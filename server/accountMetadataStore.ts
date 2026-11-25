import { createHash, randomUUID } from 'node:crypto';
import { ApiError, copyBoundedBinaryValue } from './http.js';
import { fetchUpstream } from './upstream.js';
import { isValidIban } from '../src/lib/iban.js';

export const MAX_PROVIDER_ASSET_BYTES=2*1024*1024;
export const MAX_RECURRING_SERVICE_ASSET_BYTES=MAX_PROVIDER_ASSET_BYTES;

type AccountMetadataRow={accountId:string;iban:string|null;revision:number;updatedAt:string};
type FinancialProviderAssetRow={
  assetKey:string;
  role:'logo'|'wordmark'|'card-mark';
  variant:string;
  url:string;
  fileName:string;
  mimeType:string;
  sizeBytes:number|null;
  updatedAt:string;
};
type FinancialProviderAssetBindingRow={
  role:'logo'|'wordmark'|'card-mark';
  variant:'universal'|'light'|'dark';
  assetKey:string;
};
type FinancialProviderRow={
  id:string;
  displayName:string;
  shortName:string;
  providerKind:'bank'|'fintech'|'wallet'|'payment';
  countryCode:string|null;
  logoAssetKey:string|null;
  wordmarkAssetKey:string|null;
  logoUrl:string|null;
  wordmarkUrl:string|null;
  assets:FinancialProviderAssetRow[];
  bindings:FinancialProviderAssetBindingRow[];
  sortOrder:number;
};
type StoredRow={account_id:string;iban:string|null;revision:number;updated_at:string};
type StoredFinancialProviderRow={
  id:string;
  display_name:string;
  short_name:string;
  provider_kind:string;
  country_code:string|null;
  logo_asset_key:string|null;
  wordmark_asset_key:string|null;
  sort_order:number;
};
type StoredFinancialProviderAssetRow={
  asset_key:string;
  provider_id:string;
  asset_role:string;
  variant:string;
  file_name:string;
  mime_type:string;
  storage_bucket:string|null;
  storage_path:string|null;
  size_bytes:number|null;
  updated_at:string;
  active:boolean;
};
type StoredFinancialProviderAssetBindingRow={
  provider_id:string;
  asset_role:string;
  variant:string;
  asset_key:string;
};

type RecurringServiceAssetRow={
  assetKey:string;
  recurringId:string;
  url:string;
  fileName:string;
  mimeType:string;
  sizeBytes:number;
  updatedAt:string;
};
type StoredRecurringServiceAssetRow={
  asset_key:string;
  recurring_id:string;
  file_name:string;
  mime_type:string;
  storage_bucket:string|null;
  storage_path:string|null;
  size_bytes:number;
  updated_at:string;
  active:boolean;
};
type StoredPublicAssetRow={storage_bucket:string|null;storage_path:string|null;updated_at:string};

function config(accessToken:string){
  const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
  const apiKey=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!url||!apiKey)throw new ApiError(500,'SERVER_CONFIG_ERROR','Account metadata is not configured.',false);
  return {url,apiKey,authorization:`Bearer ${accessToken}`};
}

async function request(path:string,init:RequestInit,accessToken:string){
  const {url,apiKey,authorization}=config(accessToken);
  const response=await fetchUpstream(`${url}/rest/v1/${path}`,{
    ...init,
    headers:{apikey:apiKey,authorization,accept:'application/json',...(init.body?{'content-type':'application/json'}:{}),...(init.headers||{})},
  },'DATA');
  const payload=await response.json().catch(()=>null) as unknown;
  if(!response.ok){
    // Transport/gateway uncertainty dominates any embedded SQLSTATE or
    // message. A timeout, rate limit or 5xx cannot prove a rejected write
    // (and must never authorize compensation or a fresh-key retry).
    if(response.status===408||response.status===429||response.status>=500)
      throw new ApiError(503,'ACCOUNT_METADATA_UNAVAILABLE','Account metadata is temporarily unavailable. Try again.');
    const marker=payload&&typeof payload==='object'?`${(payload as any).code??''} ${(payload as any).message??''}`:'';
    if(response.status===401)throw new ApiError(401,'AUTH_REQUIRED','Authentication required.');
    if(response.status===403||/42501|FORBIDDEN/i.test(marker))throw new ApiError(403,'FORBIDDEN','Access denied.');
    if(/40001|REVISION_CONFLICT/i.test(marker))throw new ApiError(409,'REVISION_CONFLICT','Account metadata changed on another client. Reload and try again.');
    if(/23505|PROVIDER_ID_CONFLICT/i.test(marker))throw new ApiError(409,'PROVIDER_ID_CONFLICT','Υπάρχει ήδη πάροχος με το ίδιο αναγνωριστικό.');
    if(/RECURRING_SERVICE_ASSET_IN_USE/i.test(marker))throw new ApiError(409,'RECURRING_SERVICE_ASSET_IN_USE','Η εικόνα χρησιμοποιείται ακόμη από πάγιο.');
    if(/RECURRING_SERVICE_ASSET_KEY_CONFLICT/i.test(marker))throw new ApiError(409,'RECURRING_SERVICE_ASSET_CONFLICT','Υπάρχει ήδη εικόνα υπηρεσίας με το ίδιο αναγνωριστικό.');
    if(/ASSET_KEY_CONFLICT/i.test(marker))throw new ApiError(409,'PROVIDER_ASSET_CONFLICT','Υπάρχει ήδη εικόνα με το ίδιο αναγνωριστικό.');
    if(/INVALID_RECURRING_SERVICE_ASSET|RECURRING_SERVICE_ASSET_MISSING_STORAGE_OBJECT/i.test(marker))throw new ApiError(400,'INVALID_RECURRING_SERVICE_ASSET','Μη έγκυρη εικόνα υπηρεσίας.');
    if(/22023|INVALID_PROVIDER_ASSET_BINDING|INVALID_PROVIDER_ASSET|INVALID_PROVIDER_ID|INVALID_ACCOUNT_ID|INVALID_IBAN/i.test(marker)){
      throw new ApiError(400,/INVALID_IBAN/i.test(marker)?'INVALID_IBAN':/PROVIDER/i.test(marker)?'INVALID_PROVIDER_DATA':'INVALID_ACCOUNT_ID','Invalid metadata.');
    }
    throw new ApiError(502,'ACCOUNT_METADATA_STORAGE_ERROR','Account metadata request failed.',false);
  }
  return payload;
}

// An empty RLS-protected registry read is not absence evidence if the
// originating owner session lost its AAL2/device authorization. Recheck before
// each compensating DELETE and after its acknowledgement; never substitute a
// privileged key or a new session for the original access token.
async function currentArtworkCleanupOwner(accessToken:string):Promise<boolean>{
  try{
    return await request('rpc/rheomiq_is_owner_aal2',{method:'POST',body:'{}'},accessToken)===true;
  }catch{return false}
}

function mapRow(value:unknown):AccountMetadataRow{
  const row=value as Partial<StoredRow>;
  if(!row||typeof row.account_id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(row.account_id)||
    (row.iban!==null&&(typeof row.iban!=='string'||!isValidIban(row.iban)))||
    typeof row.revision!=='number'||!Number.isSafeInteger(row.revision)||row.revision<1||
    typeof row.updated_at!=='string'||!row.updated_at){
    throw new ApiError(500,'ACCOUNT_METADATA_INVALID_ROW','Stored account metadata is invalid.',false);
  }
  return {accountId:row.account_id,iban:row.iban,revision:row.revision,updatedAt:row.updated_at};
}

function mapFinancialProviderRow(value:unknown):FinancialProviderRow{
  const row=value as Partial<StoredFinancialProviderRow>;
  const kinds=['bank','fintech','wallet','payment'] as const;
  const validAssetKey=(value:unknown)=>value===null||value===undefined||typeof value==='string'&&/^[a-z][a-z0-9-]{0,95}$/.test(value);
  if(!row||typeof row.id!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(row.id)||
    typeof row.display_name!=='string'||!row.display_name.trim()||row.display_name.length>120||
    typeof row.short_name!=='string'||!row.short_name.trim()||row.short_name.length>80||!kinds.includes(row.provider_kind as any)||
    (row.country_code!==null&&row.country_code!==undefined&&
      (typeof row.country_code!=='string'||!/^[A-Z]{2}$/.test(row.country_code)))||!validAssetKey(row.logo_asset_key)||!validAssetKey(row.wordmark_asset_key)||
    typeof row.sort_order!=='number'||!Number.isSafeInteger(row.sort_order)||row.sort_order<0||row.sort_order>100000){
    throw new ApiError(500,'FINANCIAL_PROVIDER_INVALID_ROW','Stored financial provider is invalid.',false);
  }
  return {
    id:row.id,
    displayName:row.display_name,
    shortName:row.short_name,
    providerKind:row.provider_kind as FinancialProviderRow['providerKind'],
    countryCode:row.country_code??null,
    logoAssetKey:row.logo_asset_key??null,
    wordmarkAssetKey:row.wordmark_asset_key??null,
    logoUrl:null,
    wordmarkUrl:null,
    assets:[],
    bindings:[],
    sortOrder:Number(row.sort_order),
  };
}

function mapFinancialProviderAssetRow(value:unknown):StoredFinancialProviderAssetRow{
  const row=value as Partial<StoredFinancialProviderAssetRow>;
  const roles=['logo','wordmark','card-mark'] as const;
  const role=row?.asset_role;
  // Storage paths are public URLs: bind them to the declared provider, not
  // just the asset key, and disallow path traversal/nested redirects.
  const directory=typeof row?.provider_id==='string'?`providers/${row.provider_id}/`:'';
  const filePath=typeof row?.storage_path==='string'&&row.storage_path.startsWith(directory)
    ?row.storage_path.slice(directory.length):'';
  const extension=typeof row?.mime_type==='string'?PROVIDER_ASSET_EXTENSION[row.mime_type]:undefined;
  // Uploaded keys have an immutable server-issued filename. Curated legacy
  // artworks may use independent safe file names and remain compatible.
  const prefix=typeof row?.provider_id==='string'?row.provider_id+'-asset-':'';
  const isUploaded=typeof row?.asset_key==='string'&&row.asset_key.startsWith(prefix)&&
    /^[a-f0-9]{12}$/.test(row.asset_key.slice(prefix.length));
  if(!row||typeof row.asset_key!=='string'||!/^[a-z][a-z0-9-]{0,95}$/.test(row.asset_key)||
    typeof row.provider_id!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(row.provider_id)||
    typeof role!=='string'||!roles.includes(role as any)||
    typeof row.variant!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(row.variant)||typeof row.file_name!=='string'||!row.file_name||
    typeof row.mime_type!=='string'||!extension||!filePath.endsWith(`.${extension}`)||
    (isUploaded&&filePath!==`${row.asset_key}.${extension}`)||
    row.storage_bucket!=='financial-provider-assets'||typeof row.storage_path!=='string'||typeof row.updated_at!=='string'||
    (row.size_bytes!==null&&(typeof row.size_bytes!=='number'||!Number.isSafeInteger(row.size_bytes)||row.size_bytes<0))||
    !/^providers\/[a-z][a-z0-9-]{0,63}\/[A-Za-z0-9._/-]+$/.test(row.storage_path)||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(filePath)||row.active!==true){
    throw new ApiError(500,'FINANCIAL_PROVIDER_ASSET_INVALID_ROW','Stored provider asset metadata is invalid.',false);
  }
  return {
    asset_key:row.asset_key,
    provider_id:row.provider_id,
    asset_role:role,
    variant:row.variant,
    file_name:row.file_name,
    mime_type:row.mime_type,
    storage_bucket:row.storage_bucket,
    storage_path:row.storage_path,
    size_bytes:row.size_bytes,
    updated_at:row.updated_at,
    active:true,
  };
}

function mapFinancialProviderAssetBindingRow(value:unknown):StoredFinancialProviderAssetBindingRow{
  const row=value as Partial<StoredFinancialProviderAssetBindingRow>;
  if(!row||typeof row.provider_id!=='string'||!['logo','wordmark','card-mark'].includes(String(row.asset_role))||
    !['universal','light','dark'].includes(String(row.variant))||typeof row.asset_key!=='string'){
    throw new ApiError(500,'FINANCIAL_PROVIDER_ASSET_BINDING_INVALID_ROW','Stored provider asset binding is invalid.',false);
  }
  return {provider_id:row.provider_id,asset_role:row.asset_role!,variant:row.variant!,asset_key:row.asset_key};
}

function mapRecurringServiceAssetRow(value:unknown):StoredRecurringServiceAssetRow{
  const row=value as Partial<StoredRecurringServiceAssetRow>;
  const extension=typeof row?.mime_type==='string'?PROVIDER_ASSET_EXTENSION[row.mime_type]:undefined;
  if(!row||typeof row.asset_key!=='string'||!/^[a-z][a-z0-9-]{0,95}$/.test(row.asset_key)||
    typeof row.recurring_id!=='string'||!row.recurring_id||row.recurring_id.length>200||
    typeof row.file_name!=='string'||!row.file_name||typeof row.mime_type!=='string'||!extension||
    row.storage_bucket!=='recurring-service-assets'||typeof row.storage_path!=='string'||
    // The public path must name this same registration: another service's
    // valid Storage filename is not evidence for this asset key.
    !/^service-asset-[a-f0-9]{24}$/.test(row.asset_key)||
    !/^services\/service-asset-[a-f0-9]{24}\.(?:png|jpg|webp|svg)$/.test(row.storage_path)||
    !row.storage_path.startsWith(`services/${row.asset_key}.`)||
    !row.storage_path.endsWith(`.${extension}`)||
    typeof row.size_bytes!=='number'||!Number.isSafeInteger(row.size_bytes)||row.size_bytes<=0||
    typeof row.updated_at!=='string'||row.active!==true){
    throw new ApiError(500,'RECURRING_SERVICE_ASSET_INVALID_ROW','Stored recurring service asset metadata is invalid.',false);
  }
  return {
    asset_key:row.asset_key,
    recurring_id:row.recurring_id,
    file_name:row.file_name,
    mime_type:row.mime_type,
    storage_bucket:row.storage_bucket,
    storage_path:row.storage_path,
    size_bytes:row.size_bytes,
    updated_at:row.updated_at,
    active:true,
  };
}

function publicStorageUrl(baseUrl:string,asset:StoredPublicAssetRow){
  const path=asset.storage_path!.split('/').map(encodeURIComponent).join('/');
  return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(asset.storage_bucket!)}/${path}?v=${encodeURIComponent(asset.updated_at)}`;
}

export async function readAccountMetadata(accessToken:string):Promise<AccountMetadataRow[]>{
  const payload=await request('rheomiq_account_metadata?select=account_id,iban,revision,updated_at&order=account_id.asc',{method:'GET'},accessToken);
  if(!Array.isArray(payload))throw new ApiError(500,'ACCOUNT_METADATA_INVALID_RESPONSE','Account metadata response is invalid.',false);
  const rows=payload.map(mapRow);
  if(new Set(rows.map(row=>row.accountId)).size!==rows.length)
    throw new ApiError(500,'ACCOUNT_METADATA_INVALID_RESPONSE','Duplicate account metadata rows.',false);
  return rows;
}

export async function readFinancialProviders(accessToken:string):Promise<FinancialProviderRow[]>{
  const [providerPayload,assetPayload,bindingPayload]=await Promise.all([
    request('rheomiq_financial_providers?select=id,display_name,short_name,provider_kind,country_code,logo_asset_key,wordmark_asset_key,sort_order&active=eq.true&order=sort_order.asc,id.asc',{method:'GET'},accessToken),
    request('rheomiq_financial_provider_assets?select=asset_key,provider_id,asset_role,variant,file_name,mime_type,storage_bucket,storage_path,size_bytes,updated_at,active&active=eq.true&order=provider_id.asc,updated_at.desc,asset_key.asc',{method:'GET'},accessToken),
    request('rheomiq_financial_provider_asset_bindings?select=provider_id,asset_role,variant,asset_key&order=provider_id.asc,asset_role.asc,variant.asc',{method:'GET'},accessToken),
  ]);
  if(!Array.isArray(providerPayload)||!Array.isArray(assetPayload)||!Array.isArray(bindingPayload))throw new ApiError(500,'FINANCIAL_PROVIDER_INVALID_RESPONSE','Financial provider response is invalid.',false);
  const providerRows=providerPayload.map(mapFinancialProviderRow);
  const assetRows=assetPayload.map(mapFinancialProviderAssetRow);
  const bindingRows=bindingPayload.map(mapFinancialProviderAssetBindingRow);
  // This is post-write verification data. Never pick an arbitrary duplicate.
  if(new Set(providerRows.map(row=>row.id)).size!==providerRows.length||
    new Set(assetRows.map(row=>row.asset_key)).size!==assetRows.length||
    new Set(bindingRows.map(row=>`${row.provider_id}:${row.asset_role}:${row.variant}`)).size!==bindingRows.length)
    throw new ApiError(500,'FINANCIAL_PROVIDER_INVALID_RESPONSE','Financial provider catalog registration is ambiguous.',false);
  const baseUrl=config(accessToken).url;
  return providerRows.map(provider=>{
    const ownedAssets=assetRows.filter(asset=>asset.provider_id===provider.id);
    const ownByKey=new Map(ownedAssets.map(asset=>[asset.asset_key,asset] as const));
    const logo=provider.logoAssetKey?ownByKey.get(provider.logoAssetKey):undefined;
    const wordmark=provider.wordmarkAssetKey?ownByKey.get(provider.wordmarkAssetKey):undefined;
    // Never resolve a primary image from another provider's active asset.
    if(provider.logoAssetKey&&!logo||provider.wordmarkAssetKey&&!wordmark)
      throw new ApiError(500,'FINANCIAL_PROVIDER_INVALID_RESPONSE','Financial provider asset ownership is invalid.',false);
    // Artwork is reusable across presentation slots. The registered asset
    // role describes its original upload, not permission for subsequent slots.
    // Ownership is validated by this provider's active asset keys above.
    const providerAssets=ownedAssets
      .map(asset=>({
        assetKey:asset.asset_key,
        role:asset.asset_role as FinancialProviderAssetRow['role'],
        variant:asset.variant,
        url:publicStorageUrl(baseUrl,asset),
        fileName:asset.file_name,
        mimeType:asset.mime_type,
        sizeBytes:asset.size_bytes,
        updatedAt:asset.updated_at,
      }));
    const bindings=bindingRows.filter(binding=>binding.provider_id===provider.id).map(binding=>({
      role:binding.asset_role as FinancialProviderAssetBindingRow['role'],
      variant:binding.variant as FinancialProviderAssetBindingRow['variant'],
      assetKey:binding.asset_key,
    }));
    if(bindings.some(binding=>!ownByKey.has(binding.assetKey)))
      throw new ApiError(500,'FINANCIAL_PROVIDER_INVALID_RESPONSE','Financial provider binding ownership is invalid.',false);
    return {
      ...provider,
      logoUrl:logo?publicStorageUrl(baseUrl,logo):null,
      wordmarkUrl:wordmark?publicStorageUrl(baseUrl,wordmark):null,
      assets:providerAssets,
      bindings,
    };
  });
}

export async function readRecurringServiceAssets(accessToken:string):Promise<RecurringServiceAssetRow[]>{
  const payload=await request('rheomiq_recurring_service_assets?select=asset_key,recurring_id,file_name,mime_type,storage_bucket,storage_path,size_bytes,updated_at,active&active=eq.true&order=updated_at.desc,asset_key.asc',{method:'GET'},accessToken);
  if(!Array.isArray(payload))throw new ApiError(500,'RECURRING_SERVICE_ASSET_INVALID_RESPONSE','Recurring service asset response is invalid.',false);
  const assetRows=payload.map(mapRecurringServiceAssetRow);
  if(new Set(assetRows.map(asset=>asset.asset_key)).size!==assetRows.length)
    throw new ApiError(500,'RECURRING_SERVICE_ASSET_INVALID_RESPONSE','Recurring service asset catalog registration is ambiguous.',false);
  const baseUrl=config(accessToken).url;
  return assetRows.map(asset=>({
      assetKey:asset.asset_key,
      recurringId:asset.recurring_id,
      url:publicStorageUrl(baseUrl,asset),
      fileName:asset.file_name,
      mimeType:asset.mime_type,
      sizeBytes:asset.size_bytes,
      updatedAt:asset.updated_at,
    }));
}

export async function writeAccountMetadata(accountId:string,iban:string|null,expectedRevision:number,accessToken:string):Promise<AccountMetadataRow>{
  const unverified=()=>new ApiError(503,'ACCOUNT_METADATA_WRITE_UNVERIFIED',
    'Account metadata write acknowledgement is unverified.',false);
  let payload:unknown;
  try{
    payload=await request('rpc/rheomiq_upsert_account_metadata',{
      method:'POST',
      body:JSON.stringify({p_account_id:accountId,p_iban:iban,p_expected_revision:expectedRevision}),
    },accessToken);
  }catch(error){
    // A revisioned invoker RPC can COMMIT before 5xx/timeout loses its
    // response. Never replay the write: reconcile only that next revision.
    if(!(error instanceof ApiError)||error.status<500)throw error;
    if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||
      !Number.isSafeInteger(expectedRevision+1))throw unverified();
    try{
      // An empty RLS read after device revocation is not proof of rollback.
      const owner=await request('rpc/rheomiq_is_owner_aal2',
        {method:'POST',body:'{}'},accessToken);
      if(owner!==true)throw unverified();
      const records=await request(
        'rheomiq_account_metadata?select=account_id,iban,revision,updated_at&account_id=eq.'+encodeURIComponent(accountId),
        {method:'GET'},accessToken);
      if(!Array.isArray(records)||records.length!==1)throw unverified();
      const row=mapRow(records[0]);
      if(row.accountId!==accountId||row.iban!==iban||
        row.revision!==expectedRevision+1)throw unverified();
      // The original token must still have owner+AAL2 visibility after the
      // exact readback, not merely before a potentially delayed GET.
      if(await request('rpc/rheomiq_is_owner_aal2',
        {method:'POST',body:'{}'},accessToken)!==true)throw unverified();
      return row;
    }catch{
      // No missing/foreign/stale/malformed/unavailable read can make the
      // caller advance its finance revision or claim successful IBAN save.
      throw unverified();
    }
  }
  if(!Array.isArray(payload)||payload.length!==1)throw unverified();
  const row=mapRow(payload[0]);
  // HTTP 200 is not a verified write receipt if the RPC returned the wrong
  // account, a mismatched IBAN or anything but this next revision.
  if(row.accountId!==accountId||row.iban!==iban||
    !Number.isSafeInteger(expectedRevision+1)||row.revision!==expectedRevision+1)
    throw unverified();
  return row;
}

type FinancialProviderWrite={
  id:string;
  displayName:string;
  shortName:string;
  providerKind:'bank'|'fintech'|'wallet'|'payment';
  countryCode:string|null;
  sortOrder:number;
};

async function writeProviderRpc(rpc:string,input:FinancialProviderWrite,accessToken:string):Promise<FinancialProviderRow>{
  const unverified=()=>new ApiError(503,'FINANCIAL_PROVIDER_WRITE_UNVERIFIED',
    'Financial provider write acknowledgement is unverified.',false);
  const matches=(row:FinancialProviderRow)=>row.id===input.id&&
    row.displayName===input.displayName&&row.shortName===input.shortName&&
    row.providerKind===input.providerKind&&row.countryCode===input.countryCode&&
    row.sortOrder===input.sortOrder;
  let payload:unknown;
  try{
    payload=await request(`rpc/${rpc}`,{
      method:'POST',
      body:JSON.stringify({
        p_id:input.id,
        p_display_name:input.displayName,
        p_short_name:input.shortName,
        p_provider_kind:input.providerKind,
        p_country_code:input.countryCode,
        p_sort_order:input.sortOrder,
      }),
    },accessToken);
  }catch(error){
    // Create/update can COMMIT before a 5xx or lost acknowledgement. Do not
    // resend either RPC; prove the exact intended durable metadata instead.
    if(!(error instanceof ApiError)||error.status<500)throw error;
    try{
      // Provider catalog SELECT has a broader historical read policy; it
      // cannot prove owner authorization without this independent predicate.
      const owner=await request('rpc/rheomiq_is_owner_aal2',
        {method:'POST',body:'{}'},accessToken);
      if(owner!==true)throw unverified();
      const records=await request(
        'rheomiq_financial_providers?select=id,display_name,short_name,provider_kind,country_code,sort_order,logo_asset_key,wordmark_asset_key,active&id=eq.'+encodeURIComponent(input.id)+'&active=eq.true',
        {method:'GET'},accessToken);
      // A matching archived provider is not evidence of a committed create
      // or update. Require the exact live row, not a stale soft-deleted copy.
      if(!Array.isArray(records)||records.length!==1||records[0]?.active!==true)throw unverified();
      const row=mapFinancialProviderRow(records[0]);
      if(!matches(row))throw unverified();
      // Do not return matching catalog data as a recovered write receipt
      // when the originating device/session was revoked during readback.
      if(await request('rpc/rheomiq_is_owner_aal2',
        {method:'POST',body:'{}'},accessToken)!==true)throw unverified();
      return row;
    }catch{
      // Missing, stale, malformed, inaccessible or foreign postcommit reads
      // are uncertain, not permission to repeat a new provider creation.
      throw unverified();
    }
  }
  // An HTTP 200 can conceal a committed mutation with a malformed receipt.
  // Do not infer success from an absent, duplicated or mismatched RPC row.
  if(!Array.isArray(payload)||payload.length!==1)throw unverified();
  // The create/update RPC must acknowledge an active provider, as required
  // for ambiguous postcommit recovery. Archived/missing active is unverified.
  if((payload[0] as {active?:unknown}|null)?.active!==true)throw unverified();
  const row=mapFinancialProviderRow(payload[0]);
  if(!matches(row))throw unverified();
  return row;
}

export function writeFinancialProvider(input:FinancialProviderWrite,accessToken:string){
  return writeProviderRpc('rheomiq_create_financial_provider',input,accessToken);
}

export function updateFinancialProvider(input:FinancialProviderWrite,accessToken:string){
  return writeProviderRpc('rheomiq_update_financial_provider',input,accessToken);
}

const PROVIDER_ASSET_BUCKET='financial-provider-assets';
const PROVIDER_ASSET_EXTENSION:Record<string,string>={
  'image/png':'png',
  'image/jpeg':'jpg',
  'image/webp':'webp',
  'image/svg+xml':'svg',
};

const RECURRING_SERVICE_ASSET_BUCKET='recurring-service-assets';

// A Storage POST can commit even if its 5xx/timeout receipt is lost. Both
// artwork buckets already serve public image bytes. Confirm the exact newly
// generated path AND bytes before a one-time PostgreSQL registration. Never
// replay POST, delete the object, or infer success from Storage listing alone.
async function confirmedAmbiguousArtworkUpload(
  url:string,apiKey:string,authorization:string,
  bucket:'financial-provider-assets'|'recurring-service-assets',
  encodedPath:string,expectedContent:Buffer,
):Promise<boolean>{
  const controller=new AbortController();
  // The timeout includes the response body, not just the GET headers.
  const timer=setTimeout(()=>controller.abort(),12_000);
  try{
    const response=await fetch(`${url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`,{
      method:'GET',cache:'no-store',signal:controller.signal,
      headers:{apikey:apiKey,authorization,'cache-control':'no-store'},
    });
    if(!response.ok||!response.body)return false;
    const length=response.headers.get('content-length');
    if(length!==null&&(!/^\d+$/.test(length)||Number(length)!==expectedContent.byteLength))
      return false;
    const reader=response.body.getReader();
    const actualHash=createHash('sha256');
    let size=0,complete=false;
    try{
      while(true){
        const next=await reader.read();
        if(next.done){complete=true;break}
        size+=next.value.byteLength;
        if(size>expectedContent.byteLength)return false;
        actualHash.update(next.value);
      }
    }finally{
      if(!complete)await reader.cancel().catch(()=>{});
      reader.releaseLock();
    }
    return size===expectedContent.byteLength&&
      actualHash.digest('hex')===createHash('sha256').update(expectedContent).digest('hex');
  }catch{
    // A 404, unreadable object, truncated body, transport error or timeout
    // is an UNKNOWN upload outcome. Never delete or register on that basis.
    return false;
  }finally{
    clearTimeout(timer);
    controller.abort();
  }
}

export async function uploadFinancialProviderAsset(input:{
  providerId:string;
  role:'logo'|'wordmark'|'card-mark';
  variant:string;
  mimeType:string;
  fileName:string;
  makePrimary:boolean;
  content:unknown;
},accessToken:string){
  const content=copyBoundedBinaryValue(input.content,MAX_PROVIDER_ASSET_BYTES);
  const extension=PROVIDER_ASSET_EXTENSION[input.mimeType];
  if(!extension)throw new ApiError(415,'UNSUPPORTED_PROVIDER_ASSET_TYPE','Unsupported provider image type.');
  const suffix=randomUUID().replace(/-/g,'').slice(0,12);
  const assetKey=`${input.providerId}-asset-${suffix}`;
  const storageFileName=`${assetKey}.${extension}`;
  const storagePath=`providers/${input.providerId}/${storageFileName}`;
  const {url,apiKey,authorization}=config(accessToken);
  const encodedPath=storagePath.split('/').map(encodeURIComponent).join('/');
  let upload:Response|null=null;
  try{
    upload=await fetchUpstream(`${url}/storage/v1/object/${encodeURIComponent(PROVIDER_ASSET_BUCKET)}/${encodedPath}`,{
      method:'POST',
      headers:{apikey:apiKey,authorization,'content-type':input.mimeType,'cache-control':'31536000, immutable'},
      body:Uint8Array.from(content),
    },'DATA');
  }catch(error){
    // Network timeout/5xx is not proof of rollback: a fresh owner-owned
    // Storage object may already exist under this single generated key.
    if(!(error instanceof ApiError)||error.status<500)throw error;
  }
  if(upload&&!upload.ok&&upload.status!==408&&upload.status!==429&&upload.status<500){
    const payload=await upload.json().catch(()=>null) as any;
    const marker=`${payload?.statusCode??''} ${payload?.error??''} ${payload?.message??''}`;
    if(upload.status===401)throw new ApiError(401,'AUTH_REQUIRED','Authentication required.');
    if(upload.status===403||/forbidden|42501/i.test(marker))throw new ApiError(403,'FORBIDDEN','Access denied.');
    throw new ApiError(502,'PROVIDER_ASSET_UPLOAD_FAILED','Δεν ήταν δυνατή η αποθήκευση της εικόνας.');
  }
  if(!upload||!upload.ok){
    // Verify real bytes, not an object-name listing or a possibly stale
    // registration. Never retry the non-idempotent Storage POST.
    const matched=await confirmedAmbiguousArtworkUpload(
      url,apiKey,authorization,PROVIDER_ASSET_BUCKET,encodedPath,content);
    if(!matched){
      console.error('[RheomIQ provider artwork upload]',{assetKey,status:'storage-receipt-unverified'});
      throw new ApiError(503,'PROVIDER_ASSET_UPLOAD_UNVERIFIED',
        'Η μεταφόρτωση εικόνας δεν επιβεβαιώθηκε. Έλεγξε τις εικόνες πριν από νέα μεταφόρτωση.');
    }
  }

  // A failed response does not prove the registration RPC rolled back: the
  // database may have committed before an upstream timeout. Verify by the
  // generated, per-upload asset key before deleting its Storage object.
  const asRegisteredAsset=(value:unknown)=>{
    const asset=mapFinancialProviderAssetRow(value);
    if(asset.asset_key!==assetKey||asset.provider_id!==input.providerId||
      asset.storage_bucket!==PROVIDER_ASSET_BUCKET||asset.storage_path!==storagePath||
      asset.asset_role!==input.role||asset.variant!==input.variant||
      asset.file_name!==input.fileName||asset.mime_type!==input.mimeType||asset.size_bytes!==content.byteLength){
      throw new ApiError(503,'PROVIDER_ASSET_REGISTRATION_UNVERIFIED','Δεν επιβεβαιώθηκε η καταχώριση της εικόνας.');
    }
    return {
      assetKey:asset.asset_key,
      role:asset.asset_role as FinancialProviderAssetRow['role'],
      variant:asset.variant,
      url:publicStorageUrl(url,asset),
      fileName:asset.file_name,
      mimeType:asset.mime_type,
      sizeBytes:asset.size_bytes,
      updatedAt:asset.updated_at,
    };
  };
  try{
    const payload=await request('rpc/rheomiq_register_financial_provider_asset',{
      method:'POST',
      body:JSON.stringify({
        p_provider_id:input.providerId,
        p_asset_key:assetKey,
        p_asset_role:input.role,
        p_variant:input.variant,
        p_file_name:input.fileName,
        p_mime_type:input.mimeType,
        p_storage_path:storagePath,
        p_size_bytes:content.byteLength,
        p_make_primary:input.makePrimary,
      }),
    },accessToken);
    if(!Array.isArray(payload)||payload.length!==1)throw new ApiError(502,'FINANCIAL_PROVIDER_ASSET_INVALID_RESPONSE','Provider image response is invalid.',false);
    return asRegisteredAsset(payload[0]);
  }catch(error){
    let registered:unknown;
    try{
      const records=await request(
        `rheomiq_financial_provider_assets?select=asset_key,provider_id,asset_role,variant,file_name,mime_type,storage_bucket,storage_path,size_bytes,updated_at,active&asset_key=eq.${encodeURIComponent(assetKey)}`,
        {method:'GET'},accessToken);
      if(!Array.isArray(records)||records.length>1)throw new Error('Invalid provider asset reconciliation result');
      registered=records[0]??null;
      if(registered)return asRegisteredAsset(registered);
    }catch{
      // Fail closed. A permission/read failure or mismatched committed record
      // must never cause deletion of a potentially registered/bound object.
      console.error('[RheomIQ provider asset reconciliation]',{assetKey,status:'unverified'});
      throw new ApiError(503,'PROVIDER_ASSET_REGISTRATION_UNVERIFIED','Η καταχώριση εικόνας δεν επιβεβαιώθηκε. Έλεγξε την κατάσταση πριν από νέα μεταφόρτωση.');
    }

    // A 5xx, timeout or invalid response may precede a still-running COMMIT:
    // one empty read-back is not proof that no row will later appear. Only a
    // definite PostgreSQL validation/key rejection permits compensating DELETE.
    const definiteRejection=error instanceof ApiError&&(
      error.status===400&&error.code==='INVALID_PROVIDER_DATA'||
      error.status===409&&error.code==='PROVIDER_ASSET_CONFLICT'
    );
    if(!definiteRejection){
      console.error('[RheomIQ provider asset reconciliation]',{assetKey,status:'ambiguous-register-response'});
      throw new ApiError(503,'PROVIDER_ASSET_REGISTRATION_UNVERIFIED','Η καταχώριση εικόνας δεν επιβεβαιώθηκε. Έλεγξε την κατάσταση πριν από νέα μεταφόρτωση.');
    }

    // Only a confirmed rejected transaction and a verified-absent registry
    // permit deleting this new, server-generated object. Never purge old keys.
    let cleaned=false;
    for(let attempt=1;attempt<=2;attempt++){
      if(!await currentArtworkCleanupOwner(accessToken))break;
      try{
        const cleanup=await fetchUpstream(`${url}/storage/v1/object/${encodeURIComponent(PROVIDER_ASSET_BUCKET)}/${encodedPath}`,{
          method:'DELETE',
          headers:{apikey:apiKey,authorization},
        },'DATA');
        if(cleanup.ok||cleanup.status===404){
          cleaned=await currentArtworkCleanupOwner(accessToken);
          break;
        }
        console.error('[RheomIQ provider asset cleanup]',{assetKey,status:cleanup.status,attempt});
      }catch{
        console.error('[RheomIQ provider asset cleanup]',{assetKey,status:'request-failed',attempt});
      }
    }
    if(!cleaned)throw new ApiError(503,'PROVIDER_ASSET_CLEANUP_PENDING','Η καταχώριση εικόνας απέτυχε και ο προσωρινός καθαρισμός δεν επιβεβαιώθηκε.');
    throw error;
  }
}

export async function setFinancialProviderAssetBinding(input:{
  providerId:string;
  role:'logo'|'wordmark'|'card-mark';
  variant:'universal'|'light'|'dark';
  assetKey:string|null;
},accessToken:string){
  // The RPC can commit before its transport receipt disappears. Never replay.
  let bindingReceiptAmbiguous=false;
  try{
    await request('rpc/rheomiq_set_financial_provider_asset_binding',{
    method:'POST',
    body:JSON.stringify({
      p_provider_id:input.providerId,
      p_asset_role:input.role,
      p_variant:input.variant,
      p_asset_key:input.assetKey,
    }),
    },accessToken);
  }catch(error){
    if(!(error instanceof ApiError)||error.status<500)throw error;
    bindingReceiptAmbiguous=true;
  }
  const unverifiedBinding=()=>new ApiError(503,'FINANCIAL_PROVIDER_BINDING_UNVERIFIED',
    'Provider image binding acknowledgement is unverified.',false);
  // This RPC RETURNS void. A 200/null payload proves transport completion,
  // not the exact requested slot. Confirm the single committed binding (or
  // its removal) before the API sends ok:true to its native/browser clients.
  let records:unknown;
  try{
    records=await request(
    `rheomiq_financial_provider_asset_bindings?select=provider_id,asset_role,variant,asset_key&provider_id=eq.${encodeURIComponent(input.providerId)}&asset_role=eq.${encodeURIComponent(input.role)}&variant=eq.${encodeURIComponent(input.variant)}`,
      {method:'GET'},accessToken);
  }catch(error){
    if(bindingReceiptAmbiguous)throw unverifiedBinding();
    throw error;
  }
  if(!Array.isArray(records)||records.length!==(input.assetKey===null?0:1))
    throw unverifiedBinding();
  if(input.assetKey!==null){
    const row=records[0] as Partial<StoredFinancialProviderAssetBindingRow>|null;
    if(!row||row.provider_id!==input.providerId||row.asset_role!==input.role||
      row.variant!==input.variant||row.asset_key!==input.assetKey)
      throw unverifiedBinding();
  }
  // A clear returns [] by design. RLS can also return [] after owner/AAL2 or
  // active-device revocation even when a binding remains. Require a *fresh*
  // owner+AAL2 receipt AFTER the exact slot readback, for both 200/void and
  // ambiguous RPC acknowledgements. Never replay or claim cleared otherwise.
  let activeOwner=false;
  try{
    activeOwner=await request('rpc/rheomiq_is_owner_aal2',
      {method:'POST',body:'{}'},accessToken)===true;
  }catch{ /* Missing/malformed/unavailable authorization is not proof. */ }
  if(!activeOwner)throw unverifiedBinding();
}

export async function uploadRecurringServiceAsset(input:{
  recurringId:string;
  mimeType:string;
  fileName:string;
  content:unknown;
},accessToken:string):Promise<RecurringServiceAssetRow>{
  const content=copyBoundedBinaryValue(input.content,MAX_RECURRING_SERVICE_ASSET_BYTES);
  const extension=PROVIDER_ASSET_EXTENSION[input.mimeType];
  if(!extension)throw new ApiError(415,'UNSUPPORTED_RECURRING_SERVICE_ASSET_TYPE','Unsupported recurring service image type.');
  const suffix=randomUUID().replace(/-/g,'').slice(0,24);
  const assetKey=`service-asset-${suffix}`;
  const storagePath=`services/${assetKey}.${extension}`;
  const {url,apiKey,authorization}=config(accessToken);
  const encodedPath=storagePath.split('/').map(encodeURIComponent).join('/');
  let upload:Response|null=null;
  try{
    upload=await fetchUpstream(`${url}/storage/v1/object/${encodeURIComponent(RECURRING_SERVICE_ASSET_BUCKET)}/${encodedPath}`,{
      method:'POST',
      headers:{apikey:apiKey,authorization,'content-type':input.mimeType,'cache-control':'31536000, immutable'},
      body:Uint8Array.from(content),
    },'DATA');
  }catch(error){
    // Network timeout/5xx is not proof of rollback: a fresh owner-owned
    // Storage object may already exist under this single generated key.
    if(!(error instanceof ApiError)||error.status<500)throw error;
  }
  if(upload&&!upload.ok&&upload.status!==408&&upload.status!==429&&upload.status<500){
    const payload=await upload.json().catch(()=>null) as any;
    const marker=`${payload?.statusCode??''} ${payload?.error??''} ${payload?.message??''}`;
    if(upload.status===401)throw new ApiError(401,'AUTH_REQUIRED','Authentication required.');
    if(upload.status===403||/forbidden|42501/i.test(marker))throw new ApiError(403,'FORBIDDEN','Access denied.');
    throw new ApiError(502,'RECURRING_SERVICE_ASSET_UPLOAD_FAILED','Δεν ήταν δυνατή η αποθήκευση της εικόνας υπηρεσίας.');
  }
  if(!upload||!upload.ok){
    // Verify real bytes, not an object-name listing or a possibly stale
    // registration. Never retry the non-idempotent Storage POST.
    const matched=await confirmedAmbiguousArtworkUpload(
      url,apiKey,authorization,RECURRING_SERVICE_ASSET_BUCKET,encodedPath,content);
    if(!matched){
      console.error('[RheomIQ recurring artwork upload]',{assetKey,status:'storage-receipt-unverified'});
      throw new ApiError(503,'RECURRING_SERVICE_ASSET_UPLOAD_UNVERIFIED',
        'Η μεταφόρτωση λογοτύπου υπηρεσίας δεν επιβεβαιώθηκε. Έλεγξε τις εικόνες πριν από νέα μεταφόρτωση.');
    }
  }

  // The registration RPC can COMMIT before an upstream 5xx/timeout. Treat
  // Storage and PostgreSQL as independent stores: reconcile by the unique,
  // server-generated key before considering deletion of the uploaded object.
  const asRegisteredAsset=(value:unknown):RecurringServiceAssetRow=>{
    const asset=mapRecurringServiceAssetRow(value);
    if(asset.asset_key!==assetKey||asset.recurring_id!==input.recurringId||
      asset.storage_bucket!==RECURRING_SERVICE_ASSET_BUCKET||asset.storage_path!==storagePath||
      asset.file_name!==input.fileName||asset.mime_type!==input.mimeType||asset.size_bytes!==content.byteLength){
      throw new ApiError(503,'RECURRING_SERVICE_ASSET_REGISTRATION_UNVERIFIED','Η καταχώριση εικόνας υπηρεσίας δεν επιβεβαιώθηκε.');
    }
    return {
      assetKey:asset.asset_key,
      recurringId:asset.recurring_id,
      url:publicStorageUrl(url,asset),
      fileName:asset.file_name,
      mimeType:asset.mime_type,
      sizeBytes:asset.size_bytes,
      updatedAt:asset.updated_at,
    };
  };
  try{
    const payload=await request('rpc/rheomiq_register_recurring_service_asset',{
      method:'POST',
      body:JSON.stringify({
        p_recurring_id:input.recurringId,
        p_asset_key:assetKey,
        p_file_name:input.fileName,
        p_mime_type:input.mimeType,
        p_storage_path:storagePath,
        p_size_bytes:content.byteLength,
      }),
    },accessToken);
    if(!Array.isArray(payload)||payload.length!==1)throw new ApiError(500,'RECURRING_SERVICE_ASSET_INVALID_RESPONSE','Recurring service image response is invalid.',false);
    return asRegisteredAsset(payload[0]);
  }catch(error){
    try{
      const records=await request(
        `rheomiq_recurring_service_assets?select=asset_key,recurring_id,file_name,mime_type,storage_bucket,storage_path,size_bytes,updated_at,active&asset_key=eq.${encodeURIComponent(assetKey)}`,
        {method:'GET'},accessToken);
      if(!Array.isArray(records)||records.length>1)throw new Error('Invalid recurring service asset reconciliation result');
      if(records.length)return asRegisteredAsset(records[0]);
    }catch{
      // A read failure, malformed registered row or mismatched asset cannot
      // authorize deleting an object that may already be committed or in use.
      console.error('[RheomIQ recurring service asset reconciliation]',{assetKey,status:'unverified'});
      throw new ApiError(503,'RECURRING_SERVICE_ASSET_REGISTRATION_UNVERIFIED','Η καταχώριση εικόνας υπηρεσίας δεν επιβεβαιώθηκε. Έλεγξε την κατάσταση πριν από νέα μεταφόρτωση.');
    }

    // An empty read after 5xx/timeout is not proof of rollback: the database
    // may still commit. Only a definite validation rejection and a verified
    // absent registry permit cleanup of this newly generated Storage object.
    const definiteRejection=error instanceof ApiError&&error.status===400&&error.code==='INVALID_RECURRING_SERVICE_ASSET';
    if(!definiteRejection){
      console.error('[RheomIQ recurring service asset reconciliation]',{assetKey,status:'ambiguous-register-response'});
      throw new ApiError(503,'RECURRING_SERVICE_ASSET_REGISTRATION_UNVERIFIED','Η καταχώριση εικόνας υπηρεσίας δεν επιβεβαιώθηκε. Έλεγξε την κατάσταση πριν από νέα μεταφόρτωση.');
    }
    let cleaned=false;
    for(let attempt=1;attempt<=2;attempt++){
      if(!await currentArtworkCleanupOwner(accessToken))break;
      try{
        const cleanup=await fetchUpstream(`${url}/storage/v1/object/${encodeURIComponent(RECURRING_SERVICE_ASSET_BUCKET)}/${encodedPath}`,{
          method:'DELETE',
          headers:{apikey:apiKey,authorization},
        },'DATA');
        if(cleanup.ok||cleanup.status===404){
          cleaned=await currentArtworkCleanupOwner(accessToken);
          break;
        }
        console.error('[RheomIQ recurring service asset cleanup]',{assetKey,status:cleanup.status,attempt});
      }catch{
        console.error('[RheomIQ recurring service asset cleanup]',{assetKey,status:'request-failed',attempt});
      }
    }
    if(!cleaned)throw new ApiError(503,'RECURRING_SERVICE_ASSET_CLEANUP_PENDING','Η καταχώριση εικόνας υπηρεσίας απέτυχε και ο προσωρινός καθαρισμός δεν επιβεβαιώθηκε.');
    throw error;
  }
}

export async function deleteRecurringServiceAsset(assetKey:string,accessToken:string){
  const released=await request('rpc/rheomiq_release_recurring_service_asset',{
    method:'POST',
    body:JSON.stringify({p_asset_key:assetKey}),
  },accessToken);
  const row=Array.isArray(released)&&released.length===1
    ? released[0] as {storage_bucket?:unknown;storage_path?:unknown}|undefined
    : undefined;
  // A release receipt authorizes deletion of exactly this asset and nothing
  // else. Never turn a malformed or mismatched DB path into a Storage DELETE.
  const returnedPath=typeof row?.storage_path==='string'?row.storage_path:null;
  const matchedPath=returnedPath
    ? /^services\/(service-asset-[a-f0-9]{24})\.(?:png|jpg|webp|svg)$/.exec(returnedPath)
    : null;
  if(!row||row.storage_bucket!==RECURRING_SERVICE_ASSET_BUCKET||!returnedPath||!matchedPath||matchedPath[1]!==assetKey){
    throw new ApiError(500,'RECURRING_SERVICE_ASSET_INVALID_RESPONSE','Recurring service image release response is invalid.',false);
  }
  const {url,apiKey,authorization}=config(accessToken);
  const encodedPath=returnedPath.split('/').map(encodeURIComponent).join('/');
  const removal=await fetchUpstream(`${url}/storage/v1/object/${encodeURIComponent(RECURRING_SERVICE_ASSET_BUCKET)}/${encodedPath}`,{
    method:'DELETE',
    headers:{apikey:apiKey,authorization},
  },'DATA');
  if(!removal.ok&&removal.status!==404){
    throw new ApiError(503,'RECURRING_SERVICE_ASSET_STORAGE_UNAVAILABLE','Η διαγραφή της εικόνας υπηρεσίας δεν ολοκληρώθηκε.');
  }
  // Storage deletion was acknowledged. The purge RPC may commit before a
  // transport error, so reconcile its exact row rather than replaying DELETE.
  let purgeReceiptAmbiguous=false;
  try{
    await request('rpc/rheomiq_purge_recurring_service_asset',{
      method:'POST',
      body:JSON.stringify({p_asset_key:assetKey}),
    },accessToken);
  }catch(error){
    // A definite PostgreSQL rejection is not a committed deletion receipt.
    if(!(error instanceof ApiError)||error.status<500)throw error;
    purgeReceiptAmbiguous=true;
  }
  const unverifiedPurge=()=>new ApiError(503,'RECURRING_SERVICE_ASSET_RELEASE_UNVERIFIED',
    'Η οριστική αφαίρεση της εικόνας υπηρεσίας δεν επιβεβαιώθηκε.');
  // The purge RPC RETURNS void: HTTP 200/null is not a deletion receipt.
  // Query the exact key including inactive rows. Never replay Storage DELETE.
  let remaining:unknown;
  try{
    remaining=await request(
      `rheomiq_recurring_service_assets?select=asset_key,active&asset_key=eq.${encodeURIComponent(assetKey)}`,
      {method:'GET'},accessToken);
  }catch(error){
    if(purgeReceiptAmbiguous)throw unverifiedPurge();
    throw error;
  }
  if(!Array.isArray(remaining)||remaining.length!==0)throw unverifiedPurge();
  // A revoked owner/AAL2/device session can make a retained row appear absent
  // through RLS. Check authorization *after* the exact-row read for both
  // acknowledged and ambiguous purge RPC receipts, not only before it.
  let activeOwner=false;
  try{
    activeOwner=await request('rpc/rheomiq_is_owner_aal2',{method:'POST',body:'{}'},accessToken)===true;
  }catch{ /* Permission and upstream failures cannot prove deletion. */ }
  if(!activeOwner)throw unverifiedPurge();
}
