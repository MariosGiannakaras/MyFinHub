import { saveCardSecret } from './cardVaultClient.js';
import type { PaymentCard } from '../types.js';

export type CardDetailsField='pan'|'expiry'|'cvv';

export class CardDetailsInputError extends Error{
  field:CardDetailsField;
  constructor(field:CardDetailsField,message:string){super(message);this.name='CardDetailsInputError';this.field=field;}
}

export function formatCardNumberInput(value:string){
  return value.replace(/\D/g,'').replace(/(.{4})/g,'$1 ').trim();
}

export function formatCardExpiryInput(value:string){
  const digits=value.replace(/\D/g,'').slice(0,4);
  return digits.length>2?`${digits.slice(0,2)}/${digits.slice(2)}`:digits;
}

export function normalizeCardDetailsInput(input:{pan:string;expiry:string;cvv?:string},{requireCvv=false}:{requireCvv?:boolean}={}){
  const pan=input.pan.replace(/\D/g,'');
  if(!pan)throw new CardDetailsInputError('pan','Γράψε τον αριθμό της κάρτας με αριθμητικά ψηφία.');
  const expiry=formatCardExpiryInput(input.expiry);
  const match=expiry.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
  if(!match)throw new CardDetailsInputError('expiry','Η λήξη πρέπει να είναι έγκυρος μήνας σε μορφή MM/YY.');
  const rawCvv=input.cvv?.trim()??'';
  let cvv:string|undefined;
  if(rawCvv){
    try{cvv=normalizeLocalCvv(rawCvv)}
    catch{throw new CardDetailsInputError('cvv','Το CVV πρέπει να έχει 3 ή 4 αριθμητικά ψηφία.')}
  }else if(requireCvv){
    throw new CardDetailsInputError('cvv','Γράψε το CVV για να ολοκληρωθεί η νέα κάρτα.');
  }
  return {pan,expiry:`${match[1]}/${match[2]}`,cvv};
}

export type CardDetailsPersistence={
  readCvv:(cardId:string)=>Promise<string|null>;
  saveCvv:(cardId:string,cvv:string)=>Promise<void>;
  deleteCvv:(cardId:string)=>Promise<void>;
  saveSecret:(cardId:string,secret:{pan?:string;expiry?:string;cvv?:string})=>Promise<{saved:true;last4:string|null}>;
  now:()=>string;
};

const defaultPersistence:CardDetailsPersistence={
  readCvv:readLocalCvv,
  saveCvv:saveLocalCvv,
  deleteCvv:deleteLocalCvv,
  saveSecret:saveCardSecret,
  now:()=>new Date().toISOString(),
};

export async function saveCardDetails(
  card:PaymentCard,
  input:{pan:string;expiry:string;cvv?:string},
  options:{requireCvv?:boolean}={},
  persistence:CardDetailsPersistence=defaultPersistence,
):Promise<PaymentCard>{
  const normalized=normalizeCardDetailsInput(input,options);
  let previousCvv:string|null|undefined;
  if(normalized.cvv){
    previousCvv=await persistence.readCvv(card.id);
    await persistence.saveCvv(card.id,normalized.cvv);
  }
  let receipt:{saved:true;last4:string|null};
  try{
    receipt=await persistence.saveSecret(card.id,{pan:normalized.pan,expiry:normalized.expiry});
  }catch(error){
    if(normalized.cvv){
      try{
        if(previousCvv)await persistence.saveCvv(card.id,previousCvv);
        else await persistence.deleteCvv(card.id);
      }catch{
        // Preserve the original server-side save error if best-effort local rollback fails.
      }
    }
    throw error;
  }
  const candidateLast4=receipt.last4??(normalized.pan.length>=4?normalized.pan.slice(-4):null);
  const last4=candidateLast4&&/^\d{4}$/.test(candidateLast4)?candidateLast4:undefined;
  return {...card,last4,vaultRef:card.id,updatedAt:persistence.now()};
}
