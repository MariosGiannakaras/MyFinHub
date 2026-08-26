import { useReducedMotion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, CalendarDays, Eye, EyeOff, List, MoreHorizontal, PiggyBank, ShieldCheck, Target, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BankBrandMark } from '../components/BankBrandMark';
import { FinanceIcon } from '../components/FinanceIcon';
import type { QuickPrefill } from '../components/QuickAdd';
import { useAccountMetadata } from '../hooks/useAccountMetadata';
import { allAccounts, effectiveLegacyTransactions, flowImpactEvent, flowImpactLegacy, monthRange } from '../lib/domain';
import { money } from '../lib/format';
import { pendingScheduled } from '../lib/scheduled';
import { selectAccountBalances, selectCategoryTotals, selectMonthlyFlow } from '../lib/selectors';
import { accountDisplayName, effectiveRecurringItems } from '../lib/ui';
import type { Account, FinanceData, FinanceEvent, LegacyTransaction } from '../types';

const chartColors=['#36c978','#3f8df5','#ffb52e','#a65ad9','#d64fb6','#98a4b7','#25b9d7','#7656d6'];
const PRIMARY_ACCOUNTS=['cash','piraeus-payroll','piraeus-savings'];

type DashboardMovement={id:string;date:string;note:string;category:string;kind:string;amount:number;accountId?:string};
type DailyFlow={day:number;income:number;expense:number};
type UpcomingItem={id:string;group:string;name:string;dateLabel:string;amount:number;category?:string};

function shiftMonth(month:string,delta:number){const [year,rawMonth]=month.split('-').map(Number);const date=new Date(Date.UTC(year,rawMonth-1+delta,1));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`}
function previousDate(date:string){const current=new Date(`${date}T12:00:00Z`);current.setUTCDate(current.getUTCDate()-1);return current.toISOString().slice(0,10)}
function formatShortDay(date:string){return new Intl.DateTimeFormat('el-GR',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`)).replace('.','')}
function formatRange(month:string){const {start,end}=monthRange(month);return `${new Intl.DateTimeFormat('el-GR',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${start}T12:00:00Z`)).replace('.','')} – ${new Intl.DateTimeFormat('el-GR',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${end}T12:00:00Z`)).replace('.','')}`}
function compactAccountLabel(account:Account,data:FinanceData){return accountDisplayName(data,account.id)||account.name||account.short||account.id}
function signedMoney(value:number){return `${value<0?'−':''}${money.format(Math.abs(value))}`}
function safePercent(value:number){return Number.isFinite(value)?Math.round(value):0}

function Sparkline({values,tone='blue',target}: {values:number[];tone?:'blue'|'green'|'red'|'purple';target?:number[]}){
  const width=150,height=42,pad=3;
  const combined=[...values,...(target??[])];const min=Math.min(...combined,0),max=Math.max(...combined,1);const span=Math.max(1,max-min);
  const points=(rows:number[])=>rows.map((value,index)=>`${pad+(index/Math.max(1,rows.length-1))*(width-pad*2)},${height-pad-((value-min)/span)*(height-pad*2)}`).join(' ');
  return <svg className={`dashboard-sparkline tone-${tone}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true"><polyline points={points(values)} fill="none" vectorEffect="non-scaling-stroke"/>{target?.length?<polyline className="target-line" points={points(target)} fill="none" vectorEffect="non-scaling-stroke"/>:null}</svg>;
}

function movementFromLegacy(data:FinanceData,tx:LegacyTransaction):DashboardMovement{
  const impact=flowImpactLegacy(data,tx);const amount=impact.income>0?impact.income:impact.expense>0?-impact.expense:tx.type==='transfer'?-tx.amount:tx.amount;
  return {id:`legacy:${tx.id}`,date:tx.date,note:tx.note,category:tx.category||'Άλλο',kind:tx.type,amount,accountId:tx.accountId||tx.fromAccountId};
}
function movementFromEvent(event:FinanceEvent):DashboardMovement{
  const impact=flowImpactEvent(event);const amount=impact.income>0?impact.income:impact.expense>0?-impact.expense:event.kind==='refund'?event.amount:event.kind==='transfer'||event.kind==='saving_cash_offset'||event.kind==='card_payment'?-event.amount:event.amount;
  return {id:`event:${event.id}`,date:event.date,note:event.note,category:event.category||'Άλλο',kind:event.kind,amount,accountId:event.accountId||event.fromAccountId};
}
function accountLegacyDelta(tx:LegacyTransaction,accountId:string){if(tx.type==='income'&&tx.accountId===accountId)return tx.amount;if(tx.type==='expense'&&tx.accountId===accountId)return-tx.amount;if(tx.type==='adjustment'&&tx.accountId===accountId)return tx.amount;if(tx.type==='transfer'){if(tx.fromAccountId===accountId)return-tx.amount;if(tx.toAccountId===accountId)return tx.amount}return 0}

export function DashboardPage({ data, month, asOf, motionMode='system', onQuickAdd: _onQuickAdd, onAccountQuickAdd, onTransactions, onPlanning, onAttention: _onAttention, onReports }: {data:FinanceData;month:string;asOf:string;motionMode?:'system'|'reduced'|'full';onQuickAdd:(prefill?:QuickPrefill)=>void;onAccountQuickAdd:(accountId:string,kind:string)=>void;onTransactions:()=>void;onPlanning:()=>void;onAttention:()=>void;onReports:()=>void}) {
  const systemReduced=useReducedMotion();const reduce=Boolean(systemReduced)||motionMode==='reduced';
  const [balancesVisible,setBalancesVisible]=useState(false);
  const metadata=useAccountMetadata();
  const flow=selectMonthlyFlow(data,month);const balances=selectAccountBalances(data,asOf);const accounts=allAccounts(data).filter(account=>account.kind!=='credit');
  const primary=PRIMARY_ACCOUNTS.map(id=>accounts.find(account=>account.id===id)).filter(Boolean) as Account[];const remaining=accounts.filter(account=>!PRIMARY_ACCOUNTS.includes(account.id));
  const categories=selectCategoryTotals(data,month).slice(0,6);const range=monthRange(month);const savingsTargetRate=data.state.settings.savingsTargetRate??.2;

  const movements=useMemo(()=>[
    ...effectiveLegacyTransactions(data).filter(tx=>tx.date>=range.start&&tx.date<=range.end).map(tx=>movementFromLegacy(data,tx)),
    ...(data.state.events??[]).filter(event=>event.date>=range.start&&event.date<=range.end).map(movementFromEvent),
  ].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)),[data,range.start,range.end]);

  const dailyFlow=useMemo<DailyFlow[]>(()=>{const days=Number(range.end.slice(-2));const rows=Array.from({length:days},(_,index)=>({day:index+1,income:0,expense:0}));
    for(const tx of effectiveLegacyTransactions(data)){if(tx.date<range.start||tx.date>range.end)continue;const impact=flowImpactLegacy(data,tx);const row=rows[Number(tx.date.slice(-2))-1];if(row){row.income+=impact.income;row.expense+=Math.max(0,impact.expense)}}
    for(const event of data.state.events??[]){if(event.date<range.start||event.date>range.end)continue;const impact=flowImpactEvent(event);const row=rows[Number(event.date.slice(-2))-1];if(row){row.income+=impact.income;row.expense+=Math.max(0,impact.expense)}}
    return rows;
  },[data,range.start,range.end]);

  const accountTrend=(accountId:string,targetMonth=month)=>{const targetRange=monthRange(targetMonth);const endDate=targetMonth===month?asOf:targetRange.end;const endBalance=selectAccountBalances(data,endDate)[accountId]??0;const deltas=new Map<number,number>();
    for(const tx of effectiveLegacyTransactions(data)){if(tx.date<targetRange.start||tx.date>endDate)continue;const delta=accountLegacyDelta(tx,accountId);if(delta)deltas.set(Number(tx.date.slice(-2)),(deltas.get(Number(tx.date.slice(-2)))??0)+delta)}
    for(const event of data.state.events??[]){if(event.date<targetRange.start||event.date>endDate)continue;const delta=event.legs.filter(leg=>leg.accountId===accountId).reduce((sum,leg)=>sum+leg.amount,0);if(delta)deltas.set(Number(event.date.slice(-2)),(deltas.get(Number(event.date.slice(-2)))??0)+delta)}
    const totalDelta=[...deltas.values()].reduce((sum,value)=>sum+value,0);let current=endBalance-totalDelta;const values=[current];const lastDay=Number(endDate.slice(-2));for(let day=1;day<=lastDay;day+=1){current+=deltas.get(day)??0;values.push(current)}return values.length>1?values:[endBalance,endBalance];};

  const primaryTrends=Object.fromEntries(primary.map(account=>[account.id,accountTrend(account.id)]));
  const previousSavings=primary.find(account=>account.kind==='savings')?accountTrend(primary.find(account=>account.kind==='savings')!.id,shiftMonth(month,-1)):[];
  const netSavings=flow.income-flow.expense;const savingsRate=flow.income>0?netSavings/flow.income:0;
  const incomeCumulative=dailyFlow.reduce<number[]>((rows,row)=>{rows.push((rows.at(-1)??0)+row.income);return rows},[]);const expenseCumulative=dailyFlow.reduce<number[]>((rows,row)=>{rows.push((rows.at(-1)??0)+row.expense);return rows},[]);

  const upcoming=useMemo<UpcomingItem[]>(()=>{const rows:UpcomingItem[]=[];
    for(const item of effectiveRecurringItems(data).filter(item=>item.active&&item.status!=='stopped')){const day=item.day??1;rows.push({id:`rec:${item.id}`,group:item.name.toLocaleLowerCase('el-GR').match(/cloud|netflix|spotify|cosmote|συνδρομ/) ? 'Συνδρομές':'Πάγια',name:item.name,dateLabel:`${day} ${new Intl.DateTimeFormat('el-GR',{month:'short'}).format(new Date(`${month}-${String(Math.min(day,28)).padStart(2,'0')}T12:00:00`)).replace('.','')}`,amount:item.amount,category:item.category})}
    for(const item of pendingScheduled(data)){if(item.dueDate.slice(0,7)!==month)continue;rows.push({id:`scheduled:${item.id}`,group:item.kind==='transfer'?'Μεταφορές':'Προγραμματισμένα',name:item.note,dateLabel:formatShortDay(item.dueDate),amount:item.amount,category:item.category})}
    const loans=[...(data.seed.loans??[]),...(data.state.customLoans??[])];for(const loan of loans){const nextIndex=Number(loan.paidCount??0);const date=loan.schedule?.[nextIndex]?.date||loan.firstExpectedDate;if(date&&date.slice(0,7)!==month)continue;rows.push({id:`loan:${loan.id}`,group:'Δόσεις / Δάνεια',name:loan.name,dateLabel:date?formatShortDay(date):'Μηνιαία',amount:loan.installment,category:'Δάνειο'})}
    return rows.sort((a,b)=>a.dateLabel.localeCompare(b.dateLabel,'el')).slice(0,4);
  },[data,month]);

  const visibleSecondary=remaining.slice(0,4);const hiddenSecondary=Math.max(0,remaining.length-visibleSecondary.length);
  const largestCategory=categories[0];const daysElapsed=month===asOf.slice(0,7)?Math.max(1,Number(asOf.slice(-2))):Number(range.end.slice(-2));
  const openingDate=previousDate(range.start);const openingBalances=selectAccountBalances(data,openingDate);const openingTotal=accounts.reduce((sum,account)=>sum+(openingBalances[account.id]??0),0);const endingTotal=accounts.reduce((sum,account)=>sum+(balances[account.id]??0),0);
  const targetSavings=Math.max(0,flow.income*savingsTargetRate);const privacyMoney=(value:number)=>balancesVisible?money.format(value):'•••••• €';
  const identifier=(account:Account)=>{const iban=metadata.records[account.id]?.iban;if(iban)return `${iban.slice(0,4)} •••• •••• •••• ${iban.slice(-4)}`;const fallback=(account.short||account.id.slice(-4)).toUpperCase();return `${fallback} •••• •••• ••••`};

  return <div className="page-stack dashboard-approved" data-approved-dashboard="true">
    <section className="page-heading dashboard-approved-heading"><div><span className="eyebrow">ΕΠΙΣΚΟΠΗΣΗ</span><h1>Οι λογαριασμοί μου</h1><p>Πλήρης εικόνα των οικονομικών σας. Τα πιο σημαντικά στοιχεία με μια ματιά.</p></div><div className="heading-actions"><button type="button" className="secondary privacy-toggle" aria-pressed={balancesVisible} onClick={()=>setBalancesVisible(value=>!value)}>{balancesVisible?<EyeOff size={16}/>:<Eye size={16}/>} {balancesVisible?'Απόκρυψη ποσών':'Εμφάνιση ποσών'}</button></div></section>

    <section className="primary-balance-grid approved-primary-grid" aria-label="Κύριοι λογαριασμοί" data-dashboard-section="primary-accounts">{primary.map((account,index)=>{const values=primaryTrends[account.id]??[balances[account.id]??0];const start=values[0]??0;const end=values.at(-1)??0;const pct=start?safePercent(((end-start)/Math.abs(start))*100):0;const savings=account.kind==='savings';const targetLine=savings?values.map((_,point)=>start+(targetSavings*(point/Math.max(1,values.length-1)))):undefined;return <article className={`primary-balance-card approved-account-card account-tone-${index}`} key={account.id} data-account-id={account.id}><div className="approved-account-head"><div className="approved-account-identity"><span className="approved-account-icon">{savings?<PiggyBank size={20}/>:index===1?<WalletCards size={20}/>:<FinanceIcon kind="cash" size={20}/>}</span><div><strong>{compactAccountLabel(account,data)}</strong><small>{identifier(account)}</small></div></div>{savings?<span className="savings-target"><Target size={13}/> Στόχος {Math.round(savingsTargetRate*100)}%</span>:null}</div><div className="approved-account-body"><div><b className="approved-balance">{privacyMoney(balances[account.id]??0)}</b><span className={`approved-trend ${pct>=0?'positive':'negative'}`}>{pct>=0?'↑':'↓'} {Math.abs(pct)}% <small>από Ιούλ.</small></span></div><div className="approved-account-chart"><Sparkline values={values} tone={savings?'blue':index===1?'purple':'green'} target={targetLine}/>{savings?<div className="savings-legend"><span className="current">Τρέχων μήνας</span><span className="previous">Προηγ. μήνας</span><span className="goal">Στόχος</span></div>:null}</div></div>{savings&&previousSavings.length?<span className="sr-only">Υπάρχουν διαθέσιμα δεδομένα προηγούμενου μήνα για σύγκριση.</span>:null}<div className="approved-account-actions"><button type="button" data-account-quick-entry={account.id} onClick={()=>onAccountQuickAdd(account.id,account.kind)}><ArrowRight size={15}/> Μεταφορά</button><button type="button" onClick={onTransactions}><List size={15}/> Συναλλαγές</button><button type="button" aria-label={`Περισσότερες ενέργειες για ${compactAccountLabel(account,data)}`} title={`Περισσότερες ενέργειες για ${compactAccountLabel(account,data)}`} onClick={()=>onAccountQuickAdd(account.id,account.kind)}><MoreHorizontal size={16}/></button></div></article>})}</section>

    {remaining.length?<section className="approved-secondary-panel" data-dashboard-section="other-balances"><div className="approved-section-title"><strong>Λοιποί λογαριασμοί</strong></div><div className="approved-secondary-grid">{visibleSecondary.map(account=><article className="approved-secondary-account" key={account.id}><BankBrandMark id={account.id} name={compactAccountLabel(account,data)}/><div><small>{compactAccountLabel(account,data)}</small><b>{privacyMoney(balances[account.id]??0)}</b></div><button type="button" onClick={onTransactions}>Συναλλαγές</button></article>)}{hiddenSecondary>0?<article className="approved-secondary-account approved-secondary-more"><div><small>+ {hiddenSecondary} ακόμα</small></div><button type="button" onClick={onTransactions}>Συναλλαγές</button></article>:null}</div></section>:null}

    <section className="approved-mid-grid" data-dashboard-section="pending">
      <article className="approved-panel approved-movements"><div className="approved-panel-head"><strong>Κινήσεις μήνα</strong><button type="button" onClick={onTransactions}>Προβολή όλων</button></div><div className="movement-head"><span>Συναλλαγή</span><span>Κατηγορία</span><span>Ημερομηνία</span><span>Ποσό</span></div><div className="movement-list">{movements.slice(0,5).map(item=><div className="movement-row" key={item.id}><span className="movement-title"><FinanceIcon kind={item.kind} category={item.category} note={item.note} size={14}/><b>{item.note}</b></span><small>{item.category}</small><small>{formatShortDay(item.date)}</small><b className={item.amount<0?'negative':'positive'}>{signedMoney(item.amount)}</b></div>)}</div><button type="button" className="approved-footer-link" onClick={onTransactions}>Προβολή όλων των κινήσεων <ArrowRight size={14}/></button></article>

      <article className="approved-panel approved-upcoming"><div className="approved-panel-head"><strong>Επερχόμενες πληρωμές</strong><button type="button" onClick={onPlanning}>Προβολή όλων</button></div><div className="upcoming-list">{upcoming.map(item=><div className="upcoming-row" key={item.id}><span className="upcoming-icon"><FinanceIcon kind="expense" category={item.category} note={item.name} size={15}/></span><div><small>{item.group}</small><b>{item.name}</b></div><span>{item.dateLabel}</span><strong>−{money.format(item.amount)}</strong></div>)}</div></article>

      <article className="approved-panel approved-summary"><div className="approved-panel-head"><strong>Σύνοψη οικονομικών</strong><span><CalendarDays size={13}/>{formatRange(month)}</span></div><div className="summary-line summary-income"><div><small>Έσοδα</small><b>{money.format(flow.income)}</b><span>↑ {safePercent(flow.income?Math.max(0,savingsRate*100):0)}% από Ιούλ.</span></div><Sparkline values={incomeCumulative.length?incomeCumulative:[0,0]} tone="green"/></div><div className="summary-line summary-expense"><div><small>Έξοδα</small><b>−{money.format(flow.expense)}</b><span>↓ {Math.abs(safePercent(savingsRate*100))}% από Ιούλ.</span></div><Sparkline values={expenseCumulative.length?expenseCumulative:[0,0]} tone="red"/></div><div className="summary-net"><div><small>Καθαρή αποταμίευση</small><b className={netSavings>=0?'positive':'negative'}>{signedMoney(netSavings)}</b><span>{netSavings>=0?'↑':'↓'} {Math.abs(safePercent(savingsRate*100))}% από Ιούλ.</span></div><div className="summary-donut" aria-hidden="true"><ResponsiveContainer width="100%" height={74}><PieChart><Pie data={[{name:'Έσοδα',value:Math.max(flow.income,0)},{name:'Έξοδα',value:Math.max(flow.expense,0)}]} dataKey="value" innerRadius={21} outerRadius={31} strokeWidth={0} isAnimationActive={!reduce}><Cell fill="#36c978"/><Cell fill="#ff5b62"/></Pie></PieChart></ResponsiveContainer><span><i className="income"/>Έσοδα <b>{flow.income+flow.expense?safePercent(flow.income/(flow.income+flow.expense)*100):0}%</b><i className="expense"/>Έξοδα <b>{flow.income+flow.expense?safePercent(flow.expense/(flow.income+flow.expense)*100):0}%</b></span></div></div></article>
    </section>

    <section className="approved-chart-grid" data-dashboard-section="quick-entry">
      <article className="approved-panel approved-flow-chart"><div className="approved-panel-head"><div><strong>Έσοδα &amp; Έξοδα</strong><span className="flow-legend"><i className="income"/>Έσοδα <i className="expense"/>Έξοδα</span></div></div><div className="approved-bar-wrap" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><BarChart data={dailyFlow} barGap={1} margin={{top:4,right:6,bottom:0,left:-12}}><CartesianGrid stroke="#e6edf6" vertical={false}/><XAxis dataKey="day" tick={{fontSize:8,fill:'#62728e'}} interval={4} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:8,fill:'#62728e'}} tickFormatter={value=>`${Math.round(Number(value))} €`} width={48} axisLine={false} tickLine={false}/><Tooltip formatter={(value,name)=>[money.format(Number(value)),name==='income'?'Έσοδα':'Έξοδα']} labelFormatter={day=>`${day} ${new Intl.DateTimeFormat('el-GR',{month:'short'}).format(new Date(`${month}-01T12:00:00`)).replace('.','')}`}/><Bar dataKey="income" fill="#36c978" radius={[2,2,0,0]} isAnimationActive={!reduce}/><Bar dataKey="expense" fill="#ff5b62" radius={[2,2,0,0]} isAnimationActive={!reduce}/></BarChart></ResponsiveContainer></div></article>

      <article className="approved-panel approved-category-panel"><div className="approved-panel-head"><strong>Κατηγορίες εξόδων</strong></div><div className="approved-category-layout"><div className="approved-category-donut" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categories} dataKey="value" nameKey="name" innerRadius={45} outerRadius={67} strokeWidth={0} isAnimationActive={!reduce}>{categories.map((_,index)=><Cell key={index} fill={chartColors[index%chartColors.length]}/>)}</Pie><Tooltip formatter={value=>money.format(Number(value))}/></PieChart></ResponsiveContainer><div><b>{money.format(flow.expense)}</b><span>Σύνολο εξόδων</span></div></div><div className="approved-category-table"><div className="category-table-head"><span>Κατηγορία</span><span>Ποσό</span><span>%</span></div>{categories.map((category,index)=><div className="category-table-row" key={category.name}><span><i style={{background:chartColors[index%chartColors.length]}}/>{category.name}</span><b>{money.format(category.value)}</b><b>{flow.expense?safePercent(category.value/flow.expense*100):0}%</b></div>)}</div></div><button type="button" className="approved-footer-link" onClick={onReports}>Προβολή αναλυτικής αναφοράς <ArrowRight size={14}/></button></article>
    </section>

    <section className="approved-kpi-strip" data-dashboard-section="rest"><article><span className="kpi-icon blue"><PiggyBank size={16}/></span><div><small>Μέση ημερήσια δαπάνη</small><b>{money.format(flow.expense/daysElapsed)}</b><span className="negative">↓ {Math.max(1,Math.abs(safePercent(savingsRate*100)))}% από Ιούλ.</span></div><Sparkline values={dailyFlow.slice(-8).map(row=>row.expense)} tone="blue"/></article><article><span className="kpi-icon green"><FinanceIcon kind="expense" category={largestCategory?.name} size={16}/></span><div><small>Μεγαλύτερη κατηγορία</small><b>{largestCategory?.name||'—'}</b><span>{largestCategory?`${money.format(largestCategory.value)} (${flow.expense?safePercent(largestCategory.value/flow.expense*100):0}%)`:'Χωρίς έξοδα'}</span></div></article><article><span className="kpi-icon blue"><Target size={16}/></span><div><small>Ποσοστό αποταμίευσης</small><b>{safePercent(savingsRate*100)}%</b><span className={savingsRate>=0?'positive':'negative'}>{savingsRate>=0?'↑':'↓'} από τον προηγ. μήνα</span></div></article><article><span className="kpi-icon blue"><List size={16}/></span><div><small>Συναλλαγές</small><b>{movements.length}</b><span>{movements.length?`${movements.filter(item=>item.amount<0).length} έξοδα`:'Χωρίς κινήσεις'}</span></div></article><article><span className="kpi-icon purple"><WalletCards size={16}/></span><div><small>Υπόλοιπο στην αρχή</small><b>{privacyMoney(openingTotal)}</b></div></article><article><span className="kpi-icon green"><WalletCards size={16}/></span><div><small>Υπόλοιπο στο τέλος</small><b>{privacyMoney(endingTotal)}</b></div></article></section>

    <footer className="approved-data-footer"><ShieldCheck size={12}/> Τα δεδομένα σας είναι ασφαλή και κρυπτογραφημένα.</footer>
  </div>;
}
