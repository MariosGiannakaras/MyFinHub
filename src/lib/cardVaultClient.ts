import { notifyAuthExpired } from './authExpiry.js';
import { ApiError, apiRequest } from './api.js';
import { readLocalCvv } from './localCvvVault.js';
type CardVaultSecret={pan?:string;expiry?:string;cvv?:string};

type ErrorPayload={code?:string;error?:string};

export class CardVaultClientError extends Error{
  code:string;
  status:number;
  constructor(status:number,code:string,message:string){super(message);this.name='CardVaultClientError';this.status=status;this.code=code;}
}

async function request<T>(method:'POST'|'PUT'|'DELETE',body:Record<string,unknown>):Promise<T>{
  const response=await apiRequest('/api/card-secrets',{
    method,
    credentials:'same-origin',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body),
  });
  const payload=await response.json().catch(()=>({})) as ErrorPayload&T;
  if(!response.ok){
    const code=payload.code||'CARD_VAULT_ERROR';
    notifyAuthExpired(response.status,code);
    throw new CardVaultClientError(response.status,code,payload.error||'Η ενέργεια ασφαλών στοιχείων απέτυχε.');
  }
  return payload as T;
}

export async function revealCardSecret(cardId:string):Promise<CardVaultSecret>{
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
  if(missing)throw new CardVaultClientError(404,'CARD_SECRET_NOT_FOUND','Δεν υπάρχουν αποθηκευμένα στοιχεία για αυτή την κάρτα.');
  return secret;
}

export async function saveCardSecret(cardId:string,secret:CardVaultSecret){
  // Runtime whitelist as well as TypeScript typing: arbitrary extra fields never reach the request.
  return request<{saved:true;last4:string|null}>('PUT',{cardId,pan:secret.pan,expiry:secret.expiry,cvv:secret.cvv});
}

/** Explicit secret destruction only. Archiving a card must never call this. */
export async function deleteCardSecret(cardId:string){
  return request<{deleted:true}>('DELETE',{cardId});
}

export function cardVaultErrorMessage(error:unknown){
  if(error instanceof ApiError){
    if(error.code==='NETWORK_TIMEOUT')return 'Η σύνδεση με το ασφαλές vault άργησε πολύ. Έλεγξε τη σύνδεσή σου και δοκίμασε ξανά.';
    if(error.code==='NETWORK_ERROR'||error.code==='REQUEST_ABORTED')return 'Δεν ήταν δυνατή η σύνδεση με το ασφαλές vault. Τα αποθηκευμένα στοιχεία δεν άλλαξαν.';
  }
  if(error instanceof CardVaultClientError){
    if(error.code==='CARD_SECRET_NOT_FOUND')return 'Δεν έχουν αποθηκευτεί ακόμη αριθμός και λήξη για αυτή την κάρτα.';
    if(error.code==='INVALID_CARD_PAN')return 'Γράψε έναν αριθμό κάρτας με αριθμητικά ψηφία.';
    if(error.code==='INVALID_CARD_EXPIRY')return 'Έλεγξε τη λήξη της κάρτας — χρησιμοποίησε μορφή MM/YY.';
    if(error.code==='INVALID_CARD_CVV')return 'Το CVV πρέπει να έχει 3 ή 4 αριθμητικά ψηφία.';
    if(error.code==='MFA_REQUIRED')return 'Για να δεις ή να αλλάξεις τα ασφαλή στοιχεία της κάρτας, χρειάζεται να επαληθεύσεις ξανά τη σύνδεσή σου.';
    if(error.code==='DEVICE_ACCESS_REVOKED'||error.code==='AUTH_REQUIRED')return 'Η πρόσβαση αυτής της συσκευής έχει λήξει. Συνδέσου ξανά και ολοκλήρωσε την επαλήθευση MFA.';
    if(error.code==='CARD_VAULT_CONFIG_ERROR')return 'Η ασφαλής αποθήκευση καρτών δεν είναι διαθέσιμη λόγω ρύθμισης του διακομιστή. Τα υπόλοιπα στοιχεία της κάρτας δεν χάθηκαν.';
    if(error.code==='CARD_VAULT_RATE_LIMITED')return 'Έγιναν πολλές προσπάθειες σε μικρό χρονικό διάστημα. Περίμενε λίγο και δοκίμασε ξανά.';
    return 'Δεν μπορέσαμε να ολοκληρώσουμε την ενέργεια στα ασφαλή στοιχεία της κάρτας. Δοκίμασε ξανά.';
  }
  return 'Τα ασφαλή στοιχεία της κάρτας δεν είναι διαθέσιμα αυτή τη στιγμή. Δοκίμασε ξανά.';
}
