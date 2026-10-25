import type {FinanceData,FinanceEvent,RecurringItem} from '../types.js';
import {centsToMoney,moneyToCents} from './money.js';

const exactPositiveCents=(value:number)=>{
  const cents=moneyToCents(value);
  return Number.isSafeInteger(cents)&&cents>0&&Math.abs(value*100-cents)<1e-6;
};

/** Estimates do not post financial events or pretend to be actual bank charges. */
export function recurringVariableAmountError(item:RecurringItem):string|null{
  const mode=item.amountMode??'fixed';
  if(mode!=='fixed'&&mode!=='variable')return 'Επίλεξε έγκυρο τύπο ποσού παγίου.';
  if(mode!=='variable')
    return item.estimateMin!==undefined||item.estimateMax!==undefined?'Το εύρος ποσού επιτρέπεται μόνο σε μεταβλητά πάγια.':null;
  if(!exactPositiveCents(item.amount))return 'Η εκτίμηση πρέπει να είναι θετικό ποσό με δύο δεκαδικά.';
  const min=item.estimateMin,max=item.estimateMax;
  if((min===undefined)!==(max===undefined))return 'Συμπλήρωσε και τα δύο άκρα του εύρους ή κανένα.';
  if(min!==undefined&&max!==undefined&&(!exactPositiveCents(min)||!exactPositiveCents(max)||min>item.amount||item.amount>max))
    return 'Το εύρος πρέπει να περιλαμβάνει την εκτίμηση και να χρησιμοποιεί λεπτά ευρώ.';
  return null;
}

export function recurringExpectedAmount(item:RecurringItem){
  const error=recurringVariableAmountError(item);
  if(error)throw new Error(error);
  const estimated=item.amountMode==='variable';
  return {
    amount:centsToMoney(moneyToCents(item.amount)),
    confidence:estimated?'estimated' as const:'fixed' as const,
    min:estimated?item.estimateMin:undefined,
    max:estimated?item.estimateMax:undefined,
    label:estimated?'Εκτίμηση · όχι πραγματική χρέωση':'Σταθερό ποσό'
  };
}

/** Actual money exists only in canonical linked expense events, not projections. */
export function recurringActualPayments(
  data:FinanceData,recurringId:string,fromDate:string,throughDate:string
):{events:FinanceEvent[];amount:number}{
  const events=(data.state.events??[]).filter(event=>
    event.kind==='expense'&&event.recurringId===recurringId&&
    event.date>=fromDate&&event.date<=throughDate
  ).slice().sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const total=events.reduce((sum,event)=>sum+moneyToCents(event.amount),0);
  if(!Number.isSafeInteger(total))throw new Error('Μη έγκυρο πραγματικό ποσό πληρωμών.');
  return {events,amount:centsToMoney(total)};
}
