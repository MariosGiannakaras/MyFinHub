import type { FinanceEvent, PersonAction, SettlementMethod } from '../types.js';

export type PersonEventArgs = {
  action: PersonAction;
  person: string;
  date: string;
  amount: number;
  note?: string;
  accountId?: string;
  category?: string;
  subcategory?: string;
  settlementMethod?: SettlementMethod;
  personShare?: number;
  currentBalance?: number;
};

function requirePositive(value:number,label:string){
  if(!Number.isFinite(value)||value<=0)throw new Error(`${label} πρέπει να είναι θετικό ποσό.`);
  return Number(value.toFixed(2));
}
function requireAccount(value?:string){if(!value)throw new Error('Απαιτείται λογαριασμός.');return value}
function base(args:PersonEventArgs,kind:FinanceEvent['kind'],amount:number):FinanceEvent{
  const now=new Date().toISOString();
  return {id:`evt-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,date:args.date,kind,amount,note:args.note?.trim()||'',category:args.category,subcategory:args.subcategory,accountId:args.accountId,person:args.person.trim(),legs:[],personAction:args.action,settlementMethod:args.settlementMethod,source:'user',createdAt:now,updatedAt:now};
}

/** Signed person balance: positive = they owe the user; negative = the user owes them. */
export function createPersonEvent(args:PersonEventArgs):FinanceEvent{
  const person=args.person.trim();
  if(!person)throw new Error('Συμπλήρωσε το πρόσωπο.');
  const amount=requirePositive(args.amount,'Το ποσό');

  if(args.action==='paid_for_other'){
    const account=requireAccount(args.accountId);
    const event=base(args,'lending',amount);
    event.note=event.note||'Πλήρωσα για άλλον';
    event.legs=[{accountId:account,amount:-amount}];
    event.receivableDelta=amount;
    event.personBalanceDelta=amount;
    return event;
  }

  if(args.action==='paid_by_other'){
    const event=base(args,'expense',amount);
    event.note=event.note||'Πλήρωσε άλλος για μένα';
    event.legs=[];
    event.receivableDelta=-amount;
    event.personBalanceDelta=-amount;
    return event;
  }

  if(args.action==='shared_purchase'){
    const total=amount;
    const personShare=requirePositive(Number(args.personShare),'Το μερίδιο του άλλου');
    if(personShare>=total)throw new Error('Το μερίδιο του άλλου πρέπει να είναι μικρότερο από το συνολικό ποσό.');
    const account=requireAccount(args.accountId);
    const ownShare=Number((total-personShare).toFixed(2));
    const event=base(args,'expense',ownShare);
    event.note=event.note||'Μοιρασμένη αγορά';
    event.legs=[{accountId:account,amount:-total}];
    event.paymentTotal=total;
    event.receivableDelta=personShare;
    event.personBalanceDelta=personShare;
    return event;
  }

  if(args.action==='settlement_received'){
    const current=Number(args.currentBalance||0);
    if(current<=0)throw new Error('Δεν υπάρχει ποσό που να σου χρωστά αυτό το πρόσωπο.');
    if(amount>current+.009)throw new Error('Η τακτοποίηση δεν μπορεί να ξεπερνά το ποσό που σου χρωστά.');
    const account=requireAccount(args.accountId);
    const event=base(args,'transfer',amount);
    event.note=event.note||'Μου επέστρεψαν χρήματα';
    event.legs=[{accountId:account,amount}];
    event.receivableDelta=-amount;
    event.personBalanceDelta=-amount;
    return event;
  }

  if(args.action==='settlement_sent'){
    const current=Number(args.currentBalance||0);
    if(current>=0)throw new Error('Δεν υπάρχει ποσό που να χρωστάς σε αυτό το πρόσωπο.');
    if(amount>Math.abs(current)+.009)throw new Error('Η τακτοποίηση δεν μπορεί να ξεπερνά το ποσό που χρωστάς.');
    const account=requireAccount(args.accountId);
    const event=base(args,'transfer',amount);
    event.note=event.note||'Επέστρεψα χρήματα';
    event.legs=[{accountId:account,amount:-amount}];
    event.receivableDelta=amount;
    event.personBalanceDelta=amount;
    return event;
  }

  const current=Number(args.currentBalance||0);
  if(Math.abs(current)<.009)throw new Error('Δεν υπάρχει οφειλή για διαγραφή ή συμψηφισμό.');
  if(amount>Math.abs(current)+.009)throw new Error('Η διαγραφή δεν μπορεί να ξεπερνά το εκκρεμές ποσό.');
  const event=base(args,'transfer',amount);
  event.note=event.note||'Χάρισμα / συμψηφισμός οφειλής';
  const delta=current>0?-amount:amount;
  event.receivableDelta=delta;
  event.personBalanceDelta=delta;
  return event;
}

export function personBalanceDelta(event:FinanceEvent){
  return Number(event.personBalanceDelta ?? event.receivableDelta ?? 0);
}

export function settlementMethodLabel(method?:SettlementMethod){
  if(method==='iris')return 'IRIS';
  if(method==='cash')return 'Μετρητά';
  if(method==='bank_transfer')return 'Τραπεζική μεταφορά';
  return method==='other'?'Άλλο':'—';
}
