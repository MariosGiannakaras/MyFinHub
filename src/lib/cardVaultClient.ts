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
  return request<{saved:true;last4:string|null}>('PUT',{cardId,...secret});
}

/** Explicit secret destruction only. Archiving a card must never call this. */
export async function deleteCardSecret(cardId:string){
  return request<{deleted:true}>('DELETE',{cardId});
}

export function cardVaultErrorMessage(error:unknown){
  if(error instanceof CardVaultClientError){
    if(error.code==='CARD_SECRET_NOT_FOUND')return 'Δεν έχουν αποθηκευτεί ακόμη αριθμός/λήξη για αυτή την κάρτα.';
    if(error.code==='INVALID_CARD_PAN')return 'Ο αριθμός κάρτας δεν είναι έγκυρος.';
    if(error.code==='INVALID_CARD_EXPIRY')return 'Η λήξη πρέπει να είναι σε μορφή MM/YY.';
    if(error.code==='MFA_REQUIRED')return 'Απαιτείται ξανά επαλήθευση MFA για τα ασφαλή στοιχεία.';
    if(error.code==='CARD_VAULT_RATE_LIMITED')return 'Έγιναν πολλές ενέργειες ασφαλών στοιχείων. Δοκίμασε ξανά σε λίγο.';
    return error.message;
  }
  return 'Το ασφαλές vault καρτών δεν είναι διαθέσιμο αυτή τη στιγμή.';
}
