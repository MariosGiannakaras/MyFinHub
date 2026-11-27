import { QA_FINANCIAL_PROVIDERS } from '../qaFinancialProviders.js';
import { apiRequest } from './api.js';
import { trackDatabaseWrite } from './databaseSaveActivity.js';
import { FINANCIAL_PROVIDERS, type FinancialProvider, type FinancialProviderAsset, type FinancialProviderAssetBinding, type FinancialProviderAssetRole, type FinancialProviderKind } from './financialProviders.js';
import { providerAssetUrlAllowed } from './providerAssetUrl.js';
import { watchAuthScope } from './authScopedCache.js';
import { withArtworkMutationLock } from './artworkMutationLock.js';

type FinancialProviderSnapshot={loaded:boolean;loading:boolean;providers:FinancialProvider[];error:string|null};

const QA_MODE=typeof location!=='undefined'&&location.pathname.endsWith('/qa.html');
// An opt-in synthetic QA-only failed catalog lets rendered QA exercise
// fail-closed editing and read-only recovery without changing production fetches.
const QA_CATALOG_FAILURE=QA_MODE&&new URLSearchParams(location.search).has('qaProviderCatalogFallback');
const FALLBACK=FINANCIAL_PROVIDERS.map(provider=>({...provider}));
const QA_PROVIDERS=QA_FINANCIAL_PROVIDERS.map(provider=>({...provider,assets:provider.assets?.map(asset=>({...asset})),bindings:provider.bindings?.map(binding=>({...binding}))}));
let snapshot:FinancialProviderSnapshot={
  loaded:QA_MODE,loading:false,
  providers:QA_CATALOG_FAILURE?FALLBACK:QA_MODE?QA_PROVIDERS:FALLBACK,
  error:QA_CATALOG_FAILURE?'Συνθετική QA αποτυχία ανάγνωσης καταλόγου παρόχων.':null,
};
let pending:Promise<FinancialProviderSnapshot>|null=null;
// A binary upload allocates a new key; never dispatch twice to one provider slot.
const inFlightAssetUploads=new Set<string>();
// A lost new-key upload receipt may follow a committed Storage registration.
// Closing/reopening the editor is not a rollback; block blind same-slot
// re-uploads until a genuinely new authentication scope begins.
const uncertainAssetUploads=new Set<string>();
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
const authEpoch=watchAuthScope(()=>{
  pending=null;
  inFlightAssetUploads.clear();
  uncertainAssetUploads.clear();
  publish({loaded:false,loading:false,providers:FALLBACK,error:null});
});

function parseProvider(value:unknown,requireCollections=false):FinancialProvider|null{
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
  // Explicitly malformed HTTP-200 collections are not an empty catalog.
  // In particular, do not turn missing read-back evidence into a verified save.
  if((requireCollections||row.assets!==undefined)&&!Array.isArray(row.assets))return null;
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
    const sizeBytes=asset.sizeBytes===null||asset.sizeBytes===undefined?null:asset.sizeBytes;
    const updatedAt=typeof asset.updatedAt==='string'?asset.updatedAt:undefined;
    if(!/^[a-z][a-z0-9-]{0,95}$/.test(assetKey)||!roles.includes(role)||!/^[a-z][a-z0-9-]{0,63}$/.test(variant)||!providerAssetUrlAllowed(url))return null;
    if(sizeBytes!==null&&(!Number.isSafeInteger(sizeBytes)||typeof sizeBytes!=='number'||sizeBytes<0))return null;
    assets.push({assetKey,role,variant,url,fileName,mimeType,sizeBytes,updatedAt});
  }
  // An asset key identifies one registration, not multiple variants.
  // Ambiguous HTTP-200 readback must not be interpreted as verified.
  if(new Set(assets.map(asset=>asset.assetKey)).size!==assets.length)return null;
  if((requireCollections||row.bindings!==undefined)&&!Array.isArray(row.bindings))return null;
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
  // One assignment per (provider, role, variant); do not choose an arbitrary match.
  if(new Set(bindings.map(binding=>binding.role+':'+binding.variant)).size!==bindings.length)return null;
  // Require registration of each referenced image in this provider's catalog.
  // A single registered binary may legitimately be assigned to logo, wordmark
  // and card slots; its upload role is not the role of every later binding.
  const ownedAssetKeys=new Set(assets.map(asset=>asset.assetKey));
  if(bindings.some(binding=>!ownedAssetKeys.has(binding.assetKey)))return null;
  if(logoAssetKey!==null&&!ownedAssetKeys.has(logoAssetKey))return null;
  if(wordmarkAssetKey!==null&&!ownedAssetKeys.has(wordmarkAssetKey))return null;
  const sortOrder=row.sortOrder;
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(id)||!displayName||displayName.length>120||!shortName||shortName.length>80)return null;
  if(!['bank','fintech','wallet','payment'].includes(kind)||countryCode!==undefined&&!/^[A-Z]{2}$/.test(countryCode))return null;
  if(logoAssetKey!==null&&!/^[a-z][a-z0-9-]{0,95}$/.test(logoAssetKey)||wordmarkAssetKey!==null&&!/^[a-z][a-z0-9-]{0,95}$/.test(wordmarkAssetKey)||typeof sortOrder!=='number'||!Number.isSafeInteger(sortOrder)||sortOrder<0||sortOrder>100000)return null;
  if(logoUrl!==null&&!providerAssetUrlAllowed(logoUrl)||wordmarkUrl!==null&&!providerAssetUrlAllowed(wordmarkUrl))return null;
  return {id,displayName,shortName,kind,kindLabel:kindLabels[kind],countryCode,logoAssetKey,wordmarkAssetKey,logoUrl,wordmarkUrl,assets,bindings,sortOrder};
}

async function json(response:Response){return response.json().catch(()=>null) as Promise<any>}

export async function refreshFinancialProviders(force=false){
  if(snapshot.loaded&&!force)return snapshot;
  const epoch=authEpoch();
  if(pending){
    if(!force)return pending;
    await pending;
    if(epoch!==authEpoch())return snapshot;
    // Post-write readback must not reuse a GET started before the write.
    if(pending)return pending;
  }
  if(QA_MODE)return publish({loaded:true,loading:false,providers:QA_PROVIDERS,error:null});
  publish({...snapshot,loading:true,error:null});
  // A synchronous subscriber can retire this scope before dispatch.
  if(epoch!==authEpoch())return snapshot;
  pending=(async()=>{
    try{
      const response=await apiRequest('/api/account-metadata?resource=financial-providers',{credentials:'same-origin',headers:{accept:'application/json'},cache:'no-store'});
      const payload=await json(response);
      if(epoch!==authEpoch())return snapshot;
      if(!response.ok)throw new Error(payload?.message||'Δεν ήταν δυνατή η φόρτωση των τραπεζών.');
      const rows:unknown[]|null=Array.isArray(payload?.providers)?payload.providers:null;
      if(!rows?.length)throw new Error('Η λίστα τραπεζών είναι κενή.');
      // The catalog API always returns both collections. Missing keys are
      // incomplete read-back evidence, even when the intended slots are empty.
      const parsed=rows.map(row=>parseProvider(row,true));
      // A malformed or duplicate provider must not silently disappear from a
      // supposedly complete post-write catalog. Keep the fallback explicitly
      // unverified so the editor cannot mistake partial data for a clean read.
      if(parsed.some(item=>!item)||new Set(parsed.map(item=>item?.id)).size!==parsed.length)
        throw new Error('Η λίστα παρόχων δεν επιβεβαιώθηκε πλήρως.');
      const providers=parsed as FinancialProvider[];
      return publish({loaded:true,loading:false,providers:providers.sort((a,b)=>a.sortOrder-b.sortOrder||a.displayName.localeCompare(b.displayName,'el')),error:null});
    }catch{
      if(epoch!==authEpoch())return snapshot;
      return publish({loaded:true,loading:false,providers:FALLBACK,error:'Χρησιμοποιείται η ενσωματωμένη λίστα τραπεζών.'});
    }finally{if(epoch===authEpoch())pending=null}
  })();
  return pending;
}


export class FinancialProviderAssetUploadInProgress extends Error{
  constructor(){super('Η μεταφόρτωση εικόνας για αυτή τη θέση εκκρεμεί ή δεν έχει επιβεβαιωθεί.');this.name='FinancialProviderAssetUploadInProgress'}
}

export class UnverifiedFinancialProviderWrite extends Error{
  constructor(public readonly operation:'metadata'|'asset'|'binding'){
    super(operation==='metadata'
      ?'Η αποθήκευση του παρόχου δεν επιβεβαιώθηκε· τα στοιχεία μπορεί ήδη να έχουν καταχωριστεί.'
      :operation==='asset'
        ?'Η απόκριση μεταφόρτωσης εικόνας δεν επιβεβαιώθηκε· το αρχείο μπορεί ήδη να έχει καταχωριστεί.'
        :'Η απόκριση ανάθεσης εικόνας δεν επιβεβαιώθηκε· η ανάθεση μπορεί ήδη να έχει αποθηκευτεί.');
    this.name='UnverifiedFinancialProviderWrite';
  }
}

// Mark uncertainty only for the session which originated the Storage PUT.
// A late retired-session response must not poison the new owner's slot.
function unverifiedAssetUpload(slot:string,requestEpoch:number):never{
  if(requestEpoch===authEpoch())uncertainAssetUploads.add(slot);
  throw new UnverifiedFinancialProviderWrite('asset');
}

// Server-generated assets use a canonical immutable owner directory, key and
// extension. Do not require this layout for curated legacy provider artwork.
const PROVIDER_ASSET_EXTENSION:Record<string,string>={
  'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/svg+xml':'svg',
};
function providerUploadedAssetUrlMatches(url:string,providerId:string,assetKey:string,mimeType:string){
  const extension=PROVIDER_ASSET_EXTENSION[mimeType];
  if(!extension||!providerAssetUrlAllowed(url))return false;
  try{
    return new URL(url).pathname===
      `/storage/v1/object/public/financial-provider-assets/providers/${providerId}/${assetKey}.${extension}`;
  }catch{return false}
}

function confirmedUploadedAsset(value:unknown,input:{
  providerId:string;role:FinancialProviderAssetRole;variant:string;file:File;
}):FinancialProviderAsset|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const asset=value as Record<string,unknown>;
  const prefix=`${input.providerId}-asset-`;
  const key=typeof asset.assetKey==='string'?asset.assetKey:'';
  if(!key.startsWith(prefix)||!/^[a-f0-9]{12}$/.test(key.slice(prefix.length))||
    asset.role!==input.role||asset.variant!==input.variant||
    asset.fileName!==input.file.name||asset.mimeType!==input.file.type||
    asset.sizeBytes!==input.file.size||
    typeof asset.url!=='string'||
    !providerUploadedAssetUrlMatches(asset.url,input.providerId,key,input.file.type))return null;
  return value as FinancialProviderAsset;
}

export type FinancialProviderWriteInput={
  id:string;
  displayName:string;
  shortName:string;
  providerKind:FinancialProviderKind;
  countryCode?:string|null;
  sortOrder:number;
};

// A successful GET is not a durable receipt for the preceding independent
// metadata, Storage and binding writes unless the actual returned provider
// matches every acknowledged value. This helper deliberately performs no writes.
// Reuse exact acknowledged metadata on image-only retry, not a duplicate RPC.
export function providerMetadataMatchesInput(
  acknowledged:FinancialProviderWriteInput|null|undefined,
  requested:FinancialProviderWriteInput,
):boolean{
  return Boolean(acknowledged&&acknowledged.id===requested.id&&
    acknowledged.displayName.trim()===requested.displayName.trim()&&
    acknowledged.shortName.trim()===requested.shortName.trim()&&
    acknowledged.providerKind===requested.providerKind&&
    (acknowledged.countryCode?.trim().toUpperCase()||'')===(requested.countryCode?.trim().toUpperCase()||'')&&
    acknowledged.sortOrder===requested.sortOrder);
}

export type FinancialProviderReadbackSlot={
  role:FinancialProviderAssetRole;
  variant:'universal'|'light'|'dark';
  assetKey:string|null;
};
export type FinancialProviderReadbackUpload={
  assetKey:string;
  role:FinancialProviderAssetRole;
  variant:'universal'|'light'|'dark';
  fileName:string;
  mimeType:string;
  sizeBytes:number;
};
export function providerCatalogMatchesWrite(
  catalog:FinancialProviderSnapshot,
  input:FinancialProviderWriteInput,
  slots:FinancialProviderReadbackSlot[],
  uploadedKeys:string[],
  expectedUploads?:FinancialProviderReadbackUpload[],
):boolean{
  if(!catalog.loaded||catalog.error)return false;
  const provider=catalog.providers.find(item=>item.id===input.id);
  if(!provider||
    provider.displayName!==input.displayName.trim()||
    provider.shortName!==input.shortName.trim()||
    provider.kind!==input.providerKind||
    (provider.countryCode??'')!==(input.countryCode?.trim().toUpperCase()||'')||
    provider.sortOrder!==input.sortOrder)return false;

  const assets=new Set((provider.assets??[]).map(asset=>asset.assetKey));
  if(uploadedKeys.some(key=>!assets.has(key)))return false;
  // A matching Storage/DB key alone does not prove the catalog registered
  // the actual uploaded binary. Check independent role, variant and bytes.
  if(expectedUploads){
    // Equal counts are not evidence of the exact uploaded objects. Reject a
    // foreign/stale expected key even when both keys exist in this catalog.
    const uploadedKeySet=new Set(uploadedKeys);
    if(expectedUploads.length!==uploadedKeys.length||
      uploadedKeySet.size!==uploadedKeys.length||
      new Set(expectedUploads.map(upload=>upload.assetKey)).size!==uploadedKeys.length||
      expectedUploads.some(upload=>!uploadedKeySet.has(upload.assetKey)))return false;
    if(expectedUploads.some(expected=>{
      if(!assets.has(expected.assetKey))return true;
      const actual=provider.assets?.find(asset=>asset.assetKey===expected.assetKey);
      return !actual||actual.role!==expected.role||actual.variant!==expected.variant||
        actual.fileName!==expected.fileName||actual.mimeType!==expected.mimeType||
        actual.sizeBytes!==expected.sizeBytes||
        !providerUploadedAssetUrlMatches(actual.url,input.id,expected.assetKey,expected.mimeType);
    }))return false;
  }
  return slots.every(slot=>{
    if(slot.assetKey&&!assets.has(slot.assetKey))return false;
    const binding=provider.bindings?.find(item=>item.role===slot.role&&item.variant===slot.variant);
    let committedKey:string|null=binding?.assetKey??null;
    if(!binding&&slot.variant==='universal'){
      const legacyKey=slot.role==='logo'?provider.logoAssetKey:
        slot.role==='wordmark'?provider.wordmarkAssetKey:null;
      if(legacyKey&&assets.has(legacyKey))committedKey=legacyKey;
    }
    return committedKey===slot.assetKey;
  });
}

async function writeFinancialProvider(input:FinancialProviderWriteInput,method:'POST'|'PATCH',refreshCatalog=true){
  return trackDatabaseWrite(async()=>{
  const requestEpoch=authEpoch();
  let response:Response;
  try{
    response=await apiRequest('/api/account-metadata?resource=financial-providers',{
      method,
      credentials:'same-origin',
      headers:{accept:'application/json','content-type':'application/json'},
      body:JSON.stringify(input),
    });
  }catch{
    // A dropped POST/PATCH response is not proof of rollback. Never replay
    // metadata blindly before reconciling the actual provider catalog.
    throw new UnverifiedFinancialProviderWrite('metadata');
  }
  const payload=await json(response);
  // The old owner session may have committed before logout/reverification.
  // Its late receipt is never proof of a write in the new auth scope.
  if(requestEpoch!==authEpoch())throw new UnverifiedFinancialProviderWrite('metadata');
  if(!response.ok){
    if(response.status===408||response.status===429||response.status>=500)
      throw new UnverifiedFinancialProviderWrite('metadata');
    throw new Error(payload?.error||'Δεν ήταν δυνατή η αποθήκευση της τράπεζας/παρόχου.');
  }
  // Metadata and its optional asset writes can commit independently. An HTTP
  // 200 with an absent/mismatched provider receipt is NOT proof that the
  // requested metadata was saved. Never let the editor show an all-green save.
  const acknowledged=parseProvider(payload?.provider);
  if(!acknowledged||
    acknowledged.id!==input.id||
    acknowledged.displayName!==input.displayName.trim()||
    acknowledged.shortName!==input.shortName.trim()||
    acknowledged.kind!==input.providerKind||
    (acknowledged.countryCode??'')!==(input.countryCode?.trim().toUpperCase()||'')||
    acknowledged.sortOrder!==input.sortOrder)
    // Even HTTP 200 can conceal a committed POST/PATCH when its receipt is
    // malformed. Treat it as uncertain, never as safe for blind new-key POST.
    throw new UnverifiedFinancialProviderWrite('metadata');
  if(refreshCatalog){
    await refreshFinancialProviders(true);
    if(requestEpoch!==authEpoch())throw new UnverifiedFinancialProviderWrite('metadata');
  }
  return acknowledged;
  });
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
  const requestEpoch=authEpoch();
  const uploadSlot=JSON.stringify([input.providerId,input.role,input.variant]);
  if(uncertainAssetUploads.has(uploadSlot))throw new UnverifiedFinancialProviderWrite('asset');
  if(inFlightAssetUploads.has(uploadSlot))throw new FinancialProviderAssetUploadInProgress();
  inFlightAssetUploads.add(uploadSlot);
  try{
  return await withArtworkMutationLock('provider:'+uploadSlot,requestEpoch,
    ()=>new FinancialProviderAssetUploadInProgress(),()=>uncertainAssetUploads.has(uploadSlot),()=>trackDatabaseWrite(async()=>{
  const params=new URLSearchParams({
    resource:'financial-provider-assets',
    providerId:input.providerId,
    role:input.role,
    variant:input.variant,
    primary:input.makePrimary?'1':'0',
    fileName:input.file.name,
  });
  const intentId=globalThis.crypto?.randomUUID?.();
  if(intentId)params.set('intentId',intentId);
  let response:Response;
  try{
    response=await apiRequest(`/api/account-metadata?${params.toString()}`,{
      method:'PUT',
      credentials:'same-origin',
      headers:{accept:'application/json','content-type':input.file.type},
      body:input.file,
    });
  }catch{
    // A dropped connection does not prove the one-time server-generated asset
    // was rolled back. Do not create a new key by blindly retrying this upload.
    return unverifiedAssetUpload(uploadSlot,requestEpoch);
  }
  const payload=await json(response);
  if(requestEpoch!==authEpoch())return unverifiedAssetUpload(uploadSlot,requestEpoch);
  if(!response.ok){
    // A timeout/rate limit or upstream 5xx may arrive after Storage/DB commit.
    // Only explicit validation/auth rejections are safe to treat as definite.
    if(response.status===408||response.status===429||response.status>=500)
      return unverifiedAssetUpload(uploadSlot,requestEpoch);
    throw new Error(payload?.error||'Δεν ήταν δυνατή η αποθήκευση της εικόνας.');
  }
  // A successful status without an exact receipt does not prove registration.
  // Never replay a new-key Storage upload while the outcome is uncertain.
  const asset=confirmedUploadedAsset(payload?.asset,input);
  if(!asset)return unverifiedAssetUpload(uploadSlot,requestEpoch);
  // New-protocol acknowledgement releases the durable slot. Require an
  // independent current catalog match even when the editor defers its final
  // aggregate metadata/binding readback. Older deployed APIs omit the echo.
  const journaled=payload?.intentId!==undefined;
  if(journaled&&(!intentId||payload.intentId!==intentId))return unverifiedAssetUpload(uploadSlot,requestEpoch);
  if(input.refreshCatalog!==false||journaled){
    const catalog=await refreshFinancialProviders(true);
    if(requestEpoch!==authEpoch())return unverifiedAssetUpload(uploadSlot,requestEpoch);
    if(journaled){
      const registered=catalog.providers.find(provider=>provider.id===input.providerId)?.assets?.find(row=>row.assetKey===asset.assetKey);
      if(!catalog.loaded||catalog.error||!confirmedUploadedAsset(registered,input)||registered?.url!==asset.url)
        return unverifiedAssetUpload(uploadSlot,requestEpoch);
    }
  }
  if(journaled&&intentId){
    try{
      const {resolveArtworkIntent}=await import('./artworkIntentClient.js');
      await resolveArtworkIntent({kind:'provider',targetId:input.providerId,role:input.role,variant:input.variant},
        {intentId,assetKey:asset.assetKey},'acknowledge',requestEpoch);
    }catch{return unverifiedAssetUpload(uploadSlot,requestEpoch)}
  }
  return asset;
  }));
  }finally{
    // A retired request must never clear a new auth scope's slot.
    if(requestEpoch===authEpoch())inFlightAssetUploads.delete(uploadSlot);
  }
}

export async function setFinancialProviderAssetBinding(input:{
  providerId:string;
  role:FinancialProviderAssetRole;
  variant:'universal'|'light'|'dark';
  assetKey:string|null;
  refreshCatalog?:boolean;
}){
  return trackDatabaseWrite(async()=>{
  const requestEpoch=authEpoch();
  // Binding PUT sets one explicit provider/role/variant key. A known 5xx or
  // lost response is safe to retry explicitly using the same idempotent input;
  // unlike a binary upload it never generates a fresh Storage key.
  let response:Response;
  try{
    response=await apiRequest('/api/account-metadata?resource=financial-provider-asset-binding',{
      method:'PUT',
      credentials:'same-origin',
      headers:{accept:'application/json','content-type':'application/json'},
      body:JSON.stringify({providerId:input.providerId,role:input.role,variant:input.variant,assetKey:input.assetKey}),
    });
  }catch(error){
    if(requestEpoch!==authEpoch())throw new UnverifiedFinancialProviderWrite('binding');
    throw error;
  }
  const payload=await json(response);
  if(requestEpoch!==authEpoch())throw new UnverifiedFinancialProviderWrite('binding');
  if(!response.ok)throw new Error(payload?.error||'Δεν ήταν δυνατή η ανάθεση της εικόνας.');
  if(payload?.ok!==true)throw new UnverifiedFinancialProviderWrite('binding');
  if(input.refreshCatalog!==false){
    await refreshFinancialProviders(true);
    if(requestEpoch!==authEpoch())throw new UnverifiedFinancialProviderWrite('binding');
  }
  });
}
