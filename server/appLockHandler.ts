import crypto from 'node:crypto';
import { accessTokenAal, assertMutationSessionOrigin, challengeTotp, clearSessionCookiesIfCookie, getTotpFactors, requireSession, revokeSession, signInWithPassword, verifyTotp } from './auth.js';
import { ApiError, handleApi, methodNotAllowed, readJsonBody, sendJson } from './http.js';
import { isOwner } from './storage.js';
import { fetchUpstream } from './upstream.js';

type AppLockAction = 'configure'|'verify'|'change'|'timeout'|'disable'|'lock'|'touch';
type PinAction = {action:AppLockAction;pin?:string;newPin?:string;idleMinutes?:number;unlockToken?:string};
const PIN=/^[0-9]{4}$/;
const IDLE=new Set([1,5,15,30,60]);

export function parseAppLockAction(input:unknown):PinAction{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new ApiError(400,'INVALID_APP_LOCK_ACTION','Μη έγκυρη ενέργεια PIN.');
  const body=input as Record<string,unknown>;
  const action=body.action;
  if(!['configure','verify','change','timeout','disable','lock','touch'].includes(String(action)))throw new ApiError(400,'INVALID_APP_LOCK_ACTION','Μη έγκυρη ενέργεια PIN.');
  const allowed=new Set(['action',...(action==='configure'||action==='change'?['newPin']:[]),...(action!=='configure'&&action!=='lock'&&action!=='touch'?['pin']:[]),...(action==='lock'||action==='touch'?['unlockToken']:[]),...(action==='timeout'||action==='configure'?['idleMinutes']:[])]);
  if(Object.keys(body).some(key=>!allowed.has(key)))throw new ApiError(400,'INVALID_APP_LOCK_ACTION','Μη έγκυρη ενέργεια PIN.');
  if((action==='lock'||action==='touch')&&(typeof body.unlockToken!=='string'||!/^[a-zA-Z0-9_-]{43}$/.test(body.unlockToken)))throw new ApiError(400,'INVALID_UNLOCK_TOKEN','Μη έγκυρο αναγνωριστικό ξεκλειδώματος.');
  if(action!=='configure'&&action!=='lock'&&action!=='touch'&&(typeof body.pin!=='string'||!PIN.test(body.pin)))throw new ApiError(400,'INVALID_APP_PIN','Το PIN πρέπει να έχει 4 ψηφία.');
  if((action==='configure'||action==='change')&&(typeof body.newPin!=='string'||!PIN.test(body.newPin)))throw new ApiError(400,'INVALID_APP_PIN','Το PIN πρέπει να έχει 4 ψηφία.');
  if('idleMinutes' in body&&!IDLE.has(Number(body.idleMinutes)))throw new ApiError(400,'INVALID_IDLE_TIMEOUT','Μη έγκυρος χρόνος κλειδώματος.');
  if(action==='timeout'&&!IDLE.has(Number(body.idleMinutes)))throw new ApiError(400,'INVALID_IDLE_TIMEOUT','Μη έγκυρος χρόνος κλειδώματος.');
  return {action:action as AppLockAction,
    ...(typeof body.pin==='string'?{pin:body.pin}:{}),
    ...(typeof body.newPin==='string'?{newPin:body.newPin}:{}),
    ...(typeof body.unlockToken==='string'?{unlockToken:body.unlockToken}:{}),
    ...(body.idleMinutes!==undefined?{idleMinutes:Number(body.idleMinutes)}:{})};
}

async function appLockRpc(accessToken:string, action:string, pin?:string, newPin?:string, idleMinutes?:number){
  const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
  const apikey=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!url||!apikey)throw new ApiError(503,'APP_LOCK_UNAVAILABLE','Η προστασία PIN δεν είναι διαθέσιμη.',false);
  const response=await fetchUpstream(`${url}/rest/v1/rpc/myfinhub_app_lock_action`,{
    method:'POST',
    headers:{apikey,authorization:`Bearer ${accessToken}`,'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify({p_action:action,p_pin:pin??null,p_new_pin:newPin??null,p_idle_minutes:idleMinutes??null}),
  },'DATA');
  const data=await response.json().catch(()=>null);
  if(!response.ok){
    if(response.status===404)return Promise.reject(new ApiError(503,'APP_LOCK_NOT_MIGRATED','Η λειτουργία PIN δεν έχει ακόμη ενεργοποιηθεί στη βάση.'));
    if(response.status===401||response.status===403)return Promise.reject(new ApiError(403,'APP_LOCK_FORBIDDEN','Απαιτείται πλήρης πρόσβαση ιδιοκτήτη.'));
    throw new ApiError(503,'APP_LOCK_UNAVAILABLE','Η επαλήθευση PIN δεν είναι προσωρινά διαθέσιμη.',false);
  }
  if(!data||typeof data!=='object'||typeof (data as Record<string,unknown>).enabled!=='boolean'||typeof (data as Record<string,unknown>).ok!=='boolean')throw new ApiError(503,'APP_LOCK_INVALID_RESPONSE','Μη έγκυρη απόκριση προστασίας PIN.',false);
  return data as {ok:boolean;enabled:boolean;idleMinutes:number;retryAfterMs:number;error?:string};
}

type RecoveryInput={action:'recover';email:string;password:string;code:string;newPin:string};
export function parseAppLockRecovery(input:unknown):RecoveryInput{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new ApiError(400,'INVALID_APP_LOCK_RECOVERY','Μη έγκυρα στοιχεία ανάκτησης PIN.');
  const body=input as Record<string,unknown>;
  if(body.action!=='recover'||Object.keys(body).some(key=>!['action','email','password','code','newPin'].includes(key))){
    throw new ApiError(400,'INVALID_APP_LOCK_RECOVERY','Μη έγκυρα στοιχεία ανάκτησης PIN.');
  }
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  const password=typeof body.password==='string'?body.password:'';
  const code=typeof body.code==='string'?body.code.trim():'';
  const newPin=typeof body.newPin==='string'?body.newPin:'';
  if(email.length<5||email.length>254||!email.includes('@')||password.length<8||password.length>512||!/^\\d{6}$/.test(code)||!PIN.test(newPin)){
    throw new ApiError(400,'INVALID_APP_LOCK_RECOVERY','Συμπλήρωσε έγκυρο email, κωδικό, TOTP και νέο τετραψήφιο PIN.');
  }
  return {action:'recover',email,password,code,newPin};
}

async function recoverAppLock(session:{accessToken:string;user:{id:string;email?:string|null}},input:RecoveryInput){
  if(session.user.email?.toLowerCase()!==input.email)throw new ApiError(401,'APP_LOCK_RECOVERY_REJECTED','Η επαλήθευση ανάκτησης δεν ολοκληρώθηκε.');
  let temporaryAccess='';
  let verifiedAccess='';
  try{
    const initial=await signInWithPassword(input.email,input.password);
    temporaryAccess=initial.access_token;
    if(!temporaryAccess||initial.user?.id!==session.user.id||accessTokenAal(temporaryAccess)!=='aal1'){
      throw new ApiError(401,'APP_LOCK_RECOVERY_REJECTED','Η επαλήθευση ανάκτησης δεν ολοκληρώθηκε.');
    }
    const factors=await getTotpFactors(temporaryAccess);
    const factor=factors.find(item=>item.status==='verified');
    if(!factor)throw new ApiError(401,'APP_LOCK_RECOVERY_REJECTED','Η επαλήθευση ανάκτησης δεν ολοκληρώθηκε.');
    const challenge=await challengeTotp(temporaryAccess,factor.id);
    const verified=await verifyTotp(temporaryAccess,factor.id,challenge.id,input.code);
    verifiedAccess=verified.access_token;
    if(!verifiedAccess||accessTokenAal(verifiedAccess)!=='aal2'||verified.user?.id!==session.user.id){
      throw new ApiError(401,'APP_LOCK_RECOVERY_REJECTED','Η επαλήθευση ανάκτησης δεν ολοκληρώθηκε.');
    }
    const url=process.env.SUPABASE_URL?.replace(/\\/$/,'');
    const apikey=process.env.SUPABASE_PUBLISHABLE_KEY;
    if(!url||!apikey)throw new ApiError(503,'APP_LOCK_UNAVAILABLE','Η ανάκτηση PIN δεν είναι διαθέσιμη.',false);
    const response=await fetchUpstream(`${url}/rest/v1/rpc/myfinhub_app_lock_recover`,{
      method:'POST',
      headers:{apikey,authorization:`Bearer ${verifiedAccess}`,'content-type':'application/json',accept:'application/json'},
      body:JSON.stringify({p_new_pin:input.newPin}),
    },'DATA');
    const payload=await response.json().catch(()=>null) as {ok?:unknown;enabled?:unknown;idleMinutes?:unknown;retryAfterMs?:unknown}|null;
    if(!response.ok||payload?.ok!==true||payload.enabled!==true||typeof payload.idleMinutes!=='number'){
      throw new ApiError(503,'APP_LOCK_RECOVERY_UNAVAILABLE','Η ανάκτηση PIN δεν ολοκληρώθηκε.',false);
    }
    return payload;
  }catch(error){
    if(error instanceof ApiError&&(error.code==='AUTH_REJECTED'||error.code==='AUTH_RATE_LIMITED')){
      throw new ApiError(error.status===429?429:401,'APP_LOCK_RECOVERY_REJECTED','Η επαλήθευση ανάκτησης δεν ολοκληρώθηκε.');
    }
    throw error;
  }finally{
    // Fresh credentials never replace the user's HttpOnly browser session.
    // End both temporary sessions even when GoTrue or the database rejects.
    if(verifiedAccess)await revokeSession(verifiedAccess);
    if(temporaryAccess)await revokeSession(temporaryAccess);
  }
}

async function updateUnlockTicket(accessToken:string,unlockToken:string,action:'lock'|'touch'){
  const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
  const apikey=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!url||!apikey)throw new ApiError(503,'APP_LOCK_UNAVAILABLE','Η προστασία PIN δεν είναι διαθέσιμη.',false);
  const hash=crypto.createHash('sha256').update(unlockToken).digest('hex');
  const response=await fetchUpstream(`${url}/rest/v1/rpc/myfinhub_app_lock_ticket`,{
    method:'POST',
    headers:{apikey,authorization:`Bearer ${accessToken}`,'content-type':'application/json'},
    body:JSON.stringify({p_action:action==='lock'?'revoke':'touch',p_token_hash:hash}),
  },'DATA');
  if(!response.ok)throw new ApiError(503,'APP_LOCK_UNAVAILABLE','Η προστασία PIN δεν είναι διαθέσιμη.',false);
  const accepted=await response.json().catch(()=>false);
  if(action==='touch'&&accepted!==true)throw new ApiError(423,'APP_LOCK_REQUIRED','Απαιτείται νέο ξεκλείδωμα PIN.');
  return {ok:true};
}

export async function handleAppLockRequest(req:any,res:any){
  await handleApi(res,async()=>{
    const method=String(req.method||'').toUpperCase();
    if(method!=='GET'&&method!=='POST')return methodNotAllowed(res,['GET','POST']);
    // Explicitly reviewed native bearer path: owner + AAL2 + active device only.
    // No bearer-to-cookie fallback and no public CORS relaxation.
    const session=await requireSession(req,res,{allowBearer:true});
    if(!(await isOwner(session.accessToken))){
      clearSessionCookiesIfCookie(req,res,session);
      throw new ApiError(401,'AUTH_REQUIRED','Authentication required.');
    }
    if(accessTokenAal(session.accessToken)!=='aal2')throw new ApiError(403,'MFA_REQUIRED','Verification required.');
    if(method==='GET')return sendJson(res,200,await appLockRpc(session.accessToken,'status'));
    assertMutationSessionOrigin(req,session);
    const raw=await readJsonBody(req,2048);
    if(raw&&typeof raw==='object'&&!Array.isArray(raw)&&(raw as Record<string,unknown>).action==='recover'){
      const recovery=parseAppLockRecovery(raw);
      return sendJson(res,200,await recoverAppLock(session,recovery));
    }
    const action=parseAppLockAction(raw);
    if(action.action==='lock'||action.action==='touch')return sendJson(res,200,await updateUnlockTicket(session.accessToken,action.unlockToken!,action.action));
    return sendJson(res,200,await appLockRpc(session.accessToken,action.action,action.pin,action.newPin,action.idleMinutes));
  });
}
