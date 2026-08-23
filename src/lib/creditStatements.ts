import type { FinanceEvent } from '../types.js';

export type StatementBoundaryRule='include-closing-day'|'next-cycle';

export type CreditStatementCycle={
  id:string;
  cardId:string;
  openDate:string;
  closeDate:string;
  purchaseIds:string[];
  purchaseTotal:number;
};

function parseDate(date:string){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if(!match)throw new Error('Invalid statement date.');
  return {year:Number(match[1]),month:Number(match[2]),day:Number(match[3])};
}

function isoDate(year:number,month:number,day:number){return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`}
function monthShift(year:number,month:number,delta:number){const date=new Date(Date.UTC(year,month-1+delta,1));return {year:date.getUTCFullYear(),month:date.getUTCMonth()+1}}
function lastDay(year:number,month:number){return new Date(Date.UTC(year,month,0)).getUTCDate()}
function normalizedBillingDay(day:number){const value=Math.floor(Number(day));if(!Number.isFinite(value)||value<1||value>31)throw new Error('Billing day must be between 1 and 31.');return value}
function dateAtBillingDay(year:number,month:number,billingDay:number){return isoDate(year,month,Math.min(normalizedBillingDay(billingDay),lastDay(year,month)))}

export function creditStatementId(cardId:string,closeDate:string){return `${cardId}:${closeDate}`}

export function statementCloseDateForPurchase(date:string,closingDay:number,boundary:StatementBoundaryRule){
  const parsed=parseDate(date);
  const closeThisMonth=dateAtBillingDay(parsed.year,parsed.month,closingDay);
  const belongsThisMonth=boundary==='include-closing-day'?date<=closeThisMonth:date<closeThisMonth;
  if(belongsThisMonth)return closeThisMonth;
  const next=monthShift(parsed.year,parsed.month,1);
  return dateAtBillingDay(next.year,next.month,closingDay);
}

export function statementOpenDateForClose(closeDate:string,closingDay:number){
  const parsed=parseDate(closeDate);
  const previous=monthShift(parsed.year,parsed.month,-1);
  const previousClose=parseDate(dateAtBillingDay(previous.year,previous.month,closingDay));
  const nextDay=new Date(Date.UTC(previousClose.year,previousClose.month-1,previousClose.day+1));
  return isoDate(nextDay.getUTCFullYear(),nextDay.getUTCMonth()+1,nextDay.getUTCDate());
}

export function statementDueDateForClose(closeDate:string,dueDay:number){
  const parsed=parseDate(closeDate);
  const sameMonth=dateAtBillingDay(parsed.year,parsed.month,dueDay);
  if(sameMonth>closeDate)return sameMonth;
  const next=monthShift(parsed.year,parsed.month,1);
  return dateAtBillingDay(next.year,next.month,dueDay);
}

export function groupCardPurchasesByStatement(events:FinanceEvent[],cardId:string,closingDay:number,boundary:StatementBoundaryRule):CreditStatementCycle[]{
  const groups=new Map<string,CreditStatementCycle>();
  for(const event of events){
    if(event.kind!=='card_purchase'||event.cardId!==cardId||!/^\d{4}-\d{2}-\d{2}$/.test(event.date)||!Number.isFinite(event.amount)||event.amount<=0)continue;
    const closeDate=statementCloseDateForPurchase(event.date,closingDay,boundary);
    const id=creditStatementId(cardId,closeDate);
    const group=groups.get(id)??{id,cardId,openDate:statementOpenDateForClose(closeDate,closingDay),closeDate,purchaseIds:[],purchaseTotal:0};
    group.purchaseIds.push(event.id);
    group.purchaseTotal+=event.amount;
    groups.set(id,group);
  }
  return [...groups.values()].map(group=>({...group,purchaseIds:[...group.purchaseIds]})).sort((a,b)=>b.closeDate.localeCompare(a.closeDate));
}
