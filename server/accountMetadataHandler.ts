import { accessTokenAal, assertMutationSessionOrigin, clearSessionCookiesIfCookie, requireSession } from './auth.js';
import { ApiError, handleApi, methodNotAllowed, readJsonBody, requestHeader, sendJson } from './http.js';
import { isOwner } from './storage.js';
import { readAccountMetadata, readFinancialProviders, writeAccountMetadata } from './accountMetadataStore.js';
import { assertValidIban } from '../src/lib/iban.js';

export const MAX_ACCOUNT_METADATA_BODY_BYTES=4*1024;

function parseAccountId(value:unknown){
  const accountId=typeof value==='string'?value.trim():'';
  if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(accountId))throw new ApiError(400,'INVALID_ACCOUNT_ID','Μη έγκυρη αναφορά λογαριασμού.');
  return accountId;
}

function queryResource(req:any){
  const value=req?.query?.resource;
  return typeof value==='string'?value.trim():Array.isArray(value)&&typeof value[0]==='string'?value[0].trim():'';
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
    if(method!=='GET'&&method!=='PUT')return methodNotAllowed(res,['GET','PUT']);
    const session=await requireSession(req,res,{allowBearer:true});
    if(!(await isOwner(session.accessToken))){clearSessionCookiesIfCookie(req,res,session);throw new ApiError(401,'AUTH_REQUIRED','Authentication required.');}
    if(accessTokenAal(session.accessToken)!=='aal2')throw new ApiError(403,'MFA_REQUIRED','Verification required.');
    if(method==='GET'){
      const resource=queryResource(req);
      if(resource==='financial-providers')return sendJson(res,200,{providers:await readFinancialProviders(session.accessToken)});
      if(resource)throw new ApiError(400,'INVALID_ACCOUNT_METADATA_RESOURCE','Μη έγκυρος πόρος metadata λογαριασμών.');
      return sendJson(res,200,{records:await readAccountMetadata(session.accessToken)});
    }
    assertMutationSessionOrigin(req,session);
    const body=parseAccountMetadataWrite(await readJsonBody(req,MAX_ACCOUNT_METADATA_BODY_BYTES));
    const expectedRevision=parseAccountMetadataExpectedRevision(requestHeader(req,'if-match'));
    const record=await writeAccountMetadata(body.accountId,body.iban,expectedRevision,session.accessToken);
    return sendJson(res,200,{record});
  });
}
