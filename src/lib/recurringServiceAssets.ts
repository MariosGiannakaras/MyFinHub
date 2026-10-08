import { apiRequest } from './api.js';
import { providerAssetUrlAllowed } from './providerAssetUrl.js';

export interface RecurringServiceAsset{
  assetKey:string;
  recurringId:string;
  url:string;
  fileName:string;
  mimeType:string;
  sizeBytes:number;
  updatedAt:string;
}

function parseAsset(value:unknown):RecurringServiceAsset|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const row=value as Record<string,unknown>;
  const assetKey=typeof row.assetKey==='string'?row.assetKey.trim():'';
  const recurringId=typeof row.recurringId==='string'?row.recurringId:'';
  const url=typeof row.url==='string'?row.url.trim():'';
  const fileName=typeof row.fileName==='string'?row.fileName:'';
  const mimeType=typeof row.mimeType==='string'?row.mimeType:'';
  const sizeBytes=Number(row.sizeBytes);
  const updatedAt=typeof row.updatedAt==='string'?row.updatedAt:'';
  if(!/^service-asset-[a-f0-9]{24}$/.test(assetKey)||!recurringId||recurringId.length>200||
    !providerAssetUrlAllowed(url)||!fileName||!['image/png','image/jpeg','image/webp','image/svg+xml'].includes(mimeType)||
    !Number.isFinite(sizeBytes)||sizeBytes<=0||sizeBytes>2*1024*1024||!updatedAt)return null;
  return {assetKey,recurringId,url,fileName,mimeType,sizeBytes,updatedAt};
}

async function json(response:Response){return response.json().catch(()=>null) as Promise<any>}

export async function fetchRecurringServiceAssets(){
  const response=await apiRequest('/api/account-metadata?resource=recurring-service-assets',{
    credentials:'same-origin',headers:{accept:'application/json'},cache:'no-store',
  });
  const payload=await json(response);
  if(!response.ok)throw new Error(payload?.error||'Δεν ήταν δυνατή η φόρτωση των λογοτύπων υπηρεσιών.');
  return (Array.isArray(payload?.assets)?payload.assets:[]).map(parseAsset).filter(Boolean) as RecurringServiceAsset[];
}

export async function uploadRecurringServiceAsset(input:{recurringId:string;file:File}){
  const params=new URLSearchParams({resource:'recurring-service-assets',recurringId:input.recurringId,fileName:input.file.name});
  const response=await apiRequest(`/api/account-metadata?${params.toString()}`,{
    method:'PUT',credentials:'same-origin',
    headers:{accept:'application/json','content-type':input.file.type},
    body:input.file,
  });
  const payload=await json(response);
  if(!response.ok)throw new Error(payload?.error||'Δεν ήταν δυνατή η αποθήκευση του λογοτύπου υπηρεσίας.');
  const asset=parseAsset(payload?.asset);
  if(!asset)throw new Error('Η αποθηκευμένη εικόνα υπηρεσίας δεν είναι έγκυρη.');
  return asset;
}

export async function deleteRecurringServiceAsset(assetKey:string){
  if(!/^service-asset-[a-f0-9]{24}$/.test(assetKey))throw new Error('Μη έγκυρη αναφορά λογοτύπου υπηρεσίας.');
  const params=new URLSearchParams({resource:'recurring-service-assets',assetKey});
  const response=await apiRequest(`/api/account-metadata?${params.toString()}`,{
    method:'DELETE',credentials:'same-origin',headers:{accept:'application/json'},
  });
  const payload=await json(response);
  if(!response.ok)throw new Error(payload?.error||'Δεν ήταν δυνατή η αφαίρεση του λογοτύπου υπηρεσίας.');
}

export function recurringServiceAssetFor(assets:readonly RecurringServiceAsset[],assetKey:string|null|undefined){
  return assetKey?assets.find(asset=>asset.assetKey===assetKey)??null:null;
}
