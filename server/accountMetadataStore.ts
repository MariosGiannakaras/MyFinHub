import { ApiError } from './http.js';
import { fetchUpstream } from './upstream.js';

export type AccountMetadataRow={accountId:string;iban:string|null;revision:number;updatedAt:string};
export type FinancialProviderRow={
  id:string;
  displayName:string;
  shortName:string;
  providerKind:'bank'|'fintech'|'wallet'|'payment';
  countryCode:string|null;
  logoAssetKey:string;
  wordmarkAssetKey:string;
  sortOrder:number;
};
type StoredRow={account_id:string;iban:string|null;revision:number;updated_at:string};
type StoredFinancialProviderRow={
  id:string;
  display_name:string;
  short_name:string;
  provider_kind:string;
  country_code:string|null;
  logo_asset_key:string;
  wordmark_asset_key:string;
  sort_order:number;
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
  if(!row||typeof row.id!=='string'||typeof row.display_name!=='string'||typeof row.short_name!=='string'||!kinds.includes(row.provider_kind as any)||
    (row.country_code!==null&&row.country_code!==undefined&&typeof row.country_code!=='string')||typeof row.logo_asset_key!=='string'||typeof row.wordmark_asset_key!=='string'||!Number.isInteger(row.sort_order)){
    throw new ApiError(500,'FINANCIAL_PROVIDER_INVALID_ROW','Stored financial provider is invalid.',false);
  }
  return {
    id:row.id,
    displayName:row.display_name,
    shortName:row.short_name,
    providerKind:row.provider_kind as FinancialProviderRow['providerKind'],
    countryCode:row.country_code??null,
    logoAssetKey:row.logo_asset_key,
    wordmarkAssetKey:row.wordmark_asset_key,
    sortOrder:Number(row.sort_order),
  };
}

export async function readAccountMetadata(accessToken:string):Promise<AccountMetadataRow[]>{
  const payload=await request('rheomiq_account_metadata?select=account_id,iban,revision,updated_at&order=account_id.asc',{method:'GET'},accessToken);
  if(!Array.isArray(payload))throw new ApiError(500,'ACCOUNT_METADATA_INVALID_RESPONSE','Account metadata response is invalid.',false);
  return payload.map(mapRow);
}

export async function readFinancialProviders(accessToken:string):Promise<FinancialProviderRow[]>{
  const payload=await request('rheomiq_financial_providers?select=id,display_name,short_name,provider_kind,country_code,logo_asset_key,wordmark_asset_key,sort_order&active=eq.true&order=sort_order.asc,id.asc',{method:'GET'},accessToken);
  if(!Array.isArray(payload))throw new ApiError(500,'FINANCIAL_PROVIDER_INVALID_RESPONSE','Financial provider response is invalid.',false);
  return payload.map(mapFinancialProviderRow);
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
