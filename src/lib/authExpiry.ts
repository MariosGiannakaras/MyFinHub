// Shared event identities: both expiry dispatch and auth-scope cache reset use
// the same owner/session events, never parallel literal contracts.
export const AUTH_EXPIRED_EVENT='rheomiq:auth-expired';
export const MFA_REQUIRED_EVENT='rheomiq:mfa-required';

export function notifyAuthExpired(status:number,code?:string){
  if(typeof window==='undefined')return;
  const event=status===401&&(code==='AUTH_REQUIRED'||code==='DEVICE_ACCESS_REVOKED')
    ?AUTH_EXPIRED_EVENT
    :status===403&&code==='MFA_REQUIRED'?MFA_REQUIRED_EVENT:null;
  if(event)window.dispatchEvent(new Event(event));
}
