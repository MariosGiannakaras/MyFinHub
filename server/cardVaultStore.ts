import type { CardSecretEnvelope, CardSecretPlaintext } from './cardVaultCrypto.js';
import { decryptCardSecrets, encryptCardSecrets } from './cardVaultCrypto.js';
import { ApiError } from './http.js';
import { fetchUpstream } from './upstream.js';

type CardSecretRow = {
  ciphertext: string;
  iv: string;
  auth_tag: string;
  key_version: number;
};

function config(accessToken:string){
  const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
  const apiKey=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!url||!apiKey)throw new ApiError(500,'SERVER_CONFIG_ERROR','Card vault is not configured.',false);
  return {url,apiKey,authorization:`Bearer ${accessToken}`};
}

function cardIdFilter(ownerUserId:string,cardId:string){
  return `owner_user_id=eq.${encodeURIComponent(ownerUserId)}&card_id=eq.${encodeURIComponent(cardId)}`;
}

async function request(path:string,init:RequestInit,accessToken:string){
  const {url,apiKey,authorization}=config(accessToken);
  const response=await fetchUpstream(`${url}/rest/v1/${path}`,{
    ...init,
    headers:{
      apikey:apiKey,
      authorization,
      accept:'application/json',
      ...(init.body?{'content-type':'application/json'}:{}),
      ...(init.headers||{}),
    },
  },'DATA');
  const payload=await response.json().catch(()=>null) as {code?:string;message?:string}|unknown;
  if(!response.ok){
    const marker=payload&&typeof payload==='object'?`${(payload as any).code??''} ${(payload as any).message??''}`:'';
    if(response.status===401)throw new ApiError(401,'AUTH_REQUIRED','Authentication required.');
    if(response.status===403||/42501|FORBIDDEN/i.test(marker))throw new ApiError(403,'FORBIDDEN','Access denied.');
    if(response.status===429)throw new ApiError(429,'CARD_VAULT_RATE_LIMITED','Card vault is busy. Try again shortly.');
    if(response.status>=500)throw new ApiError(503,'CARD_VAULT_UNAVAILABLE','Card vault is temporarily unavailable. Try again.');
    throw new ApiError(502,'CARD_VAULT_STORAGE_ERROR','Card vault request failed.',false);
  }
  return payload;
}

function envelope(row:CardSecretRow):CardSecretEnvelope{
  if(!row||typeof row.ciphertext!=='string'||typeof row.iv!=='string'||typeof row.auth_tag!=='string'||!Number.isInteger(row.key_version)){
    throw new ApiError(500,'CARD_VAULT_INVALID_ROW','Stored card secret is invalid.',false);
  }
  return {ciphertext:row.ciphertext,iv:row.iv,authTag:row.auth_tag,keyVersion:row.key_version};
}

function mapCryptoError(error:unknown):never{
  const code=error instanceof Error?error.message:'';
  if(code==='INVALID_CARD_PAN')throw new ApiError(400,'INVALID_CARD_PAN','Ο αριθμός κάρτας δεν είναι έγκυρος.');
  if(code==='INVALID_CARD_EXPIRY')throw new ApiError(400,'INVALID_CARD_EXPIRY','Η ημερομηνία λήξης δεν είναι έγκυρη.');
  if(code==='EMPTY_CARD_SECRET'||code==='INVALID_CARD_SECRET')throw new ApiError(400,'INVALID_CARD_SECRET','Δεν δόθηκαν έγκυρα στοιχεία κάρτας.');
  if(code==='CVV_PERSISTENCE_DISABLED')throw new ApiError(400,'CVV_PERSISTENCE_DISABLED','Το CVV δεν αποθηκεύεται στον server.');
  if(code==='CARD_VAULT_DECRYPT_FAILED')throw new ApiError(500,'CARD_VAULT_DECRYPT_FAILED','Το αποθηκευμένο στοιχείο κάρτας δεν μπόρεσε να αποκρυπτογραφηθεί.',false);
  if(code.startsWith('CARD_VAULT_KEY_')||code==='CARD_VAULT_KEY_NOT_CONFIGURED')throw new ApiError(503,'CARD_VAULT_UNAVAILABLE','Το ασφαλές vault καρτών δεν είναι διαθέσιμο.',false);
  throw error;
}

export async function readCardSecrets(ownerUserId:string,cardId:string,accessToken:string):Promise<CardSecretPlaintext|null>{
  const payload=await request(`rheomiq_card_secrets?${cardIdFilter(ownerUserId,cardId)}&select=ciphertext,iv,auth_tag,key_version&limit=1`,{method:'GET'},accessToken);
  const row=Array.isArray(payload)?payload[0] as CardSecretRow|undefined:undefined;
  if(!row)return null;
  try{return decryptCardSecrets(envelope(row),ownerUserId,cardId)}catch(error){return mapCryptoError(error)}
}

export async function writeCardSecrets(ownerUserId:string,cardId:string,input:unknown,accessToken:string):Promise<CardSecretPlaintext>{
  let encrypted:CardSecretEnvelope;
  try{encrypted=encryptCardSecrets(input,ownerUserId,cardId)}catch(error){return mapCryptoError(error)}
  const normalized=await (async()=>{
    try{return decryptCardSecrets(encrypted,ownerUserId,cardId)}catch(error){return mapCryptoError(error)}
  })();
  await request('rheomiq_card_secrets?on_conflict=owner_user_id,card_id',{
    method:'POST',
    headers:{prefer:'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify({
      owner_user_id:ownerUserId,
      card_id:cardId,
      ciphertext:encrypted.ciphertext,
      iv:encrypted.iv,
      auth_tag:encrypted.authTag,
      key_version:encrypted.keyVersion,
      updated_at:new Date().toISOString(),
    }),
  },accessToken);
  return normalized;
}

export async function deleteCardSecrets(ownerUserId:string,cardId:string,accessToken:string){
  await request(`rheomiq_card_secrets?${cardIdFilter(ownerUserId,cardId)}`,{method:'DELETE',headers:{prefer:'return=minimal'}},accessToken);
}
