import {allAccounts} from './domain.js';
import {centsToMoney,moneyToCents} from './money.js';
import type {FinanceData,LedgerLeg} from '../types.js';

type FundingSource={
  kind:'account'|'credit';
  /** A real cash/bank/savings account, never the virtual credit liability. */
  accountId?:string;
  /** An active owned credit card, present only when kind is credit. */
  cardId?:string;
  amount:number;
};

type FundingLeg={kind:'account'|'credit';sourceId:string;amount:number};

const exactCents=(value:number)=>{
  const cents=moneyToCents(value);
  if(!Number.isSafeInteger(cents)||cents<=0||Math.abs(value*100-cents)>1e-6)
    throw new Error('Κάθε πηγή χρειάζεται θετικό ακριβές ποσό σε ευρώ και λεπτά.');
  return cents;
};

/**
 * Pure contract for one economic purchase paid from >=2 distinct sources.
 * This is NOT a ledger write; consumers must persist one canonical event
 * only after versioned DB/event-kind and card statement semantics are ready.
 */
export function buildMultiSourceFundingPlan(
  data:FinanceData,
  draft:{sources:FundingSource[];total:number}
):{total:number;creditAmount:number;creditDelta:number;cardId?:string;funding:FundingLeg[];legs:LedgerLeg[]}{
  if(draft.sources.length<2||draft.sources.length>12)
    throw new Error('Επίλεξε από δύο έως δώδεκα διαφορετικές πηγές πληρωμής.');
  const expectedCents=exactCents(draft.total);
  const accounts=new Set(allAccounts(data).filter(a=>a.kind!=='credit').map(a=>a.id));
  const seen=new Set<string>();
  const funding:FundingLeg[]=[];
  const legs:LedgerLeg[]=[];
  let sumCents=0,creditCents=0,cardId:string|undefined;
  for(const source of draft.sources){
    const cents=exactCents(source.amount);
    let key:string,legAccount:string;
    if(source.kind==='credit'){
      if(source.accountId)throw new Error('Η πιστωτική πηγή δεν είναι λογαριασμός καταθέσεων.');
      const card=(data.state.cards??[]).find(c=>c.id===source.cardId&&c.kind==='credit'&&c.active!==false);
      if(!card)throw new Error('Διάλεξε ενεργή πιστωτική κάρτα.');
      if(cardId)throw new Error('Μία αγορά επιτρέπει μόνο μία πιστωτική κάρτα ανά λογιστικό γεγονός.');
      cardId=card.id;creditCents=cents;key=`credit:${card.id}`;legAccount='credit-card';
    }else{
      if(source.kind!=='account'||!source.accountId||!accounts.has(source.accountId)||source.cardId)
        throw new Error('Διάλεξε υπαρκτό λογαριασμό πληρωμής για κάθε πηγή.');
      key=`account:${source.accountId}`;legAccount=source.accountId;
    }
    if(seen.has(key))throw new Error('Η ίδια πηγή πληρωμής δεν μπορεί να εμφανίζεται δύο φορές.');
    seen.add(key);
    sumCents+=cents;
    if(!Number.isSafeInteger(sumCents))throw new Error('Το άθροισμα υπερβαίνει το επιτρεπτό όριο.');
    funding.push({kind:source.kind,sourceId:source.kind==='credit'?cardId!:source.accountId!,amount:centsToMoney(cents)});
    legs.push({accountId:legAccount,amount:centsToMoney(-cents)});
  }
  if(sumCents!==expectedCents)throw new Error('Τα επιμέρους ποσά δεν ισούνται ακριβώς με το συνολικό ποσό αγοράς.');
  return {
    total:centsToMoney(sumCents),
    creditAmount:centsToMoney(creditCents),
    creditDelta:centsToMoney(-creditCents),
    cardId,
    funding,
    legs
  };
}
