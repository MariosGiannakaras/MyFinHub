import type { FinanceData, LegacyTransaction } from '../types.js';
import { accountBalances, effectiveLegacyTransactions, monthRange } from './domain.js';

export type DashboardAccountPoint={date:string;value:number};

const DAY=86_400_000;
const parseDate=(value:string)=>Date.parse(`${value}T12:00:00Z`);
const toIso=(value:number)=>new Date(value).toISOString().slice(0,10);

function shiftDashboardMonth(month:string,delta:number){
  const [year,rawMonth]=month.split('-').map(Number);
  const date=new Date(Date.UTC(year,rawMonth-1+delta,1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;
}

function legacyAccountDelta(tx:LegacyTransaction,accountId:string){
  if(tx.type==='income'&&tx.accountId===accountId)return tx.amount;
  if(tx.type==='expense'&&tx.accountId===accountId)return-tx.amount;
  if(tx.type==='adjustment'&&tx.accountId===accountId)return tx.amount;
  if(tx.type==='transfer'){
    if(tx.fromAccountId===accountId)return-tx.amount;
    if(tx.toAccountId===accountId)return tx.amount;
  }
  return 0;
}

function dashboardAccountDeltas(data:FinanceData,accountIds:string[],start:string,end:string){
  const ids=new Set(accountIds);
  const byAccount=Object.fromEntries(accountIds.map(accountId=>[accountId,new Map<string,number>()])) as Record<string,Map<string,number>>;
  for(const tx of effectiveLegacyTransactions(data)){
    if(tx.date<start||tx.date>end)continue;
    for(const accountId of accountIds){
      const delta=legacyAccountDelta(tx,accountId);
      if(delta)byAccount[accountId]!.set(tx.date,(byAccount[accountId]!.get(tx.date)??0)+delta);
    }
  }
  for(const event of data.state.events??[]){
    if(event.date<start||event.date>end)continue;
    for(const leg of event.legs){
      if(!ids.has(leg.accountId)||!leg.amount)continue;
      const rows=byAccount[leg.accountId]!;
      rows.set(event.date,(rows.get(event.date)??0)+leg.amount);
    }
  }
  return byAccount;
}

export function dashboardHistoryStart(month:string){
  const previousMonth=shiftDashboardMonth(month,-1);
  const previousRange=monthRange(previousMonth);
  const lastDay=Number(previousRange.end.slice(-2));
  return `${previousMonth}-${String(Math.max(1,lastDay-7)).padStart(2,'0')}`;
}

/**
 * Reconstructs movement-shaped balance history while keeping the final point
 * anchored to the canonical accountBalances result. Imported seed transactions
 * therefore shape the history without being double-applied to the current balance.
 */
export function dashboardAccountHistory(data:FinanceData,accountIds:string[],start:string,end:string){
  const rows:Record<string,DashboardAccountPoint[]>={};
  for(const accountId of accountIds)rows[accountId]=[];
  if(!accountIds.length||parseDate(end)<parseDate(start))return rows;
  const deltas=dashboardAccountDeltas(data,accountIds,start,end);
  const closing=accountBalances(data,end);
  for(const accountId of accountIds){
    const accountDeltas=deltas[accountId]!;
    const total=[...accountDeltas.values()].reduce((sum,value)=>sum+value,0);
    let running=(closing[accountId]??0)-total;
    for(let cursor=parseDate(start);cursor<=parseDate(end);cursor+=DAY){
      const date=toIso(cursor);
      running+=accountDeltas.get(date)??0;
      rows[accountId]!.push({date,value:Number(running.toFixed(2))});
    }
  }
  return rows;
}

export function dashboardPreviousMonthValues(data:FinanceData,accountId:string,currentMonth:string,asOf:string){
  const previousMonth=shiftDashboardMonth(currentMonth,-1);
  const previousRange=monthRange(previousMonth);
  const currentRange=monthRange(currentMonth);
  const currentDay=currentMonth===asOf.slice(0,7)?Number(asOf.slice(-2)):Number(currentRange.end.slice(-2));
  const endDay=Math.min(currentDay,Number(previousRange.end.slice(-2)));
  const end=`${previousMonth}-${String(Math.max(1,endDay)).padStart(2,'0')}`;
  return dashboardAccountHistory(data,[accountId],`${previousMonth}-01`,end)[accountId]??[];
}

export function dashboardBalanceChange(data:FinanceData,accountId:string,asOf:string,days=30){
  const previousDate=toIso(parseDate(asOf)-Math.max(1,days)*DAY);
  const series=dashboardAccountHistory(data,[accountId],previousDate,asOf)[accountId]??[];
  if(series.length<2)return 0;
  return Number(((series.at(-1)?.value??0)-(series[0]?.value??0)).toFixed(2));
}
