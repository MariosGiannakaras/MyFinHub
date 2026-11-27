import { assertCurrentAuthScope, authScopeEpoch, subscribeAuthScopeReset } from './authScopedCache.js';

// Nonblocking same-origin cross-tab exclusion. An uncertain result returns to
// the editor promptly but holds this target while its originating auth scope
// remains alive. Full teardown releases browser locks; durable server intent
// recovery is a separate boundary, not something browser storage may replace.
export function runArtworkWebLock<T>(
  target:string,scope:number,busy:()=>Error,uncertain:()=>boolean,work:()=>Promise<T>,
):Promise<T>{
  return new Promise<T>((resolve,reject)=>{
    void navigator.locks.request('myfinhub:artwork:'+target,{ifAvailable:true},async lock=>{
      if(!lock)throw busy();
      assertCurrentAuthScope(scope);
      try{return await work()}
      catch(error){
        if(scope===authScopeEpoch()&&uncertain()){
          reject(error);
          await new Promise<void>(done=>{
            const unsubscribe=subscribeAuthScopeReset(()=>{unsubscribe();done()});
          });
        }
        throw error;
      }
    }).then(resolve,reject);
  });
}
