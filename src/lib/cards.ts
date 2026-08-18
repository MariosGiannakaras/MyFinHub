import type { CardBank, FinanceData, PaymentCard } from '../types.js';

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

export function cardsForBank(data:FinanceData,bankId:string){
  return (data.state.cards??[]).filter(card=>card.bankId===bankId&&card.active!==false).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
}

export function cardLabel(card:PaymentCard){return card.nickname.trim()||`${card.kind==='credit'?'Πιστωτική':card.kind==='prepaid'?'Prepaid':'Χρεωστική'} ${card.last4?`•••• ${card.last4}`:''}`.trim()}
export function cardKindLabel(card:PaymentCard){return card.kind==='credit'?'Πιστωτική':card.kind==='prepaid'?'Prepaid':'Χρεωστική'}
export function cardNetworkLabel(card:PaymentCard){return card.network==='mastercard'?'Mastercard':card.network==='visa'?'Visa':'Κάρτα'}
