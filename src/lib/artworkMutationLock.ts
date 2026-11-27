import { assertCurrentAuthScope } from './authScopedCache.js';

// No persistent identifiers, tokens or finance payloads. Unsupported browsers
// retain the existing in-memory per-target guards and server authorization.
export function withArtworkMutationLock<T>(
  target:string,scope:number,busy:()=>Error,uncertain:()=>boolean,work:()=>Promise<T>,
):Promise<T>{
  if(typeof window!=='undefined'&&window.isSecureContext&&navigator.locks)
    return import('./artworkWebLock.js').then(module=>module.runArtworkWebLock(target,scope,busy,uncertain,work));
  assertCurrentAuthScope(scope);
  return work();
}
