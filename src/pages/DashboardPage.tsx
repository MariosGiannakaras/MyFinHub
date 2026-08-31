import { useReducedMotion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, CalendarDays, Eye, EyeOff, List, MoreHorizontal, PiggyBank, ShieldCheck, Target, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AccountIban } from '../components/AccountIban';
import { BankBrandMark } from '../components/BankBrandMark';
import { FinanceIcon } from '../components/FinanceIcon';
import type { QuickPrefill } from '../components/QuickAdd';
import { budgetProgress } from '../lib/budgets';
import { allAccounts, effectiveLegacyTransactions, flowImpactEvent, flowImpactLegacy, monthRange } from '../lib/domain';
import { cashFlowForecast } from '../lib/forecast';
import { money } from '../lib/format';
import { activeRecurringItems } from '../lib/recurring';
import { selectAccountBalances, selectCategoryTotals, selectMonthlyFlow } from '../lib/selectors';
import { accountDisplayName } from '../lib/ui';
import type { Account, FinanceData, FinanceEvent, LegacyTransaction } from '../types';

const chartColors=['#36c978','#3f8df5','#ffb52e','#a65ad9','#d64fb6','#98a4b7','#25b9d7','#7656d6'];
const PRIMARY_ACCOUNTS=['cash','piraeus-payroll','piraeus-savings'];

type DashboardMovement={id:string;date:string;note:string;category:string;kind:string;amount:number;accountId?:string;expense:boolean;neutral:boolean};
type DailyFlow={day:number;income:number;expense:number};
type UpcomingItem={id:string;group:string;name:string;dateLabel:string;amount:number;category?:string};

function shiftMonth(month:string,delta:number){const [year,rawMonth]=month.split('-').map(Number);const date=new Date(Date.UTC(year,rawMonth-1+delta,1));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`}
function previousDate(date:string){const current=new Date(`${date}T12:00:00Z`);current.setUTCDate(current.getUTCDate()-1);return current.toISOString().slice(0,10)}
function formatShortDay(date:string){return new Intl.DateTimeFormat('el-GR',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`)).replace('.','')}
function formatMonthLabel(month:string){return new Intl.DateTimeFormat('el-GR',{month:'short',timeZone:'UTC'}).format(new Date(`${month}-01T12:00:00Z`)).replace('.','')}
function formatRange(month:string){const {start,end}=monthRange(month);return `${new Intl.DateTimeFormat('el-GR',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${start}T12:00:00Z`)).replace('.','')} – ${new Intl.DateTimeFormat('el-GR',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${end}T12:00:00Z`)).replace('.','')}`}
function compactAccountLabel(account:Account,data:FinanceData){return accountDisplayName(data,account.id)||account.name||account.short||account.id}
function signedMoney(value:number){return `${value<0?'−':''}${money.format(Math.abs(value))}`}
function safePercent(value:number){return Number.isFinite(value)?Math.round(value):0}
function percentChange(current:number,previous:number){return Math.abs(previous)>0.005?safePercent(((current-previous)/Math.abs(previous))*100):null}
function movementAmountLabel(item:DashboardMovement){if(item.neutral)return `↔ ${money.format(Math.abs(item.amount))}`;if(item.expense)return `−${money.format(Math.abs(item.amount))}`;return item.amount>0?`+${money.format(Math.abs(item.amount))}`:money.format(0)}

function Sparkline({values,tone='blue',target,comparison}: {values:number[];tone?:'blue'|'green'|'red'|'purple';target?:number[];comparison?:number[]}){
  const width=150,height=42,pad=3;
  const combined=[...values,...(target??[]),...(comparison??[])];const min=Math.min(...combined,0),max=Math.max(...combined,1);const span=Math.max(1,max-min);
  const points=(rows:number[])=>rows.map((value,index)=>`${pad+(index/Math.max(1,rows.length-1))*(width-pad*2)},${height-pad-((value-min)/span)*(height-pad*2)}`).join(' ');
  return <svg className={`dashboard-sparkline tone-${tone}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">{comparison?.length?<polyline points={points(comparison)} fill="none" vectorEffect="non-scaling-stroke" style={{stroke:'#8fc3fa',strokeWidth:1.4,opacity:.88}}/>:null}<polyline points={points(values)} fill="none" vectorEffect="non-scaling-stroke"/>{target?.length?<polyline className="target-line" points={points(target)} fill="none" vectorEffect="non-scaling-stroke"/>:null}</svg>;
}

function movementFromLegacy(data:FinanceData,tx:LegacyTransaction):DashboardMovement{
  const impact=flowImpactLegacy(data,tx);const expense=impact.expense>0;const neutral=impact.income===0&&impact.expense===0;const amount=impact.income>0?impact.income:expense?-impact.expense:impact.refund>0?impact.refund:tx.amount;
  return {id:`legacy:${tx.id}`,date:tx.date,note:tx.note,category:tx.category||'Άλλο',kind:tx.type,amount,accountId:tx.accountId||tx.fromAccountId,expense,neutral};
}
function movementFromEvent(event:FinanceEvent):DashboardMovement{
  const impact=flowImpactEvent(event);const expense=impact.expense>0;const neutral=impact.income===0&&impact.expense===0;const amount=impact.income>0?impact.income:expense?-impact.expense:impact.refund>0?impact.refund:event.amount;
  return {id:`event:${event.id}`,date:event.date,note:event.note,category:event.category||'Άλλο',kind:event.kind,amount,accountId:event.accountId||event.fromAccountId,expense,neutral};
}
function accountLegacyDelta(tx:LegacyTransaction,accountId:string){if(tx.type==='income'&&tx.accountId===accountId)return tx.amount;if(tx.type==='expense'&&tx.accountId===accountId)return-tx.amount;if(tx.type==='adjustment'&&tx.accountId===accountId)return tx.amount;if(tx.type==='transfer'){if(tx.fromAccountId===accountId)return-tx.amount;if(tx.toAccountId===accountId)return tx.amount}return 0}

export function DashboardPage({ data, month, asOf, motionMode='system', onQuickAdd: _onQuickAdd, onAccountQuickAdd, onTransactions, onPlanning, onAttention: _onAttention, onReports }: {data:FinanceData;month:string;asOf:string;motionMode?:'system'|'reduced'|'full';onQuickAdd:(prefill?:QuickPrefill)=>void;onAccountQuickAdd:(accountId:string,kind:string)=>void;onTransactions:()=>void;onPlanning:()=>void;onAttention:()=>void;onReports:()=>void}) {
  const systemReduced=useReducedMotion();const reduce=Boolean(systemReduced)||motionMode==='reduced';const animateCharts=motionMode==='full'&&!reduce;
  const [balancesVisible,setBalancesVisible]=useState(false);
  const flow=selectMonthlyFlow(data,month);const balances=selectAccountBalances(data,asOf);const accounts=allAccounts(data).filter(account=>account.kind!=='credit');
  const primary=PRIMARY_ACCOUNTS.map(id=>accounts.find(account=>account.id===id)).filter(Boolean) as Account[];const remaining=accounts.filter(account=>!PRIMARY_ACCOUNTS.includes(account.id));
  const categories=selectCategoryTotals(data,month).slice(0,6);const range=monthRange(month);const savingsTargetRate=data.state.settings.savingsTargetRate??.2;
  const previousMonth=shiftMonth(month,-1);const previousRange=monthRange(previousMonth);const previousMonthLabel=formatMonthLabel(previousMonth);const previousFlow=selectMonthlyFlow(data,previousMonth);
  const balanceMonth=asOf.slice(0,7);const balancePreviousMonth=shiftMonth(balanceMonth,-1);const balancePreviousRange=monthRange(balancePreviousMonth);const balancePreviousMonthLabel=formatMonthLabel(balancePreviousMonth);const balancePreviousBalances=selectAccountBalances(data,balancePreviousRange.end);const balanceFlow=selectMonthlyFlow(data,balanceMonth);

  const movements=useMemo(()=>[
    ...effectiveLegacyTransactions(data).filter(tx=>tx.date>=range.start&&tx.date<=range.end).map(tx=>movementFromLegacy(data,tx)),
    ...(data.state.events??[]).filter(event=>event.date>=range.start&&event.date<=range.end).map(movementFromEvent),
  ].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)),[data,range.start,range.end]);

  const dailyFlow=useMemo<DailyFlow[]>(()=>{const days=Number(range.end.slice(-2));const rows=Array.from({length:days},(_,index)=>({day:index+1,income:0,expense:0}));
    for(const tx of effectiveLegacyTransactions(data)){if(tx.date<range.start||tx.date>range.end)continue;const impact=flowImpactLegacy(data,tx);const row=rows[Number(tx.date.slice(-2))-1];if(row){row.income+=impact.income;row.expense+=Math.max(0,impact.expense)}}
    for(const event of data.state.events??[]){if(event.date<range.start||event.date>range.end)continue;const impact=flowImpactEvent(event);const row=rows[Number(event.date.slice(-2))-1];if(row){row.income+=impact.income;row.expense+=Math.max(0,impact.expense)}}
    return rows;
  },[data,range.start,range.end]);

  const accountTrend=(accountId:string,targetMonth=balanceMonth)=>{const targetRange=monthRange(targetMonth);const endDate=targetMonth===balanceMonth?asOf:targetRange.end;const endBalance=selectAccountBalances(data,endDate)[accountId]??0;const deltas=new Map<number,number>();
    for(const tx of effectiveLegacyTransactions(data)){if(tx.date<targetRange.start||tx.date>endDate)continue;const delta=accountLegacyDelta(tx,accountId);if(delta)deltas.set(Number(tx.date.slice(-2)),(deltas.get(Number(tx.date.slice(-2)))??0)+delta)}
    for(const event of data.state.events??[]){if(event.date<targetRange.start||event.date>endDate)continue;const delta=event.legs.filter(leg=>leg.accountId===accountId).reduce((sum,leg)=>sum+leg.amount,0);if(delta)deltas.set(Number(event.date.slice(-2)),(deltas.get(Number(event.date.slice(-2)))??0)+delta)}
    const totalDelta=[...deltas.values()].reduce((sum,value)=>sum+value,0);let current=endBalance-totalDelta;const values=[current];const lastDay=Number(endDate.slice(-2));for(let day=1;day<=lastDay;day+=1){current+=deltas.get(day)??0;values.push(current)}return values.length>1?values:[endBalance,endBalance];};

  const primaryTrends=Object.fromEntries(primary.map(account=>[account.id,accountTrend(account.id)]));
  const savingsAccount=primary.find(account=>account.kind==='savings');const previousSavings=savingsAccount?accountTrend(savingsAccount.id,balancePreviousMonth):[];
  const savingAmount=flow.saving;const savingsRate=flow.income>0?savingAmount/flow.income:0;const previousSavingsRate=previousFlow.income>0?previousFlow.saving/previousFlow.income:null;
  const incomeComparison=percentChange(flow.income,previousFlow.income);const expenseComparison=percentChange(flow.expense,previousFlow.expense);const savingComparison=percentChange(savingAmount,previousFlow.saving);const savingsRateDelta=previousSavingsRate===null?null:safePercent((savingsRate-previousSavingsRate)*100);
  const comparisonText=(value:number|null)=>value===null?`— έναντι ${previousMonthLabel}`:`${value>0?'↑':value<0?'↓':'→'} ${Math.abs(value)}% από ${previousMonthLabel}`;
  const incomeCumulative=dailyFlow.reduce<number[]>((rows,row)=>{rows.push((rows.at(-1)??0)+row.income);return rows},[]);const expenseCumulative=dailyFlow.reduce<number[]>((rows,row)=>{rows.push((rows.at(-1)??0)+row.expense);return rows},[]);

  const recurringCategoryByName=useMemo(()=>new Map(activeRecurringItems(data).map(item=>[item.name,item.category])),[data]);
  const upcoming=useMemo<UpcomingItem[]>(()=>{
    const groupFor=(item:ReturnType<typeof cashFlowForecast>['movements'][number])=>{
      const defaultGroup=item.source==='recurring'?'Πάγια':item.source==='loan'?'Δόσεις / Δάνεια':'Προγραμματισμένα';
      if(item.source==='recurring'&&/συνδρομ/i.test(recurringCategoryByName.get(item.label)??''))return 'Συνδρομές';
      return defaultGroup;
    };
    const groupRank:Record<string,number>={'Συνδρομές':0,'Πάγια':1,'Δόσεις / Δάνεια':2,'Προγραμματισμένα':3};
    return cashFlowForecast(data,asOf,30).movements.filter(item=>item.portfolioDelta<-.005).sort((a,b)=>(groupRank[groupFor(a)]??9)-(groupRank[groupFor(b)]??9)).slice(0,4).map(item=>({
      id:item.id,
      group:groupFor(item),
      name:item.label,
      dateLabel:formatShortDay(item.date),
      amount:Math.abs(item.portfolioDelta),
      category:item.source==='loan'?'Δάνειο':recurringCategoryByName.get(item.label),
    }));
  },[data,asOf,recurringCategoryByName]);

  const visibleSecondary=remaining.slice(0,4);const hiddenSecondary=Math.max(0,remaining.length-visibleSecondary.length);
  const largestCategory=categories[0];const daysElapsed=month===asOf.slice(0,7)?Math.max(1,Number(asOf.slice(-2))):Number(range.end.slice(-2));const previousDays=Math.max(1,Number(previousRange.end.slice(-2)));
  const averageDailyExpense=flow.expense/daysElapsed;const previousAverageDailyExpense=previousFlow.expense/previousDays;const dailyExpenseComparison=percentChange(averageDailyExpense,previousAverageDailyExpense);
  const budgetRows=budgetProgress(data,month);const budgetHighlight=budgetRows.find(row=>row.status==='exceeded')??budgetRows.slice().sort((a,b)=>b.ratio-a.ratio||a.id.localeCompare(b.id))[0];
  const openingDate=previousDate(range.start);const openingBalances=selectAccountBalances(data,openingDate);const periodEndDate=month===asOf.slice(0,7)?asOf:range.end;const periodEndingBalances=selectAccountBalances(data,periodEndDate);const openingTotal=accounts.reduce((sum,account)=>sum+(openingBalances[account.id]??0),0);const endingTotal=accounts.reduce((sum,account)=>sum+(periodEndingBalances[account.id]??0),0);
  const targetSavings=Math.max(0,balanceFlow.income*savingsTargetRate);const privacyMoney=(value:number)=>balancesVisible?money.format(value):'•••••• €';

  return <div className="page-stack dashboard-approved" data-approved-dashboard="true">
    <span className="sr-only">Νέα κίνηση διαθέσιμη από τη Γρήγορη κίνηση.</span>
    <section className="page-heading dashboard-approved-heading"><div><span className="eyebrow">ΕΠΙΣΚΟΠΗΣΗ</span><h1>Οι λογαριασμοί μου</h1><p>Πλήρης εικόνα των οικονομικών σας. Τα πιο σημαντικά στοιχεία με μια ματιά.</p></div><div className="heading-actions"><button type="button" className="secondary privacy-toggle" aria-pressed={balancesVisible} onClick={()=>setBalancesVisible(value=>!value)}>{balancesVisible?<EyeOff size={16}/>:<Eye size={16}/>} {balancesVisible?'Απόκρυψη ποσών':'Εμφάνιση ποσών'}</button></div></section>

    <section className="primary-balance-grid approved-primary-grid" aria-label="Κύριοι λογαριασμοί" data-dashboard-section="primary-accounts">{primary.map((account,index)=>{const values=primaryTrends[account.id]??[balances[account.id]??0];const currentBalance=balances[account.id]??0;const pct=percentChange(currentBalance,balancePreviousBalances[account.id]??0);const savings=account.kind==='savings';const start=values[0]??currentBalance;const targetLine=savings?values.map((_,point)=>start+(targetSavings*(point/Math.max(1,values.length-1)))):undefined;const accountAction=savings?'Μεταφορά':'Νέα κίνηση';return <article className={`primary-balance-card approved-account-card account-tone-${index}`} key={account.id} data-account-id={account.id}><div className="approved-account-head"><div className="approved-account-identity"><span className="approved-account-icon">{savings?<BankBrandMark id={account.id} name={compactAccountLabel(account,data)}/>:index===1?<WalletCards size={20}/>:<FinanceIcon kind="cash" size={20}/>}</span><div><strong>{compactAccountLabel(account,data)}</strong><AccountIban accountId={account.id}/></div></div>{savings?<span className="savings-target"><Target size={13}/> Στόχος {Math.round(savingsTargetRate*100)}%</span>:null}</div><div className="approved-account-body"><div><b className="approved-balance">{privacyMoney(currentBalance)}</b>{!savings?<span className={`approved-trend ${pct===null?'':pct>=0?'positive':'negative'}`}>{pct===null?'—':`${pct>=0?'↑':'↓'} ${Math.abs(pct)}%`} <small>{pct===null?`χωρίς βάση ${balancePreviousMonthLabel}`:`από ${balancePreviousMonthLabel}`}</small></span>:null}</div><div className="approved-account-chart"><Sparkline values={values} tone={savings?'blue':index===1?'purple':'green'} target={targetLine} comparison={savings?previousSavings:undefined}/>{savings?<div className="savings-legend"><span className="current">Τρέχων μήνας</span><span className="previous">Προηγ. μήνας</span><span className="goal">Στόχος</span></div>:null}</div></div><div className="approved-account-actions"><button type="button" data-account-quick-entry={account.id} onClick={()=>onAccountQuickAdd(account.id,account.kind)}><ArrowRight size={15}/> {accountAction}</button><button type="button" onClick={onTransactions}><List size={15}/> Συναλλαγές</button><button type="button" className="account-context-action" aria-label={`${accountAction} για ${compactAccountLabel(account,data)}`} title={`${accountAction} για ${compactAccountLabel(account,data)}`} onClick={()=>onAccountQuickAdd(account.id,account.kind)}><MoreHorizontal size={16}/></button></div></article>})}</section>

    {remaining.length?<section className="approved-secondary-panel" data-dashboard-section="other-balances"><div className="approved-section-title"><strong>Λοιποί λογαριασμοί</strong></div><div className="approved-secondary-grid">{visibleSecondary.map(account=><article className="approved-secondary-account" key={account.id}><BankBrandMark id={account.id} name={compactAccountLabel(account,data)}/><div><small>{compactAccountLabel(account,data)}</small><b>{privacyMoney(balances[account.id]??0)}</b></div><button type="button" onClick={onTransactions}>Συναλλαγές</button></article>)}{hiddenSecondary>0?<article className="approved-secondary-account approved-secondary-more"><div><small>+ {hiddenSecondary} ακόμα</small></div><button type="button" onClick={onTransactions}>Συναλλαγές</button></article>:null}</div></section>:null}

    <section className="approved-mid-grid" data-dashboard-section="pending">
      <article className="approved-panel approved-movements"><div className="approved-panel-head"><strong>Κινήσεις μήνα</strong><button type="button" onClick={onTransactions}>Προβολή όλων</button></div><div className="movement-head"><span>Συναλλαγή</span><span>Κατηγορία</span><span>Ημερομηνία</span><span>Ποσό</span></div><div className="movement-list">{movements.slice(0,5).map(item=><div className="movement-row" key={item.id}><span className="movement-title"><FinanceIcon kind={item.kind} category={item.category} note={item.note} size={14}/><b>{item.note}</b></span><small>{item.category}</small><small>{formatShortDay(item.date)}</small><b className={item.neutral?'':item.expense?'negative':'positive'}>{movementAmountLabel(item)}</b></div>)}</div><button type="button" className="approved-footer-link" onClick={onTransactions}>Προβολή όλων των κινήσεων <ArrowRight size={14}/></button></article>

      <article className="approved-panel approved-upcoming"><span className="sr-only">Προγραμματισμένες και επαναλαμβανόμενες πληρωμές από το κανονικό μοντέλο πρόβλεψης.</span><div className="approved-panel-head"><strong>Επερχόμενες πληρωμές</strong><button type="button" onClick={onPlanning}>Προβολή όλων</button></div><div className="upcoming-list">{upcoming.map(item=><div className="upcoming-row" key={item.id}><span className="upcoming-icon"><FinanceIcon kind="expense" category={item.category} note={item.name} size={15}/></span><div><small>{item.group}</small><b>{item.name}</b></div><span>{item.dateLabel}</span><strong>−{money.format(item.amount)}</strong></div>)}</div></article>

      <article className="approved-panel approved-summary"><div className="approved-panel-head"><strong>Σύνοψη οικονομικών</strong><span><CalendarDays size={13}/>{formatRange(month)}</span></div><div className="summary-line summary-income"><div><small>Έσοδα</small><b>{money.format(flow.income)}</b><span className={incomeComparison===null?'':incomeComparison>=0?'positive':'negative'}>{comparisonText(incomeComparison)}</span></div><Sparkline values={incomeCumulative.length?incomeCumulative:[0,0]} tone="green"/></div><div className="summary-line summary-expense"><div><small>Έξοδα</small><b>−{money.format(flow.expense)}</b><span className={expenseComparison===null?'':expenseComparison<=0?'positive':'negative'}>{comparisonText(expenseComparison)}</span></div><Sparkline values={expenseCumulative.length?expenseCumulative:[0,0]} tone="red"/></div><div className="summary-net"><div><small>Αποταμίευση</small><b className={savingAmount>=0?'positive':'negative'}>{signedMoney(savingAmount)}</b><span className={savingComparison===null?'':savingComparison>=0?'positive':'negative'}>{comparisonText(savingComparison)}</span></div><div className="summary-donut" aria-hidden="true"><ResponsiveContainer width="100%" height={74}><PieChart><Pie data={[{name:'Έσοδα',value:Math.max(flow.income,0)},{name:'Έξοδα',value:Math.max(flow.expense,0)}]} dataKey="value" innerRadius={21} outerRadius={31} strokeWidth={0} isAnimationActive={animateCharts}><Cell fill="#36c978"/><Cell fill="#ff5b62"/></Pie></PieChart></ResponsiveContainer><span><i className="income"/>Έσοδα <b>{flow.income+flow.expense?safePercent(flow.income/(flow.income+flow.expense)*100):0}%</b><i className="expense"/>Έξοδα <b>{flow.income+flow.expense?safePercent(flow.expense/(flow.income+flow.expense)*100):0}%</b></span></div></div></article>
    </section>

    <section className="approved-chart-grid" data-dashboard-section="quick-entry">
      <article className="approved-panel approved-flow-chart"><div className="approved-panel-head"><div><strong>Έσοδα &amp; Έξοδα</strong><span className="flow-legend"><i className="income"/>Έσοδα <i className="expense"/>Έξοδα</span></div></div><div className="approved-bar-wrap" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><BarChart data={dailyFlow} barGap={1} margin={{top:4,right:6,bottom:0,left:-12}}><CartesianGrid stroke="#e6edf6" vertical={false}/><XAxis dataKey="day" tick={{fontSize:8,fill:'#62728e'}} interval={4} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:8,fill:'#62728e'}} tickFormatter={value=>`${Math.round(Number(value))} €`} width={48} axisLine={false} tickLine={false}/><Tooltip formatter={(value,name)=>[money.format(Number(value)),name==='income'?'Έσοδα':'Έξοδα']} labelFormatter={day=>`${day} ${new Intl.DateTimeFormat('el-GR',{month:'short'}).format(new Date(`${month}-01T12:00:00`)).replace('.','')}`}/><Bar dataKey="income" fill="#36c978" radius={[2,2,0,0]} isAnimationActive={animateCharts}/><Bar dataKey="expense" fill="#ff5b62" radius={[2,2,0,0]} isAnimationActive={animateCharts}/></BarChart></ResponsiveContainer></div></article>

      <article className="approved-panel approved-category-panel"><div className="approved-panel-head"><strong>Κατηγορίες εξόδων</strong></div><div className="approved-category-layout"><div className="approved-category-donut" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categories} dataKey="value" nameKey="name" innerRadius={45} outerRadius={67} strokeWidth={0} isAnimationActive={animateCharts}>{categories.map((_,index)=><Cell key={index} fill={chartColors[index%chartColors.length]}/>)}</Pie><Tooltip formatter={value=>money.format(Number(value))}/></PieChart></ResponsiveContainer><div><b>{money.format(flow.expense)}</b><span>Σύνολο εξόδων</span></div></div><div className="approved-category-table"><div className="category-table-head"><span>Κατηγορία</span><span>Ποσό</span><span>%</span></div>{categories.map((category,index)=><div className="category-table-row" key={category.name}><span><i style={{background:chartColors[index%chartColors.length]}}/>{category.name}</span><b>{money.format(category.value)}</b><b>{flow.expense?safePercent(category.value/flow.expense*100):0}%</b></div>)}</div></div><button type="button" className="approved-footer-link" onClick={onReports}>Προβολή αναλυτικής αναφοράς <ArrowRight size={14}/></button></article>
    </section>

    <section className="approved-kpi-strip" data-dashboard-section="rest"><article><span className="kpi-icon blue"><PiggyBank size={16}/></span><div><small>Μέση ημερήσια δαπάνη</small><b>{money.format(averageDailyExpense)}</b><span className={dailyExpenseComparison===null?'':dailyExpenseComparison<=0?'positive':'negative'}>{comparisonText(dailyExpenseComparison)}</span></div><Sparkline values={dailyFlow.slice(-8).map(row=>row.expense)} tone="blue"/></article><article data-budget-panel style={{position:'relative'}}><span className="kpi-icon green"><FinanceIcon kind="expense" category={largestCategory?.name} size={16}/></span><div><small>Μεγαλύτερη κατηγορία</small><b>{largestCategory?.name||'—'}</b><span>{largestCategory?`${money.format(largestCategory.value)} (${flow.expense?safePercent(largestCategory.value/flow.expense*100):0}%)`:'Χωρίς έξοδα'}</span></div><span className="sr-only">{budgetHighlight?`${budgetHighlight.scope==='overall'?'Συνολικό discretionary':budgetHighlight.category} · ${budgetHighlight.status==='exceeded'?'Υπέρβαση':budgetHighlight.status==='near'?'Κοντά στο όριο':'Εντός ορίου'}`:'Δεν υπάρχουν budgets'}</span><button type="button" onClick={onReports} aria-label="Αναλυτική εικόνα budgets" style={{position:'absolute',inset:0,border:0,background:'transparent',cursor:'pointer'}}><span className="sr-only">Αναλυτική εικόνα budgets</span></button></article><article><span className="kpi-icon blue"><Target size={16}/></span><div><small>Ποσοστό αποταμίευσης</small><b>{safePercent(savingsRate*100)}%</b><span className={savingsRateDelta===null?'':savingsRateDelta>=0?'positive':'negative'}>{savingsRateDelta===null?'— έναντι προηγ. μήνα':`${savingsRateDelta>0?'↑':savingsRateDelta<0?'↓':'→'} ${Math.abs(savingsRateDelta)} π.μ. από προηγ. μήνα`}</span></div></article><article><span className="kpi-icon blue"><List size={16}/></span><div><small>Συναλλαγές</small><b>{movements.length}</b><span>{movements.length?`${movements.filter(item=>item.expense).length} έξοδα`:'Χωρίς κινήσεις'}</span></div></article><article><span className="kpi-icon purple"><WalletCards size={16}/></span><div><small>Υπόλοιπο στην αρχή</small><b>{privacyMoney(openingTotal)}</b></div></article><article><span className="kpi-icon green"><WalletCards size={16}/></span><div><small>Υπόλοιπο στο τέλος</small><b>{privacyMoney(endingTotal)}</b></div></article></section>

    <footer className="approved-data-footer"><ShieldCheck size={12}/> Τα δεδομένα σας είναι ασφαλή και κρυπτογραφημένα.</footer>
  </div>;
}
