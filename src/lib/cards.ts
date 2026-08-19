import type { CardBank, CardKind, FinanceData, FinanceEvent, PaymentCard } from '../types.js';

export const DEFAULT_CARD_BANKS:CardBank[]=[
  {id:'piraeus',name:'ΠΕΙΡΑΙΩΣ',order:10},
  {id:'revolut',name:'REVOLUT',order:20},
  {id:'alpha',name:'ALPHA BANK',order:30},
  {id:'payzy',name:'PAYZY',order:40},
  {id:'viva',name:'VIVA',order:50},
];

export function cardBanks(data:FinanceData){
  const custom=data.state.cardBanks??[];
  const byId=new Map<string,CardBank>();
  for(const bank of [...DEFAULT_CARD_BANKS,...custom])byId.set(bank.id,bank);
  return [...byId.values()].sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name,'el'));
}

export function allCards(data:FinanceData){
  return [...(data.state.cards??[])].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
}

export function cardsForBank(data:FinanceData,bankId:string){
  return allCards(data).filter(card=>card.bankId===bankId&&card.active!==false);
}

export function archivedCardsForBank(data:FinanceData,bankId:string){
  return allCards(data).filter(card=>card.bankId===bankId&&card.active===false).sort((a,b)=>(b.archivedAt??b.updatedAt).localeCompare(a.archivedAt??a.updatedAt));
}

export function creditCards(data:FinanceData,{includeArchived=false}:{includeArchived?:boolean}={}){
  return allCards(data).filter(card=>card.kind==='credit'&&(includeArchived||card.active!==false));
}

/**
 * RheomIQ currently has one credit-liability account. The active credit card
 * record is therefore the single visual/metadata identity for that liability.
 * If the card is archived, the newest archived credit record remains the
 * historical identity so its events and vault row can be restored in place.
 */
export function primaryCreditCard(data:FinanceData){
  const active=creditCards(data)[0];
  if(active)return active;
  return creditCards(data,{includeArchived:true}).filter(card=>card.active===false).sort((a,b)=>(b.archivedAt??b.updatedAt).localeCompare(a.archivedAt??a.updatedAt))[0];
}

export function archivedCardMatch(data:FinanceData,args:{bankId:string;kind:CardKind;last4?:string}){
  const last4=args.last4?.replace(/\D/g,'');
  if(last4?.length!==4)return undefined;
  return archivedCardsForBank(data,args.bankId).find(card=>card.kind===args.kind&&card.last4===last4);
}

export function restoreCard(card:PaymentCard,now=new Date().toISOString()):PaymentCard{
  const {archivedAt:_archivedAt,...rest}=card;
  return {...rest,active:true,updatedAt:now};
}

export function archiveCardRecord(card:PaymentCard,now=new Date().toISOString()):PaymentCard{
  return {...card,active:false,archivedAt:now,updatedAt:now};
}

export function creditEventsForCard(data:FinanceData,cardId:string){
  const primary=primaryCreditCard(data);
  return (data.state.events??[]).filter((event:FinanceEvent)=>{
    if(event.kind!=='card_purchase'&&event.kind!=='card_payment')return false;
    if(event.cardId)return event.cardId===cardId;
    // Existing pre-linkage credit events belong to the historical primary card.
    return primary?.id===cardId;
  });
}

export function cardLabel(card:PaymentCard){return card.nickname.trim()||`${card.kind==='credit'?'Πιστωτική':card.kind==='prepaid'?'Prepaid':'Χρεωστική'} ${card.last4?`•••• ${card.last4}`:''}`.trim()}
export function cardKindLabel(card:PaymentCard){return card.kind==='credit'?'Πιστωτική':card.kind==='prepaid'?'Prepaid':'Χρεωστική'}
export function cardNetworkLabel(card:PaymentCard){return card.network==='mastercard'?'Mastercard':card.network==='visa'?'Visa':'Κάρτα'}