// Auth-scope epoch is owned by the shared observer. Re-export for vault
// requests that already depend on this expiry boundary.
export { authScopeEpoch } from './authScopedCache.js';

export function notifyAuthExpired(status:number,code?:string){
  if(typeof window==='undefined')return;
  const event=status===401&&(code==='AUTH_REQUIRED'||code==='DEVICE_ACCESS_REVOKED')
    ?'rheomiq:auth-expired'
    :status===403&&code==='MFA_REQUIRED'?'rheomiq:mfa-required':null;
  if(event)window.dispatchEvent(new Event(event));
}
