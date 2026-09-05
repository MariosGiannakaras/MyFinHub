import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CircleCheck, CreditCard, Eye, EyeOff, HandCoins, Landmark, ListChecks, PiggyBank, TriangleAlert, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnimatedAmount } from '../components/AnimatedAmount';
import { BudgetRuleSettings } from '../components/BudgetRuleSettings';
import { FinanceIcon } from '../components/FinanceIcon';
import { budgetProgress } from '../lib/budgets';
import { allAccounts } from '../lib/domain';
import { money } from '../lib/format';
import { categoryMomentum, operationalReportSnapshot, primaryAccountSeries, reportExpenseCounterparties, reportFlowSeries, reportInsightModel, reportLoanBurden } from '../lib/reports';
import { SAVING_SOURCE_LABELS } from '../lib/savings';
import { accountDisplayName } from '../lib/ui';
import type { FinanceData, MonthlyBudget, TransactionRule } from '../types';
import './ReportsPage.css';

const change=(current:number,previous:number)=>previous===0?(current===0?0:null):((current-previous)/Math.abs(previous))*100;
const changeLabel=(value:number|null)=>value===null?'Νέα βάση':`${value>=0?'+':''}${Math.round(value)}%`;
const percent=(value:number|null,digits=0)=>value===null?'—':`${(value*100).toFixed(digits)}%`;
const directionText=(value:number)=>value>=0?'πάνω':'κάτω';
const comparisonTone=(label:string,value:number|null)=>value===null?'neutral':((label==='Έξοδα'&&value>0)||(label!=='Έξοδα'&&value<0))?'negative':'positive';
const CATEGORY_COLORS=['#2f6fed','#ff5068','#7a5af8','#ffb648','#27bfa5','#f59e0b','#8b95ad'];
const ACCOUNT_COLORS=['#2f6fed','#14a77f','#7a5af8','#f59e0b'];

export function ReportsPage({data,month,onUpsertBudget,onDeleteBudget,onUpsertRule,onDeleteRule}:{data:FinanceData;month:string;onUpsertBudget:(budget:MonthlyBudget)=>void;onDeleteBudget:(id:string)=>void;onUpsertRule:(rule:TransactionRule)=>void;onDeleteRule:(id:string)=>void}){
 const snapshot=operationalReportSnapshot(data,month);
 const insights=reportInsightModel(data,month);
 const series=reportFlowSeries(data,month,6);
 const cumulativeSeries=useMemo(()=>{let running=0;return series.map(row=>({...row,cumulative:(running+=row.income-row.expense)}))},[series]);
 const momentum=categoryMomentum(data,month,100);
 const counterparties=reportExpenseCounterparties(data,month,5);
 const loanBurden=reportLoanBurden(data);
 const accountIds=allAccounts(data).filter(account=>account.kind!=='credit').slice(0,4).map(account=>account.id);
 const accountSeries=primaryAccountSeries(data,month,accountIds);
 const [accountsVisible,setAccountsVisible]=useState(false);
 const budgetRows=budgetProgress(data,month);
 const exceededBudgets=budgetRows.filter(row=>row.status==='exceeded').length;
 const nearBudgets=budgetRows.filter(row=>row.status==='near').length;
 const overallBudget=budgetRows.find(row=>row.scope==='overall')??null;
 const budgetSummaryRows=overallBudget?[overallBudget]:budgetRows.filter(row=>row.scope==='category');
 const budgetLimit=budgetSummaryRows.reduce((sum,row)=>sum+row.limit,0);
 const budgetUsed=budgetSummaryRows.reduce((sum,row)=>sum+row.used,0);
 const budgetRemaining=budgetLimit-budgetUsed;
 const budgetRatio=budgetLimit>0?budgetUsed/budgetLimit:0;
 const budgetDataDate=data.updatedAt.slice(0,10);
 const budgetDataMonth=budgetDataDate.slice(0,7);
 const [budgetYear,budgetMonthNumber]=month.split('-').map(Number);
 const budgetDaysInMonth=new Date(Date.UTC(budgetYear,budgetMonthNumber,0)).getUTCDate();
 const budgetElapsedDays=month<budgetDataMonth?budgetDaysInMonth:month===budgetDataMonth?Math.min(budgetDaysInMonth,Math.max(1,Number(budgetDataDate.slice(8,10))||1)):0;
 const budgetProjection=budgetElapsedDays>0?budgetUsed/(budgetElapsedDays/budgetDaysInMonth):null;
 const budgetProjectionDetail=month<budgetDataMonth?'Καταγεγραμμένο κλείσιμο περιόδου':month===budgetDataMonth?`Με βάση ${budgetElapsedDays} από ${budgetDaysInMonth} ημέρες`:'Θα εμφανιστεί όταν ξεκινήσει η περίοδος';
 const budgetAttentionPool=budgetRows.some(row=>row.scope==='category')?budgetRows.filter(row=>row.scope==='category'):budgetRows;
 const budgetAttentionRows=budgetAttentionPool.slice().sort((a,b)=>({exceeded:2,near:1,ok:0}[b.status]-{exceeded:2,near:1,ok:0}[a.status])||b.ratio-a.ratio).slice(0,3);
 const budgetStatusText=!budgetRows.length?'Δεν υπάρχουν ενεργά όρια':exceededBudgets?`${exceededBudgets} ${exceededBudgets===1?'όριο είναι':'όρια είναι'} σε υπέρβαση`:nearBudgets?`${nearBudgets} ${nearBudgets===1?'όριο πλησιάζει':'όρια πλησιάζουν'} το σημείο προειδοποίησης`:'Όλα τα ενεργά όρια είναι εντός στόχου';
 const netFlow=snapshot.flow.income-snapshot.flow.expense;
 const previousNetFlow=snapshot.previous.income-snapshot.previous.expense;
 const creditPercent=snapshot.creditLimit>0?snapshot.creditUsage:null;
 const loanBurdenRate=snapshot.flow.income>0?loanBurden.total/snapshot.flow.income:null;
 const combinedMonthlyBurden=snapshot.recurring+loanBurden.total;
 const combinedBurdenRate=snapshot.flow.income>0?combinedMonthlyBurden/snapshot.flow.income:null;
 const savingsTarget=data.state.settings.savingsTargetRate??.2;
 const savingsTargetProgress=insights.savingsRate!==null&&savingsTarget>0?insights.savingsRate/savingsTarget:null;
 const monthDate=(()=>{const [year,number]=month.split('-').map(Number);return new Date(Date.UTC(year,number-1,1))})();
 const monthLabel=new Intl.DateTimeFormat('el-GR',{month:'long',year:'numeric',timeZone:'UTC'}).format(monthDate);
 const categoryTop=momentum.slice(0,6);
 const categoryRest=momentum.slice(6).reduce((sum,row)=>sum+row.value,0);
 const categoryDonut=categoryRest>.005?[...categoryTop,{name:'Λοιπά',value:categoryRest,previous:0,change:null}]:categoryTop;
 const categoryTotal=momentum.reduce((sum,row)=>sum+row.value,0);
 let donutCursor=0;
 const categoryDonutBackground=`conic-gradient(${categoryDonut.map((row,index)=>{const start=donutCursor;donutCursor+=categoryTotal>0?row.value/categoryTotal*100:0;return `${CATEGORY_COLORS[index%CATEGORY_COLORS.length]} ${start}% ${donutCursor}%`}).join(',')})`;
 const comparisonRows=[
   {label:'Έσοδα',current:snapshot.flow.income,previous:snapshot.previous.income,value:change(snapshot.flow.income,snapshot.previous.income),kind:'money' as const},
   {label:'Έξοδα',current:snapshot.flow.expense,previous:snapshot.previous.expense,value:change(snapshot.flow.expense,snapshot.previous.expense),kind:'money' as const},
   {label:'Καθαρή ροή',current:netFlow,previous:previousNetFlow,value:change(netFlow,previousNetFlow),kind:'money' as const},
   {label:'Ρυθμός αποταμίευσης',current:insights.savingsRate,previous:insights.previousSavingsRate,value:insights.savingsRate!==null&&insights.previousSavingsRate!==null?insights.savingsRate-insights.previousSavingsRate:null,kind:'rate' as const},
 ];
 const callouts=useMemo(()=>{
   const rows:Array<{title:string;detail:string;tone:'positive'|'negative'|'neutral'}>=[];
   if(insights.sufficientExpenseHistory&&insights.expenseVsTrailingAverage!==null){const delta=Math.abs(insights.expenseVsTrailingAverage);rows.push({title:`Έξοδα ${Math.round(delta*100)}% ${directionText(insights.expenseVsTrailingAverage)} από τον πρόσφατο μέσο όρο`,detail:`Μέσος όρος 3 προηγούμενων μηνών: ${money.format(insights.trailingExpenseAverage)}.`,tone:insights.expenseVsTrailingAverage>0?'negative':'positive'})}
   else rows.push({title:'Δεν υπάρχει ακόμη αρκετό ιστορικό εξόδων',detail:'Χρειάζονται προηγούμενοι μήνες με έξοδα για αξιόπιστη σύγκριση με πρόσφατο μέσο όρο.',tone:'neutral'});
   if(insights.topCategory?.share!==null&&insights.topCategory){rows.push({title:`Μεγαλύτερη κατηγορία: ${insights.topCategory.name}`,detail:`${money.format(insights.topCategory.value)} · ${Math.round(insights.topCategory.share*100)}% των εξόδων αυτής της περιόδου.`,tone:'neutral'})}
   if(insights.savingsRate!==null){const previous=insights.previousSavingsRate;rows.push({title:`Ρυθμός αποταμίευσης ${percent(insights.savingsRate)}`,detail:previous===null?'Δεν υπάρχει συγκρίσιμος προηγούμενος μήνας με έσοδα.':`Προηγούμενος μήνας: ${percent(previous)}.`,tone:previous!==null&&insights.savingsRate<previous?'negative':'positive'})}
   if(insights.recurringBurden!==null)rows.push({title:`Πάγια ${percent(insights.recurringBurden)} των εσόδων`,detail:`Ενεργές μηνιαίες υποχρεώσεις: ${money.format(snapshot.recurring)}.`,tone:insights.recurringBurden>.5?'negative':'neutral'});
   if(loanBurden.total>0)rows.push({title:`Δόσεις δανείων ${loanBurdenRate===null?'χωρίς βάση εσόδων':percent(loanBurdenRate)}`,detail:`Επόμενη μηνιαία επιβάρυνση ${money.format(loanBurden.total)} από ${loanBurden.count} ενεργές μακροχρόνιες υποχρεώσεις.`,tone:loanBurdenRate!==null&&loanBurdenRate>.35?'negative':'neutral'});
   return rows.slice(0,5);
 },[insights,loanBurden.count,loanBurden.total,loanBurdenRate,snapshot.recurring]);
 const comparisonValue=(value:number|null,kind:'money'|'rate')=>kind==='money'?money.format(value??0):percent(value,1);

 return <div className="page-stack reports-dashboard reports-composite reports-dense">
  <section className="page-heading report-heading" id="report-overview"><div><span className="eyebrow">ΑΝΑΦΟΡΕΣ · {monthLabel}</span><h1>Αναφορές</h1><p>Οικονομική εικόνα, τάσεις και προϋπολογισμοί σε μία πυκνή επισκόπηση.</p></div><div className="report-period-chip" aria-label={`Επιλεγμένη περίοδος ${monthLabel}`}><span>Περίοδος</span><b>{monthLabel}</b></div></section>

  <nav className="report-section-nav" aria-label="Ενότητες αναφορών"><a href="#report-overview">Επισκόπηση</a><a href="#report-budget-overview">Προϋπολογισμοί</a><a href="#report-support">Αναλύσεις</a><a href="#report-accounts">Λογαριασμοί</a></nav>

  <section className="report-executive report-kpi-strip" aria-label="Κύριοι δείκτες περιόδου">
   <article className="report-headline-card positive"><span>Συνολικά έσοδα</span><b><AnimatedAmount value={snapshot.flow.income}/></b><small>{changeLabel(change(snapshot.flow.income,snapshot.previous.income))} από τον προηγούμενο μήνα</small></article>
   <article className="report-headline-card negative"><span>Συνολικά έξοδα</span><b><AnimatedAmount value={snapshot.flow.expense}/></b><small>{changeLabel(change(snapshot.flow.expense,snapshot.previous.expense))} από τον προηγούμενο μήνα</small></article>
   <article className={`report-headline-card ${netFlow>=0?'positive':'negative'}`}><span>Καθαρό ισοζύγιο</span><b><AnimatedAmount value={netFlow}/></b><small>{changeLabel(change(netFlow,previousNetFlow))} από τον προηγούμενο μήνα</small></article>
   <article className="report-headline-card"><span>Συνολικό budget</span><b>{budgetLimit>0?money.format(budgetLimit):'—'}</b><small>{budgetLimit>0?`${Math.round(budgetRatio*100)}% χρησιμοποιημένο`:'Δεν έχει οριστεί ενεργό όριο'}</small></article>
   <article className="report-headline-card positive"><span>Αποταμίευση</span><b>{percent(insights.savingsRate,1)}</b><small>Στόχος {percent(savingsTarget,0)} · {savingsTargetProgress===null?'χωρίς συγκρίσιμη βάση':`${Math.round(savingsTargetProgress*100)}% προόδου`}</small></article>
  </section>

  <section className="report-analytics-grid" aria-label="Βασικά γραφήματα">
   <article className="panel neo-raised report-category-panel"><div className="panel-head"><div><span>Έξοδα ανά κατηγορία</span><small>Κατανομή της επιλεγμένης περιόδου.</small></div></div>{momentum.length?<div className="report-category-layout"><div className="report-category-chart" aria-hidden="true"><div className="report-css-donut" style={{background:categoryDonutBackground}}/><div className="report-donut-total"><b>{money.format(categoryTotal)}</b><span>Σύνολο</span></div></div><div className="category-momentum-list report-category-list">{categoryDonut.map((row,index)=>{const [category,subcategory]=row.name.split(' › ');return <div key={row.name}><span className="semantic-list-title"><i className="report-category-swatch" style={{background:CATEGORY_COLORS[index%CATEGORY_COLORS.length]}}/>{row.name!=='Λοιπά'?<FinanceIcon settings={data.state.settings} kind="expense" category={category} subcategory={subcategory} size={14}/>:null}{row.name}</span><b>{money.format(row.value)} <em>{percent(categoryTotal>0?row.value/categoryTotal:null,1)}</em></b></div>})}</div></div>:<div className="empty-state">Δεν υπάρχουν έξοδα για την επιλεγμένη περίοδο.</div>}</article>

   <article className="panel neo-raised report-chart-card"><div className="panel-head"><div><span>Έσοδα vs έξοδα</span><small>Τελευταίοι 6 μήνες.</small></div><div className="report-flow-legend" aria-hidden="true"><span><i className="income"/>Έσοδα</span><span><i className="expense"/>Έξοδα</span></div></div><div className="report-chart-frame" aria-hidden="true"><ResponsiveContainer width="100%" height={250}><ComposedChart data={series} margin={{left:0,right:8,top:8,bottom:0}}><CartesianGrid stroke="#dbe4f0" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={{fontSize:10,fill:'#52627d'}}/><YAxis tick={{fontSize:9,fill:'#52627d'}}/><Tooltip formatter={(v)=>money.format(Number(v))}/><Bar dataKey="income" name="Έσοδα" fill="#20b892" radius={[5,5,0,0]}/><Bar dataKey="expense" name="Έξοδα" fill="#ff5068" radius={[5,5,0,0]}/></ComposedChart></ResponsiveContainer></div><details className="chart-alt"><summary>Ποσά σε κείμενο</summary><ul className="chart-alt-list report-flow-alt">{series.map(row=><li key={row.month}><span>{row.label}</span><b>Έσοδα {money.format(row.income)} · Έξοδα {money.format(row.expense)}</b></li>)}</ul></details></article>

   <article className="panel neo-raised report-chart-card"><div className="panel-head"><div><span>Ταμειακή ροή (σωρευτικά)</span><small>Συσσωρευμένο καθαρό αποτέλεσμα 6 μηνών.</small></div></div><div className="report-chart-frame" aria-hidden="true"><ResponsiveContainer width="100%" height={250}><ComposedChart data={cumulativeSeries} margin={{left:0,right:8,top:8,bottom:0}}><CartesianGrid stroke="#dbe4f0" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={{fontSize:10,fill:'#52627d'}}/><YAxis tick={{fontSize:9,fill:'#52627d'}}/><Tooltip formatter={(v)=>money.format(Number(v))}/><Line type="monotone" dataKey="cumulative" name="Σωρευτική ροή" stroke="#20b892" strokeWidth={3} dot={{r:3}}/></ComposedChart></ResponsiveContainer></div><details className="chart-alt"><summary>Σωρευτικά ποσά σε κείμενο</summary><ul className="chart-alt-list report-flow-alt">{cumulativeSeries.map(row=><li key={row.month}><span>{row.label}</span><b>{money.format(row.cumulative)}</b></li>)}</ul></details></article>
  </section>

  <section className="panel neo-raised report-budget-overview" id="report-budget-overview" data-budget-overview aria-labelledby="report-budget-overview-title">
   <div className="panel-head"><div><span id="report-budget-overview-title">Προϋπολογισμοί</span><small>Χρήση, σημεία προσοχής και πρόβλεψη τέλους μήνα εμφανίζονται πριν από τη διαχείριση.</small></div><ListChecks aria-hidden="true"/></div>
   {budgetRows.length?<div className="report-budget-cockpit">
    <article className="report-budget-health-card"><div className="report-budget-health-copy"><span>Συνολική χρήση</span><b>{Math.round(budgetRatio*100)}%</b><small>{budgetStatusText}</small></div><div className="report-budget-meter" role="progressbar" aria-label="Συνολική χρήση ενεργών προϋπολογισμών" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.round(budgetRatio*100))}><i style={{width:`${Math.min(100,budgetRatio*100)}%`}}/></div><p>{money.format(budgetUsed)} από {money.format(budgetLimit)} · {budgetRemaining>=0?`${money.format(budgetRemaining)} διαθέσιμα`:`${money.format(Math.abs(budgetRemaining))} υπέρβαση`}</p></article>
    <div className="report-budget-attention" aria-label="Προϋπολογισμοί που χρειάζονται προσοχή"><div className="report-budget-attention-head"><span>Τι χρειάζεται προσοχή</span><small>Υψηλότερη χρήση πρώτα.</small></div>{budgetAttentionRows.map(row=><article key={row.id} className={`report-budget-attention-row ${row.status}`}><div><b>{row.scope==='overall'?'Συνολικό όριο':row.category}</b><small>{money.format(row.used)} / {money.format(row.limit)}</small></div><strong>{Math.round(row.ratio*100)}%</strong><div className="report-budget-meter"><i style={{width:`${Math.min(100,row.ratio*100)}%`}}/></div></article>)}</div>
    <article className={`report-budget-projection ${budgetProjection!==null&&budgetProjection>budgetLimit?'negative':'positive'}`}><span>{month<budgetDataMonth?'Τελική χρήση':'Πρόβλεψη τέλους μήνα'}</span><b>{budgetProjection===null?'—':money.format(budgetProjection)}</b><small>{budgetProjectionDetail}</small>{budgetProjection!==null&&budgetLimit>0?<p>{budgetProjection>budgetLimit?`Πιθανή υπέρβαση ${money.format(budgetProjection-budgetLimit)}`:`Πιθανό περιθώριο ${money.format(budgetLimit-budgetProjection)}`}</p>:null}</article>
   </div>:<div className="empty-state report-budget-empty"><b>Δεν υπάρχουν ενεργοί προϋπολογισμοί για αυτή την περίοδο.</b><span>Μπορείς να προσθέσεις συνολικό ή ανά κατηγορία όριο από τη διαχείριση.</span></div>}
   <details className="report-budget-management"><summary>Διαχείριση προϋπολογισμών</summary><BudgetRuleSettings data={data} asOf={`${month}-01`} budgetMonth={month} onUpsertBudget={onUpsertBudget} onDeleteBudget={onDeleteBudget} onUpsertRule={onUpsertRule} onDeleteRule={onDeleteRule} view="budgets"/></details>
  </section>

  <section className="report-support-grid" id="report-support">
   <article className="panel neo-raised report-counterparties"><div className="panel-head"><div><span>Μεγαλύτερες δαπάνες / έμποροι</span><small>Top 5 της περιόδου.</small></div></div>{counterparties.length?<div className="report-counterparty-list">{counterparties.map((row,index)=>{const [category,subcategory]=row.category.split(' › ');return <div key={`${row.title}-${row.category}`}><span className="report-counterparty-rank">{index+1}</span><FinanceIcon settings={data.state.settings} kind="expense" category={category} subcategory={subcategory} size={18}/><span><b>{row.title}</b><small>{row.category} · {row.count===1?'1 κίνηση':`${row.count} κινήσεις`}</small></span><strong>{money.format(row.amount)}<small>{percent(row.share,1)}</small></strong></div>})}</div>:<div className="empty-state">Δεν υπάρχουν καταγεγραμμένες χρεώσεις.</div>}</article>

   <article className="panel neo-raised report-pressure" id="report-obligations"><div className="panel-head"><div><span>Επερχόμενες υποχρεώσεις</span><small>Πάγια, δόσεις και πιστωτικές.</small></div></div><div className="report-operations-grid report-pressure-grid"><article className="report-pressure-card"><div className="report-pressure-icon"><Landmark/></div><div><span>Πάγια & δόσεις / μήνα</span><b><AnimatedAmount value={combinedMonthlyBurden}/></b><small>Πάγια {money.format(snapshot.recurring)} · Δόσεις {money.format(loanBurden.total)}</small></div>{combinedBurdenRate!==null?<div className="report-meter"><i style={{width:`${Math.min(100,combinedBurdenRate*100)}%`}}/></div>:null}</article><article className={`report-pressure-card ${creditPercent!==null&&creditPercent>1?'over-limit':''}`}><div className="report-pressure-icon"><CreditCard/></div><div><span>Πιστωτικές</span><b>{creditPercent!==null?`${Math.round(creditPercent*100)}%`:'Χωρίς όριο'}</b><small><AnimatedAmount value={snapshot.creditDebt}/> οφειλή · <AnimatedAmount value={snapshot.creditAvailable}/> διαθέσιμο</small></div>{creditPercent!==null?<div className="report-meter"><i style={{width:`${Math.min(100,creditPercent*100)}%`}}/></div>:null}</article><article className="report-pressure-card"><div className="report-pressure-icon"><HandCoins/></div><div><span>Προς είσπραξη</span><b><AnimatedAmount value={snapshot.receivables}/></b><small>Καταγεγραμμένες απαιτήσεις</small></div></article></div></article>

   <aside className="panel neo-raised report-insights report-insights-rail" aria-labelledby="report-insights-title"><div className="panel-head"><div><span id="report-insights-title">Τι χρειάζεται προσοχή</span><small>Σύντομες αριθμητικές ενδείξεις.</small></div></div><div className="report-insight-grid">{callouts.slice(0,3).map((item,index)=><article key={`${item.title}-${index}`} className={`report-insight ${item.tone}`}>{item.tone==='negative'?<TriangleAlert aria-hidden="true"/>:item.tone==='positive'?<CircleCheck aria-hidden="true"/>:<ListChecks aria-hidden="true"/>}<div><b>{item.title}</b><small>{item.detail}</small></div></article>)}</div></aside>
  </section>

  <section className="report-lower-grid">
   <article className="panel neo-raised report-comparison-panel"><div className="panel-head"><div><span>Σύγκριση μηνών</span><small>{monthLabel} έναντι προηγούμενου μήνα.</small></div></div><div className="report-comparison-table" role="table"><div className="report-comparison-head" role="row"><span role="columnheader">Δείκτης</span><span role="columnheader">Τρέχων</span><span role="columnheader">Προηγ.</span><span role="columnheader">Μεταβολή</span></div>{comparisonRows.map(row=>{const tone=comparisonTone(row.label==='Καθαρή ροή'?'Έσοδα':row.label,row.value);const delta=row.kind==='rate'?(row.value===null?'—':`${row.value>=0?'+':''}${(row.value*100).toFixed(1)} π.μ.`):changeLabel(row.value);return <div className="report-comparison-row" role="row" key={row.label}><b role="cell">{row.label}</b><span role="cell">{comparisonValue(row.current,row.kind)}</span><span role="cell">{comparisonValue(row.previous,row.kind)}</span><span role="cell" className={tone}>{delta}</span></div>})}</div></article>

   <article className="panel neo-raised report-account-history" id="report-accounts"><div className="panel-head"><div><span>Εξέλιξη λογαριασμών</span><small>Έως τέσσερις μη πιστωτικοί λογαριασμοί.</small></div><button type="button" className="text-button report-eye" aria-pressed={accountsVisible} onClick={()=>setAccountsVisible(value=>!value)}>{accountsVisible?<EyeOff size={15}/>:<Eye size={15}/>} {accountsVisible?'Απόκρυψη':'Εμφάνιση'}</button></div>{accountsVisible&&accountIds.length?<><div className="report-account-legend">{accountIds.map((id,index)=><span key={id}><i style={{background:ACCOUNT_COLORS[index%ACCOUNT_COLORS.length]}}/>{accountDisplayName(data,id)}</span>)}</div><div aria-hidden="true"><ResponsiveContainer width="100%" height={230}><ComposedChart data={accountSeries}><CartesianGrid stroke="#dbe4f0" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={{fontSize:10,fill:'#52627d'}}/><YAxis tick={{fontSize:9,fill:'#52627d'}}/><Tooltip formatter={(v)=>money.format(Number(v))}/>{accountIds.map((id,index)=><Line key={id} type="monotone" dataKey={id} name={accountDisplayName(data,id)} stroke={ACCOUNT_COLORS[index%ACCOUNT_COLORS.length]} strokeWidth={2.4} dot={{r:2.5}}/>)}</ComposedChart></ResponsiveContainer></div></>:accountsVisible?<div className="empty-state">Δεν υπάρχουν διαθέσιμοι λογαριασμοί.</div>:<div className="private-report-placeholder"><Eye/><span>Τα υπόλοιπα είναι κρυμμένα. Πάτησε «Εμφάνιση».</span></div>}</article>

   <article className="panel neo-raised savings-report-breakdown report-savings-sources"><div className="panel-head"><div><span>Πηγές αποταμίευσης</span><small>Πώς σχηματίστηκε η αποταμίευση.</small></div><PiggyBank aria-hidden="true"/></div>{Object.entries(snapshot.savings.bySource).map(([source,value])=><div key={source}><span>{SAVING_SOURCE_LABELS[source as keyof typeof SAVING_SOURCE_LABELS]}</span><b><AnimatedAmount value={value}/></b></div>)}<div className="savings-total-row"><span><WalletCards size={16} aria-hidden="true"/> Σύνολο</span><b><AnimatedAmount value={snapshot.savings.total}/></b></div></article>
  </section>

  <section className="report-footnote neo-raised" aria-label="Σημείωση αναφορών"><CircleCheck aria-hidden="true"/><div><b>Σημείωση</b><span>Οι αναφορές χρησιμοποιούν τα canonical οικονομικά δεδομένα του MyFinHub. Μεταφορές, αποπληρωμές πιστωτικών και άλλες ουδέτερες κινήσεις δεν διπλομετρώνται ως έξοδα.</span></div></section>
 </div>
}
