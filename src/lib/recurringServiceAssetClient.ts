import { apiRequest } from './api.js';
import { trackDatabaseWrite } from './databaseSaveActivity.js';
import { publicAssetUrlAllowed } from './providerAssetUrl.js';
import { watchAuthScope } from './authScopedCache.js';
import { withArtworkMutationLock } from './artworkMutationLock.js';

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
const MIME_EXTENSION:Record<RecurringServiceAsset['mimeType'],string>={
  'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/svg+xml':'svg',
};
// HTTP 200 metadata is not an image registration if its public Storage path
// actually points to a different asset, bucket or binary type.
function matchesRegisteredAssetUrl(url:string,key:string,mimeType:RecurringServiceAsset['mimeType']){
  try{
    return new URL(url).pathname===
      `/storage/v1/object/public/recurring-service-assets/services/${key}.${MIME_EXTENSION[mimeType]}`;
  }catch{return false}
}
// One operator-visible uncertainty contract for both upload receipt failures.
const UNVERIFIED_UPLOAD='Η καταχώριση της εικόνας υπηρεσίας δεν επιβεβαιώθηκε. Έλεγξε την κατάσταση πριν από νέα μεταφόρτωση.';
export class UnverifiedRecurringServiceAssetWrite extends Error {
  constructor(){super(UNVERIFIED_UPLOAD);this.name='UnverifiedRecurringServiceAssetWrite'}
}
export class RecurringServiceUploadInProgress extends Error {
  constructor(){super('Η μεταφόρτωση εικόνας για αυτό το πάγιο εκκρεμεί ή δεν έχει επιβεβαιωθεί.');this.name='RecurringServiceUploadInProgress'}
}
// A lost binary-upload response may follow a committed server-generated key.
// Do not blindly replay for this recurring item within the same auth scope.
const uncertainUploads=new Set<string>();
// Shared-owner guard: a second same-tick Save must not allocate another Storage key.
const inFlightUploads=new Set<string>();
// A lost release receipt can follow a committed registry/Storage deactivation.
// No blind second DELETE for this exact key in the same owner session.
const uncertainReleases=new Set<string>();
const inFlightReleases=new Set<string>();
function unverifiedRelease(assetKey:string,requestEpoch:number):never{
  if(requestEpoch===authEpoch())uncertainReleases.add(assetKey);
  throw new Error('Η αποδέσμευση της εικόνας δεν επιβεβαιώθηκε. Έλεγξε τα δεδομένα πριν από επανάληψη.');
}
function unverifiedUpload(recurringId:string,requestEpoch:number):never{
  // A late result from a retired auth scope cannot block the new session.
  if(requestEpoch===authEpoch())uncertainUploads.add(recurringId);
  throw new UnverifiedRecurringServiceAssetWrite();
}
let snapshot:RecurringServiceAssetSnapshot={loaded:false,loading:false,assets:[],error:null};
let pending:Promise<RecurringServiceAssetSnapshot>|null=null;
const listeners=new Set<()=>void>();

function publish(next:RecurringServiceAssetSnapshot){snapshot=next;for(const listener of listeners)listener();return snapshot}
export function getRecurringServiceAssetSnapshot(){return snapshot}
export function subscribeRecurringServiceAssets(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}}
const authEpoch=watchAuthScope(()=>{
  pending=null;
  uncertainUploads.clear();
  inFlightUploads.clear();
  uncertainReleases.clear();
  inFlightReleases.clear();
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
    !matchesRegisteredAssetUrl(url,assetKey,mimeType)||
    typeof sizeBytes!=='number'||!Number.isSafeInteger(sizeBytes)||sizeBytes<1||sizeBytes>2*1024*1024||!updatedAt)return null;
  return {assetKey,recurringId,url,fileName,mimeType,sizeBytes,updatedAt};
}

async function json(response:Response){return response.json().catch(()=>null) as Promise<any>}

export async function refreshRecurringServiceAssets(force=false){
  if(snapshot.loaded&&!force)return snapshot;
  const epoch=authEpoch();
  if(pending){
    if(!force)return pending;
    await pending;
    if(epoch!==authEpoch())return snapshot;
    if(pending)return pending;
  }
  publish({...snapshot,loading:true,error:null});
  // A synchronous subscriber can retire this scope before dispatch.
  if(epoch!==authEpoch())return snapshot;
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
  const epoch=authEpoch();
  if(uncertainUploads.has(input.recurringId))throw new UnverifiedRecurringServiceAssetWrite();
  if(inFlightUploads.has(input.recurringId))throw new RecurringServiceUploadInProgress();
  inFlightUploads.add(input.recurringId);
  try{
  return await withArtworkMutationLock('recurring-upload:'+input.recurringId,epoch,
    ()=>new RecurringServiceUploadInProgress(),()=>uncertainUploads.has(input.recurringId),()=>trackDatabaseWrite(async()=>{
  const params=new URLSearchParams({resource:'recurring-service-assets',recurringId:input.recurringId,fileName:input.file.name});
  let response:Response;
  try{
    response=await apiRequest(`/api/account-metadata?${params.toString()}`,{
      method:'PUT',
      credentials:'same-origin',
      headers:{accept:'application/json','content-type':input.file.type},
      body:input.file,
    });
  }catch{
    // A lost or timed-out request can commit before its response disappears.
    return unverifiedUpload(input.recurringId,epoch);
  }
  const payload=await json(response);
  if(epoch!==authEpoch())return unverifiedUpload(input.recurringId,epoch);
  if(!response.ok){
    if(response.status===408||response.status===429||response.status>=500)
      return unverifiedUpload(input.recurringId,epoch);
    throw new Error(payload?.error||'Δεν ήταν δυνατή η αποθήκευση του λογοτύπου.');
  }
  const asset=parseRecurringServiceAsset(payload?.asset);
  // A 200 receipt must describe exactly this binary and recurring item,
  // never a different key, file, MIME or byte count.
  if(!asset||asset.recurringId!==input.recurringId||
    asset.fileName!==input.file.name||asset.mimeType!==input.file.type||
    asset.sizeBytes!==input.file.size)
    return unverifiedUpload(input.recurringId,epoch);
  // Storage, registration and the finance revision are separate writes.
  // Confirm one fresh registered catalog GET before returning a key that the
  // caller will attach to the canonical finance state. Never replay the PUT.
  try{
    const confirmed=await refreshRecurringServiceAssets(true);
    const registered=confirmed.assets.find(row=>row.assetKey===asset.assetKey);
    if(epoch!==authEpoch()||confirmed.error||!registered||registered.recurringId!==asset.recurringId||
      registered.fileName!==asset.fileName||registered.mimeType!==asset.mimeType||
      registered.sizeBytes!==asset.sizeBytes||registered.url!==asset.url)
      return unverifiedUpload(input.recurringId,epoch);
    return registered;
  }catch{
    return unverifiedUpload(input.recurringId,epoch);
  }
  }));
  }finally{
    // Old-session completions cannot release a new session's in-flight slot.
    if(epoch===authEpoch())inFlightUploads.delete(input.recurringId);
  }
}

export async function deleteRecurringServiceAsset(assetKey:string){
  if(!/^service-asset-[a-f0-9]{24}$/.test(assetKey))throw new Error('Μη έγκυρη αναφορά λογοτύπου υπηρεσίας.');
  const epoch=authEpoch();
  if(uncertainReleases.has(assetKey))return unverifiedRelease(assetKey,epoch);
  if(inFlightReleases.has(assetKey))
    throw new Error('Η αποδέσμευση της εικόνας βρίσκεται ήδη σε εξέλιξη.');
  inFlightReleases.add(assetKey);
  try{
    return await withArtworkMutationLock('recurring-release:'+assetKey,epoch,
      ()=>new Error('Η αποδέσμευση της εικόνας εκκρεμεί ή δεν έχει επιβεβαιωθεί.'),
      ()=>uncertainReleases.has(assetKey),()=>trackDatabaseWrite(async()=>{
      const params=new URLSearchParams({resource:'recurring-service-assets',assetKey});
      let response:Response|null=null;
      try{
        response=await apiRequest(`/api/account-metadata?${params.toString()}`,{
          method:'DELETE',
          credentials:'same-origin',
          headers:{accept:'application/json'},
        });
      }catch{
        // Transport loss does not prove that the release RPC was skipped.
      }
      const payload=response?await json(response):null;
      if(epoch!==authEpoch())return unverifiedRelease(assetKey,epoch);
      if(!response||response.status===408||response.status===429||response.status>=500)
        return unverifiedRelease(assetKey,epoch);
      if(!response.ok)
        throw new Error(payload?.error||'Δεν ήταν δυνατή η αφαίρεση του λογοτύπου.');
      if(payload?.ok!==true)return unverifiedRelease(assetKey,epoch);
      // Only the server's explicit OK means it completed Storage deletion
      // and exact-row purge. The public catalog lists active rows only:
      // absence alone cannot prove purge after an ambiguous DELETE (the
      // release RPC may have deactivated a row before Storage failed).
      // On confirmed OK we still require a fresh catalog absence check.
      try{
        const confirmed=await refreshRecurringServiceAssets(true);
        if(epoch!==authEpoch()||confirmed.error||confirmed.assets.some(asset=>asset.assetKey===assetKey))
          return unverifiedRelease(assetKey,epoch);
        uncertainReleases.delete(assetKey);
      }catch{
        return unverifiedRelease(assetKey,epoch);
      }
    }));
  }finally{
    // Retired-session completions must never unlock a new session's request.
    if(epoch===authEpoch())inFlightReleases.delete(assetKey);
  }
}

export function recurringServiceAssetByKey(assetKey:string|null|undefined){
  if(!assetKey)return null;
  return snapshot.assets.find(asset=>asset.assetKey===assetKey)??null;
}
