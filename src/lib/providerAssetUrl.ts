export function publicAssetUrlAllowed(value:string){
  try{
    const url=new URL(value);
    if(url.protocol==='https:')return true;
    if(url.protocol!=='http:')return false;
    return url.hostname==='127.0.0.1'||url.hostname==='localhost'||url.hostname==='[::1]';
  }catch{return false}
}

export const providerAssetUrlAllowed=publicAssetUrlAllowed;
