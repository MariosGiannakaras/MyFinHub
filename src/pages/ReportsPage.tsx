import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarClock, CircleCheck, CreditCard, Eye, EyeOff, Landmark, ListChecks, PiggyBank, TriangleAlert, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnimatedAmount } from '../components/AnimatedAmount';
import { BudgetRuleSettings } from '../components/BudgetRuleSettings';
import { FinanceIcon } from '../components/FinanceIcon';
import { budgetProgress } from '../lib/budgets';
import { accountBalances, allAccounts, effectiveLegacyTransactions, flowImpactEvent, flowImpactLegacy } from '../lib/domain';
import { cleanNote, money, shortDate } from '../lib/format';
import { categoryMomentum, monthEnd, operationalReportSnapshot, primaryAccountSeries, reportExpenseCounterparties, reportFlowSeries, reportInsightModel, reportLoanBurden } from '../lib/reports';
import { recurringUpcoming } from '../lib/recurring';
import { SAVING_SOURCE_LABELS } from '../lib/savings';
import { accountDisplayName, eventKindLabel } from '../lib/ui';
import type { FinanceData, MonthlyBudget, TransactionRule } from '../types';
import './ReportsPage.css';

const change=(current:number,previous:number)=>previous===0?(current===0?0:null):((current-previous)/Math.abs(previous))*100;
const changeLabel=(value:number|null)=>value===null?'Νέα βάση':`${value>=0?'+':''}${Math.round(value)}%`;
const percent=(value:number|null,digits=0)=>value===null?'—':`${(value*100).toFixed(digits)}%`;
const directionText=(value:number)=>value>=0?'πάνω':'κάτω';
const comparisonTone=(label:string,value:number|null)=>value===null?'neutral':((label==='Έξοδα'&&value>0)||(label!=='Έξοδα'&&value<0))?'negative':'positive';
const CATEGORY_COLORS=['#2f6fed','#ff5068','#7a5af8','#ffb648','#27bfa5','#f59e0b','#8b95ad'];
const ACCOUNT_COLORS=['#2f6fed','#14a77f','#7a5af8','#f59e0b','#8b95ad'];

type ActivityRow={id:string;date:string;title:string;category:string;subcategory?:string;amount:number};

export function ReportsPage({data,month,onUpsertBudget,onDeleteBudget,onUpsertRule,onDeleteRule}:{data:FinanceData;month:string;onUpsertBudget:(budget:MonthlyBudget)=>void;onDeleteBudget:(id:string)=>void;onUpsertRule:(rule:TransactionRule)=>void;onDeleteRule:(id:string)=>void}){
 const snapshot=operationalReportSnapshot(data,month);
 const insights=reportInsightModel(data,month);
 const series=reportFlowSeries(data,month,6);
 const cumulativeSeries=useMemo(()=>{let running=0;return series.map(row=>({...row,cumulative:(running+=row.income-row.expense)}))},[series]);
 const momentum=categoryMomentum(data,month,100);
 const counterparties=reportExpenseCounterparties(data,month,5);
 const loanBurden=reportLoanBurden(data);
 const accounts=allAccounts(data).filter(account=>account.kind!=='credit');
 const accountIds=accounts.slice(0,4).map(account=>account.id);
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
   if(insights.topCategory?.share!==null&&insights.topCategory)rows.push({title:`Μεγαλύτερη κατηγορία: ${insights.topCategory.name}`,detail:`${money.format(insights.topCategory.value)} · ${Math.round(insights.topCategory.share*100)}% των εξόδων αυτής της περιόδου.`,tone:'neutral'});
   if(insights.savingsRate!==null){const previous=insights.previousSavingsRate;rows.push({title:`Ρυθμός αποταμίευσης ${percent(insights.savingsRate)}`,detail:previous===null?'Δεν υπάρχει συγκρίσιμος προηγούμενος μήνας με έσοδα.':`Προηγούμενος μήνας: ${percent(previous)}.`,tone:previous!==null&&insights.savingsRate<previous?'negative':'positive'})}
   return rows.slice(0,3);
 },[insights]);
 const comparisonValue=(value:number|null,kind:'money'|'rate')=>kind==='money'?money.format(value??0):percent(value,1);

 const activityRows=useMemo<ActivityRow[]>(()=>{
   const rows:ActivityRow[]=[];
   for(const tx of effectiveLegacyTransactions(data)){
     if(!tx.date.startsWith(`${month}-`))continue;
     const impact=flowImpactLegacy(data,tx);
     const amount=impact.income+impact.refund-impact.expense-impact.saving;
     if(Math.abs(amount)<=.005)continue;
     rows.push({id:`legacy:${tx.id}`,date:tx.date,title:cleanNote(tx.note)||tx.category||'Συναλλαγή',category:tx.category||'Άλλο',subcategory:tx.subcategory,amount});
   }
   for(const event of data.state.events??[]){
     if(!event.date.startsWith(`${month}-`))continue;
     const impact=flowImpactEvent(event);
     const amount=impact.income+impact.refund-impact.expense-impact.saving;
     if(Math.abs(amount)<=.005)continue;
     rows.push({id:`event:${event.id}`,date:event.date,title:cleanNote(event.note)||eventKindLabel(event.kind),category:event.category||eventKindLabel(event.kind),subcategory:event.subcategory,amount});
   }
   return rows.sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
 },[data,month]);
 const recentTransactions=activityRows.slice(0,5);
 const topIncomeRows=activityRows.filter(row=>row.amount>0).sort((a,b)=>b.amount-a.amount||b.date.localeCompare(a.date)).slice(0,5);
 const periodBalances=useMemo(()=>accountBalances(data,monthEnd(month)),[data,month]);
 const accountDistribution=useMemo(()=>accounts.map(account=>({id:account.id,name:accountDisplayName(data,account.id),balance:periodBalances[account.id]||0})).filter(row=>row.balance>.005).sort((a,b)=>b.balance-a.balance).slice(0,5),[accounts,data,periodBalances]);
 const accountDistributionTotal=accountDistribution.reduce((sum,row)=>sum+row.balance,0);
 const upcomingObligations=useMemo(()=>{
   const recurring=recurringUpcoming(data,`${month}-01`).filter(row=>row.nextDate&&row.nextDate<=monthEnd(month)).map(row=>({id:`recurring:${row.item.id}`,name:row.item.name,category:row.item.category,amount:row.item.amount,date:row.nextDate!,kind:'recurring' as const}));
   const loans=loanBurden.rows.map(row=>({id:`loan:${row.id}`,name:row.name,category:'Δάνειο',amount:row.amount,date:null,kind:'loan' as const}));
   return [...recurring,...loans].slice(0,5);
 },[data,loanBurden.rows,month]);

 return <div className="page-stack reports-dashboard reports-composite reports-dense">
  <section className="page-heading report-heading" id="report-overview"><div><span className="eyebrow">ΑΝΑΦΟΡΕΣ · {monthLabel}</span><h1>Αναφορές</h1><p>Οικονομική εικόνα, τάσεις και προϋπολογισμοί σε μία πυκνή επισκόπηση.</p></div><div className="report-period-chip" aria-label={`Επιλεγμένη περίοδος ${monthLabel}`}><span>Περίοδος</span><b>{monthLabel}</b></div></section>

  <nav className="report-section-nav" aria-label="Ενότητες αναφορών"><a href="#report-overview">Επισκόπηση</a><a href="#report-budget-overview">Προϋπολογισμοί</a><a href="#report-flow">Ροή</a><a href="#report-obligations">Υποχρεώσεις</a><a href="#report-expenses">Έξοδα</a><a href="#report-comparisons">Συγκρίσεις</a><a href="#report-accounts">Λογαριασμοί</a></nav>

  <section className="report-executive report-kpi-strip" aria-label="Κύριοι δείκτες περιόδου">
   <article className="report-headline-card positive"><span>Συνολικά έσοδα</span><b><AnimatedAmount value={snapshot.flow.income}/></b><small>{changeLabel(change(snapshot.flow.income,snapshot.previous.income))} από τον προηγούμενο μήνα</small></article>
   <article className="report-headline-card negative"><span>Συνολικά έξοδα</span><b><AnimatedAmount value={snapshot.flow.expense}/></b><small>{changeLabel(change(snapshot.flow.expense,snapshot.previous.expense))} από τον προηγούμενο μήνα</small></article>
   <article className={`report-headline-card ${netFlow>=0?'positive':'negative'}`}><span>Καθαρό ισοζύγιο</span><b><AnimatedAmount value={netFlow}/></b><small>{changeLabel(change(netFlow,previousNetFlow))} από τον προηγούμενο μήνα</small></article>
   <article className="report-headline-card"><span>Συνολικό budget</span><b>{budgetLimit>0?money.format(budgetLimit):'—'}</b><small>{budgetLimit>0?`${Math.round(budgetRatio*100)}% χρησιμοποιημένο`:'Δεν έχει οριστεί ενεργό όριο'}</small></article>
   <article className="report-headline-card positive"><span>Αποταμίευση</span><b>{percent(insights.savingsRate,1)}</b><small>Στόχος {percent(savingsTarget,0)} · {savingsTargetProgress===null?'χωρίς συγκρίσιμη βάση':`${Math.round(savingsTargetProgress*100)}% προόδου`}</small></article>
  </section>

  <section className="report-analytics-grid" id="report-flow" aria-label="Βασικά γραφήματα">
   <article className="panel neo-raised report-category-panel" id="report-expenses"><div className="panel-head"><div><span>Έξοδα ανά κατηγορία</span><small>Κατανομή & μεταβολή εξόδων στην επιλεγμένη περίοδο.</small></div></div>{momentum.length?<div className="report-category-layout"><div className="report-category-chart" aria-hidden="true"><div className="report-css-donut" style={{background:categoryDonutBackground}}/><div className="report-donut-total"><b>{money.format(categoryTotal)}</b><span>Σύνολο</span></div></div><div className="category-momentum-list report-category-list">{categoryDonut.map((row,index)=>{const [category,subcategory]=row.name.split(' › ');return <div key={row.name}><span className="semantic-list-title"><i className="report-category-swatch" style={{background:CATEGORY_COLORS[index%CATEGORY_COLORS.length]}}/>{row.name!=='Λοιπά'?<FinanceIcon settings={data.state.settings} kind="expense" category={category} subcategory={subcategory} size={14}/>:null}{row.name}</span><b>{money.format(row.value)} <em>{percent(categoryTotal>0?row.value/categoryTotal:null,1)}</em></b></div>})}</div></div>:<div className="empty-state">Δεν υπάρχουν έξοδα για την επιλεγμένη περίοδο.</div>}</article>
   <article className="panel neo-raised report-chart-card"><div className="panel-head"><div><span>6μηνη οικονομική ροή</span><small>Έσοδα vs έξοδα των τελευταίων 6 μηνών.</small></div><div className="report-flow-legend" aria-hidden="true"><span><i className="income"/>Έσοδα</span><span><i className="expense"/>Έξοδα</span></div></div><div className="report-chart-frame" aria-hidden="true"><ResponsiveContainer width="100%" height={250}><ComposedChart data={series} margin={{left:0,right:8,top:8,bottom:0}}><CartesianGrid stroke="#dbe4f0" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={{fontSize:10,fill:'#52627d'}}/><YAxis tick={{fontSize:9,fill:'#52627d'}}/><Tooltip formatter={(v)=>money.format(Number(v))}/><Bar dataKey="income" name="Έσοδα" fill="#20b892" radius={[5,5,0,0]}/><Bar dataKey="expense" name="Έξοδα" fill="#ff5068" radius={[5,5,0,0]}/></ComposedChart></ResponsiveContainer></div><details className="chart-alt"><summary>Ποσά σε κείμενο</summary><ul className="chart-alt-list report-flow-alt">{series.map(row=><li key={row.month}><span>{row.label}</span><b>Έσοδα {money.format(row.income)} · Έξοδα {money.format(row.expense)}</b></li>)}</ul></details></article>
   <article className="panel neo-raised report-chart-card"><div className="panel-head"><div><span>Ταμειακή ροή (σωρευτικά)</span><small>Συσσωρευμένο καθαρό αποτέλεσμα 6 μηνών.</small></div></div><div className="report-chart-frame" aria-hidden="true"><ResponsiveContainer width="100%" height={250}><ComposedChart data={cumulativeSeries} margin={{left:0,right:8,top:8,bottom:0}}><CartesianGrid stroke="#dbe4f0" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={{fontSize:10,fill:'#52627d'}}/><YAxis tick={{fontSize:9,fill:'#52627d'}}/><Tooltip formatter={(v)=>money.format(Number(v))}/><Line type="monotone" dataKey="cumulative" name="Σωρευτική ροή" stroke="#20b892" strokeWidth={3} dot={{r:3}}/></ComposedChart></ResponsiveContainer></div><details className="chart-alt"><summary>Σωρευτικά ποσά σε κείμενο</summary><ul className="chart-alt-list report-flow-alt">{cumulativeSeries.map(row=><li key={row.month}><span>{row.label}</span><b>{money.format(row.cumulative)}</b></li>)}</ul></details></article>
  </section>

  <section className="panel neo-raised report-budget-overview" id="report-budget-overview" data-budget-overview aria-labelledby="report-budget-overview-title">
   <div className="panel-head"><div><span id="report-budget-overview-title">Προϋπολογισμοί · εικόνα περιόδου</span><small>Χρήση, σημεία προσοχής και πρόβλεψη τέλους μήνα εμφανίζονται πριν από τη διαχείριση.</small></div><ListChecks aria-hidden="true"/></div>
   {budgetRows.length?<>
    <div className="report-budget-summary-grid" aria-label="Σύνοψη προϋπολογισμών">
     <article><span>Συνολικό όριο</span><b>{money.format(budgetLimit)}</b><small>{overallBudget?'Κύρια βάση περιόδου':`${budgetSummaryRows.length} όρια κατηγοριών`}</small></article>
     <article><span>Χρήση ορίων</span><b>{money.format(budgetUsed)}</b><small>{budgetLimit>0?`${Math.round(budgetRatio*100)}% της διαθέσιμης βάσης`:'Χωρίς διαθέσιμη βάση'}</small></article>
     <article className={budgetRemaining<0?'negative':budgetRatio>=.8?'warning':'positive'}><span>{budgetRemaining<0?'Υπέρβαση':'Διαθέσιμο'}</span><b>{money.format(Math.abs(budgetRemaining))}</b><small>{budgetRemaining<0?'Πάνω από τα ενεργά όρια':'Μέχρι τα ενεργά όρια'}</small></article>
     <article className={budgetProjection!==null&&budgetProjection>budgetLimit?'negative':'positive'}><span>{month<budgetDataMonth?'Τελική χρήση':'Πρόβλεψη τέλους μήνα'}</span><b>{budgetProjection===null?'—':money.format(budgetProjection)}</b><small>{budgetProjectionDetail}</small></article>
    </div>
    <div className="report-budget-health-grid">
     <article className="report-budget-health-card"><div className="report-budget-health-copy"><span>Συνολική χρήση</span><b>{Math.round(budgetRatio*100)}%</b><small>{budgetStatusText}</small></div><div className="report-budget-meter" role="progressbar" aria-label="Συνολική χρήση ενεργών προϋπολογισμών" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.round(budgetRatio*100))}><i style={{width:`${Math.min(100,budgetRatio*100)}%`}}/></div><p>{money.format(budgetUsed)} από {money.format(budgetLimit)} · {budgetRemaining>=0?`${money.format(budgetRemaining)} διαθέσιμα`:`${money.format(Math.abs(budgetRemaining))} υπέρβαση`}</p></article>
     <div className="report-budget-attention" aria-label="Προϋπολογισμοί που χρειάζονται προσοχή"><div className="report-budget-attention-head"><span>Τι χρειάζεται προσοχή</span><small>Υψηλότερη χρήση πρώτα.</small></div>{budgetAttentionRows.map(row=><article key={row.id} className={`report-budget-attention-row ${row.status}`}><div><b>{row.scope==='overall'?'Συνολικό όριο':row.category}</b><small>{money.format(row.used)} / {money.format(row.limit)}</small></div><strong>{Math.round(row.ratio*100)}%</strong><div className="report-budget-meter"><i style={{width:`${Math.min(100,row.ratio*100)}%`}}/></div></article>)}</div>
    </div>
   </>:<div className="empty-state report-budget-empty"><b>Δεν υπάρχουν ενεργοί προϋπολογισμοί για αυτή την περίοδο.</b><span>Μπορείς να προσθέσεις συνολικό ή ανά κατηγορία όριο από τη διαχείριση.</span></div>}
   <details id="report-budgets" data-budget-management className="report-budget-management"><summary>Διαχείριση προϋπολογισμών</summary><BudgetRuleSettings data={data} asOf={`${month}-01`} budgetMonth={month} onUpsertBudget={onUpsertBudget} onDeleteBudget={onDeleteBudget} onUpsertRule={onUpsertRule} onDeleteRule={onDeleteRule} view="budgets"/></details>
  </section>

  <section className="report-support-grid report-support-grid-four" id="report-support">
   <article className="panel neo-raised report-activity-card"><div className="panel-head"><div><span>Πρόσφατες συναλλαγές</span><small>Οι τελευταίες κινήσεις που επηρεάζουν τη μηνιαία ροή.</small></div></div>{recentTransactions.length?<div className="report-activity-list">{recentTransactions.map(row=><div key={row.id}><FinanceIcon settings={data.state.settings} kind={row.amount>=0?'income':'expense'} category={row.category} subcategory={row.subcategory} note={row.title} size={17}/><span><b>{row.title}</b><small>{shortDate(row.date)} · {row.category}</small></span><strong className={row.amount>=0?'positive':'negative'}>{row.amount>=0?'+':''}{money.format(row.amount)}</strong></div>)}</div>:<div className="empty-state">Δεν υπάρχουν κινήσεις για την περίοδο.</div>}</article>

   <article className="panel neo-raised report-account-distribution"><div className="panel-head"><div><span>Κατανομή λογαριασμών</span><small>Θετικά υπόλοιπα στο τέλος της περιόδου.</small></div></div>{accountDistribution.length?<div className="report-account-distribution-list">{accountDistribution.map((row,index)=><div key={row.id}><span><i style={{background:ACCOUNT_COLORS[index%ACCOUNT_COLORS.length]}}/><b>{row.name}</b></span><div className="report-account-bar"><i style={{width:`${accountDistributionTotal>0?Math.max(4,row.balance/accountDistributionTotal*100):0}%`,background:ACCOUNT_COLORS[index%ACCOUNT_COLORS.length]}}/></div><strong>{money.format(row.balance)}</strong></div>)}</div>:<div className="empty-state">Δεν υπάρχουν θετικά υπόλοιπα για κατανομή.</div>}</article>

   <article className="panel neo-raised report-counterparties"><div className="panel-head"><div><span>Μεγαλύτερες δαπάνες / έμποροι</span><small>Top 5 έμποροι / περιγραφές της περιόδου.</small></div></div>{counterparties.length?<div className="report-counterparty-list">{counterparties.map((row,index)=>{const [category,subcategory]=row.category.split(' › ');return <div key={`${row.title}-${row.category}`}><span className="report-counterparty-rank">{index+1}</span><FinanceIcon settings={data.state.settings} kind="expense" category={category} subcategory={subcategory} size={18}/><span><b>{row.title}</b><small>{row.category} · {row.count===1?'1 κίνηση':`${row.count} κινήσεις`}</small></span><strong>{money.format(row.amount)}<small>{percent(row.share,1)}</small></strong></div>})}</div>:<div className="empty-state">Δεν υπάρχουν καταγεγραμμένες χρεώσεις.</div>}</article>

   <article className="panel neo-raised report-upcoming-card" id="report-obligations"><div className="panel-head"><div><span>Επερχόμενες υποχρεώσεις</span><small>Πάγια & δόσεις / μήνα, με τις επόμενες ημερομηνίες.</small></div><CalendarClock aria-hidden="true"/></div>{upcomingObligations.length?<div className="report-upcoming-list">{upcomingObligations.map(row=><div key={row.id}>{row.kind==='loan'?<Landmark size={17}/>:<FinanceIcon settings={data.state.settings} kind="expense" category={row.category} note={row.name} size={17}/>}<span><b>{row.name}</b><small>{row.date?shortDate(row.date):'Επόμενη δόση'} · {row.category}</small></span><strong>{money.format(row.amount)}</strong></div>)}</div>:<div className="empty-state">Δεν υπάρχουν επερχόμενες υποχρεώσεις.</div>}<div className="report-operations-grid report-credit-portfolio"><article className={`report-credit-portfolio-card ${creditPercent!==null&&creditPercent>1?'over-limit':''}`}><CreditCard size={16}/><div><span>Χρήση πιστωτικών</span><b>{creditPercent===null?'Χωρίς όριο':`${Math.round(creditPercent*100)}%`}</b><small>{money.format(snapshot.creditDebt)} οφειλή · {money.format(snapshot.creditAvailable)} διαθέσιμο</small></div></article></div>{snapshot.creditCardRows.length?<details className="credit-report-drilldown"><summary>Ανάλυση πιστωτικών καρτών</summary><div className="credit-report-list">{snapshot.creditCardRows.map(card=><div key={card.id}><span><b>{card.nickname}</b><small>{card.active?'Ενεργή':'Αρχειοθετημένη'}</small></span><span>Οφειλή <b>{money.format(card.debt)}</b></span><span>{card.limit>0?`Χρήση ${Math.round(card.usage*100)}% · Όριο ${money.format(card.limit)}`:'Χωρίς ενεργό όριο'}</span></div>)}</div></details>:null}</article>
  </section>

  <section className="report-lower-grid report-lower-grid-dense">
   <article className="panel neo-raised report-income-card"><div className="panel-head"><div><span>Μεγαλύτερα έσοδα</span><small>Οι μεγαλύτερες θετικές κινήσεις της περιόδου.</small></div></div>{topIncomeRows.length?<div className="report-income-list">{topIncomeRows.map((row,index)=><div key={row.id}><span className="report-counterparty-rank">{index+1}</span><FinanceIcon settings={data.state.settings} kind="income" category={row.category} subcategory={row.subcategory} note={row.title} size={17}/><span><b>{row.title}</b><small>{shortDate(row.date)} · {row.category}</small></span><strong>+{money.format(row.amount)}</strong></div>)}</div>:<div className="empty-state">Δεν υπάρχουν έσοδα για την περίοδο.</div>}</article>

   <article className="panel neo-raised report-comparison-panel" id="report-comparisons"><div className="panel-head"><div><span>Σύγκριση μηνών</span><small>{monthLabel} έναντι προηγούμενου μήνα.</small></div></div><div className="report-comparison-table" role="table"><div className="report-comparison-head" role="row"><span role="columnheader">Δείκτης</span><span role="columnheader">Τρέχων</span><span role="columnheader">Προηγ.</span><span role="columnheader">Μεταβολή</span></div>{comparisonRows.map(row=>{const tone=comparisonTone(row.label==='Καθαρή ροή'?'Έσοδα':row.label,row.value);const delta=row.kind==='rate'?(row.value===null?'—':`${row.value>=0?'+':''}${(row.value*100).toFixed(1)} π.μ.`):changeLabel(row.value);return <div className="report-comparison-row" role="row" key={row.label}><b role="cell">{row.label}</b><span role="cell">{comparisonValue(row.current,row.kind)}</span><span role="cell">{comparisonValue(row.previous,row.kind)}</span><span role="cell" className={tone}>{delta}</span></div>})}</div></article>

   <aside className="panel neo-raised report-insights report-insights-rail" aria-labelledby="report-insights-title"><div className="panel-head"><div><span id="report-insights-title">Τάσεις & ενδείξεις</span><small>Σύντομες αριθμητικές παρατηρήσεις.</small></div></div><div className="report-insight-grid">{callouts.map((item,index)=><article key={`${item.title}-${index}`} className={`report-insight ${item.tone}`}>{item.tone==='negative'?<TriangleAlert aria-hidden="true"/>:item.tone==='positive'?<CircleCheck aria-hidden="true"/>:<ListChecks aria-hidden="true"/>}<div><b>{item.title}</b><small>{item.detail}</small></div></article>)}</div></aside>
  </section>

  <section className="report-accounts-grid" id="report-accounts">
   <article className="panel neo-raised report-account-history"><div className="panel-head"><div><span>Εξέλιξη βασικών λογαριασμών</span><small>Έως τέσσερις μη πιστωτικοί λογαριασμοί.</small></div><button type="button" className="text-button report-eye" aria-pressed={accountsVisible} onClick={()=>setAccountsVisible(value=>!value)}>{accountsVisible?<EyeOff size={15}/>:<Eye size={15}/>} {accountsVisible?'Απόκρυψη':'Εμφάνιση'}</button></div>{accountsVisible&&accountIds.length?<><div className="report-account-legend">{accountIds.map((id,index)=><span key={id}><i style={{background:ACCOUNT_COLORS[index%ACCOUNT_COLORS.length]}}/>{accountDisplayName(data,id)}</span>)}</div><div aria-hidden="true"><ResponsiveContainer width="100%" height={230}><ComposedChart data={accountSeries}><CartesianGrid stroke="#dbe4f0" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={{fontSize:10,fill:'#52627d'}}/><YAxis tick={{fontSize:9,fill:'#52627d'}}/><Tooltip formatter={(v)=>money.format(Number(v))}/>{accountIds.map((id,index)=><Line key={id} type="monotone" dataKey={id} name={accountDisplayName(data,id)} stroke={ACCOUNT_COLORS[index%ACCOUNT_COLORS.length]} strokeWidth={2.4} dot={{r:2.5}}/>)}</ComposedChart></ResponsiveContainer></div></>:accountsVisible?<div className="empty-state">Δεν υπάρχουν διαθέσιμοι λογαριασμοί.</div>:<div className="private-report-placeholder"><Eye/><span>Τα υπόλοιπα είναι κρυμμένα. Πάτησε «Εμφάνιση».</span></div>}</article>
   <article className="panel neo-raised savings-report-breakdown report-savings-sources"><div className="panel-head"><div><span>Πηγές αποταμίευσης</span><small>Πώς σχηματίστηκε η αποταμίευση.</small></div><PiggyBank aria-hidden="true"/></div>{Object.entries(snapshot.savings.bySource).map(([source,value])=><div key={source}><span>{SAVING_SOURCE_LABELS[source as keyof typeof SAVING_SOURCE_LABELS]}</span><b><AnimatedAmount value={value}/></b></div>)}<div className="savings-total-row"><span><WalletCards size={16} aria-hidden="true"/> Σύνολο</span><b><AnimatedAmount value={snapshot.savings.total}/></b></div></article>
  </section>

  <section className="report-footnote neo-raised" aria-label="Σημείωση αναφορών"><CircleCheck aria-hidden="true"/><div><b>Σημείωση</b><span>Οι αναφορές χρησιμοποιούν τα canonical οικονομικά δεδομένα του MyFinHub. Μεταφορές, αποπληρωμές πιστωτικών και άλλες ουδέτερες κινήσεις δεν διπλομετρώνται ως έξοδα.</span></div></section>
 </div>
}