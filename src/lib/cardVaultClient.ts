export type CardVaultSecret={pan?:string;expiry?:string};

type ErrorPayload={code?:string;error?:string};

export class CardVaultClientError extends Error{
  code:string;
  status:number;
  constructor(status:number,code:string,message:string){super(message);this.name='CardVaultClientError';this.status=status;this.code=code;}
}

async function request<T>(method:'POST'|'PUT'|'DELETE',body:Record<string,unknown>):Promise<T>{
  const response=await fetch('/api/card-secrets',{
    method,
    credentials:'same-origin',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body),
  });
  const payload=await response.json().catch(()=>({})) as ErrorPayload&T;
  if(!response.ok){throw new CardVaultClientError(response.status,payload.code||'CARD_VAULT_ERROR',payload.error||'Η ενέργεια ασφαλών στοιχείων απέτυχε.');}
  return payload as T;
}

export async function revealCardSecret(cardId:string):Promise<CardVaultSecret>{
  const payload=await request<{pan:string|null;expiry:string|null}>('POST',{cardId});
  return {pan:payload.pan||undefined,expiry:payload.expiry||undefined};
}

export async function saveCardSecret(cardId:string,secret:CardVaultSecret){
  // Runtime whitelist as well as TypeScript typing: an accidental extra field
  // on a structurally-compatible object can never be spread into the request.
  return request<{saved:true;last4:string|null}>('PUT',{cardId,pan:secret.pan,expiry:secret.expiry});
}

/** Explicit secret destruction only. Archiving a card must never call this. */
export async function deleteCardSecret(cardId:string){
  return request<{deleted:true}>('DELETE',{cardId});
}

export function cardVaultErrorMessage(error:unknown){
  if(error instanceof CardVaultClientError){
    if(error.code==='CARD_SECRET_NOT_FOUND')return 'Δεν έχουν αποθηκευτεί ακόμη αριθμός και λήξη για αυτή την κάρτα.';
    if(error.code==='INVALID_CARD_PAN')return 'Έλεγξε τον αριθμό της κάρτας — χρειάζονται 16 ψηφία.';
    if(error.code==='INVALID_CARD_EXPIRY')return 'Έλεγξε τη λήξη της κάρτας — χρησιμοποίησε μορφή MM/YY.';
    if(error.code==='MFA_REQUIRED')return 'Για να δεις ή να αλλάξεις τα ασφαλή στοιχεία της κάρτας, χρειάζεται να επαληθεύσεις ξανά τη σύνδεσή σου.';
    if(error.code==='CARD_VAULT_RATE_LIMITED')return 'Έγιναν πολλές προσπάθειες σε μικρό χρονικό διάστημα. Περίμενε λίγο και δοκίμασε ξανά.';
    return 'Δεν μπορέσαμε να ολοκληρώσουμε την ενέργεια στα ασφαλή στοιχεία της κάρτας. Δοκίμασε ξανά.';
  }
  return 'Τα ασφαλή στοιχεία της κάρτας δεν είναι διαθέσιμα αυτή τη στιγμή. Δοκίμασε ξανά.';
}
