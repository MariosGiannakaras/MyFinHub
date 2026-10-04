import { QA_FINANCIAL_PROVIDERS } from '../qaFinancialProviders';
import { apiRequest } from './api.js';
import { FINANCIAL_PROVIDERS, type FinancialProvider, type FinancialProviderAsset, type FinancialProviderAssetBinding, type FinancialProviderAssetRole, type FinancialProviderKind } from './financialProviders';
import { providerAssetUrlAllowed } from './providerAssetUrl';

type FinancialProviderSnapshot={loaded:boolean;loading:boolean;providers:FinancialProvider[];error:string|null};

const QA_MODE=typeof location!=='undefined'&&location.pathname.endsWith('/qa.html');
const FALLBACK=FINANCIAL_PROVIDERS.map(provider=>({...provider}));
const QA_PROVIDERS=QA_FINANCIAL_PROVIDERS.map(provider=>({...provider,assets:provider.assets?.map(asset=>({...asset})),bindings:provider.bindings?.map(binding=>({...binding}))}));
let snapshot:FinancialProviderSnapshot={loaded:QA_MODE,loading:false,providers:QA_MODE?QA_PROVIDERS:FALLBACK,error:null};
let pending:Promise<FinancialProviderSnapshot>|null=null;
const listeners=new Set<()=>void>();

const kindLabels:Record<FinancialProviderKind,string>={
  bank:'Τράπεζα',
  fintech:'Ψηφιακός πάροχος',
  wallet:'Ψηφιακό πορτοφόλι',
  payment:'Πάροχος πληρωμών',
};

function publish(next:FinancialProviderSnapshot){snapshot=next;for(const listener of listeners)listener();return snapshot}
export function getFinancialProviderSnapshot(){return snapshot}
export function subscribeFinancialProviders(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}}

function parseProvider(value:unknown):FinancialProvider|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const row=value as Record<string,unknown>;
  const id=typeof row.id==='string'?row.id.trim():'';
  const displayName=typeof row.displayName==='string'?row.displayName.trim():'';
  const shortName=typeof row.shortName==='string'?row.shortName.trim():'';
  const kind=typeof row.providerKind==='string'?row.providerKind as FinancialProviderKind:'' as FinancialProviderKind;
  const countryCode=row.countryCode===null||row.countryCode===undefined?undefined:typeof row.countryCode==='string'?row.countryCode.trim():'';
  const logoAssetKey=row.logoAssetKey===null||row.logoAssetKey===undefined?null:typeof row.logoAssetKey==='string'?row.logoAssetKey.trim():'';
  const wordmarkAssetKey=row.wordmarkAssetKey===null||row.wordmarkAssetKey===undefined?null:typeof row.wordmarkAssetKey==='string'?row.wordmarkAssetKey.trim():'';
  const logoUrl=row.logoUrl===null||row.logoUrl===undefined?null:typeof row.logoUrl==='string'?row.logoUrl.trim():'';
  const wordmarkUrl=row.wordmarkUrl===null||row.wordmarkUrl===undefined?null:typeof row.wordmarkUrl==='string'?row.wordmarkUrl.trim():'';
  const rawAssets=Array.isArray(row.assets)?row.assets:[];
  const roles:FinancialProviderAssetRole[]=['logo','wordmark','card-mark'];
  const assets:FinancialProviderAsset[]=[];
  for(const value of rawAssets){
    if(!value||typeof value!=='object'||Array.isArray(value))return null;
    const asset=value as Record<string,unknown>;
    const assetKey=typeof asset.assetKey==='string'?asset.assetKey.trim():'';
    const role=typeof asset.role==='string'?asset.role as FinancialProviderAssetRole:'' as FinancialProviderAssetRole;
    const variant=typeof asset.variant==='string'?asset.variant.trim():'';
    const url=typeof asset.url==='string'?asset.url.trim():'';
    const fileName=typeof asset.fileName==='string'?asset.fileName.trim():undefined;
    const mimeType=typeof asset.mimeType==='string'?asset.mimeType.trim():undefined;
    const sizeBytes=asset.sizeBytes===null||asset.sizeBytes===undefined?null:Number(asset.sizeBytes);
    const updatedAt=typeof asset.updatedAt==='string'?asset.updatedAt:undefined;
    if(!/^[a-z][a-z0-9-]{0,95}$/.test(assetKey)||!roles.includes(role)||!/^[a-z][a-z0-9-]{0,63}$/.test(variant)||!providerAssetUrlAllowed(url))return null;
    if(sizeBytes!==null&&(!Number.isFinite(sizeBytes)||sizeBytes<0))return null;
    assets.push({assetKey,role,variant,url,fileName,mimeType,sizeBytes,updatedAt});
  }
  const rawBindings=Array.isArray(row.bindings)?row.bindings:[];
  const bindings:FinancialProviderAssetBinding[]=[];
  for(const value of rawBindings){
    if(!value||typeof value!=='object'||Array.isArray(value))return null;
    const binding=value as Record<string,unknown>;
    const role=typeof binding.role==='string'?binding.role as FinancialProviderAssetRole:'' as FinancialProviderAssetRole;
    const variant=typeof binding.variant==='string'?binding.variant.trim():'';
    const assetKey=typeof binding.assetKey==='string'?binding.assetKey.trim():'';
    if(!roles.includes(role)||!['universal','light','dark'].includes(variant)||!/^[a-z][a-z0-9-]{0,95}$/.test(assetKey))return null;
    bindings.push({role,variant:variant as FinancialProviderAssetBinding['variant'],assetKey});
  }
  const sortOrder=Number(row.sortOrder);
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(id)||!displayName||displayName.length>120||!shortName||shortName.length>80)return null;
  if(!['bank','fintech','wallet','payment'].includes(kind)||countryCode!==undefined&&!/^[A-Z]{2}$/.test(countryCode))return null;
  if(logoAssetKey!==null&&!/^[a-z][a-z0-9-]{0,95}$/.test(logoAssetKey)||wordmarkAssetKey!==null&&!/^[a-z][a-z0-9-]{0,95}$/.test(wordmarkAssetKey)||!Number.isSafeInteger(sortOrder))return null;
  if(logoUrl!==null&&!providerAssetUrlAllowed(logoUrl)||wordmarkUrl!==null&&!providerAssetUrlAllowed(wordmarkUrl))return null;
  return {id,displayName,shortName,kind,kindLabel:kindLabels[kind],countryCode,logoAssetKey,wordmarkAssetKey,logoUrl,wordmarkUrl,assets,bindings,sortOrder};
}

async function json(response:Response){return response.json().catch(()=>null) as Promise<any>}

export async function refreshFinancialProviders(force=false){
  if(snapshot.loaded&&!force)return snapshot;
  if(pending)return pending;
  if(QA_MODE)return publish({loaded:true,loading:false,providers:QA_PROVIDERS,error:null});
  publish({...snapshot,loading:true,error:null});
  pending=(async()=>{
    try{
      const response=await apiRequest('/api/account-metadata?resource=financial-providers',{credentials:'same-origin',headers:{accept:'application/json'},cache:'no-store'});
      const payload=await json(response);
      if(!response.ok)throw new Error(payload?.message||'Δεν ήταν δυνατή η φόρτωση των τραπεζών.');
      const parsed=(Array.isArray(payload?.providers)?payload.providers:[]).map(parseProvider).filter(Boolean) as FinancialProvider[];
      if(!parsed.length)throw new Error('Η λίστα τραπεζών είναι κενή.');
      return publish({loaded:true,loading:false,providers:parsed.sort((a,b)=>a.sortOrder-b.sortOrder||a.displayName.localeCompare(b.displayName,'el')),error:null});
    }catch{
      return publish({loaded:true,loading:false,providers:FALLBACK,error:'Χρησιμοποιείται η ενσωματωμένη λίστα τραπεζών.'});
    }finally{pending=null}
  })();
  return pending;
}


export type FinancialProviderWriteInput={
  id:string;
  displayName:string;
  shortName:string;
  providerKind:FinancialProviderKind;
  countryCode?:string|null;
  sortOrder:number;
};

async function writeFinancialProvider(input:FinancialProviderWriteInput,method:'POST'|'PATCH',refreshCatalog=true){
  const response=await apiRequest('/api/account-metadata?resource=financial-providers',{
    method,
    credentials:'same-origin',
    headers:{accept:'application/json','content-type':'application/json'},
    body:JSON.stringify(input),
  });
  const payload=await json(response);
  if(!response.ok)throw new Error(payload?.error||'Δεν ήταν δυνατή η αποθήκευση της τράπεζας/παρόχου.');
  if(refreshCatalog)await refreshFinancialProviders(true);
  return payload?.provider as FinancialProvider;
}
export function saveFinancialProvider(input:FinancialProviderWriteInput,refreshCatalog=true){return writeFinancialProvider(input,'POST',refreshCatalog)}
export function updateFinancialProvider(input:FinancialProviderWriteInput,refreshCatalog=true){return writeFinancialProvider(input,'PATCH',refreshCatalog)}

export async function uploadFinancialProviderAsset(input:{
  providerId:string;
  role:FinancialProviderAssetRole;
  variant:string;
  file:File;
  makePrimary?:boolean;
  refreshCatalog?:boolean;
}){
  const params=new URLSearchParams({
    resource:'financial-provider-assets',
    providerId:input.providerId,
    role:input.role,
    variant:input.variant,
    primary:input.makePrimary?'1':'0',
    fileName:input.file.name,
  });
  const response=await apiRequest(`/api/account-metadata?${params.toString()}`,{
    method:'PUT',
    credentials:'same-origin',
    headers:{accept:'application/json','content-type':input.file.type},
    body:input.file,
  });
  const payload=await json(response);
  if(!response.ok)throw new Error(payload?.error||'Δεν ήταν δυνατή η αποθήκευση της εικόνας.');
  if(input.refreshCatalog!==false)await refreshFinancialProviders(true);
  return payload?.asset as FinancialProviderAsset;
}

export async function setFinancialProviderAssetBinding(input:{
  providerId:string;
  role:FinancialProviderAssetRole;
  variant:'universal'|'light'|'dark';
  assetKey:string|null;
  refreshCatalog?:boolean;
}){
  const response=await apiRequest('/api/account-metadata?resource=financial-provider-asset-binding',{
    method:'PUT',
    credentials:'same-origin',
    headers:{accept:'application/json','content-type':'application/json'},
    body:JSON.stringify({providerId:input.providerId,role:input.role,variant:input.variant,assetKey:input.assetKey}),
  });
  const payload=await json(response);
  if(!response.ok)throw new Error(payload?.error||'Δεν ήταν δυνατή η ανάθεση της εικόνας.');
  if(input.refreshCatalog!==false)await refreshFinancialProviders(true);
}
