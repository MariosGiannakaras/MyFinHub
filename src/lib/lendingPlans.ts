import {isValidDateOnly} from './dateOnly.js';
import {lendingOutstandingFor} from './lending.js';
import {centsToMoney,moneyToCents} from './money.js';
import type {FinanceData} from '../types.js';

const exactPositiveCents=(value:number)=>{
  const cents=moneyToCents(value);
  if(!Number.isSafeInteger(cents)||cents<=0||Math.abs(value*100-cents)>1e-6)
    throw new Error('Χρειάζεται θετικό ποσό σε ακριβή λεπτά ευρώ.');
  return cents;
};
const dateAfterMonths=(date:string,months:number)=>{
  const [year,month,day]=date.split('-').map(Number);
  const first=new Date(Date.UTC(year,month-1+months,1));
  const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  const due=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),Math.min(day,last)));
  return due.toISOString().slice(0,10);
};

/** Non-posting settlement projection. Confirmed future dates are not receipts.
 * The receivable changes only when a real repayment/write-off is persisted. */
export function lendingSettlementProjection(
  data:FinanceData,
  args:{person:string;asOf:string;firstDueDate:string;amount:number;installments:number;everyMonths?:number}
){
  const person=args.person.trim();
  if(!person)throw new Error('Διάλεξε πρόσωπο με καταγεγραμμένη οφειλή.');
  if(!isValidDateOnly(args.asOf)||!isValidDateOnly(args.firstDueDate)||args.firstDueDate<args.asOf)
    throw new Error('Η πρώτη ημερομηνία επιστροφής πρέπει να είναι έγκυρη και όχι παλαιότερη του ελέγχου.');
  const count=args.installments,interval=args.everyMonths??1;
  if(!Number.isInteger(count)||count<1||count>60||!Number.isInteger(interval)||interval<1||interval>24)
    throw new Error('Ο αριθμός και η συχνότητα των δόσεων δεν είναι έγκυρα.');
  const cents=exactPositiveCents(args.amount);
  const available=moneyToCents(lendingOutstandingFor(data,person,args.asOf));
  if(!Number.isSafeInteger(available)||available<=0)
    throw new Error('Δεν υπάρχει επαληθευμένη απαίτηση για το πρόσωπο.');
  if(cents>available)throw new Error('Το προτεινόμενο ποσό δεν μπορεί να ξεπερνά την καταγεγραμμένη οφειλή.');
  if(cents<count)throw new Error('Κάθε προτεινόμενη δόση πρέπει να είναι τουλάχιστον ένα λεπτό του ευρώ.');
  const per=Math.floor(cents/count),extra=cents%count;
  const schedule=Array.from({length:count},(_,index)=>({
    dueDate:dateAfterMonths(args.firstDueDate,index*interval),
    amount:centsToMoney(per+(index===count-1?extra:0)),
    status:'planned' as const
  }));
  return {person,asOf:args.asOf,total:centsToMoney(cents),outstanding:centsToMoney(available),schedule,
    note:'Μόνο προγραμματισμένη επιστροφή — καμία οικονομική κίνηση ή είσπραξη δεν καταχωρίστηκε.'};
}
