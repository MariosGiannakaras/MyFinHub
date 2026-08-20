import { accountBalances, effectiveLegacyTransactions, flowImpactEvent, flowImpactLegacy } from './domain.js';
import { categoryPath } from './categories.js';
import { creditCards, creditDebtForCard, creditLimitForCard } from './cards.js';
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

function relativeChange(current:number,previous:number){return previous===0?(current===0?0:null):(current-previous)/Math.abs(previous)}
function average(values:number[]){return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0}

export function categoryMomentum(data:FinanceData,month:string,limit=10){
  const current=subcategoryTotals(data,month);
  const previous=new Map(subcategoryTotals(data,shiftReportMonth(month,-1)).map(row=>[row.name,row.value]));
  return current.slice(0,limit).map(row=>{const previousValue=previous.get(row.name)??0;return {...row,previous:previousValue,change:relativeChange(row.value,previousValue)}});
}

export function creditCardSnapshots(data:FinanceData,asOf:string){
  return creditCards(data,{includeArchived:true}).map(card=>{
    const debt=creditDebtForCard(data,card.id,asOf);const limit=card.active===false?0:creditLimitForCard(data,card);
    return {id:card.id,nickname:card.nickname,bankId:card.bankId,active:card.active!==false,debt,limit,available:Math.max(0,limit-debt),usage:limit>0?Math.min(1,debt/limit):0};
  }).sort((a,b)=>b.debt-a.debt||a.nickname.localeCompare(b.nickname,'el'));
}

export function creditPortfolioSnapshot(data:FinanceData,asOf:string){
  const cards=creditCardSnapshots(data,asOf);
  const active=cards.filter(card=>card.active);
  const debt=cards.reduce((sum,card)=>sum+card.debt,0);
  const limit=active.reduce((sum,card)=>sum+card.limit,0);
  const available=Math.max(0,limit-debt);
  return {
    activeCards:active.length,
    totalCards:cards.length,
    debt,
    limit,
    available,
    usage:limit>0?Math.min(1,debt/limit):0,
    cards,
  };
}

export function reportInsightModel(data:FinanceData,month:string){
  const flow=operationalMonthlyFlow(data,month);
  const previousMonth=shiftReportMonth(month,-1);
  const previous=operationalMonthlyFlow(data,previousMonth);
  const recent=reportFlowSeries(data,shiftReportMonth(month,-1),3);
  const trailingExpenseAverage=average(recent.map(row=>row.expense));
  const categories=subcategoryTotals(data,month);
  const previousCategories=new Map(subcategoryTotals(data,previousMonth).map(row=>[row.name,row.value]));
  const topCategory=categories[0];
  const recurring=recurringMonthlyTotal(data);
  const credit=creditPortfolioSnapshot(data,monthEnd(month));
  const topPrevious=topCategory?previousCategories.get(topCategory.name)??0:0;
  return {
    month,
    incomeChange:relativeChange(flow.income,previous.income),
    expenseChange:relativeChange(flow.expense,previous.expense),
    savingChange:relativeChange(flow.saving,previous.saving),
    netFlow:flow.income-flow.expense,
    savingsRate:flow.income>0?flow.saving/flow.income:null,
    previousSavingsRate:previous.income>0?previous.saving/previous.income:null,
    trailingExpenseAverage,
    expenseVsTrailingAverage:trailingExpenseAverage>0?(flow.expense-trailingExpenseAverage)/trailingExpenseAverage:null,
    recurringBurden:flow.income>0?recurring/flow.income:null,
    topCategory:topCategory?{
      name:topCategory.name,
      value:topCategory.value,
      share:flow.expense>0?topCategory.value/flow.expense:null,
      change:relativeChange(topCategory.value,topPrevious),
    }:null,
    credit,
    sufficientExpenseHistory:recent.some(row=>row.expense>0),
  };
}

export function operationalReportSnapshot(data:FinanceData,month:string){
  const flow=operationalMonthlyFlow(data,month);const previous=operationalMonthlyFlow(data,shiftReportMonth(month,-1));const balances=accountBalances(data,monthEnd(month));const credit=creditPortfolioSnapshot(data,monthEnd(month));const receivables=lendingRows(data).reduce((sum,row)=>sum+row.outstanding,0);const recurring=recurringMonthlyTotal(data);const savings=savingsBreakdown(data,month);const budget=data.state.settings.monthlyBudget??0;
  return {flow,previous,balances,creditDebt:credit.debt,creditLimit:credit.limit,creditUsage:credit.usage,creditAvailable:credit.available,creditCards:credit.activeCards,creditCardRows:credit.cards,receivables,recurring,savings,budget,budgetRemaining:budget-flow.expense};
}