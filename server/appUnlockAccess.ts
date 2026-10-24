import crypto from 'node:crypto';
import { ApiError, requestHeader } from './http.js';
import { fetchUpstream } from './upstream.js';

const protectedPaths = new Set(['/api/data','/api/import','/api/history','/api/backup','/api/card-secrets','/api/account-metadata','/api/auth/devices','/api/auth/account','/api/android-update']);

export function requiresAppUnlock(req:any) {
  try {
    const raw=String(req?.originalUrl||req?.url||req?.path||'');
    const pathname=new URL(raw,'http://localhost').pathname;
    return protectedPaths.has(pathname);
  } catch { return false; }
}

export async function assertAppUnlock(req:any, accessToken:string) {
  const candidate=requestHeader(req,'x-myfinhub-app-unlock');
  if(candidate && !/^[a-zA-Z0-9_-]{43}$/.test(candidate)) throw new ApiError(423,'APP_LOCK_REQUIRED','Απαιτείται ξεκλείδωμα PIN.');
  const hash=candidate?crypto.createHash('sha256').update(candidate).digest('hex'):'';
  const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
  const key=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)throw new ApiError(503,'APP_LOCK_UNAVAILABLE','Η επαλήθευση κλειδώματος δεν είναι διαθέσιμη.',false);
  const response=await fetchUpstream(`${url}/rest/v1/rpc/myfinhub_app_lock_ticket`,{
    method:'POST',
    headers:{apikey:key,authorization:`Bearer ${accessToken}`,'content-type':'application/json'},
    body:JSON.stringify({p_action:'validate',p_token_hash:hash}),
  },'DATA');
  if(!response.ok) throw new ApiError(503,'APP_LOCK_UNAVAILABLE','Η επαλήθευση κλειδώματος δεν είναι διαθέσιμη.',false);
  const allowed=await response.json().catch(()=>null);
  if(allowed!==true)throw new ApiError(423,'APP_LOCK_REQUIRED','Απαιτείται ξεκλείδωμα PIN.');
}
