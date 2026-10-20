import { accountBalances, allAccounts, effectiveLegacyTransactions } from './domain.js';
import { isValidDateOnly } from './dateOnly.js';
import { centsToMoney, moneyToCents } from './money.js';
import type { FinanceData } from '../types.js';

/**
 * Manual reconciliation is as-of, not the current-day balance. Candidates are
 * evidence to review, never inferred bank matches or auto-imported purchases.
 */
export interface ReconciliationCandidate {
  id: string;
  date: string;
  note: string;
  amount: number;
  origin: 'event' | 'legacy';
  sameAmount: boolean;
}

export interface ManualReconciliationPreview {
  expectedBalance: number;
  differenceCents: number | null;
  duplicateOnDate: boolean;
  candidates: ReconciliationCandidate[];
  matchingCandidates: number;
}

const isoDayBefore = (date:string,days:number)=>{
  const parsed=new Date(date+'T00:00:00Z');
  parsed.setUTCDate(parsed.getUTCDate()-days);
  return parsed.toISOString().slice(0,10);
};

export function manualReconciliationPreview(
  data:FinanceData,
  accountId:string,
  asOf:string,
  options:{verifiedBalance?:number|null;statementMovement?:number|null;editingEventId?:string}={}
):ManualReconciliationPreview {
  if(!isValidDateOnly(asOf))throw new Error('Επίλεξε έγκυρη ημερομηνία για τον έλεγχο.');
  if(!allAccounts(data).some(a=>a.id===accountId&&a.kind!=='credit'))throw new Error('Επίλεξε διαθέσιμο λογαριασμό.');
  // Exclude the *entire* previously persisted adjustment during edits, even
  // if its date or account has changed, so it is never applied twice.
  const considered=options.editingEventId?{
    ...data,state:{...data.state,events:(data.state.events??[]).filter(e=>e.id!==options.editingEventId)}
  }:data;
  const expectedCents=moneyToCents(accountBalances(considered,asOf)[accountId]??0);
  if(!Number.isSafeInteger(expectedCents))throw new Error('Μη έγκυρο υπολογισμένο υπόλοιπο.');
  let differenceCents:number|null=null;
  if(options.verifiedBalance!==null&&options.verifiedBalance!==undefined){
    const verified=moneyToCents(options.verifiedBalance);
    if(!Number.isSafeInteger(verified))throw new Error('Μη έγκυρο επαληθευμένο υπόλοιπο.');
    differenceCents=verified-expectedCents;
    if(!Number.isSafeInteger(differenceCents))throw new Error('Η διαφορά υπερβαίνει το επιτρεπτό όριο.');
  }
  const movementCents=options.statementMovement===null||options.statementMovement===undefined?null:moneyToCents(options.statementMovement);
  if(movementCents!==null&&(!Number.isSafeInteger(movementCents)||movementCents<=0))throw new Error('Το ποσό αναζήτησης κίνησης πρέπει να είναι θετικό.');
  const from=isoDayBefore(asOf,7);
  const candidates:ReconciliationCandidate[]=[];
  for(const event of data.state.events??[]){
    if(event.id===options.editingEventId||event.date<from||event.date>asOf)continue;
    const delta=event.legs.filter(leg=>leg.accountId===accountId).reduce((sum,leg)=>sum+moneyToCents(leg.amount),0);
    if(!Number.isSafeInteger(delta)||delta===0)continue;
    candidates.push({id:event.id,date:event.date,note:event.note||event.kind,amount:centsToMoney(delta),origin:'event',sameAmount:movementCents!==null&&Math.abs(delta)===movementCents});
  }
  for(const tx of effectiveLegacyTransactions(data)){
    if(tx.date<from||tx.date>asOf)continue;
    let signed=0;
    if(tx.type==='transfer'){
      if(tx.fromAccountId===accountId)signed=-tx.amount;
      if(tx.toAccountId===accountId)signed=tx.amount;
    }else if(tx.accountId===accountId){
      signed=tx.type==='expense'?-tx.amount:tx.amount;
    }
    const cents=moneyToCents(signed);
    if(!Number.isSafeInteger(cents)||cents===0)continue;
    candidates.push({id:tx.id,date:tx.date,note:tx.note||tx.type,amount:centsToMoney(cents),origin:'legacy',sameAmount:movementCents!==null&&Math.abs(cents)===movementCents});
  }
  candidates.sort((a,b)=>Number(b.sameAmount)-Number(a.sameAmount)||b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  return {
    expectedBalance:centsToMoney(expectedCents),
    differenceCents,
    duplicateOnDate:(data.state.events??[]).some(event=>event.id!==options.editingEventId&&event.kind==='reconciliation'&&event.accountId===accountId&&event.date===asOf),
    matchingCandidates:candidates.filter(candidate=>candidate.sameAmount).length,
    candidates:candidates.slice(0,8),
  };
}

export function manualReconciliationDraftError(preview:ManualReconciliationPreview,confirmed:boolean){
  if(preview.duplicateOnDate)return 'Υπάρχει ήδη διόρθωση για αυτόν τον λογαριασμό και την ημέρα. Έλεγξε ή επεξεργάσου την υπάρχουσα κίνηση.';
  if(preview.differenceCents===null)return 'Συμπλήρωσε το επαληθευμένο υπόλοιπο της συγκεκριμένης ημέρας.';
  if(preview.differenceCents===0)return 'Δεν υπάρχει διαφορά υπολοίπου. Δεν δημιουργείται μηδενική οικονομική κίνηση.';
  if(!confirmed)return 'Επιβεβαίωσε ότι το υπόλοιπο προέρχεται από πραγματικό έλεγχο και ότι εξέτασες τις υπάρχουσες κινήσεις.';
  return null;
}
