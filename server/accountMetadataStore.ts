import { ApiError } from './http.js';
import { fetchUpstream } from './upstream.js';

type AccountMetadataRow={accountId:string;iban:string|null;revision:number;updatedAt:string};
type FinancialProviderAssetRow={
  assetKey:string;
  role:'logo'|'wordmark'|'card-mark';
  variant:string;
  url:string;
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
  storage_bucket:string|null;
  storage_path:string|null;
  updated_at:string;
  active:boolean;
};

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
    const marker=payload&&typeof payload==='object'?`${(payload as any).code??''} ${(payload as any).message??''}`:'';
    if(response.status===401)throw new ApiError(401,'AUTH_REQUIRED','Authentication required.');
    if(response.status===403||/42501|FORBIDDEN/i.test(marker))throw new ApiError(403,'FORBIDDEN','Access denied.');
    if(/40001|REVISION_CONFLICT/i.test(marker))throw new ApiError(409,'REVISION_CONFLICT','Account metadata changed on another client. Reload and try again.');
    if(/23505|PROVIDER_ID_CONFLICT|ASSET_KEY_CONFLICT/i.test(marker))throw new ApiError(409,'PROVIDER_ID_CONFLICT','Υπάρχει ήδη πάροχος ή εικόνα με το ίδιο αναγνωριστικό.');
    if(/22023|INVALID_ACCOUNT_ID|INVALID_IBAN/i.test(marker))throw new ApiError(400,/INVALID_IBAN/i.test(marker)?'INVALID_IBAN':'INVALID_ACCOUNT_ID','Invalid account metadata.');
    if(response.status>=500)throw new ApiError(503,'ACCOUNT_METADATA_UNAVAILABLE','Account metadata is temporarily unavailable. Try again.');
    throw new ApiError(502,'ACCOUNT_METADATA_STORAGE_ERROR','Account metadata request failed.',false);
  }
  return payload;
}

function mapRow(value:unknown):AccountMetadataRow{
  const row=value as Partial<StoredRow>;
  if(!row||typeof row.account_id!=='string'||(row.iban!==null&&typeof row.iban!=='string')||!Number.isInteger(row.revision)||Number(row.revision)<1||typeof row.updated_at!=='string'){
    throw new ApiError(500,'ACCOUNT_METADATA_INVALID_ROW','Stored account metadata is invalid.',false);
  }
  return {accountId:row.account_id,iban:row.iban??null,revision:Number(row.revision),updatedAt:row.updated_at};
}

function mapFinancialProviderRow(value:unknown):FinancialProviderRow{
  const row=value as Partial<StoredFinancialProviderRow>;
  const kinds=['bank','fintech','wallet','payment'] as const;
  const validAssetKey=(value:unknown)=>value===null||value===undefined||typeof value==='string'&&/^[a-z][a-z0-9-]{0,95}$/.test(value);
  if(!row||typeof row.id!=='string'||typeof row.display_name!=='string'||typeof row.short_name!=='string'||!kinds.includes(row.provider_kind as any)||
    (row.country_code!==null&&row.country_code!==undefined&&typeof row.country_code!=='string')||!validAssetKey(row.logo_asset_key)||!validAssetKey(row.wordmark_asset_key)||!Number.isInteger(row.sort_order)){
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
    sortOrder:Number(row.sort_order),
  };
}

function mapFinancialProviderAssetRow(value:unknown):StoredFinancialProviderAssetRow{
  const row=value as Partial<StoredFinancialProviderAssetRow>;
  const roles=['logo','wordmark','card-mark'] as const;
  const role=row?.asset_role;
  if(!row||typeof row.asset_key!=='string'||typeof row.provider_id!=='string'||typeof role!=='string'||!roles.includes(role as any)||
    typeof row.variant!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(row.variant)||row.storage_bucket!=='financial-provider-assets'||typeof row.storage_path!=='string'||typeof row.updated_at!=='string'||
    !/^providers\/[a-z][a-z0-9-]{0,63}\/[A-Za-z0-9._/-]+$/.test(row.storage_path)||row.active!==true){
    throw new ApiError(500,'FINANCIAL_PROVIDER_ASSET_INVALID_ROW','Stored provider asset metadata is invalid.',false);
  }
  return {
    asset_key:row.asset_key,
    provider_id:row.provider_id,
    asset_role:role,
    variant:row.variant,
    storage_bucket:row.storage_bucket,
    storage_path:row.storage_path,
    updated_at:row.updated_at,
    active:true,
  };
}

function publicStorageUrl(baseUrl:string,asset:StoredFinancialProviderAssetRow){
  const path=asset.storage_path!.split('/').map(encodeURIComponent).join('/');
  return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(asset.storage_bucket!)}/${path}?v=${encodeURIComponent(asset.updated_at)}`;
}

export async function readAccountMetadata(accessToken:string):Promise<AccountMetadataRow[]>{
  const payload=await request('rheomiq_account_metadata?select=account_id,iban,revision,updated_at&order=account_id.asc',{method:'GET'},accessToken);
  if(!Array.isArray(payload))throw new ApiError(500,'ACCOUNT_METADATA_INVALID_RESPONSE','Account metadata response is invalid.',false);
  return payload.map(mapRow);
}

export async function readFinancialProviders(accessToken:string):Promise<FinancialProviderRow[]>{
  const [providerPayload,assetPayload]=await Promise.all([
    request('rheomiq_financial_providers?select=id,display_name,short_name,provider_kind,country_code,logo_asset_key,wordmark_asset_key,sort_order&active=eq.true&order=sort_order.asc,id.asc',{method:'GET'},accessToken),
    request('rheomiq_financial_provider_assets?select=asset_key,provider_id,asset_role,variant,storage_bucket,storage_path,updated_at,active&active=eq.true&order=provider_id.asc,asset_role.asc,variant.asc,asset_key.asc',{method:'GET'},accessToken),
  ]);
  if(!Array.isArray(providerPayload)||!Array.isArray(assetPayload))throw new ApiError(500,'FINANCIAL_PROVIDER_INVALID_RESPONSE','Financial provider response is invalid.',false);
  const assetRows=assetPayload.map(mapFinancialProviderAssetRow);
  const assets=new Map(assetRows.map(asset=>[asset.asset_key,asset] as const));
  const baseUrl=config(accessToken).url;
  return providerPayload.map(value=>{
    const provider=mapFinancialProviderRow(value);
    const logo=provider.logoAssetKey?assets.get(provider.logoAssetKey):undefined;
    const wordmark=provider.wordmarkAssetKey?assets.get(provider.wordmarkAssetKey):undefined;
    const providerAssets=assetRows
      .filter(asset=>asset.provider_id===provider.id)
      .map(asset=>({
        assetKey:asset.asset_key,
        role:asset.asset_role as FinancialProviderAssetRow['role'],
        variant:asset.variant,
        url:publicStorageUrl(baseUrl,asset),
      }));
    return {
      ...provider,
      logoUrl:logo?publicStorageUrl(baseUrl,logo):null,
      wordmarkUrl:wordmark?publicStorageUrl(baseUrl,wordmark):null,
      assets:providerAssets,
    };
  });
}

export async function writeAccountMetadata(accountId:string,iban:string|null,expectedRevision:number,accessToken:string):Promise<AccountMetadataRow>{
  const payload=await request('rpc/rheomiq_upsert_account_metadata',{
    method:'POST',
    body:JSON.stringify({p_account_id:accountId,p_iban:iban,p_expected_revision:expectedRevision}),
  },accessToken);
  const row=Array.isArray(payload)?payload[0]:null;
  if(!row)throw new ApiError(500,'ACCOUNT_METADATA_INVALID_RESPONSE','Account metadata response is invalid.',false);
  return mapRow(row);
}


type FinancialProviderWrite={
  id:string;
  displayName:string;
  shortName:string;
  providerKind:'bank'|'fintech'|'wallet'|'payment';
  countryCode:string|null;
  sortOrder:number;
};

export async function writeFinancialProvider(input:FinancialProviderWrite,accessToken:string):Promise<FinancialProviderRow>{
  const payload=await request('rpc/rheomiq_create_financial_provider',{
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
  const row=Array.isArray(payload)?payload[0]:null;
  if(!row)throw new ApiError(500,'FINANCIAL_PROVIDER_INVALID_RESPONSE','Financial provider response is invalid.',false);
  return mapFinancialProviderRow(row);
}

const PROVIDER_ASSET_BUCKET='financial-provider-assets';
const PROVIDER_ASSET_EXTENSION:Record<string,string>={
  'image/png':'png',
  'image/jpeg':'jpg',
  'image/webp':'webp',
  'image/svg+xml':'svg',
};

async function existingProviderAssetPath(assetKey:string,providerId:string,accessToken:string){
  const payload=await request(`rheomiq_financial_provider_assets?select=provider_id,storage_path&asset_key=eq.${encodeURIComponent(assetKey)}&limit=1`,{method:'GET'},accessToken);
  if(!Array.isArray(payload)||!payload.length)return null;
  const row=payload[0] as {provider_id?:unknown;storage_path?:unknown};
  if(row.provider_id!==providerId||typeof row.storage_path!=='string'||!/^providers\/[a-z][a-z0-9-]{0,63}\/[A-Za-z0-9._/-]+$/.test(row.storage_path))return null;
  return row.storage_path;
}

async function removeProviderStorageObject(storagePath:string,accessToken:string){
  const {url,apiKey,authorization}=config(accessToken);
  const response=await fetchUpstream(`${url}/storage/v1/object/${encodeURIComponent(PROVIDER_ASSET_BUCKET)}`,{
    method:'DELETE',
    headers:{apikey:apiKey,authorization,'content-type':'application/json'},
    body:JSON.stringify({prefixes:[storagePath]}),
  },'DATA');
  if(!response.ok)throw new Error(`Provider asset cleanup failed with status ${response.status}`);
}

export async function uploadFinancialProviderAsset(input:{
  providerId:string;
  role:'logo'|'wordmark'|'card-mark';
  variant:string;
  mimeType:string;
  makePrimary:boolean;
  content:Buffer;
},accessToken:string){
  const extension=PROVIDER_ASSET_EXTENSION[input.mimeType];
  if(!extension)throw new ApiError(415,'UNSUPPORTED_PROVIDER_ASSET_TYPE','Unsupported provider image type.');
  const assetKey=`${input.providerId}-${input.role}-${input.variant}`;
  const fileName=`${assetKey}.${extension}`;
  const storagePath=`providers/${input.providerId}/${fileName}`;
  const previousStoragePath=await existingProviderAssetPath(assetKey,input.providerId,accessToken);
  const {url,apiKey,authorization}=config(accessToken);
  const encodedPath=storagePath.split('/').map(encodeURIComponent).join('/');
  const upload=await fetchUpstream(`${url}/storage/v1/object/${encodeURIComponent(PROVIDER_ASSET_BUCKET)}/${encodedPath}`,{
    method:'POST',
    headers:{
      apikey:apiKey,
      authorization,
      'content-type':input.mimeType,
      'x-upsert':'true',
      'cache-control':'3600',
    },
    body:Uint8Array.from(input.content),
  },'DATA');
  if(!upload.ok){
    const payload=await upload.json().catch(()=>null) as any;
    const marker=`${payload?.statusCode??''} ${payload?.error??''} ${payload?.message??''}`;
    if(upload.status===401)throw new ApiError(401,'AUTH_REQUIRED','Authentication required.');
    if(upload.status===403||/forbidden|42501/i.test(marker))throw new ApiError(403,'FORBIDDEN','Access denied.');
    if(upload.status>=500)throw new ApiError(503,'PROVIDER_ASSET_STORAGE_UNAVAILABLE','Provider image storage is temporarily unavailable.');
    throw new ApiError(502,'PROVIDER_ASSET_UPLOAD_FAILED','Δεν ήταν δυνατή η αποθήκευση της εικόνας.');
  }

  const payload=await request('rpc/rheomiq_register_financial_provider_asset',{
    method:'POST',
    body:JSON.stringify({
      p_provider_id:input.providerId,
      p_asset_key:assetKey,
      p_asset_role:input.role,
      p_variant:input.variant,
      p_file_name:fileName,
      p_mime_type:input.mimeType,
      p_storage_path:storagePath,
      p_size_bytes:input.content.length,
      p_make_primary:input.makePrimary,
    }),
  },accessToken);
  const row=Array.isArray(payload)?payload[0]:null;
  if(!row)throw new ApiError(500,'FINANCIAL_PROVIDER_ASSET_INVALID_RESPONSE','Provider image response is invalid.',false);
  const asset=mapFinancialProviderAssetRow(row);
  if(previousStoragePath&&previousStoragePath!==storagePath){
    try{await removeProviderStorageObject(previousStoragePath,accessToken)}
    catch(error){console.warn('[MyFinHub provider asset cleanup]',{assetKey,message:error instanceof Error?error.message:String(error)})}
  }
  return {
    assetKey:asset.asset_key,
    role:asset.asset_role as FinancialProviderAssetRow['role'],
    variant:asset.variant,
    url:publicStorageUrl(url,asset),
  };
}
