import { AUTH_EXPIRED_EVENT, MFA_REQUIRED_EVENT } from './authExpiry.js';

// One browser-wide auth boundary, not three parallel listener sets.
let epoch=0;
const resets=new Set<()=>void>();
if(typeof window!=='undefined'){
  const invalidate=()=>{epoch++;resets.forEach(reset=>reset())};
  for(const event of [AUTH_EXPIRED_EVENT,MFA_REQUIRED_EVENT,'myfinhub:auth-completed','myfinhub:auth-scope-reset'])
    window.addEventListener(event,invalidate);
}
export function watchAuthScope(onReset:()=>void){
  resets.add(onReset);
  return ()=>epoch;
}
