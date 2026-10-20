import {createEvent} from './domain.js';
import {centsToMoney,moneyToCents} from './money.js';
import type {FinanceData,FinanceEvent} from '../types.js';

export function linkedFeeFor(data:FinanceData,principalId:string):FinanceEvent|null{
  return (data.state.events??[]).find(event=>event.feeForEventId===principalId)??null;
}

export function buildLinkedTransferFee(
  data:FinanceData,principal:FinanceEvent,args:{amount:number;category:string;note?:string}
):FinanceEvent|null{
  if(!['transfer','withdrawal','card_payment'].includes(principal.kind)||!principal.fromAccountId)
    throw new Error('Η προμήθεια χρειάζεται έγκυρη μεταφορά ή πληρωμή.');
  const cents=moneyToCents(args.amount);
  if(!Number.isSafeInteger(cents)||cents<0)
    throw new Error('Η προμήθεια πρέπει να είναι έγκυρο μη αρνητικό ποσό σε λεπτά.');
  if(cents===0)return null;
  if(!data.state.settings.expenseCategories.includes(args.category))
    throw new Error('Διάλεξε διαθέσιμη κατηγορία εξόδων για την προμήθεια.');
  const event=createEvent({
    kind:'expense',date:principal.date,amount:centsToMoney(cents),
    note:args.note?.trim()||'Προμήθεια μεταφοράς / πληρωμής',
    category:args.category,accountId:principal.fromAccountId
  });
  const previous=linkedFeeFor(data,principal.id);
  return {...event,id:previous?.id??event.id,createdAt:previous?.createdAt??event.createdAt,feeForEventId:principal.id};
}

/** One immutable change: main transfer and actual commission belong to the
 * same revision, Do/Undo/Redo history point and save acknowledgement. */
export function replaceLinkedTransferWithFee(data:FinanceData,principal:FinanceEvent,fee:FinanceEvent|null):FinanceData{
  if(!['transfer','withdrawal','card_payment'].includes(principal.kind)||!principal.fromAccountId)
    throw new Error('Μη έγκυρη κύρια μεταφορά ή πληρωμή.');
  const original=data.state.events??[];
  const previous=linkedFeeFor(data,principal.id);
  if(original.filter(e=>e.feeForEventId===principal.id).length>1)
    throw new Error('Πολλαπλές προμήθειες για την ίδια κίνηση.');
  if(fee&&(fee.kind!=='expense'||fee.feeForEventId!==principal.id||
     fee.accountId!==principal.fromAccountId||fee.date!==principal.date))
    throw new Error('Η προμήθεια δεν ανήκει στην κύρια οικονομική κίνηση.');
  if(fee&&previous&&fee.id!==previous.id)
    throw new Error('Δεν επιτρέπεται αλλαγή ιστορικού ID προμήθειας.');
  if(fee&&original.some(e=>e.id===fee.id&&e.id!==previous?.id))
    throw new Error('Το ID της προμήθειας χρησιμοποιείται ήδη.');
  const existingPrincipal=original.find(e=>e.id===principal.id);
  if(existingPrincipal&&existingPrincipal.kind!==principal.kind)
    throw new Error('Η υπάρχουσα κίνηση έχει διαφορετικό τύπο.');
  return {...data,state:{...data.state,events:[
    ...original.filter(e=>e.id!==principal.id&&e.id!==previous?.id),
    principal,...(fee?[fee]:[])
  ]}};
}
