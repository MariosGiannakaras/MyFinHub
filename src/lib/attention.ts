import { creditCards, creditDebtForCard, creditLimitForCard, cardLabel } from './cards.js';
import { addDays, cashFlowForecast, LOW_BALANCE_THRESHOLD } from './forecast.js';
import { lendingOutstandingFor } from './lending.js';
import { isSelfLoan, loanPaymentEvents, loanRemainingInstallments, typicalLoanPaymentDay } from './loans.js';
import { activeRecurringItems, recurringPayments, typicalPaymentDay } from './recurring.js';
import { pendingScheduled, scheduledLifecycle } from './scheduled.js';
import type { AttentionDecision, FinanceData, FinanceEvent, Loan, RecurringItem } from '../types.js';

export type AttentionSeverity = 'danger' | 'warning' | 'info';
export type AttentionKind = 'scheduled' | 'recurring' | 'loan' | 'credit' | 'lending' | 'forecast';
export type AttentionAction =
  | 'complete_scheduled'
  | 'pay_recurring'
  | 'pay_loan'
  | 'pay_credit'
  | 'collect_lending'
  | 'open_forecast';

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
  person?: string;
  recurringId?: string;
  loanId?: string;
  scheduledId?: string;
  action: AttentionAction;
  fingerprint: string;
}

const UPCOMING_DAYS = 7;
const CREDIT_WARNING_RATIO = .8;

function utc(value:string){return new Date(`${value}T12:00:00Z`)}
function daysBetween(from:string,to:string){return Math.round((utc(to).getTime()-utc(from).getTime())/86400000)}
function monthDate(asOf:string,day:number,monthOffset=0){
  const base=utc(asOf);const month=base.getUTCMonth()+monthOffset;const last=new Date(Date.UTC(base.getUTCFullYear(),month+1,0)).getUTCDate();
  return new Date(Date.UTC(base.getUTCFullYear(),month,Math.min(Math.max(1,day),last),12)).toISOString().slice(0,10);
}
function fingerprint(parts:Array<string|number|undefined|null>){return parts.map(value=>String(value??'')).join('|')}
function make(item:Omit<AttentionItem,'fingerprint'>):AttentionItem{return {...item,fingerprint:fingerprint([item.kind,item.id,item.severity,item.dueDate,item.amount,item.accountId,item.cardId,item.person,item.action])}}

function effectiveLoans(data:FinanceData):Loan[]{
  const seeded=(data.seed.loans??[]).map(loan=>data.state.loanOverrides?.[loan.id]??loan);
  return [...seeded,...(data.state.customLoans??[])];
}

function recurringDue(data:FinanceData,item:RecurringItem,asOf:string){
  const day=typicalPaymentDay(data,item);if(!day)return null;
  const current=monthDate(asOf,day);const paid=recurringPayments(data,item.id).some(event=>event.date>=current&&event.date<=asOf);
  if(current<=asOf&&!paid)return {date:current,severity:'danger' as const,overdue:true};
  if(current>asOf&&daysBetween(asOf,current)<=UPCOMING_DAYS)return {date:current,severity:'warning' as const,overdue:false};
  if(paid){const next=monthDate(asOf,day,1);if(daysBetween(asOf,next)<=UPCOMING_DAYS)return {date:next,severity:'warning' as const,overdue:false}}
  return null;
}

function loanDue(data:FinanceData,loan:Loan,asOf:string){
  if(isSelfLoan(loan)||loanRemainingInstallments(data,loan)<=0||Number(loan.installment||0)<=0)return null;
  const day=typicalLoanPaymentDay(data,loan);if(!day)return null;
  const current=loan.firstExpectedDate&&loan.firstExpectedDate.slice(0,7)===asOf.slice(0,7)?loan.firstExpectedDate:monthDate(asOf,day);
  const paid=loanPaymentEvents(data,loan).some(event=>event.date>=current&&event.date<=asOf);
  if(current<=asOf&&!paid)return {date:current,severity:'danger' as const,overdue:true};
  if(current>asOf&&daysBetween(asOf,current)<=UPCOMING_DAYS)return {date:current,severity:'warning' as const,overdue:false};
  if(paid){const next=monthDate(asOf,day,1);if(daysBetween(asOf,next)<=UPCOMING_DAYS)return {date:next,severity:'warning' as const,overdue:false}}
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
  return activeRecurringItems(data).flatMap(item=>{const due=recurringDue(data,item,asOf);if(!due)return [];return [make({id:`recurring:${item.id}`,kind:'recurring',severity:due.severity,title:item.name,reason:due.overdue?'Δεν υπάρχει συνδεδεμένη πληρωμή για την τρέχουσα ημερομηνία του παγίου.':'Το επόμενο πάγιο πλησιάζει.',dueDate:due.date,amount:Number(item.amount||0),accountId:item.accountId,recurringId:item.id,action:'pay_recurring'})]});
}

function loanAttention(data:FinanceData,asOf:string):AttentionItem[]{
  return effectiveLoans(data).flatMap(loan=>{const due=loanDue(data,loan,asOf);if(!due)return [];return [make({id:`loan:${loan.id}`,kind:'loan',severity:due.severity,title:loan.name,reason:due.overdue?'Δεν υπάρχει συνδεδεμένη πληρωμή για την τρέχουσα δόση.':'Η επόμενη γνωστή δόση πλησιάζει.',dueDate:due.date,amount:Number(loan.installment||0),accountId:loan.defaultAccountId||data.state.settings.defaultLoanAccount,loanId:loan.id,action:'pay_loan'})]});
}

function creditAttention(data:FinanceData,asOf:string):AttentionItem[]{
  return creditCards(data).flatMap(card=>{const limit=creditLimitForCard(data,card);const debt=creditDebtForCard(data,card.id,asOf);if(limit<=0||debt<=0)return [];const ratio=debt/limit;if(ratio<CREDIT_WARNING_RATIO)return [];const severity:AttentionSeverity=ratio>=1?'danger':'warning';return [make({id:`credit:${card.id}`,kind:'credit',severity,title:cardLabel(card),reason:ratio>=1?`Η χρήση της κάρτας είναι ${Math.round(ratio*100)}% και έχει φτάσει ή ξεπεράσει το όριο.`:`Η χρήση της κάρτας είναι ${Math.round(ratio*100)}% του ορίου.`,amount:debt,cardId:card.id,action:'pay_credit'})]});
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
    if(account.firstNegativeDate)return [make({id:`forecast:${account.accountId}`,kind:'forecast',severity:'danger',title:'Προβλεπόμενο αρνητικό υπόλοιπο',reason:`Η ντετερμινιστική προβολή 30 ημερών περνά κάτω από μηδέν στις ${account.firstNegativeDate.split('-').reverse().join('/')}.`,dueDate:account.firstNegativeDate,amount:account.minimum,accountId:account.accountId,action:'open_forecast'})];
    if(account.firstLowDate&&account.minimum<LOW_BALANCE_THRESHOLD)return [make({id:`forecast:${account.accountId}`,kind:'forecast',severity:'warning',title:'Προβλεπόμενο χαμηλό υπόλοιπο',reason:`Η ντετερμινιστική προβολή 30 ημερών πέφτει κάτω από ${LOW_BALANCE_THRESHOLD}€ στις ${account.firstLowDate.split('-').reverse().join('/')}.`,dueDate:account.firstLowDate,amount:account.minimum,accountId:account.accountId,action:'open_forecast'})];
    return [];
  });
}

function priority(item:AttentionItem){return item.severity==='danger'?0:item.severity==='warning'?1:2}
export function allAttentionItems(data:FinanceData,asOf:string):AttentionItem[]{
  const items=[...scheduledAttention(data,asOf),...recurringAttention(data,asOf),...loanAttention(data,asOf),...creditAttention(data,asOf),...lendingAttention(data,asOf),...forecastAttention(data,asOf)];
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
