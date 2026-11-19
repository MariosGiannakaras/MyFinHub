// Owner-scoped metadata must not survive logout/MFA downgrade or a new
// authenticated session. A returned epoch lets pending reads discard stale
// completions rather than repopulate data from an earlier session.
export function watchAuthScope(onReset:()=>void):()=>number{
  let epoch=0;
  if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){
    const reset=()=>{epoch++;onReset()};
    for(const name of [
      'rheomiq:auth-expired','rheomiq:mfa-required',
      'myfinhub:auth-completed','myfinhub:auth-scope-reset',
    ])window.addEventListener(name,reset);
  }
  return ()=>epoch;
}
