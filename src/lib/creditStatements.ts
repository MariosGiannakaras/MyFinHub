import type { CreditStatementRecord, CreditStatementStatus, FinanceData, FinanceEvent, PaymentCard, StatementBoundaryRule } from '../types.js';
import { dateOnlyToUtcDate, daysInCalendarMonth, parseDateOnly } from './dateOnly.js';
import { centsToMoney, moneyToCents } from './money.js';
type CreditStatementCycle={
  id:string;
  cardId:string;
  openDate:string;
  closeDate:string;
  purchaseIds:string[];
  purchaseTotal:number;
};

type CreditStatementView=CreditStatementRecord&{
  purchaseIds:string[];
  paymentIds:string[];
  purchaseTotal:number;
  paymentTotal:number;
  remaining:number;
  status:CreditStatementStatus;
};

function statementDate(date:string){
  const parsed=parseDateOnly(date);
  if(!parsed)throw new Error('Invalid statement date.');
  return parsed;
}

function isoDate(year:number,month:number,day:number){return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`}
function monthShift(year:number,month:number,delta:number){const absolute=year*12+(month-1)+delta;const nextYear=Math.floor(absolute/12);const nextMonth=((absolute%12)+12)%12+1;if(nextYear<1||nextYear>9999)throw new Error('Invalid statement month.');return {year:nextYear,month:nextMonth}}
function normalizedBillingDay(day:number){const value=Math.floor(Number(day));if(!Number.isFinite(value)||value<1||value>31)throw new Error('Billing day must be between 1 and 31.');return value}
function dateAtBillingDay(year:number,month:number,billingDay:number){return isoDate(year,month,Math.min(normalizedBillingDay(billingDay),daysInCalendarMonth(year,month)))}
function roundMoney(value:number){const cents=moneyToCents(value);if(!Number.isSafeInteger(cents))throw new Error('Statement amount is outside the supported range.');return centsToMoney(cents)}

function creditStatementId(cardId:string,closeDate:string){return `${cardId}:${closeDate}`}

export function statementCloseDateForPurchase(date:string,closingDay:number,boundary:StatementBoundaryRule){
  const parsed=statementDate(date);
  const closeThisMonth=dateAtBillingDay(parsed.year,parsed.month,closingDay);
  const belongsThisMonth=boundary==='include-closing-day'?date<=closeThisMonth:date<closeThisMonth;
  if(belongsThisMonth)return closeThisMonth;
  const next=monthShift(parsed.year,parsed.month,1);
  return dateAtBillingDay(next.year,next.month,closingDay);
}

export function statementOpenDateForClose(closeDate:string,closingDay:number,boundary:StatementBoundaryRule='include-closing-day'){
  const parsed=statementDate(closeDate);
  const previous=monthShift(parsed.year,parsed.month,-1);
  const previousClose=statementDate(dateAtBillingDay(previous.year,previous.month,closingDay));
  const offsetDays=boundary==='next-cycle'?0:1;
  const previousCloseDate=dateOnlyToUtcDate(isoDate(previousClose.year,previousClose.month,previousClose.day));
  if(!previousCloseDate)throw new Error('Invalid statement date.');
  previousCloseDate.setUTCDate(previousCloseDate.getUTCDate()+offsetDays);
  return isoDate(previousCloseDate.getUTCFullYear(),previousCloseDate.getUTCMonth()+1,previousCloseDate.getUTCDate());
}

export function statementDueDateForClose(closeDate:string,dueDay:number){
  const parsed=statementDate(closeDate);
  const sameMonth=dateAtBillingDay(parsed.year,parsed.month,dueDay);
  if(sameMonth>closeDate)return sameMonth;
  const next=monthShift(parsed.year,parsed.month,1);
  return dateAtBillingDay(next.year,next.month,dueDay);
}

export function groupCardPurchasesByStatement(events:FinanceEvent[],cardId:string,closingDay:number,boundary:StatementBoundaryRule):CreditStatementCycle[]{
  const groups=new Map<string,CreditStatementCycle>();
  for(const event of events){
    if(event.kind!=='card_purchase'||event.cardId!==cardId||!parseDateOnly(event.date)||!Number.isSafeInteger(moneyToCents(event.amount))||event.amount<=0)continue;
    const closeDate=statementCloseDateForPurchase(event.date,closingDay,boundary);
    const id=creditStatementId(cardId,closeDate);
    const group=groups.get(id)??{id,cardId,openDate:statementOpenDateForClose(closeDate,closingDay,boundary),closeDate,purchaseIds:[],purchaseTotal:0};
    group.purchaseIds.push(event.id);
    group.purchaseTotal+=event.amount;
    groups.set(id,group);
  }
  return [...groups.values()].map(group=>({...group,purchaseIds:[...group.purchaseIds],purchaseTotal:roundMoney(group.purchaseTotal)})).sort((a,b)=>b.closeDate.localeCompare(a.closeDate));
}

export function cardStatementConfiguration(card:PaymentCard){
  const closing=Number(card.statementClosingDay);const due=Number(card.statementDueDay);
  if(card.kind!=='credit'||!Number.isInteger(closing)||closing<1||closing>31||!Number.isInteger(due)||due<1||due>31)return null;
  const boundary=card.statementBoundaryRule;
  if(boundary!=='include-closing-day'&&boundary!=='next-cycle')return null;
  return {closingDay:closing,dueDay:due,boundary};
}

function statementRecordForPurchase(card:PaymentCard,date:string,now=new Date().toISOString()):CreditStatementRecord|null{
  const config=cardStatementConfiguration(card);if(!config)return null;
  const closeDate=statementCloseDateForPurchase(date,config.closingDay,config.boundary);
  return {id:creditStatementId(card.id,closeDate),cardId:card.id,openDate:statementOpenDateForClose(closeDate,config.closingDay,config.boundary),closeDate,dueDate:statementDueDateForClose(closeDate,config.dueDay),boundaryRule:config.boundary,createdAt:now,updatedAt:now};
}

export function prepareCreditStatementEvent(data:FinanceData,event:FinanceEvent,now=event.updatedAt||new Date().toISOString()){
  const statements=[...(data.state.creditStatements??[])];
  if(event.statementId){
    const statement=statements.find(item=>item.id===event.statementId);
    if(!statement||event.cardId!==statement.cardId||(event.kind!=='card_purchase'&&event.kind!=='card_payment'))return {event:{...event,statementId:undefined},statements};
    return {event,statements};
  }
  if(event.kind!=='card_purchase'||!event.cardId)return {event,statements};
  const card=(data.state.cards??[]).find(item=>item.id===event.cardId&&item.kind==='credit');
  if(!card)return {event,statements};
  const record=statementRecordForPurchase(card,event.date,now);if(!record)return {event,statements};
  const existing=statements.find(item=>item.id===record.id);
  if(!existing)statements.push(record);
  return {event:{...event,statementId:record.id},statements};
}

function creditStatementRecords(data:FinanceData,cardId?:string){
  return (data.state.creditStatements??[]).filter(item=>!cardId||item.cardId===cardId).slice().sort((a,b)=>b.closeDate.localeCompare(a.closeDate)||b.id.localeCompare(a.id));
}

export function creditStatementEvents(data:FinanceData,statementId:string){
  return (data.state.events??[]).filter(event=>event.statementId===statementId&&(event.kind==='card_purchase'||event.kind==='card_payment')).slice().sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
}

function creditStatementStatus(record:CreditStatementRecord,remaining:number,asOf:string):CreditStatementStatus{
  if(remaining<=.005)return 'paid';
  if(asOf<record.closeDate)return 'open';
  if(asOf>=record.dueDate)return 'due';
  return 'closed';
}

export function creditStatementView(data:FinanceData,record:CreditStatementRecord,asOf:string):CreditStatementView{
  const events=creditStatementEvents(data,record.id);
  const purchases=events.filter(event=>event.kind==='card_purchase');
  const payments=events.filter(event=>event.kind==='card_payment');
  const purchaseTotal=roundMoney(purchases.reduce((sum,event)=>sum+Number(event.amount||0),0));
  const paymentTotal=roundMoney(payments.reduce((sum,event)=>sum+Number(event.amount||0),0));
  const remaining=roundMoney(Math.max(0,purchaseTotal-paymentTotal));
  return {...record,purchaseIds:purchases.map(event=>event.id),paymentIds:payments.map(event=>event.id),purchaseTotal,paymentTotal,remaining,status:creditStatementStatus(record,remaining,asOf)};
}

export function creditStatementViews(data:FinanceData,cardId:string,asOf:string){
  return creditStatementRecords(data,cardId).map(record=>creditStatementView(data,record,asOf));
}

export function creditStatementById(data:FinanceData,statementId:string,asOf:string){
  const record=(data.state.creditStatements??[]).find(item=>item.id===statementId);return record?creditStatementView(data,record,asOf):undefined;
}

export function recommendedPayableStatement(data:FinanceData,cardId:string,asOf:string){
  const priority:Record<CreditStatementStatus,number>={due:0,closed:1,open:2,paid:3};
  return creditStatementViews(data,cardId,asOf).filter(item=>item.remaining>.005).sort((a,b)=>priority[a.status]-priority[b.status]||a.dueDate.localeCompare(b.dueDate)||a.closeDate.localeCompare(b.closeDate))[0];
}

export function unlinkedCreditStatementEvents(data:FinanceData,cardId:string){
  return (data.state.events??[]).filter(event=>event.cardId===cardId&&(event.kind==='card_purchase'||event.kind==='card_payment')&&!event.statementId);
}
