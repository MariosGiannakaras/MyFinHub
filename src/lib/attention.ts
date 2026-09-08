import { budgetProgress } from './budgets.js';
import { creditCards, creditDebtForCard, creditLimitForCard, cardLabel } from './cards.js';
import { creditStatementViews } from './creditStatements.js';
import { accountBalances, allAccounts, effectiveLegacyTransactions } from './domain.js';
import { addDays, cashFlowForecast, LOW_BALANCE_THRESHOLD } from './forecast.js';
import { lendingOutstandingFor } from './lending.js';
import { isSelfLoan, loanPaymentEvents, loanRemainingInstallments, typicalLoanPaymentDay } from './loans.js';
import { activeRecurringItems, recurringPayments, typicalPaymentDay } from './recurring.js';
import { pendingScheduled, scheduledLifecycle } from './scheduled.js';
import type { AttentionDecision, FinanceData, FinanceEvent, Loan, RecurringItem } from '../types.js';

export type AttentionSeverity = 'danger' | 'warning' | 'info';
export type AttentionKind = 'scheduled' | 'recurring' | 'recurring_expiry' | 'loan' | 'credit' | 'lending' | 'forecast' | 'budget' | 'account_balance' | 'transaction' | 'duplicate';
export type AttentionAction =
  | 'complete_scheduled'
  | 'pay_recurring'
  | 'pay_loan'
  | 'pay_credit'
  | 'collect_lending'
  | 'open_forecast'
  | 'open_budgets'
  | 'open_dashboard'
  | 'open_recurring'
  | 'categorize_transaction'
  | 'review_duplicate';

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  severity: AttentionSeverity;
  title: string;
  reason: string;
  dueDate?: string;
  amount?: number;
  accountId?: string;
  cardId?: string;
  statementId?: string;
  person?: string;
  recurringId?: string;
  loanId?: string;
  scheduledId?: string;
  budgetId?: string;
  transactionId?: string;
  transactionSource?: 'legacy' | 'event';
  action: AttentionAction;
  fingerprint: string;
}

const UPCOMING_DAYS = 7;
const EXPIRY_LOOKAHEAD_DAYS = 30;
const CREDIT_WARNING_RATIO = .8;
const MAX_TRANSACTION_ATTENTION = 50;
const MAX_DUPLICATE_GROUPS = 20;

function utc(value:string){return new Date(`${value}T12:00:00Z`)}
function daysBetween(from:string,to:string){return Math.round((utc(to).getTime()-utc(from).getTime())/86400000)}
function monthDate(asOf:string,day:number,monthOffset=0){
  const base=utc(asOf);const month=base.getUTCMonth()+monthOffset;const last=new Date(Date.UTC(base.getUTCFullYear(),month+1,0)).getUTCDate();
  return new Date(Date.UTC(base.getUTCFullYear(),month,Math.min(Math.max(1,day),last),12)).toISOString().slice(0,10);
}
function monthStart(value:string){return `${value.slice(0,7)}-01`}
function fingerprint(parts:Array<string|number|undefined|null>){return parts.map(value=>String(value??'')).join('|')}
function make(item:Omit<AttentionItem,'fingerprint'>):AttentionItem{return {...item,fingerprint:fingerprint([item.kind,item.id,item.severity,item.dueDate,item.amount,item.accountId,item.cardId,item.statementId,item.person,item.recurringId,item.transactionId,item.transactionSource,item.action,item.title,item.reason])}}
function accountName(data:FinanceData,id:string){return allAccounts(data).find(account=>account.id===id)?.name??data.state.settings.accountNames?.[id]??data.seed.accounts.find(account=>account.id===id)?.name??id}
function descriptionTitle(note:string){return String(note??'').split(/\r?\n/)[0].trim()||'Συναλλαγή χωρίς περιγραφή'}
function normalizedDescription(note:string){return descriptionTitle(note).normalize('NFKC').toLocaleLowerCase('el-GR').replace(/\s+/g,' ').trim()}
function uncategorized(category?:string){const value=String(category??'').trim().toLocaleLowerCase('el-GR');return !value||value==='άλλο'||value==='χωρίς κατηγορία'||value==='uncategorized'}

function effectiveLoans(data:FinanceData):Loan[]{
  const seeded=(data.seed.loans??[]).map(loan=>data.state.loanOverrides?.[loan.id]??loan);
  return [...seeded,...(data.state.customLoans??[])];
}

function recurringDue(data:FinanceData,item:RecurringItem,asOf:string){
  const day=typicalPaymentDay(data,item);if(!day)return null;
  const current=monthDate(asOf,day);
  const paidThisMonth=recurringPayments(data,item.id).some(event=>event.date>=monthStart(asOf)&&event.date<=asOf);
  if(current<=asOf&&!paidThisMonth)return {date:current,severity:'danger' as const,overdue:true};
  if(current>asOf&&!paidThisMonth&&daysBetween(asOf,current)<=UPCOMING_DAYS)return {date:current,severity:'warning' as const,overdue:false};
  if(paidThisMonth){const next=monthDate(asOf,day,1);if(daysBetween(asOf,next)<=UPCOMING_DAYS)return {date:next,severity:'warning' as const,overdue:false}}
  return null;
}

function loanDue(data:FinanceData,loan:Loan,asOf:string){
  if(isSelfLoan(loan)||loanRemainingInstallments(data,loan)<=0||Number(loan.installment||0)<=0)return null;
  const day=typicalLoanPaymentDay(data,loan);if(!day)return null;
  const first=loan.firstExpectedDate;
  const current=first&&first>=monthStart(asOf)&&first.slice(0,7)===asOf.slice(0,7)?first:monthDate(asOf,day);
  const paidThisMonth=loanPaymentEvents(data,loan).some(event=>event.date>=monthStart(asOf)&&event.date<=asOf);
  if(current<=asOf&&!paidThisMonth)return {date:current,severity:'danger' as const,overdue:true};
  if(current>asOf&&!paidThisMonth&&daysBetween(asOf,current)<=UPCOMING_DAYS)return {date:current,severity:'warning' as const,overdue:false};
  if(paidThisMonth){const next=monthDate(asOf,day,1);if(daysBetween(asOf,next)<=UPCOMING_DAYS)return {date:next,severity:'warning' as const,overdue:false}}
  return null;
}

function scheduledAttention(data:FinanceData,asOf:string):AttentionItem[]{
  return pendingScheduled(data).flatMap(item=>{
    const lifecycle=scheduledLifecycle(item,asOf);const distance=daysBetween(asOf,item.dueDate);
    if(lifecycle!=='due'&&(distance<0||distance>UPCOMING_DAYS))return [];
    const severity:AttentionSeverity=lifecycle==='due'?'danger':distance<=2?'warning':'info';
    return [make({id:`scheduled:${item.id}`,kind:'scheduled',severity,title:item.note,reason:lifecycle==='due'?'Η προγραμματισμένη κίνηση είναι ληξιπρόθεσμη ή λήγει σήμερα.':`Προγραμματισμένη κίνηση σε ${distance} ημέρες.`,dueDate:item.dueDate,amount:item.amount,accountId:item.accountId??item.fromAccountId,scheduledId:item.id,action:'complete_scheduled'})];
  });
}

function recurringAttention(data:FinanceData,asOf:string):AttentionItem[]{
  return activeRecurringItems(data).flatMap(item=>{const due=recurringDue(data,item,asOf);if(!due)return [];return [make({id:`recurring:${item.id}`,kind:'recurring',severity:due.severity,title:item.name,reason:due.overdue?'Δεν υπάρχει συνδεδεμένη πληρωμή για το πάγιο μέσα στον τρέχοντα μήνα και η γνωστή ημέρα έχει περάσει.':'Το επόμενο πάγιο πλησιάζει.',dueDate:due.date,amount:Number(item.amount||0),accountId:item.accountId,recurringId:item.id,action:'pay_recurring'})]});
}

function recurringExpiryAttention(data:FinanceData,asOf:string):AttentionItem[]{
  return activeRecurringItems(data).flatMap(item=>{
    const endDate=(item as RecurringItem&{endDate?:string|null}).endDate;
    if(!endDate||!/^\d{4}-\d{2}-\d{2}$/.test(endDate))return [];
    const distance=daysBetween(asOf,endDate);if(distance>EXPIRY_LOOKAHEAD_DAYS)return [];
    const severity:AttentionSeverity=distance<0?'danger':distance<=UPCOMING_DAYS?'warning':'info';
    const reason=distance<0?'Η δηλωμένη ημερομηνία λήξης/ανανέωσης έχει περάσει και το πάγιο παραμένει ενεργό.':distance===0?'Η δηλωμένη ημερομηνία λήξης/ανανέωσης είναι σήμερα.':`Η δηλωμένη ημερομηνία λήξης/ανανέωσης είναι σε ${distance} ημέρες.`;
    return [make({id:`recurring-expiry:${item.id}`,kind:'recurring_expiry',severity,title:`Λήξη · ${item.name}`,reason,dueDate:endDate,amount:Number(item.amount||0),accountId:item.accountId,recurringId:item.id,action:'open_recurring'})];
  });
}

function loanAttention(data:FinanceData,asOf:string):AttentionItem[]{
  return effectiveLoans(data).flatMap(loan=>{const due=loanDue(data,loan,asOf);if(!due)return [];return [make({id:`loan:${loan.id}`,kind:'loan',severity:due.severity,title:loan.name,reason:due.overdue?'Δεν υπάρχει συνδεδεμένη πληρωμή για τη δόση μέσα στον τρέχοντα μήνα και η γνωστή ημέρα έχει περάσει.':'Η επόμενη γνωστή δόση πλησιάζει.',dueDate:due.date,amount:Number(loan.installment||0),accountId:loan.defaultAccountId||data.state.settings.defaultLoanAccount,loanId:loan.id,action:'pay_loan'})]});
}

function creditAttention(data:FinanceData,asOf:string):AttentionItem[]{
  return creditCards(data).flatMap(card=>{
    const statement=creditStatementViews(data,card.id,asOf).filter(item=>item.remaining>.005&&(item.status==='closed'||item.status==='due')).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||a.closeDate.localeCompare(b.closeDate))[0];
    if(statement){
      const distance=daysBetween(asOf,statement.dueDate);
      if(statement.status==='due'||(distance>=0&&distance<=UPCOMING_DAYS)){
        const severity:AttentionSeverity=statement.status==='due'?'danger':distance<=2?'warning':'info';
        const reason=statement.status==='due'?'Η δήλωση της πιστωτικής έχει φτάσει ή περάσει την ημερομηνία πληρωμής και παραμένει υπόλοιπο.':`Η δήλωση της πιστωτικής λήγει σε ${distance} ${distance===1?'ημέρα':'ημέρες'}.`;
        return [make({id:`credit-statement:${statement.id}`,kind:'credit',severity,title:`${cardLabel(card)} · Δήλωση`,reason,dueDate:statement.dueDate,amount:statement.remaining,cardId:card.id,statementId:statement.id,action:'pay_credit'})];
      }
    }
    const limit=creditLimitForCard(data,card);const debt=creditDebtForCard(data,card.id,asOf);if(limit<=0||debt<=0)return [];
    const ratio=debt/limit;if(ratio<CREDIT_WARNING_RATIO)return [];
    const severity:AttentionSeverity=ratio>=1?'danger':'warning';
    return [make({id:`credit:${card.id}`,kind:'credit',severity,title:cardLabel(card),reason:ratio>=1?`Η χρήση της κάρτας είναι ${Math.round(ratio*100)}% και έχει φτάσει ή ξεπεράσει το όριο.`:`Η χρήση της κάρτας είναι ${Math.round(ratio*100)}% του ορίου.`,amount:debt,cardId:card.id,action:'pay_credit'})];
  });
}

function budgetAttention(data:FinanceData,asOf:string):AttentionItem[]{
  return budgetProgress(data,asOf.slice(0,7)).flatMap(row=>{
    if(row.status==='ok')return [];
    const label=row.scope==='overall'?'Συνολικό discretionary':row.category??'Κατηγορία';
    const severity:AttentionSeverity=row.status==='exceeded'?'danger':'warning';
    const reason=row.status==='exceeded'
      ?`Το budget έχει ξεπεραστεί και βρίσκεται στο ${Math.round(row.ratio*100)}% του ορίου.`
      :`Το budget πλησιάζει το όριό του και βρίσκεται στο ${Math.round(row.ratio*100)}%.`;
    return [make({id:`budget-alert:${row.id}`,kind:'budget',severity,title:`Budget · ${label}`,reason,amount:row.used,budgetId:row.id,action:'open_budgets'})];
  });
}

function latestOverdueLendingEvents(data:FinanceData,asOf:string){
  const byPerson=new Map<string,FinanceEvent>();
  for(const event of data.state.events??[]){
    if(event.kind!=='lending'||!event.person||!event.expectedReturnDate||event.expectedReturnDate>=asOf)continue;
    if(lendingOutstandingFor(data,event.person)<=0)continue;
    const current=byPerson.get(event.person);if(!current||String(event.expectedReturnDate)<String(current.expectedReturnDate))byPerson.set(event.person,event);
  }
  return [...byPerson.values()];
}

function lendingAttention(data:FinanceData,asOf:string):AttentionItem[]{
  return latestOverdueLendingEvents(data,asOf).map(event=>make({id:`lending:${event.person}`,kind:'lending',severity:'danger',title:`Επιστροφή από ${event.person}`,reason:'Η ρητή αναμενόμενη ημερομηνία επιστροφής έχει περάσει και παραμένει υπόλοιπο προς είσπραξη.',dueDate:event.expectedReturnDate,amount:lendingOutstandingFor(data,event.person!),accountId:event.accountId,person:event.person,action:'collect_lending'}));
}

function forecastAttention(data:FinanceData,asOf:string):AttentionItem[]{
  const forecast=cashFlowForecast(data,asOf,30);return forecast.accounts.flatMap(account=>{
    const name=accountName(data,account.accountId);
    if(account.firstNegativeDate)return [make({id:`forecast:${account.accountId}`,kind:'forecast',severity:'danger',title:`Προβλεπόμενο αρνητικό υπόλοιπο · ${name}`,reason:`Η ντετερμινιστική προβολή 30 ημερών περνά κάτω από μηδέν στις ${account.firstNegativeDate.split('-').reverse().join('/')}.`,dueDate:account.firstNegativeDate,amount:account.minimum,accountId:account.accountId,action:'open_forecast'})];
    if(account.firstLowDate&&account.minimum<LOW_BALANCE_THRESHOLD)return [make({id:`forecast:${account.accountId}`,kind:'forecast',severity:'warning',title:`Προβλεπόμενο χαμηλό υπόλοιπο · ${name}`,reason:`Η ντετερμινιστική προβολή 30 ημερών πέφτει κάτω από ${LOW_BALANCE_THRESHOLD}€ στις ${account.firstLowDate.split('-').reverse().join('/')}.`,dueDate:account.firstLowDate,amount:account.minimum,accountId:account.accountId,action:'open_forecast'})];
    return [];
  });
}

function currentBalanceAttention(data:FinanceData,asOf:string):AttentionItem[]{
  const balances=accountBalances(data,asOf);const excluded=new Set(data.state.settings.excludedFromAvailable??[]);
  return allAccounts(data).flatMap(account=>{
    const eligible=account.kind==='bank'||(account.kind==='cash'&&account.cashRole!=='reserve');
    if(!eligible||excluded.has(account.id))return [];
    const balance=balances[account.id];if(!Number.isFinite(balance)||balance>=LOW_BALANCE_THRESHOLD)return [];
    if(Math.abs(balance)<.005&&account.id!==data.state.settings.defaultExpenseAccount)return [];
    return [make({id:`current-balance:${account.id}`,kind:'account_balance',severity:'danger',title:`Χαμηλό υπόλοιπο · ${account.name}`,reason:`Το τρέχον υπόλοιπο είναι κάτω από το όριο προσοχής των ${LOW_BALANCE_THRESHOLD}€.`,dueDate:asOf,amount:balance,accountId:account.id,action:'open_dashboard'})];
  });
}

type TransactionCandidate={id:string;source:'legacy'|'event';date:string;amount:number;accountId?:string;note:string;category?:string};
function transactionCandidates(data:FinanceData,asOf:string):TransactionCandidate[]{
  const legacy=effectiveLegacyTransactions(data).filter(item=>item.date<=asOf&&(item.type==='expense'||item.type==='income')).map(item=>({id:item.id,source:'legacy' as const,date:item.date,amount:item.amount,accountId:item.accountId,note:item.note,category:item.category}));
  const events=(data.state.events??[]).filter(item=>item.date<=asOf&&(item.kind==='expense'||item.kind==='income')).map(item=>({id:item.id,source:'event' as const,date:item.date,amount:item.amount,accountId:item.accountId??item.legs.find(leg=>leg.accountId!=='credit-card')?.accountId,note:item.note,category:item.category}));
  return [...legacy,...events];
}

function uncategorizedTransactionAttention(data:FinanceData,asOf:string):AttentionItem[]{
  return transactionCandidates(data,asOf).filter(item=>uncategorized(item.category)).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).slice(0,MAX_TRANSACTION_ATTENTION).map(item=>make({id:`uncategorized:${item.source}:${item.id}`,kind:'transaction',severity:'info',title:descriptionTitle(item.note),reason:'Η συναλλαγή δεν έχει σαφή κατηγορία και χρειάζεται δική σου κατηγοριοποίηση.',dueDate:item.date,amount:item.amount,accountId:item.accountId,transactionId:item.id,transactionSource:item.source,action:'categorize_transaction'}));
}

function duplicateTransactionAttention(data:FinanceData,asOf:string):AttentionItem[]{
  const groups=new Map<string,TransactionCandidate[]>();
  for(const item of transactionCandidates(data,asOf)){
    const note=normalizedDescription(item.note);if(!item.accountId||note.length<3||!Number.isFinite(item.amount))continue;
    const key=[item.date,item.accountId,item.amount.toFixed(2),note].join('|');const rows=groups.get(key)??[];rows.push(item);groups.set(key,rows);
  }
  return [...groups.entries()].filter(([,rows])=>rows.length>1).sort((a,b)=>b[1][0].date.localeCompare(a[1][0].date)||a[0].localeCompare(b[0])).slice(0,MAX_DUPLICATE_GROUPS).map(([key,rows])=>{
    const primary=rows.slice().sort((a,b)=>a.id.localeCompare(b.id))[0];
    return make({id:`duplicate:${key}`,kind:'duplicate',severity:'info',title:`Πιθανό διπλότυπο · ${descriptionTitle(primary.note)}`,reason:`Βρέθηκαν ${rows.length} κινήσεις με ίδια ημερομηνία, λογαριασμό, ποσό και περιγραφή. Χρειάζεται ανθρώπινος έλεγχος πριν αλλάξει οτιδήποτε.`,dueDate:primary.date,amount:primary.amount,accountId:primary.accountId,transactionId:primary.id,transactionSource:primary.source,action:'review_duplicate'});
  });
}

function priority(item:AttentionItem){return item.severity==='danger'?0:item.severity==='warning'?1:2}
export function allAttentionItems(data:FinanceData,asOf:string):AttentionItem[]{
  const items=[...currentBalanceAttention(data,asOf),...scheduledAttention(data,asOf),...recurringAttention(data,asOf),...recurringExpiryAttention(data,asOf),...loanAttention(data,asOf),...creditAttention(data,asOf),...lendingAttention(data,asOf),...forecastAttention(data,asOf),...budgetAttention(data,asOf),...uncategorizedTransactionAttention(data,asOf),...duplicateTransactionAttention(data,asOf)];
  const dedup=new Map<string,AttentionItem>();for(const item of items){const current=dedup.get(item.id);if(!current||priority(item)<priority(current))dedup.set(item.id,item)}
  return [...dedup.values()].sort((a,b)=>priority(a)-priority(b)||(a.dueDate??'9999').localeCompare(b.dueDate??'9999')||a.title.localeCompare(b.title,'el'));
}

export function attentionDecisionVisible(item:AttentionItem,decision:AttentionDecision|undefined,asOf:string){
  if(!decision||decision.fingerprint!==item.fingerprint)return true;
  if(decision.status==='snoozed')return !decision.snoozedUntil||decision.snoozedUntil<=asOf;
  if(decision.status==='dismissed')return item.severity==='danger';
  return true;
}

export function visibleAttentionItems(data:FinanceData,asOf:string){
  const decisions=data.state.attentionDecisions??{};return allAttentionItems(data,asOf).filter(item=>attentionDecisionVisible(item,decisions[item.id],asOf));
}

export function attentionSnoozeDecision(item:AttentionItem,asOf:string):AttentionDecision{
  return {status:'snoozed',fingerprint:item.fingerprint,decidedAt:new Date().toISOString(),snoozedUntil:addDays(asOf,item.severity==='danger'?1:3)};
}

export function attentionDismissDecision(item:AttentionItem):AttentionDecision{
  if(item.severity==='danger')throw new Error('Μια επείγουσα οικονομική εκκρεμότητα δεν μπορεί να κρυφτεί μόνιμα. Μπορείς να την αναβάλεις προσωρινά.');
  return {status:'dismissed',fingerprint:item.fingerprint,decidedAt:new Date().toISOString()};
}