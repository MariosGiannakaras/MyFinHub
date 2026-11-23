// One browser-wide auth boundary, not three parallel listener sets.
let epoch=0;
const resets=new Set<()=>void>();
if(typeof window!=='undefined'){
  const invalidate=()=>{epoch++;resets.forEach(reset=>reset())};
  for(const event of 'rheomiq:auth-expired rheomiq:mfa-required myfinhub:auth-completed myfinhub:auth-scope-reset'.split(' '))
    window.addEventListener(event,invalidate);
}
export function watchAuthScope(onReset:()=>void){
  resets.add(onReset);
  return ()=>epoch;
}

// Read-only epoch provenance does not register another per-client listener.
export const authScopeEpoch=()=>epoch;
