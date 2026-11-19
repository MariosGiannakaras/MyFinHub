// One browser-wide auth boundary, not three parallel listener sets: every
// owner-scoped store receives the same monotonic epoch and clears its cache.
let epoch=0;
const resets=new Set<()=>void>();
const invalidate=()=>{
  epoch++;
  for(const reset of resets)reset();
};
if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){
  for(const event of [
    'rheomiq:auth-expired','rheomiq:mfa-required',
    'myfinhub:auth-completed','myfinhub:auth-scope-reset',
  ])window.addEventListener(event,invalidate);
}
export function watchAuthScope(onReset:()=>void):()=>number{
  resets.add(onReset);
  return ()=>epoch;
}
