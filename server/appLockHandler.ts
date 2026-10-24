import { accessTokenAal, assertMutationSessionOrigin, clearSessionCookiesIfCookie, requireSession } from './auth.js';
import { ApiError, handleApi, methodNotAllowed, readJsonBody, sendJson } from './http.js';
import { isOwner } from './storage.js';
import { fetchUpstream } from './upstream.js';

type AppLockAction = 'configure'|'verify'|'change'|'timeout'|'disable';
type PinAction = {action:AppLockAction;pin?:string;newPin?:string;idleMinutes?:number};
const PIN=/^[0-9]{4}$/;
const IDLE=new Set([1,5,15,30,60]);

export function parseAppLockAction(input:unknown):PinAction{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new ApiError(400,'INVALID_APP_LOCK_ACTION','Μη έγκυρη ενέργεια PIN.');
  const body=input as Record<string,unknown>;
  const action=body.action;
  if(!['configure','verify','change','timeout','disable'].includes(String(action)))throw new ApiError(400,'INVALID_APP_LOCK_ACTION','Μη έγκυρη ενέργεια PIN.');
  const allowed=new Set(['action',...(action==='configure'||action==='change'?['newPin']:[]),...(action!=='configure'?['pin']:[]),...(action==='timeout'||action==='configure'?['idleMinutes']:[])]);
  if(Object.keys(body).some(key=>!allowed.has(key)))throw new ApiError(400,'INVALID_APP_LOCK_ACTION','Μη έγκυρη ενέργεια PIN.');
  if(action!=='configure'&&(typeof body.pin!=='string'||!PIN.test(body.pin)))throw new ApiError(400,'INVALID_APP_PIN','Το PIN πρέπει να έχει 4 ψηφία.');
  if((action==='configure'||action==='change')&&(typeof body.newPin!=='string'||!PIN.test(body.newPin)))throw new ApiError(400,'INVALID_APP_PIN','Το PIN πρέπει να έχει 4 ψηφία.');
  if('idleMinutes' in body&&!IDLE.has(Number(body.idleMinutes)))throw new ApiError(400,'INVALID_IDLE_TIMEOUT','Μη έγκυρος χρόνος κλειδώματος.');
  if(action==='timeout'&&!IDLE.has(Number(body.idleMinutes)))throw new ApiError(400,'INVALID_IDLE_TIMEOUT','Μη έγκυρος χρόνος κλειδώματος.');
  return {action:action as AppLockAction,
    ...(typeof body.pin==='string'?{pin:body.pin}:{}),
    ...(typeof body.newPin==='string'?{newPin:body.newPin}:{}),
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
  if(!data||typeof data!=='object'||typeof data.enabled!=='boolean'||typeof data.ok!=='boolean')throw new ApiError(503,'APP_LOCK_INVALID_RESPONSE','Μη έγκυρη απόκριση προστασίας PIN.',false);
  return data as {ok:boolean;enabled:boolean;idleMinutes:number;retryAfterMs:number;error?:string};
}

export async function handleAppLockRequest(req:any,res:any){
  await handleApi(res,async()=>{
    const method=String(req.method||'').toUpperCase();
    if(method!=='GET'&&method!=='POST')return methodNotAllowed(res,['GET','POST']);
    const session=await requireSession(req,res);
    if(!(await isOwner(session.accessToken))){
      clearSessionCookiesIfCookie(req,res,session);
      throw new ApiError(401,'AUTH_REQUIRED','Authentication required.');
    }
    if(accessTokenAal(session.accessToken)!=='aal2')throw new ApiError(403,'MFA_REQUIRED','Verification required.');
    if(method==='GET')return sendJson(res,200,await appLockRpc(session.accessToken,'status'));
    assertMutationSessionOrigin(req,session);
    const action=parseAppLockAction(await readJsonBody(req,512));
    return sendJson(res,200,await appLockRpc(session.accessToken,action.action,action.pin,action.newPin,action.idleMinutes));
  });
}
