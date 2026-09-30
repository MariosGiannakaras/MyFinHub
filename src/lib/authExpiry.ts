export function notifyAuthExpired(status:number,code?:string){
  if(
    status===401
    && (code==='AUTH_REQUIRED'||code==='DEVICE_ACCESS_REVOKED')
    && typeof window!=='undefined'
  ){
    window.dispatchEvent(new Event('rheomiq:auth-expired'));
  }
}
