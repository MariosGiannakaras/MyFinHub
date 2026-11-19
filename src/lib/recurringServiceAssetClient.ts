import { apiRequest } from './api.js';
import { trackDatabaseWrite } from './databaseSaveActivity.js';
import { publicAssetUrlAllowed } from './providerAssetUrl.js';
import { watchAuthScope } from './authScopedCache.js';

export interface RecurringServiceAsset{
  assetKey:string;
  recurringId:string;
  url:string;
  fileName:string;
  mimeType:'image/png'|'image/jpeg'|'image/webp'|'image/svg+xml';
  sizeBytes:number;
  updatedAt:string;
}

type RecurringServiceAssetSnapshot={loaded:boolean;loading:boolean;assets:RecurringServiceAsset[];error:string|null};

const MIME_TYPES=new Set<RecurringServiceAsset['mimeType']>(['image/png','image/jpeg','image/webp','image/svg+xml']);
// One operator-visible uncertainty contract for both upload receipt failures.
const UNVERIFIED_UPLOAD='Η καταχώριση της εικόνας υπηρεσίας δεν επιβεβαιώθηκε. Έλεγξε την κατάσταση πριν από νέα μεταφόρτωση.';
let snapshot:RecurringServiceAssetSnapshot={loaded:false,loading:false,assets:[],error:null};
let pending:Promise<RecurringServiceAssetSnapshot>|null=null;
const listeners=new Set<()=>void>();

function publish(next:RecurringServiceAssetSnapshot){snapshot=next;for(const listener of listeners)listener();return snapshot}
export function getRecurringServiceAssetSnapshot(){return snapshot}
export function subscribeRecurringServiceAssets(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}}
const authEpoch=watchAuthScope(()=>{
  pending=null;
  publish({loaded:false,loading:false,assets:[],error:null});
});

export function parseRecurringServiceAsset(value:unknown):RecurringServiceAsset|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const row=value as Record<string,unknown>;
  const assetKey=typeof row.assetKey==='string'?row.assetKey.trim():'';
  const recurringId=typeof row.recurringId==='string'?row.recurringId.trim():'';
  const url=typeof row.url==='string'?row.url.trim():'';
  const fileName=typeof row.fileName==='string'?row.fileName.trim():'';
  const mimeType=typeof row.mimeType==='string'?row.mimeType.trim() as RecurringServiceAsset['mimeType']:'' as RecurringServiceAsset['mimeType'];
  const sizeBytes=row.sizeBytes;
  const updatedAt=typeof row.updatedAt==='string'?row.updatedAt.trim():'';
  if(!/^service-asset-[a-f0-9]{24}$/.test(assetKey)||!recurringId||recurringId.length>200||/[\u0000-\u001f\u007f]/.test(recurringId)||
    !publicAssetUrlAllowed(url)||!fileName||fileName.length>160||!MIME_TYPES.has(mimeType)||
    typeof sizeBytes!=='number'||!Number.isSafeInteger(sizeBytes)||sizeBytes<1||sizeBytes>2*1024*1024||!updatedAt)return null;
  return {assetKey,recurringId,url,fileName,mimeType,sizeBytes,updatedAt};
}

async function json(response:Response){return response.json().catch(()=>null) as Promise<any>}

export async function refreshRecurringServiceAssets(force=false){
  if(snapshot.loaded&&!force)return snapshot;
  if(pending)return pending;
  const epoch=authEpoch();
  publish({...snapshot,loading:true,error:null});
  pending=(async()=>{
    try{
      const response=await apiRequest('/api/account-metadata?resource=recurring-service-assets',{credentials:'same-origin',headers:{accept:'application/json'},cache:'no-store'});
      const payload=await json(response);
      if(epoch!==authEpoch())return snapshot;
      if(!response.ok)throw new Error(payload?.error||'Δεν ήταν δυνατή η φόρτωση των λογοτύπων υπηρεσιών.');
      if(!Array.isArray(payload?.assets))
        throw new Error('Η λίστα εικόνων υπηρεσιών δεν επιβεβαιώθηκε.');
      const parsed=payload.assets.map(parseRecurringServiceAsset) as Array<RecurringServiceAsset|null>;
      if(parsed.some(asset=>asset===null))
        throw new Error('Η λίστα εικόνων υπηρεσιών δεν επιβεβαιώθηκε.');
      const assets=parsed as RecurringServiceAsset[];
      if(new Set(assets.map(asset=>asset.assetKey)).size!==assets.length)
        throw new Error('Η λίστα εικόνων υπηρεσιών έχει διπλές καταχωρίσεις.');
      return publish({loaded:true,loading:false,assets,error:null});
    }catch{
      if(epoch!==authEpoch())return snapshot;
      return publish({loaded:true,loading:false,assets:[],error:'Δεν ήταν δυνατή η φόρτωση των λογοτύπων υπηρεσιών.'});
    }finally{if(epoch===authEpoch())pending=null}
  })();
  return pending;
}

export async function uploadRecurringServiceAsset(input:{recurringId:string;file:File}){
  return trackDatabaseWrite(async()=>{
  const epoch=authEpoch();
  const params=new URLSearchParams({resource:'recurring-service-assets',recurringId:input.recurringId,fileName:input.file.name});
  const response=await apiRequest(`/api/account-metadata?${params.toString()}`,{
    method:'PUT',
    credentials:'same-origin',
    headers:{accept:'application/json','content-type':input.file.type},
    body:input.file,
  });
  const payload=await json(response);
  if(epoch!==authEpoch())throw new Error('Η συνεδρία άλλαξε πριν επιβεβαιωθεί η καταχώριση εικόνας.');
  if(!response.ok)throw new Error(payload?.error||'Δεν ήταν δυνατή η αποθήκευση του λογοτύπου.');
  const asset=parseRecurringServiceAsset(payload?.asset);
  // A 200 receipt must describe exactly this binary and recurring item,
  // never a different key, file, MIME or byte count.
  if(!asset||asset.recurringId!==input.recurringId||
    asset.fileName!==input.file.name||asset.mimeType!==input.file.type||
    asset.sizeBytes!==input.file.size)
    throw new Error(UNVERIFIED_UPLOAD);
  // Storage, registration and the finance revision are separate writes.
  // Confirm one fresh registered catalog GET before returning a key that the
  // caller will attach to the canonical finance state. Never replay the PUT.
  if(pending)await pending;
  const confirmed=await refreshRecurringServiceAssets(true);
  const registered=confirmed.assets.find(row=>row.assetKey===asset.assetKey);
  if(epoch!==authEpoch()||confirmed.error||!registered||registered.recurringId!==asset.recurringId||
    registered.fileName!==asset.fileName||registered.mimeType!==asset.mimeType||
    registered.sizeBytes!==asset.sizeBytes||registered.url!==asset.url)
    throw new Error(UNVERIFIED_UPLOAD);
  return registered;
  });
}

export async function deleteRecurringServiceAsset(assetKey:string){
  if(!/^service-asset-[a-f0-9]{24}$/.test(assetKey))throw new Error('Μη έγκυρη αναφορά λογοτύπου υπηρεσίας.');
  return trackDatabaseWrite(async()=>{
  const epoch=authEpoch();
  const params=new URLSearchParams({resource:'recurring-service-assets',assetKey});
  const response=await apiRequest(`/api/account-metadata?${params.toString()}`,{
    method:'DELETE',
    credentials:'same-origin',
    headers:{accept:'application/json'},
  });
  const payload=await json(response);
  if(epoch!==authEpoch())throw new Error('Η συνεδρία άλλαξε πριν επιβεβαιωθεί η αποδέσμευση εικόνας.');
  if(!response.ok)throw new Error(payload?.error||'Δεν ήταν δυνατή η αφαίρεση του λογοτύπου.');
  if(payload?.ok!==true)
    throw new Error('Η αποδέσμευση της εικόνας δεν επιβεβαιώθηκε.');
  // A release/Storage purge can complete while the final response is stale.
  // Confirm the asset is absent via a fresh owner-scoped catalog GET, without
  // issuing another destructive DELETE after an ambiguous acknowledgement.
  if(pending)await pending;
  const confirmed=await refreshRecurringServiceAssets(true);
  if(epoch!==authEpoch()||confirmed.error||confirmed.assets.some(asset=>asset.assetKey===assetKey))
    throw new Error('Η αποδέσμευση της εικόνας δεν επιβεβαιώθηκε. Έλεγξε τα δεδομένα πριν από επανάληψη.');
  });
}

export function recurringServiceAssetByKey(assetKey:string|null|undefined){
  if(!assetKey)return null;
  return snapshot.assets.find(asset=>asset.assetKey===assetKey)??null;
}
