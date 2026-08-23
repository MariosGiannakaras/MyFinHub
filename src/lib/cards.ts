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

export function storedCards(data:FinanceData,{includeArchived=false}:{includeArchived?:boolean}={}){
  return allCards(data).filter(card=>card.kind!=='credit'&&(includeArchived||card.active!==false));
}

export function cardsForBank(data:FinanceData,bankId:string){
  return storedCards(data).filter(card=>card.bankId===bankId&&card.active!==false);
}

export function archivedCardsForBank(data:FinanceData,bankId:string){
  return storedCards(data,{includeArchived:true}).filter(card=>card.bankId===bankId&&card.active===false).sort((a,b)=>(b.archivedAt??b.updatedAt).localeCompare(a.archivedAt??a.updatedAt));
}

export function creditCards(data:FinanceData,{includeArchived=false}:{includeArchived?:boolean}={}){
  return allCards(data).filter(card=>card.kind==='credit'&&(includeArchived||card.active!==false));
}

export function deletedCreditCards(data:FinanceData){
  return [...(data.state.deletedCards??[])].filter(card=>card.kind==='credit').sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
}

/**
 * Legacy credit events created before cardId linkage used one shared liability.
 * Keep their historical owner deterministic even if that oldest credit profile
 * is later permanently deleted: deleted tombstones retain only id/timestamps.
 */
export function legacyCreditOwnerId(data:FinanceData){
  const identities=[
    ...creditCards(data,{includeArchived:true}).map(card=>({id:card.id,createdAt:card.createdAt})),
    ...deletedCreditCards(data).map(card=>({id:card.id,createdAt:card.createdAt})),
  ];
  return identities.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))[0]?.id;
}

export function primaryCreditCard(data:FinanceData){
  return creditCards(data,{includeArchived:true})[0];
}

export function archivedCardMatch(data:FinanceData,args:{bankId:string;kind:CardKind;last4?:string}){
  const last4=args.last4?.replace(/\D/g,'');
  if(last4?.length!==4)return undefined;
  return allCards(data).filter(card=>card.active===false).find(card=>card.bankId===args.bankId&&card.kind===args.kind&&card.last4===last4);
}

export function restoreCard(card:PaymentCard,now=new Date().toISOString()):PaymentCard{
  const {archivedAt:_archivedAt,...rest}=card;
  return {...rest,active:true,updatedAt:now};
}

export function archiveCardRecord(card:PaymentCard,now=new Date().toISOString()):PaymentCard{
  return {...card,active:false,archivedAt:now,updatedAt:now};
}

export function creditEventsForCard(data:FinanceData,cardId:string){
  const legacyOwnerId=legacyCreditOwnerId(data);
  return (data.state.events??[]).filter((event:FinanceEvent)=>{
    if(event.kind!=='card_purchase'&&event.kind!=='card_payment')return false;
    if(event.cardId)return event.cardId===cardId;
    return legacyOwnerId===cardId;
  });
}

export function creditDebtForCard(data:FinanceData,cardId:string,asOf:string){
  return Math.max(0,creditEventsForCard(data,cardId).reduce((sum,event)=>{
    if(event.date>asOf)return sum;
    if(event.kind==='card_purchase')return sum+Number(event.amount||0);
    if(event.kind==='card_payment')return sum-Number(event.amount||0);
    return sum;
  },0));
}

export function creditLimitForCard(data:FinanceData,card:PaymentCard){
  const explicit=Number(card.creditLimit);
  if(Number.isFinite(explicit)&&explicit>=0)return explicit;
  const legacy=Number(data.state.settings.creditLimit);
  return Number.isFinite(legacy)&&legacy>=0?legacy:0;
}

export function creditAvailableForCard(data:FinanceData,card:PaymentCard,asOf:string){
  return Math.max(0,creditLimitForCard(data,card)-creditDebtForCard(data,card.id,asOf));
}

export function canPermanentlyDeleteCreditCard(data:FinanceData,cardId:string,asOf:string){
  const card=allCards(data).find(item=>item.id===cardId);
  return card?.kind==='credit'&&card.active===false&&creditDebtForCard(data,cardId,asOf)<=0.005;
}

export function withCardProfileDeleted(data:FinanceData,card:PaymentCard,deletedAt=new Date().toISOString(),asOf=deletedAt.slice(0,10)):FinanceData{
  const cards=data.state.cards??[];
  if(!cards.some(item=>item.id===card.id))return data;
  if(card.kind==='credit'&&card.active!==false)throw new Error('CREDIT_CARD_MUST_BE_ARCHIVED');
  if(card.kind==='credit'&&!canPermanentlyDeleteCreditCard(data,card.id,asOf))throw new Error('CREDIT_CARD_HAS_OUTSTANDING_BALANCE');
  const linkedEvents=(data.state.events??[]).filter(event=>event.cardId===card.id&&(event.kind==='card_purchase'||event.kind==='card_payment'));
  if(card.kind!=='credit'&&linkedEvents.length)throw new Error('NON_CREDIT_CARD_HAS_FINANCE_HISTORY');
  const deletedCards=card.kind==='credit'
    ? [...(data.state.deletedCards??[]).filter(item=>item.id!==card.id),{id:card.id,kind:'credit' as const,createdAt:card.createdAt,deletedAt}]
    : data.state.deletedCards??[];
  return {...data,state:{...data.state,cards:cards.filter(item=>item.id!==card.id),deletedCards}};
}

export function historicalCardLabel(data:FinanceData,cardId:string){
  const current=allCards(data).find(card=>card.id===cardId);
  if(current)return cardLabel(current);
  if(deletedCreditCards(data).some(card=>card.id===cardId))return 'Διαγραμμένη κάρτα';
  return 'Άγνωστη κάρτα';
}

export function cardLabel(card:PaymentCard){return card.nickname.trim()||`${card.kind==='credit'?'Πιστωτική':card.kind==='prepaid'?'Prepaid':'Χρεωστική'} ${card.last4?`•••• ${card.last4}`:''}`.trim()}
export function cardKindLabel(card:PaymentCard){return card.kind==='credit'?'Πιστωτική':card.kind==='prepaid'?'Prepaid':'Χρεωστική'}
export function cardNetworkLabel(card:PaymentCard){return card.network==='mastercard'?'Mastercard':card.network==='visa'?'Visa':'Κάρτα'}
