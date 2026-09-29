import type { FinanceData } from '../types.js';
import { accountBalances, monthRange } from './domain.js';

export type DashboardAccountPoint={date:string;value:number};

const DAY=86_400_000;
const parseDate=(value:string)=>Date.parse(`${value}T12:00:00Z`);
const toIso=(value:number)=>new Date(value).toISOString().slice(0,10);

export function shiftDashboardMonth(month:string,delta:number){
  const [year,rawMonth]=month.split('-').map(Number);
  const date=new Date(Date.UTC(year,rawMonth-1+delta,1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;
}

export function dashboardHistoryStart(month:string){
  const previousMonth=shiftDashboardMonth(month,-1);
  const previousRange=monthRange(previousMonth);
  const lastDay=Number(previousRange.end.slice(-2));
  return `${previousMonth}-${String(Math.max(1,lastDay-7)).padStart(2,'0')}`;
}

export function dashboardAccountHistory(data:FinanceData,accountIds:string[],start:string,end:string){
  const rows:Record<string,DashboardAccountPoint[]>={};
  for(const accountId of accountIds)rows[accountId]=[];
  if(!accountIds.length||parseDate(end)<parseDate(start))return rows;
  for(let cursor=parseDate(start);cursor<=parseDate(end);cursor+=DAY){
    const date=toIso(cursor);
    const balances=accountBalances(data,date);
    for(const accountId of accountIds)rows[accountId]!.push({date,value:balances[accountId]??0});
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
  const current=accountBalances(data,asOf)[accountId]??0;
  const previousDate=toIso(parseDate(asOf)-Math.max(1,days)*DAY);
  const previous=accountBalances(data,previousDate)[accountId]??0;
  return Number((current-previous).toFixed(2));
}
