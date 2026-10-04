import { accessTokenAal, assertMutationSessionOrigin, clearSessionCookiesIfCookie, requireSession } from './auth.js';
import { ApiError, copyBoundedBinaryValue, handleApi, methodNotAllowed, readBinaryBody, readJsonBody, requestHeader, sendJson, strictQueryValue } from './http.js';
import { isOwner } from './storage.js';
import { MAX_PROVIDER_ASSET_BYTES, readAccountMetadata, readFinancialProviders, setFinancialProviderAssetBinding, updateFinancialProvider, uploadFinancialProviderAsset, writeAccountMetadata, writeFinancialProvider } from './accountMetadataStore.js';
import { assertValidIban } from '../src/lib/iban.js';

const MAX_ACCOUNT_METADATA_BODY_BYTES=4*1024;
const MAX_FINANCIAL_PROVIDER_BODY_BYTES=16*1024;
const PROVIDER_ASSET_MIME_TYPES=new Set(['image/png','image/jpeg','image/webp','image/svg+xml']);

function parseAccountId(value:unknown){
  const accountId=typeof value==='string'?value.trim():'';
  if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(accountId))throw new ApiError(400,'INVALID_ACCOUNT_ID','Μη έγκυρη αναφορά λογαριασμού.');
  return accountId;
}

function queryResource(req:any){return strictQueryValue(req,'resource')}

export function parseFinancialProviderWrite(value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError(400,'INVALID_FINANCIAL_PROVIDER','Μη έγκυρα στοιχεία τράπεζας/παρόχου.');
  const body=value as Record<string,unknown>;
  if(Object.keys(body).some(key=>!['id','displayName','shortName','providerKind','countryCode','sortOrder'].includes(key)))throw new ApiError(400,'INVALID_FINANCIAL_PROVIDER','Μη έγκυρα στοιχεία τράπεζας/παρόχου.');
  const id=typeof body.id==='string'?body.id.trim():'';
  const displayName=typeof body.displayName==='string'?body.displayName.trim():'';
  const shortName=typeof body.shortName==='string'?body.shortName.trim():'';
  const providerKind=typeof body.providerKind==='string'?body.providerKind.trim():'';
  const countryCode=body.countryCode===null||body.countryCode===undefined||body.countryCode===''?null:typeof body.countryCode==='string'?body.countryCode.trim().toUpperCase():'';
  const sortOrder=Number(body.sortOrder);
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(id)||!displayName||displayName.length>120||!shortName||shortName.length>80||
    !['bank','fintech','wallet','payment'].includes(providerKind)||countryCode!==null&&!/^[A-Z]{2}$/.test(countryCode)||
    !Number.isSafeInteger(sortOrder)||sortOrder<0||sortOrder>100000){
    throw new ApiError(400,'INVALID_FINANCIAL_PROVIDER','Μη έγκυρα στοιχεία τράπεζας/παρόχου.');
  }
  return {id,displayName,shortName,providerKind:providerKind as 'bank'|'fintech'|'wallet'|'payment',countryCode,sortOrder};
}

export function parseProviderAssetUpload(req:any){
  const providerId=strictQueryValue(req,'providerId');
  const role=strictQueryValue(req,'role');
  const variant=strictQueryValue(req,'variant');
  const makePrimary=strictQueryValue(req,'primary')==='1';
  const fileName=strictQueryValue(req,'fileName');
  const mimeType=requestHeader(req,'content-type').split(';',1)[0].trim().toLowerCase();
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(providerId)||!['logo','wordmark','card-mark'].includes(role)||
    !/^[a-z][a-z0-9-]{0,63}$/.test(variant)||!PROVIDER_ASSET_MIME_TYPES.has(mimeType)||
    !fileName||fileName.length>160||/[\u0000-\u001f\u007f]/.test(fileName)||
    (role==='card-mark'&&makePrimary)){
    throw new ApiError(400,'INVALID_PROVIDER_ASSET','Μη έγκυρα στοιχεία εικόνας παρόχου.');
  }
  return {providerId,role:role as 'logo'|'wordmark'|'card-mark',variant,mimeType,fileName,makePrimary};
}

export function parseProviderAssetBindingWrite(value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError(400,'INVALID_PROVIDER_ASSET_BINDING','Μη έγκυρη ανάθεση εικόνας.');
  const body=value as Record<string,unknown>;
  if(Object.keys(body).some(key=>!['providerId','role','variant','assetKey'].includes(key)))throw new ApiError(400,'INVALID_PROVIDER_ASSET_BINDING','Μη έγκυρη ανάθεση εικόνας.');
  const providerId=typeof body.providerId==='string'?body.providerId.trim():'';
  const role=typeof body.role==='string'?body.role.trim():'';
  const variant=typeof body.variant==='string'?body.variant.trim():'';
  const assetKey=body.assetKey===null?null:typeof body.assetKey==='string'?body.assetKey.trim():'';
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(providerId)||!['logo','wordmark','card-mark'].includes(role)||
    !['universal','light','dark'].includes(variant)||(assetKey!==null&&!/^[a-z][a-z0-9-]{0,95}$/.test(assetKey))){
    throw new ApiError(400,'INVALID_PROVIDER_ASSET_BINDING','Μη έγκυρη ανάθεση εικόνας.');
  }
  return {providerId,role:role as 'logo'|'wordmark'|'card-mark',variant:variant as 'universal'|'light'|'dark',assetKey};
}

export function validateProviderAssetContent(mimeType:string,content:unknown):Buffer{
  const bytes=copyBoundedBinaryValue(content,MAX_PROVIDER_ASSET_BYTES);
  if(!bytes.byteLength)throw new ApiError(400,'EMPTY_PROVIDER_ASSET','Η εικόνα είναι κενή.');
  const valid=
    mimeType==='image/png'&&bytes.byteLength>=8&&bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))||
    mimeType==='image/jpeg'&&bytes.byteLength>=3&&bytes.readUInt8(0)===0xff&&bytes.readUInt8(1)===0xd8&&bytes.readUInt8(2)===0xff||
    mimeType==='image/webp'&&bytes.byteLength>=12&&bytes.subarray(0,4).toString('ascii')==='RIFF'&&bytes.subarray(8,12).toString('ascii')==='WEBP'||
    mimeType==='image/svg+xml'&&(()=>{const text=bytes.toString('utf8').replace(/^\uFEFF/,'').trim();return /^(?:<\?xml[^>]*>\s*)?<svg\b/i.test(text)&&!/<\s*(?:script|foreignObject)\b|\bon[a-z]+\s*=|javascript:/i.test(text)})();
  if(!valid)throw new ApiError(400,'INVALID_PROVIDER_ASSET_CONTENT','Το αρχείο δεν ταιριάζει με τον δηλωμένο τύπο εικόνας.');
  return bytes;
}

export function parseAccountMetadataExpectedRevision(value:string|undefined){
  const raw=(value??'').replace(/^W\//,'').replace(/^"|"$/g,'').trim();
  if(!/^\d+$/.test(raw))throw new ApiError(428,'REVISION_REQUIRED','Απαιτείται έκδοση της εγγραφής πριν από την αποθήκευση.');
  const revision=Number(raw);
  if(!Number.isSafeInteger(revision)||revision<0)throw new ApiError(400,'INVALID_REVISION','Μη έγκυρη έκδοση εγγραφής.');
  return revision;
}

export function parseAccountMetadataWrite(value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError(400,'INVALID_ACCOUNT_METADATA','Μη έγκυρα metadata λογαριασμού.');
  const body=value as Record<string,unknown>;
  if(Object.keys(body).some(key=>key!=='accountId'&&key!=='iban'))throw new ApiError(400,'INVALID_ACCOUNT_METADATA','Μη έγκυρα metadata λογαριασμού.');
  const accountId=parseAccountId(body.accountId);
  if(body.iban!==null&&body.iban!==undefined&&typeof body.iban!=='string')throw new ApiError(400,'INVALID_IBAN','Το IBAN δεν είναι έγκυρο.');
  try{return {accountId,iban:assertValidIban(body.iban as string|null|undefined)}}catch{throw new ApiError(400,'INVALID_IBAN','Το IBAN δεν είναι έγκυρο.');}
}

export async function handleAccountMetadataRequest(req:any,res:any){
  await handleApi(res,async()=>{
    const method=String(req.method||'').toUpperCase();
    if(method!=='GET'&&method!=='PUT'&&method!=='POST'&&method!=='PATCH')return methodNotAllowed(res,['GET','PUT','POST','PATCH']);
    const session=await requireSession(req,res,{allowBearer:true});
    if(!(await isOwner(session.accessToken))){clearSessionCookiesIfCookie(req,res,session);throw new ApiError(401,'AUTH_REQUIRED','Authentication required.');}
    if(accessTokenAal(session.accessToken)!=='aal2')throw new ApiError(403,'MFA_REQUIRED','Verification required.');
    const resource=queryResource(req);
    if(method==='GET'){
      if(resource==='financial-providers')return sendJson(res,200,{providers:await readFinancialProviders(session.accessToken)});
      if(resource)throw new ApiError(400,'INVALID_ACCOUNT_METADATA_RESOURCE','Μη έγκυρος πόρος metadata λογαριασμών.');
      return sendJson(res,200,{records:await readAccountMetadata(session.accessToken)});
    }
    assertMutationSessionOrigin(req,session);
    if((method==='POST'||method==='PATCH')&&resource==='financial-providers'){
      const body=parseFinancialProviderWrite(await readJsonBody(req,MAX_FINANCIAL_PROVIDER_BODY_BYTES));
      if(method==='POST')await writeFinancialProvider(body,session.accessToken);
      else await updateFinancialProvider(body,session.accessToken);
      const provider=(await readFinancialProviders(session.accessToken)).find(item=>item.id===body.id);
      if(!provider)throw new ApiError(500,'FINANCIAL_PROVIDER_INVALID_RESPONSE','Financial provider response is invalid.',false);
      return sendJson(res,200,{provider});
    }
    if(method==='PUT'&&resource==='financial-provider-assets'){
      const input=parseProviderAssetUpload(req);
      const content=validateProviderAssetContent(input.mimeType,await readBinaryBody(req,MAX_PROVIDER_ASSET_BYTES));
      const asset=await uploadFinancialProviderAsset({...input,content},session.accessToken);
      return sendJson(res,200,{asset});
    }
    if(method==='PUT'&&resource==='financial-provider-asset-binding'){
      const input=parseProviderAssetBindingWrite(await readJsonBody(req,MAX_FINANCIAL_PROVIDER_BODY_BYTES));
      await setFinancialProviderAssetBinding(input,session.accessToken);
      return sendJson(res,200,{ok:true});
    }
    if(resource)throw new ApiError(400,'INVALID_ACCOUNT_METADATA_RESOURCE','Μη έγκυρος πόρος metadata λογαριασμών.');
    if(method!=='PUT')return methodNotAllowed(res,['GET','PUT']);
    const body=parseAccountMetadataWrite(await readJsonBody(req,MAX_ACCOUNT_METADATA_BODY_BYTES));
    const expectedRevision=parseAccountMetadataExpectedRevision(requestHeader(req,'if-match'));
    const record=await writeAccountMetadata(body.accountId,body.iban,expectedRevision,session.accessToken);
    return sendJson(res,200,{record});
  });
}
