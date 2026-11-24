// One browser-wide auth boundary, not three parallel listener sets.
let epoch=0;
const resets=new Set<()=>void>();
if(typeof window!=='undefined'){
  const invalidate=()=>{epoch++;resets.forEach(reset=>reset())};
  for(const event of 'rheomiq:auth-expired rheomiq:mfa-required myfinhub:auth-completed myfinhub:auth-scope-reset'.split(' '))
    window.addEventListener(event,invalidate);
}
export const authScopeEpoch=()=>epoch;
export function assertCurrentAuthScope(origin:number){
  if(origin!==epoch)throw new Error('Η συνεδρία άλλαξε πριν σταλεί η ενημέρωση.');
}
export function watchAuthScope(onReset:()=>void){
  resets.add(onReset);
  return authScopeEpoch;
}
