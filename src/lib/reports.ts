import { accountBalances, effectiveLegacyTransactions, flowImpactEvent, flowImpactLegacy } from './domain.js';
import { categoryPath } from './categories.js';
import { lendingRows } from './lending.js';
import { recurringMonthlyTotal } from './recurring.js';
import { operationalMonthlyFlow, savingsBreakdown } from './savings.js';
import type { FinanceData } from '../types.js';

export function shiftReportMonth(month:string,delta:number){const [year,m]=month.split('-').map(Number);const date=new Date(Date.UTC(year,m-1+delta,1));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`}
export function reportMonths(month:string,count=6){return Array.from({length:count},(_,index)=>shiftReportMonth(month,index-(count-1)))}
export function reportMonthLabel(month:string){const [year,m]=month.split('-').map(Number);return new Intl.DateTimeFormat('el-GR',{month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(Date.UTC(year,m-1,1)))}
export function monthEnd(month:string){const [year,m]=month.split('-').map(Number);return new Date(Date.UTC(year,m,0,12)).toISOString().slice(0,10)}

export function reportFlowSeries(data:FinanceData,month:string,count=6){return reportMonths(month,count).map(value=>{const flow=operationalMonthlyFlow(data,value);return {month:value,label:reportMonthLabel(value),income:flow.income,expense:flow.expense,saving:flow.saving}})}

export function primaryAccountSeries(data:FinanceData,month:string,ids=['piraeus-payroll','piraeus-savings'],count=6){return reportMonths(month,count).map(value=>{const balances=accountBalances(data,monthEnd(value));const row:Record<string,string|number>={month:value,label:reportMonthLabel(value)};for(const id of ids)row[id]=balances[id]||0;return row})}

export function subcategoryTotals(data:FinanceData,month:string){
  const totals=new Map<string,number>();const add=(label:string,value:number)=>{totals.set(label,(totals.get(label)||0)+value)};
  for(const tx of effectiveLegacyTransactions(data)){if(!tx.date.startsWith(`${month}-`))continue;const impact=flowImpactLegacy(data,tx);if(impact.expense)add(categoryPath(tx.category,tx.subcategory),impact.expense);if(impact.refund)add(categoryPath(tx.category,tx.subcategory),-impact.refund)}
  for(const event of data.state.events??[]){if(!event.date.startsWith(`${month}-`))continue;if(event.parts?.length){for(const part of event.parts){if((part.kind??'expense')==='expense')add(categoryPath(part.category,part.subcategory),part.amount);if(part.kind==='refund')add(categoryPath(part.category,part.subcategory),-part.amount)}continue}const impact=flowImpactEvent(event);if(impact.expense)add(categoryPath(event.category,event.subcategory),impact.expense);if(impact.refund)add(categoryPath(event.category,event.subcategory),-impact.refund)}
  return [...totals.entries()].map(([name,value])=>({name,value:Math.max(0,value)})).filter(row=>row.value>.005).sort((a,b)=>b.value-a.value);
}

export function operationalReportSnapshot(data:FinanceData,month:string){
  const flow=operationalMonthlyFlow(data,month);const previous=operationalMonthlyFlow(data,shiftReportMonth(month,-1));const balances=accountBalances(data,monthEnd(month));const creditDebt=Math.abs(Math.min(0,balances['credit-card']||0));const creditLimit=data.state.settings.creditLimit??0;const receivables=lendingRows(data).reduce((sum,row)=>sum+row.outstanding,0);const recurring=recurringMonthlyTotal(data);const savings=savingsBreakdown(data,month);const budget=data.state.settings.monthlyBudget??0;
  return {flow,previous,balances,creditDebt,creditLimit,creditUsage:creditLimit>0?Math.min(1,creditDebt/creditLimit):0,receivables,recurring,savings,budget,budgetRemaining:budget-flow.expense};
}
