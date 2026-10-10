import { useReducedMotion } from 'framer-motion';
import { ArrowRight, CalendarDays, Eye, EyeOff, List, PiggyBank, ShieldCheck, Target, WalletCards } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AccountIban } from '../components/AccountIban';
import { BankBrandMark } from '../components/BankBrandMark';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import { FinanceIcon } from '../components/FinanceIcon';
import type { QuickPrefill } from '../components/QuickAdd';
import { budgetProgress } from '../lib/budgets';
import { visibleAttentionItems } from '../lib/attention';
import { effectiveLegacyTransactions, flowImpactEvent, flowImpactLegacy, monthRange } from '../lib/domain';
import { financeAccountChoices } from '../lib/accountSelection';
import { dashboardAccountHistory, dashboardBalanceChange, dashboardHistoryStart, dashboardPreviousMonthValues, dashboardSavingsGoal, type DashboardAccountPoint } from '../lib/dashboardAccounts';
import { addCalendarDays } from '../lib/dateOnly';
import { cashFlowForecast } from '../lib/forecast';
import { money } from '../lib/format';
import { activeRecurringItems } from '../lib/recurring';
import { reportingPeriodEndDate, shiftReportingMonth } from '../lib/reportingPeriod';
import { selectAccountBalances, selectCategoryTotals, selectMonthlyFlow } from '../lib/selectors';
import { accountDisplayName } from '../lib/ui';
import type { Account, FinanceData, FinanceEvent, LegacyTransaction } from '../types';
import './DashboardCompletion.css';

const chartColors=['#36c978','#3f8df5','#ffb52e','#a65ad9','#d64fb6','#98a4b7','#25b9d7','#7656d6'];
type DashboardMovement={id:string;date:string;note:string;category:string;kind:string;amount:number;accountId?:string;expense:boolean;neutral:boolean};
type DailyFlow={day:number;income:number;expense:number};
type UpcomingItem={id:string;group:string;name:string;dateLabel:string;amount:number;category?:string};

const DashboardSummaryChart=lazy(()=>import('../components/DashboardRecharts').then(module=>({default:module.DashboardSummaryChart})));
const DashboardFlowChart=lazy(()=>import('../components/DashboardRecharts').then(module=>({default:module.DashboardFlowChart})));
const DashboardCategoryChart=lazy(()=>import('../components/DashboardRecharts').then(module=>({default:module.DashboardCategoryChart})));

function previousDate(date:string){return addCalendarDays(date,-1)}
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
  return <svg className={`dashboard-sparkline tone-${tone}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">{comparison?.length?<polyline className="comparison-line" points={points(comparison)} fill="none" vectorEffect="non-scaling-stroke"/>:null}<polyline points={points(values)} fill="none" vectorEffect="non-scaling-stroke"/>{target?.length?<polyline className="target-line" points={points(target)} fill="none" vectorEffect="non-scaling-stroke"/>:null}</svg>;
}

function accountChartTarget(series:DashboardAccountPoint[],comparison:DashboardAccountPoint[],target:number|undefined){
  if(target===undefined||!Number.isFinite(target)||!series.length)return undefined;
  const values=[...series,...comparison].map(point=>point.value);
  const min=Math.min(...values),max=Math.max(...values);const span=Math.max(1,max-min);const allowance=Math.max(span*2.5,Math.max(Math.abs(min),Math.abs(max),1)*.08);
  return target>=min-allowance&&target<=max+allowance?target:undefined;
}

function AccountBalanceChart({series,comparison=[],tone,currentMonth,target,label}:{series:DashboardAccountPoint[];comparison?:DashboardAccountPoint[];tone:'blue'|'green'|'purple';currentMonth:string;target?:number;label:string}){
  const width=360,height=76,padX=3,padY=5;const monthStart=`${currentMonth}-01`;
  const safeSeries=series.length?series:[{date:monthStart,value:0},{date:monthStart,value:0}];
  const visibleTarget=accountChartTarget(safeSeries,comparison,target);
  const values=[...safeSeries,...comparison].map(point=>point.value);if(visibleTarget!==undefined)values.push(visibleTarget);
  const rawMin=Math.min(...values),rawMax=Math.max(...values);const rawSpan=Math.max(1,rawMax-rawMin);const min=rawMin-rawSpan*.12,max=rawMax+rawSpan*.12;
  const start=Date.parse(`${safeSeries[0]!.date}T12:00:00Z`),end=Date.parse(`${safeSeries.at(-1)!.date}T12:00:00Z`);const usableWidth=width-padX*2;
  const xForDate=(date:string)=>padX+((Date.parse(`${date}T12:00:00Z`)-start)/Math.max(1,end-start))*usableWidth;
  const yForValue=(value:number)=>padY+(1-(value-min)/Math.max(1,max-min))*(height-padY*2);
  const point=(entry:DashboardAccountPoint)=>[xForDate(entry.date),yForValue(entry.value)] as const;
  const points=safeSeries.map(point);const path=(rows:ReadonlyArray<readonly[number,number]>)=>rows.map((item,index)=>`${index?'L':'M'} ${item[0].toFixed(2)} ${item[1].toFixed(2)}`).join(' ');
  const previousPoints=safeSeries.filter(entry=>entry.date<monthStart).map(point);const currentPoints=safeSeries.filter(entry=>entry.date>=monthStart).map(point);
  const boundaryX=Math.max(padX,Math.min(width-padX,xForDate(monthStart)));const comparisonPoints=comparison.map((entry,index)=>[boundaryX+(index/Math.max(1,comparison.length-1))*(width-padX-boundaryX),yForValue(entry.value)] as const);
  const last=points.at(-1)!;const toneColor=tone==='green'?'#31C77B':tone==='purple'?'#A15CFF':'#2463F4';const comparisonColor=tone==='blue'?'#A9C5FF':'#B9C9E8';
  return <svg className={`dashboard-account-history tone-${tone}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
    {boundaryX>padX+1?<line className="account-month-boundary" x1={boundaryX} y1="2" x2={boundaryX} y2={height-2}/>:null}
    {[.25,.5,.75].map(ratio=>{const x=boundaryX+(width-padX-boundaryX)*ratio;return <line key={ratio} className="account-period-guide" x1={x} y1="4" x2={x} y2={height-4}/>})}
    {comparisonPoints.length>1?<path className="account-history-comparison" d={path(comparisonPoints)} fill="none" stroke={comparisonColor}/>:null}
    {visibleTarget!==undefined?<line className="account-history-target" x1={boundaryX} y1={yForValue(visibleTarget)} x2={width-padX} y2={yForValue(visibleTarget)} stroke={toneColor}/>:null}
    {previousPoints.length>1?<path className="account-history-previous" d={path(previousPoints)} fill="none" stroke={toneColor}/>:null}
    {currentPoints.length>1?<path className="account-history-current" d={path(currentPoints)} fill="none" stroke={toneColor}/>:null}
    {previousPoints.length&&currentPoints.length?<line className="account-history-connector" x1={previousPoints.at(-1)![0]} y1={previousPoints.at(-1)![1]} x2={currentPoints[0]![0]} y2={currentPoints[0]![1]} stroke={toneColor}/>:null}
    <circle className="account-history-end" cx={last[0]} cy={last[1]} r="2.35" stroke={toneColor}/>
  </svg>;
}

function movementFromLegacy(data:FinanceData,tx:LegacyTransaction):DashboardMovement{
  const impact=flowImpactLegacy(data,tx);const expense=impact.expense>0;const neutral=impact.income===0&&impact.expense===0;const amount=impact.income>0?impact.income:expense?-impact.expense:impact.refund>0?impact.refund:tx.amount;
  return {id:`legacy:${tx.id}`,date:tx.date,note:tx.note,category:tx.category||'Άλλο',kind:tx.type,amount,accountId:tx.accountId||tx.fromAccountId,expense,neutral};
}
function movementFromEvent(event:FinanceEvent):DashboardMovement{
  const impact=flowImpactEvent(event);const expense=impact.expense>0;const neutral=impact.income===0&&impact.expense===0;const amount=impact.income>0?impact.income:expense?-impact.expense:impact.refund>0?impact.refund:event.amount;
  return {id:`event:${event.id}`,date:event.date,note:event.note,category:event.category||'Άλλο',kind:event.kind,amount,accountId:event.accountId||event.fromAccountId,expense,neutral};
}

export function DashboardPage({ data, month, asOf, motionMode='system', privacyVisible, onPrivacyVisibleChange, onQuickAdd: _onQuickAdd, onAccountQuickAdd, onTransactions, onPlanning, onAttention, onReports }: {data:FinanceData;month:string;asOf:string;motionMode?:'system'|'reduced'|'full';privacyVisible:boolean;onPrivacyVisibleChange:(visible:boolean)=>void;onQuickAdd:(prefill?:QuickPrefill)=>void;onAccountQuickAdd:(accountId:string,kind:string)=>void;onTransactions:()=>void;onPlanning:()=>void;onAttention:()=>void;onReports:()=>void}) {
  const systemReduced=useReducedMotion();const reduce=Boolean(systemReduced)||motionMode==='reduced';const animateCharts=motionMode==='full'&&!reduce;
  const [renderDeferredCharts,setRenderDeferredCharts]=useState(false);
  const [mobileAnalyticsExpanded,setMobileAnalyticsExpanded]=useState(false);
  const [mobileAnalyticsChartsReady,setMobileAnalyticsChartsReady]=useState(false);
  const [mobileViewport,setMobileViewport]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(max-width:680px)').matches);
  useEffect(()=>{let secondFrame=0;let settled=false;const reveal=()=>{if(settled)return;settled=true;setRenderDeferredCharts(true)};const fallback=window.setTimeout(reveal,700);const firstFrame=requestAnimationFrame(()=>{secondFrame=requestAnimationFrame(reveal)});return()=>{settled=true;window.clearTimeout(fallback);cancelAnimationFrame(firstFrame);if(secondFrame)cancelAnimationFrame(secondFrame)}},[]);
  useEffect(()=>{const query=window.matchMedia('(max-width:680px)');const sync=()=>setMobileViewport(query.matches);sync();query.addEventListener('change',sync);return()=>query.removeEventListener('change',sync)},[]);
  useEffect(()=>{if(!mobileViewport||!mobileAnalyticsExpanded||!renderDeferredCharts){setMobileAnalyticsChartsReady(false);return}let secondFrame=0;let settled=false;const reveal=()=>{if(settled)return;settled=true;setMobileAnalyticsChartsReady(true)};const fallback=window.setTimeout(reveal,250);const firstFrame=requestAnimationFrame(()=>{secondFrame=requestAnimationFrame(reveal)});return()=>{settled=true;window.clearTimeout(fallback);cancelAnimationFrame(firstFrame);if(secondFrame)cancelAnimationFrame(secondFrame)}},[mobileViewport,mobileAnalyticsExpanded,renderDeferredCharts]);
  const heavyChartsReady=renderDeferredCharts&&(!mobileViewport||mobileAnalyticsChartsReady);
  const range=monthRange(month);const periodEndDate=reportingPeriodEndDate(month,asOf);
  const flow=selectMonthlyFlow(data,month,asOf);const balances=selectAccountBalances(data,periodEndDate);const accountChoices=financeAccountChoices(data);const accounts=accountChoices.accounts;
  const primary=accountChoices.dashboardPrimary;const primarySlots=accountChoices.dashboardPrimarySlots;const primaryIdSet=new Set(primary.map(account=>account.id));const remaining=accounts.filter(account=>!primaryIdSet.has(account.id));
  const categories=selectCategoryTotals(data,month,asOf).slice(0,6);const savingsTargetRate=data.state.settings.savingsTargetRate??.2;
  const previousMonth=shiftReportingMonth(month,-1);const previousRange=monthRange(previousMonth);const previousMonthLabel=formatMonthLabel(previousMonth);const previousFlow=selectMonthlyFlow(data,previousMonth);
  const balanceMonth=month;

  const movements=useMemo(()=>[
    ...effectiveLegacyTransactions(data).filter(tx=>tx.date>=range.start&&tx.date<=periodEndDate).map(tx=>movementFromLegacy(data,tx)),
    ...(data.state.events??[]).filter(event=>event.date>=range.start&&event.date<=periodEndDate).map(movementFromEvent),
  ].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)),[data,range.start,periodEndDate]);

  const dailyFlow=useMemo<DailyFlow[]>(()=>{const days=Number(range.end.slice(-2));const rows=Array.from({length:days},(_,index)=>({day:index+1,income:0,expense:0}));
    for(const tx of effectiveLegacyTransactions(data)){if(tx.date<range.start||tx.date>periodEndDate)continue;const impact=flowImpactLegacy(data,tx);const row=rows[Number(tx.date.slice(-2))-1];if(row){row.income+=impact.income;row.expense+=Math.max(0,impact.expense)}}
    for(const event of data.state.events??[]){if(event.date<range.start||event.date>periodEndDate)continue;const impact=flowImpactEvent(event);const row=rows[Number(event.date.slice(-2))-1];if(row){row.income+=impact.income;row.expense+=Math.max(0,impact.expense)}}
    return rows;
  },[data,range.start,periodEndDate]);

  const primaryAccountKey=primary.map(account=>account.id).join('|');const accountHistoryStart=dashboardHistoryStart(balanceMonth);
  const primaryHistory=useMemo(()=>dashboardAccountHistory(data,primary.map(account=>account.id),accountHistoryStart,periodEndDate),[data,primaryAccountKey,accountHistoryStart,periodEndDate]);
  const accountChanges=useMemo(()=>Object.fromEntries(primary.map(account=>[account.id,dashboardBalanceChange(data,account.id,periodEndDate)])),[data,primaryAccountKey,periodEndDate]);
  const savingsAccount=accountChoices.dashboardSavings;
  const previousSavings=useMemo(()=>savingsAccount?dashboardPreviousMonthValues(data,savingsAccount.id,balanceMonth,periodEndDate):[],[data,savingsAccount?.id,balanceMonth,periodEndDate]);
  const savingsAccounts=accounts.filter(account=>account.kind==='savings'||(account.kind==='bank'&&account.bankAccountCategory==='savings'));
  const accountSavingsGoal=dashboardSavingsGoal(data.state.savingsGoals,savingsAccounts.length);
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
  const budgetRows=budgetProgress(data,month,asOf);const budgetHighlight=budgetRows.find(row=>row.status==='exceeded')??budgetRows.slice().sort((a,b)=>b.ratio-a.ratio||a.id.localeCompare(b.id))[0];
  const openingDate=previousDate(range.start);const openingBalances=selectAccountBalances(data,openingDate);const openingTotal=accounts.reduce((sum,account)=>sum+(openingBalances[account.id]??0),0);const endingTotal=accounts.reduce((sum,account)=>sum+(balances[account.id]??0),0);
  const privacyMoney=(value:number)=>privacyVisible?money.format(value):'•••••• €';
  const attentionCount=visibleAttentionItems(data,asOf).length;

  return <div className="page-stack dashboard-approved" data-approved-dashboard="true">
    <span className="sr-only">Νέα κίνηση διαθέσιμη από τη Γρήγορη κίνηση.</span>
    <PageHeader className="dashboard-approved-heading" eyebrow="ΕΠΙΣΚΟΠΗΣΗ" title="Οι λογαριασμοί μου" description={<p>Πλήρης εικόνα των οικονομικών σας. Τα πιο σημαντικά στοιχεία με μια ματιά.</p>} actions={<>{attentionCount>0?<Button type="button" variant="secondary" onClick={onAttention}><ShieldCheck size={16}/> Έλεγχος · {attentionCount}</Button>:null}<Button type="button" variant="secondary" className="privacy-toggle" aria-pressed={privacyVisible} onClick={()=>onPrivacyVisibleChange(!privacyVisible)}>{privacyVisible?<EyeOff size={16}/>:<Eye size={16}/>} {privacyVisible?'Απόκρυψη ποσών':'Εμφάνιση ποσών'}</Button></>}/>

    <section className="primary-balance-grid approved-primary-grid" aria-label="Κύριοι λογαριασμοί" data-dashboard-section="primary-accounts">
      {primarySlots.map((slot,index)=>{
        const account=slot.account;
        if(!account)return <article className={`primary-balance-card approved-account-card approved-account-missing account-tone-${index}`} key={slot.role} data-account-role={slot.role} data-account-missing="true">
          <div className="approved-account-head">
            <div className="approved-account-identity">
              <span className="approved-account-icon">{slot.role==='cash'?<FinanceIcon settings={data.state.settings} kind="cash" size={20}/>:<WalletCards size={20}/>}</span>
              <div><strong>{slot.label}</strong><small>Δεν έχει οριστεί αντίστοιχος λογαριασμός</small></div>
            </div>
          </div>
          <div className="approved-account-missing-copy">
            <b>Απαιτείται σημασιολογική αντιστοίχιση</b>
            <span>{slot.role==='payroll'?'Όρισε τραπεζικό λογαριασμό κατηγορίας «Μισθοδοσίας».':slot.role==='savings'?'Όρισε αποταμιευτικό λογαριασμό ή τραπεζικό λογαριασμό κατηγορίας «Αποταμιευτικός».':'Όρισε λογαριασμό μετρητών με ρόλο καθημερινών μετρητών.'}</span>
          </div>
        </article>;

        const series=primaryHistory[account.id]??[{date:periodEndDate,value:balances[account.id]??0}];
        const currentBalance=balances[account.id]??0;
        const change=accountChanges[account.id]??0;
        const savings=slot.role==='savings';
        const tone=savings?'blue':slot.role==='payroll'?'purple':'green';
        const target=accountChartTarget(series,savings?previousSavings:[],savings?accountSavingsGoal?.targetAmount:undefined);
        const accountAction=savings?'Μεταφορά':'Νέα κίνηση';
        const changeText=privacyVisible?`${change>0?'+':change<0?'−':''}${money.format(Math.abs(change))}`:'•••• €';
        const goalText=accountSavingsGoal?privacyMoney(accountSavingsGoal.targetAmount):`${Math.round(savingsTargetRate*100)}%`;
        return <article className={`primary-balance-card approved-account-card account-tone-${index}`} key={account.id} data-account-id={account.id} data-account-role={slot.role}>
          <div className="approved-account-head"><div className="approved-account-identity"><span className="approved-account-icon">{account.kind==='cash'?<FinanceIcon kind="cash" size={20}/>:<BankBrandMark id={account.providerId??account.provider??account.id} name={compactAccountLabel(account,data)}/>}</span><div><strong>{compactAccountLabel(account,data)}</strong><AccountIban accountId={account.id} variant="dashboard" fallback={account.kind==='cash'?'Πορτοφόλι':undefined}/></div></div>{savings?<span className="savings-target" title={accountSavingsGoal?`${accountSavingsGoal.name}: στόχος αποταμίευσης`:'Μηνιαίος στόχος αποταμίευσης ως ποσοστό εσόδων'}><Target size={13}/> Στόχος {goalText}</span>:<span className={`approved-account-delta ${change<-.005?'negative':change>.005?'positive':'neutral'}`} title="Μεταβολή υπολοίπου 30 ημερών έως την επιλεγμένη περίοδο">{change<-.005?'↓':change>.005?'↑':'→'} {changeText}</span>}</div>
          <div className="approved-account-body"><div className="account-metric-overlay"><b className="approved-balance">{privacyMoney(currentBalance)}</b></div><div className="approved-account-chart"><AccountBalanceChart series={series} comparison={savings?previousSavings:[]} tone={tone} currentMonth={balanceMonth} target={target} label={`Εξέλιξη υπολοίπου για ${compactAccountLabel(account,data)}`}/>{savings?<div className="savings-legend"><span className="current">{month===asOf.slice(0,7)?'Τρέχων μήνας':'Επιλεγμένος μήνας'}</span><span className="previous">Προηγ. μήνας</span>{target!==undefined?<span className="goal">Στόχος</span>:null}</div>:null}</div></div>
          <div className="approved-account-actions"><Button type="button" variant="ghost" data-account-quick-entry={account.id} aria-label={`${accountAction} για ${compactAccountLabel(account,data)}`} onClick={()=>onAccountQuickAdd(account.id,savings?'savings':account.kind)}><ArrowRight size={15}/> {accountAction}</Button><Button type="button" variant="ghost" onClick={onTransactions}><List size={15}/> Συναλλαγές</Button></div>
        </article>;
      })}
    </section>

    {remaining.length?<section className="approved-secondary-panel" data-dashboard-section="other-balances"><div className="approved-section-title"><strong>Λοιποί λογαριασμοί</strong></div><div className="approved-secondary-grid">{visibleSecondary.map(account=><article className="approved-secondary-account" key={account.id}><BankBrandMark id={account.providerId??account.provider??account.id} name={compactAccountLabel(account,data)}/><div><small>{compactAccountLabel(account,data)}</small><b>{privacyMoney(balances[account.id]??0)}</b></div><Button type="button" variant="ghost" onClick={onTransactions}>Συναλλαγές</Button></article>)}{hiddenSecondary>0?<article className="approved-secondary-account approved-secondary-more"><div><small>+ {hiddenSecondary} ακόμα</small></div><Button type="button" variant="ghost" onClick={onTransactions}>Συναλλαγές</Button></article>:null}</div></section>:null}

    <section className="approved-mid-grid" data-dashboard-section="pending">
      <article className="approved-panel approved-movements"><div className="approved-panel-head"><strong>Κινήσεις μήνα</strong><Button type="button" variant="ghost" onClick={onTransactions}>Προβολή όλων</Button></div>{movements.length?<><div className="movement-head"><span>Συναλλαγή</span><span>Κατηγορία</span><span>Ημερομηνία</span><span>Ποσό</span></div><div className="movement-list">{movements.slice(0,5).map(item=><div className="movement-row" key={item.id}><span className="movement-title"><FinanceIcon settings={data.state.settings} kind={item.kind} category={item.category} note={item.note} size={14}/><b>{item.note}</b></span><small>{item.category}</small><small>{formatShortDay(item.date)}</small><b className={item.neutral?'':item.expense?'negative':'positive'}>{movementAmountLabel(item)}</b></div>)}</div><Button type="button" variant="ghost" className="approved-footer-link" onClick={onTransactions}>Προβολή όλων των κινήσεων <ArrowRight size={14}/></Button></>:<div className="dashboard-empty-state" role="status"><List size={24}/><b>Δεν υπάρχουν κινήσεις αυτόν τον μήνα</b><span>Η περιοχή θα γεμίσει μόλις καταχωριστούν συναλλαγές στην επιλεγμένη περίοδο.</span><Button type="button" variant="secondary" onClick={onTransactions}>Άνοιγμα συναλλαγών</Button></div>}</article>

      <article className="approved-panel approved-upcoming"><span className="sr-only">Προγραμματισμένες και επαναλαμβανόμενες πληρωμές από το κανονικό μοντέλο πρόβλεψης.</span><div className="approved-panel-head"><strong>Επερχόμενες πληρωμές</strong><Button type="button" variant="ghost" onClick={onPlanning}>Προβολή όλων</Button></div>{upcoming.length?<div className="upcoming-list">{upcoming.map(item=><div className="upcoming-row" key={item.id}><span className="upcoming-icon"><FinanceIcon settings={data.state.settings} kind="expense" category={item.category} note={item.name} size={15}/></span><div><small>{item.group}</small><b>{item.name}</b></div><span>{item.dateLabel}</span><strong>−{money.format(item.amount)}</strong></div>)}</div>:<div className="dashboard-empty-state dashboard-upcoming-empty" role="status"><CalendarDays size={24}/><b>Δεν υπάρχουν επερχόμενες πληρωμές</b><span>Δεν προβλέπεται πληρωμή για τις επόμενες 30 ημέρες.</span><Button type="button" variant="secondary" onClick={onPlanning}>Άνοιγμα προγραμματισμού</Button></div>}</article>

      <article className="approved-panel approved-summary"><div className="approved-panel-head"><strong>Σύνοψη οικονομικών</strong><span><CalendarDays size={13}/>{formatRange(month)}</span></div><div className="summary-line summary-income"><div><small>Έσοδα</small><b>{money.format(flow.income)}</b><span className={incomeComparison===null?'':incomeComparison>=0?'positive':'negative'}>{comparisonText(incomeComparison)}</span></div><Sparkline values={incomeCumulative.length?incomeCumulative:[0,0]} tone="green"/></div><div className="summary-line summary-expense"><div><small>Έξοδα</small><b>−{money.format(flow.expense)}</b><span className={expenseComparison===null?'':expenseComparison<=0?'positive':'negative'}>{comparisonText(expenseComparison)}</span></div><Sparkline values={expenseCumulative.length?expenseCumulative:[0,0]} tone="red"/></div><div className="summary-net"><div><small>Αποταμίευση</small><b className={savingAmount>=0?'positive':'negative'}>{signedMoney(savingAmount)}</b><span className={savingComparison===null?'':savingComparison>=0?'positive':'negative'}>{comparisonText(savingComparison)}</span></div><div className="summary-donut" aria-hidden="true">{heavyChartsReady?<Suspense fallback={null}><DashboardSummaryChart income={flow.income} expense={flow.expense} animateCharts={animateCharts}/></Suspense>:mobileViewport?<div className="dashboard-mobile-summary-donut" style={{background:`conic-gradient(#31C77B 0 ${flow.income+flow.expense?safePercent(flow.income/(flow.income+flow.expense)*100):0}%,#ff5b62 ${flow.income+flow.expense?safePercent(flow.income/(flow.income+flow.expense)*100):0}% 100%)`}}/>:null}<span><i className="income"/>Έσοδα <b>{flow.income+flow.expense?safePercent(flow.income/(flow.income+flow.expense)*100):0}%</b><i className="expense"/>Έξοδα <b>{flow.income+flow.expense?safePercent(flow.expense/(flow.income+flow.expense)*100):0}%</b></span></div></div></article>
    </section>

    <Button type="button" variant="secondary" className="dashboard-mobile-disclosure" aria-expanded={mobileAnalyticsExpanded} onClick={()=>setMobileAnalyticsExpanded(value=>!value)}>{mobileAnalyticsExpanded?'Λιγότερη ανάλυση':'Περισσότερη ανάλυση'}</Button>

    <section className={`approved-chart-grid ${mobileAnalyticsExpanded?'':'mobile-collapsed'}`} data-dashboard-section="quick-entry">
      <article className="approved-panel approved-flow-chart"><div className="approved-panel-head"><div><strong>Έσοδα &amp; Έξοδα</strong><span className="flow-legend"><i className="income"/>Έσοδα <i className="expense"/>Έξοδα</span></div></div><div className="approved-bar-wrap" aria-hidden="true">{heavyChartsReady?<Suspense fallback={null}><DashboardFlowChart data={dailyFlow} month={month} animateCharts={animateCharts}/></Suspense>:null}</div></article>

      <article className="approved-panel approved-category-panel"><div className="approved-panel-head"><strong>Κατηγορίες εξόδων</strong></div>{categories.length?<><div className="approved-category-layout"><div className="approved-category-donut" aria-hidden="true">{heavyChartsReady?<Suspense fallback={null}><DashboardCategoryChart categories={categories} animateCharts={animateCharts} colors={chartColors}/></Suspense>:null}<div><b>{money.format(flow.expense)}</b><span>Σύνολο εξόδων</span></div></div><div className="approved-category-table"><div className="category-table-head"><span>Κατηγορία</span><span>Ποσό</span><span>%</span></div>{categories.map((category,index)=><div className="category-table-row" key={category.name}><span><i style={{background:chartColors[index%chartColors.length]}}/>{category.name}</span><b>{money.format(category.value)}</b><b>{flow.expense?safePercent(category.value/flow.expense*100):0}%</b></div>)}</div></div><Button type="button" variant="ghost" className="approved-footer-link" onClick={onReports}>Προβολή αναλυτικής αναφοράς <ArrowRight size={14}/></Button></>:<div className="dashboard-empty-state" role="status"><PiggyBank size={24}/><b>Δεν υπάρχουν έξοδα για κατηγοριοποίηση</b><span>Οι κατηγορίες θα εμφανιστούν όταν υπάρξουν έξοδα στην επιλεγμένη περίοδο.</span><Button type="button" variant="secondary" onClick={onReports}>Άνοιγμα αναφορών</Button></div>}</article>
    </section>

    <section className={`approved-kpi-strip ${mobileAnalyticsExpanded?'':'mobile-collapsed'}`} data-dashboard-section="rest"><article><span className="kpi-icon blue"><PiggyBank size={16}/></span><div><small>Μέση ημερήσια δαπάνη</small><b>{money.format(averageDailyExpense)}</b><span className={dailyExpenseComparison===null?'':dailyExpenseComparison<=0?'positive':'negative'}>{comparisonText(dailyExpenseComparison)}</span></div><Sparkline values={dailyFlow.slice(-8).map(row=>row.expense)} tone="blue"/></article><article className="dashboard-budget-kpi" data-budget-panel><span className="kpi-icon green"><FinanceIcon settings={data.state.settings} kind="expense" category={largestCategory?.name} size={16}/></span><div><small>Μεγαλύτερη κατηγορία</small><b>{largestCategory?.name||'—'}</b><span>{largestCategory?`${money.format(largestCategory.value)} (${flow.expense?safePercent(largestCategory.value/flow.expense*100):0}%)`:'Χωρίς έξοδα'}</span></div><span className="sr-only">{budgetHighlight?`${budgetHighlight.scope==='overall'?'Συνολικό discretionary':budgetHighlight.category} · ${budgetHighlight.status==='exceeded'?'Υπέρβαση':budgetHighlight.status==='near'?'Κοντά στο όριο':'Εντός ορίου'}`:'Δεν υπάρχουν budgets'}</span><button type="button" className="dashboard-budget-kpi-hitarea" onClick={onReports} aria-label="Αναλυτική εικόνα budgets"><span className="sr-only">Αναλυτική εικόνα budgets</span></button></article><article><span className="kpi-icon blue"><Target size={16}/></span><div><small>Ποσοστό αποταμίευσης</small><b>{safePercent(savingsRate*100)}%</b><span className={savingsRateDelta===null?'':savingsRateDelta>=0?'positive':'negative'}>{savingsRateDelta===null?'— έναντι προηγ. μήνα':`${savingsRateDelta>0?'↑':savingsRateDelta<0?'↓':'→'} ${Math.abs(savingsRateDelta)} π.μ. από προηγ. μήνα`}</span></div></article><article><span className="kpi-icon blue"><List size={16}/></span><div><small>Συναλλαγές</small><b>{movements.length}</b><span>{movements.length?`${movements.filter(item=>item.expense).length} έξοδα`:'Χωρίς κινήσεις'}</span></div></article><article><span className="kpi-icon purple"><WalletCards size={16}/></span><div><small>Υπόλοιπο στην αρχή</small><b>{privacyMoney(openingTotal)}</b></div></article><article><span className="kpi-icon green"><WalletCards size={16}/></span><div><small>Υπόλοιπο στο τέλος</small><b>{privacyMoney(endingTotal)}</b></div></article></section>

    <footer className="approved-data-footer"><ShieldCheck size={12}/> Τα δεδομένα σας είναι ασφαλή και κρυπτογραφημένα.</footer>
  </div>;
}
