import { saveCardSecret } from './cardVaultClient.js';
import { deleteLocalCvv } from './localCvvVault.js';
import type { PaymentCard } from '../types.js';

type CardDetailsField='pan'|'expiry'|'cvv';

export class CardDetailsInputError extends Error{
  field:CardDetailsField;
  constructor(field:CardDetailsField,message:string){super(message);this.name='CardDetailsInputError';this.field=field;}
}

export function formatCardNumberInput(value:string){
  // 16 digits, grouped into four quartets while the owner types or pastes.
  return value.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();
}

// Existing encrypted vault entries are never silently truncated on read.
// Older nonstandard values can be viewed, but must be replaced with a valid
// 16-digit PAN before a new write is accepted.
export function formatStoredCardNumberInput(value:string){
  return value.replace(/\D/g,'').replace(/(.{4})/g,'$1 ').trim();
}

export function formatCardExpiryInput(value:string){
  const digits=value.replace(/\D/g,'').slice(0,4);
  return digits.length>2?`${digits.slice(0,2)}/${digits.slice(2)}`:digits;
}

export function normalizeCardDetailsInput(input:{pan:string;expiry:string;cvv?:string},{requireCvv=false}:{requireCvv?:boolean}={}){
  const pan=input.pan.replace(/\D/g,'');
  if(!/^\d{16}$/.test(pan))throw new CardDetailsInputError('pan','Ο αριθμός κάρτας πρέπει να έχει ακριβώς 16 ψηφία (4 τετράδες).');
  const expiry=formatCardExpiryInput(input.expiry);
  const match=expiry.match(/^(\d{2})\/(\d{2})$/);
  if(!match)throw new CardDetailsInputError('expiry','Η λήξη πρέπει να έχει μορφή MM/YY.');
  const month=Number(match[1]);
  const year=2000+Number(match[2]);
  const today=new Date();
  // Cards remain valid through the last day of their expiry month.
  if(month<1||month>12||year<today.getUTCFullYear()||(year===today.getUTCFullYear()&&month<today.getUTCMonth()+1)){
    throw new CardDetailsInputError('expiry','Η λήξη πρέπει να έχει έγκυρο μήνα (01–12) και να μην έχει παρέλθει.');
  }
  const rawCvv=input.cvv?.trim()??'';
  let cvv:string|undefined;
  if(rawCvv){
    if(!/^\d{3}$/.test(rawCvv))throw new CardDetailsInputError('cvv','Το CVV πρέπει να έχει ακριβώς 3 ψηφία.');
    cvv=rawCvv;
  }else if(requireCvv){
    throw new CardDetailsInputError('cvv','Γράψε το CVV 3 ψηφίων για να ολοκληρωθεί η νέα κάρτα.');
  }
  return {pan,expiry:`${match[1]}/${match[2]}`,cvv};
}

export type CardDetailsPersistence={
  saveSecret:(cardId:string,secret:{pan?:string;expiry?:string;cvv?:string})=>Promise<{saved:true;last4:string|null}>;
  now:()=>string;
  cleanupLocalCvv?:(cardId:string)=>Promise<void>;
};

const defaultPersistence:CardDetailsPersistence={
  saveSecret:saveCardSecret,
  now:()=>new Date().toISOString(),
  cleanupLocalCvv:deleteLocalCvv,
};

export async function saveCardDetails(
  card:PaymentCard,
  input:{pan:string;expiry:string;cvv?:string},
  options:{requireCvv?:boolean}={},
  persistence:CardDetailsPersistence=defaultPersistence,
):Promise<PaymentCard>{
  const normalized=normalizeCardDetailsInput(input,options);
  const receipt=await persistence.saveSecret(card.id,{pan:normalized.pan,expiry:normalized.expiry,cvv:normalized.cvv});
  if(normalized.cvv&&persistence.cleanupLocalCvv){
    try{await persistence.cleanupLocalCvv(card.id)}catch{/* Server persistence already succeeded; a stale local compatibility copy can be cleaned later. */}
  }
  const candidateLast4=receipt.last4??(normalized.pan.length>=4?normalized.pan.slice(-4):null);
  const last4=candidateLast4&&/^\d{4}$/.test(candidateLast4)?candidateLast4:undefined;
  return {...card,last4,vaultRef:card.id,updatedAt:persistence.now()};
}
