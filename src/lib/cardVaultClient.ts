import { notifyAuthExpired } from './authExpiry.js';
import { ApiError, apiRequest } from './api.js';
import { trackDatabaseWrite } from './databaseSaveActivity.js';
import { readLocalCvv } from './localCvvVault.js';
import { authScopeEpoch as authEpoch } from './authScopedCache.js';
type CardVaultSecret={pan?:string;expiry?:string;cvv?:string};

type ErrorPayload={code?:string;error?:string};

// Never show old-owner PAN/CVV or claim a previous-session write succeeded
// after the cookie/MFA/device authentication scope has changed.
function staleVaultScope():CardVaultClientError{
  return new CardVaultClientError(409,'CARD_VAULT_AUTH_SCOPE_CHANGED',
    'Η συνεδρία άλλαξε κατά την ενέργεια ασφαλών στοιχείων.');
}

export class CardVaultClientError extends Error{
  code:string;
  status:number;
  constructor(status:number,code:string,message:string){super(message);this.name='CardVaultClientError';this.status=status;this.code=code;}
}

/** A mutating vault operation can commit before its receipt is lost. No
 * secret values or raw upstream errors may escape via this classification. */
export class UnverifiedCardVaultWrite extends Error{
  constructor(public readonly operation:'save'|'delete'){
    super('Η απόκριση του ασφαλούς vault δεν επιβεβαιώθηκε.');
    this.name='UnverifiedCardVaultWrite';
  }
}

function vaultMutationMayHaveCommitted(reason:unknown):boolean{
  return (reason instanceof ApiError || reason instanceof CardVaultClientError)&&
    (reason.status===0||reason.status===408||reason.status===429||reason.status>=500);
}

async function requireVaultWriteReceipt<T>(
  operation:'save'|'delete',
  action:()=>Promise<T>,
  confirmed:(receipt:T)=>boolean,
):Promise<T>{
  const epoch=authEpoch();
  try{
    const receipt=await action();
    if(epoch!==authEpoch()||!confirmed(receipt))throw new UnverifiedCardVaultWrite(operation);
    return receipt;
  }catch(reason){
    if(reason instanceof UnverifiedCardVaultWrite)throw reason;
    if(reason instanceof CardVaultClientError&&reason.code==='CARD_VAULT_AUTH_SCOPE_CHANGED')
      throw new UnverifiedCardVaultWrite(operation);
    if(vaultMutationMayHaveCommitted(reason))throw new UnverifiedCardVaultWrite(operation);
    throw reason;
  }
}

async function request<T>(method:'POST'|'PUT'|'DELETE',body:Record<string,unknown>):Promise<T>{
  const epoch=authEpoch();
  let response:Response;
  try{
    response=await apiRequest('/api/card-secrets',{
      method,
      credentials:'same-origin',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(body),
    });
  }catch(error){
    // The old request may have reached the server. Never carry its transport
    // error into a new session as proof of a current-owner outcome.
    if(epoch!==authEpoch())throw staleVaultScope();
    throw error;
  }
  const payload=await response.json().catch(()=>({})) as ErrorPayload&T;
  // Check after the body resolves and BEFORE notifyAuthExpired: a delayed
  // old-device 401 must not expire a newer valid owner session.
  if(epoch!==authEpoch())throw staleVaultScope();
  if(!response.ok){
    const code=payload.code||'CARD_VAULT_ERROR';
    notifyAuthExpired(response.status,code);
    throw new CardVaultClientError(response.status,code,payload.error||'Η ενέργεια ασφαλών στοιχείων απέτυχε.');
  }
  return payload as T;
}

export async function revealCardSecret(cardId:string):Promise<CardVaultSecret>{
  const epoch=authEpoch();
  let missing=false;
  let payload:{pan:string|null;expiry:string|null;cvv:string|null}={pan:null,expiry:null,cvv:null};
  try{payload=await request<typeof payload>('POST',{cardId})}
  catch(error){
    if(error instanceof CardVaultClientError&&error.code==='CARD_SECRET_NOT_FOUND')missing=true;
    else throw error;
  }
  const secret:CardVaultSecret={pan:payload.pan||undefined,expiry:payload.expiry||undefined,cvv:payload.cvv||undefined};

  // Compatibility read only: never upload a legacy local CVV merely because the user revealed it.
  // Explicit Save/Update is the migration boundary.
  if(!secret.cvv&&typeof indexedDB!=='undefined'){
    try{
      const legacy=await readLocalCvv(cardId);
      if(legacy){secret.cvv=legacy;missing=false}
    }catch{
      // Local compatibility read is best effort; server data remains authoritative.
    }
  }
  // Includes an async legacy IndexedDB CVV fallback: an old response must
  // not leak PAN/CVV after logout, new MFA or another owner auth boundary.
  if(epoch!==authEpoch())throw staleVaultScope();
  if(missing)throw new CardVaultClientError(404,'CARD_SECRET_NOT_FOUND','Δεν υπάρχουν αποθηκευμένα στοιχεία για αυτή την κάρτα.');
  return secret;
}

export async function saveCardSecret(cardId:string,secret:CardVaultSecret){
  // Runtime whitelist as well as TypeScript typing: arbitrary extra fields never reach the request.
  return trackDatabaseWrite(()=>requireVaultWriteReceipt('save',
    ()=>request<{saved:true;last4:string|null}>('PUT',{cardId,pan:secret.pan,expiry:secret.expiry,cvv:secret.cvv}),
    receipt=>receipt?.saved===true&&
      (receipt.last4===null||(typeof receipt.last4==='string'&&/^\d{4}$/.test(receipt.last4)))&&
      (!secret.pan||receipt.last4===secret.pan.slice(-4)),
  ));
}

/** Explicit secret destruction only. Archiving a card must never call this. */
export async function deleteCardSecret(cardId:string,requireCommittedDeletion=false){
  return trackDatabaseWrite(()=>requireVaultWriteReceipt('delete',
    ()=>request<{deleted:true}>('DELETE',requireCommittedDeletion?{cardId,requireCommittedDeletion:true}:{cardId}),
    receipt=>receipt?.deleted===true,
  ));
}

export function cardVaultErrorMessage(error:unknown){
  if(error instanceof UnverifiedCardVaultWrite)return error.operation==='save'
    ?'Η αποθήκευση στο ασφαλές vault ίσως ολοκληρώθηκε, αλλά η απόκριση δεν επιβεβαιώθηκε. Κλείσε τη φόρμα, επαναφόρτωσε και έλεγξε τα αποθηκευμένα στοιχεία πριν κάνεις νέα αποθήκευση.'
    :'Η διαγραφή από το ασφαλές vault ίσως ολοκληρώθηκε, αλλά δεν επιβεβαιώθηκε. Επαναφόρτωσε και έλεγξε τα αποθηκευμένα στοιχεία πριν κάνεις νέα διαγραφή.';
  if(error instanceof ApiError){
    if(error.code==='NETWORK_TIMEOUT')return 'Η σύνδεση με το ασφαλές vault άργησε πολύ. Η κατάσταση των στοιχείων δεν επιβεβαιώθηκε.';
    if(error.code==='NETWORK_ERROR'||error.code==='REQUEST_ABORTED')return 'Δεν ήταν δυνατή η σύνδεση με το ασφαλές vault. Η κατάσταση των αποθηκευμένων στοιχείων δεν επιβεβαιώθηκε.';
  }
  if(error instanceof CardVaultClientError){
    if(error.code==='CARD_VAULT_AUTH_SCOPE_CHANGED')return 'Η σύνδεση άλλαξε κατά την ενέργεια ασφαλών στοιχείων. Κλείσε τη φόρμα και άνοιξέ την ξανά μετά την επαλήθευση.';
    if(error.code==='CARD_SECRET_NOT_FOUND')return 'Δεν έχουν αποθηκευτεί ακόμη αριθμός και λήξη για αυτή την κάρτα.';
    if(error.code==='INVALID_CARD_PAN')return 'Ο αριθμός κάρτας πρέπει να έχει ακριβώς 16 ψηφία (4 τετράδες).';
    if(error.code==='INVALID_CARD_EXPIRY')return 'Έλεγξε τη λήξη: MM/YY, μήνας 01–12 και όχι περασμένη ημερομηνία.';
    if(error.code==='INVALID_CARD_CVV')return 'Το CVV πρέπει να έχει ακριβώς 3 αριθμητικά ψηφία.';
    if(error.code==='MFA_REQUIRED')return 'Για να δεις ή να αλλάξεις τα ασφαλή στοιχεία της κάρτας, χρειάζεται να επαληθεύσεις ξανά τη σύνδεσή σου.';
    if(error.code==='DEVICE_ACCESS_REVOKED'||error.code==='AUTH_REQUIRED')return 'Η πρόσβαση αυτής της συσκευής έχει λήξει. Συνδέσου ξανά και ολοκλήρωσε την επαλήθευση MFA.';
    if(error.code==='CARD_VAULT_CONFIG_ERROR')return 'Η ασφαλής αποθήκευση καρτών δεν είναι διαθέσιμη λόγω ρύθμισης του διακομιστή. Τα υπόλοιπα στοιχεία της κάρτας δεν χάθηκαν.';
    if(error.code==='CARD_VAULT_RATE_LIMITED')return 'Έγιναν πολλές προσπάθειες σε μικρό χρονικό διάστημα. Περίμενε λίγο και δοκίμασε ξανά.';
    return 'Δεν μπορέσαμε να ολοκληρώσουμε την ενέργεια στα ασφαλή στοιχεία της κάρτας. Δοκίμασε ξανά.';
  }
  return 'Τα ασφαλή στοιχεία της κάρτας δεν είναι διαθέσιμα αυτή τη στιγμή. Δοκίμασε ξανά.';
}
