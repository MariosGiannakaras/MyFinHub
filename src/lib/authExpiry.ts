export const AUTH_RELOGIN_MESSAGE='Η πρόσβαση έληξε ή ανακλήθηκε. Συνδέσου ξανά.';

export function notifyAuthExpired(status:number,code?:string){
  if(typeof window==='undefined')return;
  const event=status===401&&(code==='AUTH_REQUIRED'||code==='DEVICE_ACCESS_REVOKED')
    ?'rheomiq:auth-expired'
    :status===403&&code==='MFA_REQUIRED'?'rheomiq:mfa-required':null;
  if(event)window.dispatchEvent(new Event(event));
}
