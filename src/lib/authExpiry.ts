export function notifyAuthExpired(status:number,code?:string){
  if(typeof window==='undefined')return;
  if(status===401&&(code==='AUTH_REQUIRED'||code==='DEVICE_ACCESS_REVOKED')){
    window.dispatchEvent(new Event('rheomiq:auth-expired'));
    return;
  }
  if(status===403&&code==='MFA_REQUIRED'){
    window.dispatchEvent(new Event('rheomiq:mfa-required'));
  }
}
