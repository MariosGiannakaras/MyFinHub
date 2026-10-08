import { apiRequest } from './api.js';
import { publicAssetUrlAllowed } from './providerAssetUrl.js';

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
let snapshot:RecurringServiceAssetSnapshot={loaded:false,loading:false,assets:[],error:null};
let pending:Promise<RecurringServiceAssetSnapshot>|null=null;
const listeners=new Set<()=>void>();

function publish(next:RecurringServiceAssetSnapshot){snapshot=next;for(const listener of listeners)listener();return snapshot}
export function getRecurringServiceAssetSnapshot(){return snapshot}
export function subscribeRecurringServiceAssets(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}}

export function parseRecurringServiceAsset(value:unknown):RecurringServiceAsset|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const row=value as Record<string,unknown>;
  const assetKey=typeof row.assetKey==='string'?row.assetKey.trim():'';
  const recurringId=typeof row.recurringId==='string'?row.recurringId.trim():'';
  const url=typeof row.url==='string'?row.url.trim():'';
  const fileName=typeof row.fileName==='string'?row.fileName.trim():'';
  const mimeType=typeof row.mimeType==='string'?row.mimeType.trim() as RecurringServiceAsset['mimeType']:'' as RecurringServiceAsset['mimeType'];
  const sizeBytes=Number(row.sizeBytes);
  const updatedAt=typeof row.updatedAt==='string'?row.updatedAt.trim():'';
  if(!/^service-asset-[a-f0-9]{24}$/.test(assetKey)||!recurringId||recurringId.length>200||/[\u0000-\u001f\u007f]/.test(recurringId)||
    !publicAssetUrlAllowed(url)||!fileName||fileName.length>160||!MIME_TYPES.has(mimeType)||
    !Number.isSafeInteger(sizeBytes)||sizeBytes<1||sizeBytes>2*1024*1024||!updatedAt)return null;
  return {assetKey,recurringId,url,fileName,mimeType,sizeBytes,updatedAt};
}

async function json(response:Response){return response.json().catch(()=>null) as Promise<any>}

export async function refreshRecurringServiceAssets(force=false){
  if(snapshot.loaded&&!force)return snapshot;
  if(pending)return pending;
  publish({...snapshot,loading:true,error:null});
  pending=(async()=>{
    try{
      const response=await apiRequest('/api/account-metadata?resource=recurring-service-assets',{credentials:'same-origin',headers:{accept:'application/json'},cache:'no-store'});
      const payload=await json(response);
      if(!response.ok)throw new Error(payload?.error||'Δεν ήταν δυνατή η φόρτωση των λογοτύπων υπηρεσιών.');
      const assets=(Array.isArray(payload?.assets)?payload.assets:[]).map(parseRecurringServiceAsset).filter(Boolean) as RecurringServiceAsset[];
      return publish({loaded:true,loading:false,assets,error:null});
    }catch{
      return publish({loaded:true,loading:false,assets:[],error:'Δεν ήταν δυνατή η φόρτωση των λογοτύπων υπηρεσιών.'});
    }finally{pending=null}
  })();
  return pending;
}

export async function uploadRecurringServiceAsset(input:{recurringId:string;file:File}){
  const params=new URLSearchParams({resource:'recurring-service-assets',recurringId:input.recurringId,fileName:input.file.name});
  const response=await apiRequest(`/api/account-metadata?${params.toString()}`,{
    method:'PUT',
    credentials:'same-origin',
    headers:{accept:'application/json','content-type':input.file.type},
    body:input.file,
  });
  const payload=await json(response);
  if(!response.ok)throw new Error(payload?.error||'Δεν ήταν δυνατή η αποθήκευση του λογοτύπου.');
  const asset=parseRecurringServiceAsset(payload?.asset);
  if(!asset)throw new Error('Η αποθηκευμένη εικόνα υπηρεσίας δεν ήταν έγκυρη.');
  const assets=[asset,...snapshot.assets.filter(item=>item.assetKey!==asset.assetKey)];
  publish({loaded:true,loading:false,assets,error:null});
  return asset;
}

export async function deleteRecurringServiceAsset(assetKey:string){
  if(!/^service-asset-[a-f0-9]{24}$/.test(assetKey))throw new Error('Μη έγκυρη αναφορά λογοτύπου υπηρεσίας.');
  const params=new URLSearchParams({resource:'recurring-service-assets',assetKey});
  const response=await apiRequest(`/api/account-metadata?${params.toString()}`,{
    method:'DELETE',
    credentials:'same-origin',
    headers:{accept:'application/json'},
  });
  const payload=await json(response);
  if(!response.ok)throw new Error(payload?.error||'Δεν ήταν δυνατή η αφαίρεση του λογοτύπου.');
  publish({...snapshot,assets:snapshot.assets.filter(item=>item.assetKey!==assetKey),error:null});
}

export function recurringServiceAssetByKey(assetKey:string|null|undefined){
  if(!assetKey)return null;
  return snapshot.assets.find(asset=>asset.assetKey===assetKey)??null;
}
