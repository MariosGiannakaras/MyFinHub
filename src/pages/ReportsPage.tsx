import { Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CircleCheck, CreditCard, Eye, EyeOff, HandCoins, Landmark, ListChecks, PiggyBank, TriangleAlert, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnimatedAmount } from '../components/AnimatedAmount';
import { BudgetProgressPanel } from '../components/BudgetProgressPanel';
import { FinanceIcon } from '../components/FinanceIcon';
import { allAccounts } from '../lib/domain';
import { money } from '../lib/format';
import { categoryMomentum, operationalReportSnapshot, primaryAccountSeries, reportExpenseCounterparties, reportFlowSeries, reportInsightModel, reportLoanBurden } from '../lib/reports';
import { SAVING_SOURCE_LABELS } from '../lib/savings';
import { accountDisplayName } from '../lib/ui';
import type { FinanceData } from '../types';
import './ReportsPage.css';

const change=(current:number,previous:number)=>previous===0?(current===0?0:null):((current-previous)/Math.abs(previous))*100;
const changeLabel=(value:number|null)=>value===null?'Νέα βάση':`${value>=0?'+':''}${Math.round(value)}%`;
const percent=(value:number|null,digits=0)=>value===null?'—':`${(value*100).toFixed(digits)}%`;
const directionText=(value:number)=>value>=0?'πάνω':'κάτω';
const comparisonTone=(label:string,value:number|null)=>value===null?'neutral':((label==='Έξοδα'&&value>0)||(label!=='Έξοδα'&&value<0))?'negative':'positive';
const CATEGORY_COLORS=['#2f6fed','#ff5068','#7a5af8','#ffb648','#27bfa5','#f59e0b','#8b95ad'];
const ACCOUNT_COLORS=['#2f6fed','#14a77f','#7a5af8','#f59e0b'];

export function ReportsPage({data,month}:{data:FinanceData;month:string}){
 const snapshot=operationalReportSnapshot(data,month);
 const insights=reportInsightModel(data,month);
 const series=reportFlowSeries(data,month,6);
 const momentum=categoryMomentum(data,month,100);
 const counterparties=reportExpenseCounterparties(data,month,5);
 const loanBurden=reportLoanBurden(data);
 const accountIds=allAccounts(data).filter(account=>account.kind!=='credit').slice(0,4).map(account=>account.id);
 const accountSeries=primaryAccountSeries(data,month,accountIds);
 const [accountsVisible,setAccountsVisible]=useState(false);
 const budget=snapshot.budget;
 const budgetValue=budget>0?snapshot.budgetRemaining:0;
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

 return <div className="page-stack reports-dashboard reports-composite">
  <section className="page-heading report-heading" id="report-overview"><div><span className="eyebrow">ΑΝΑΦΟΡΕΣ · {monthLabel}</span><h1>Αναφορές · Η οικονομική εικόνα του μήνα</h1><p>Ενιαία εικόνα με ροή, δαπάνες, υποχρεώσεις, λογαριασμούς και συγκρίσεις. Οι ίδιες αναλύσεις εμφανίζονται μία φορά, στην ενότητα όπου είναι πιο χρήσιμες.</p></div><div className="report-period-chip" aria-label={`Επιλεγμένη περίοδος ${monthLabel}`}><span>Περίοδος</span><b>{monthLabel}</b></div></section>

  <nav className="report-section-nav" aria-label="Ενότητες αναφορών">
   <a href="#report-overview">Επισκόπηση</a>
   <a href="#report-flow">Ροή</a>
   <a href="#report-obligations">Υποχρεώσεις</a>
   <a href="#report-expenses">Έξοδα</a>
   <a href="#report-comparisons">Συγκρίσεις</a>
   <a href="#report-accounts">Λογαριασμοί</a>
  </nav>

  <section className="report-executive neo-raised" aria-label="Κύριοι δείκτες περιόδου">
   <article className="report-headline-card positive"><span>Καθαρή ροή</span><b><AnimatedAmount value={netFlow}/></b><small>{changeLabel(change(netFlow,previousNetFlow))} από τον προηγούμενο μήνα</small></article>
   <article className="report-headline-card"><span>Ρυθμός αποταμίευσης</span><b>{percent(insights.savingsRate,1)}</b><small>Στόχος {percent(savingsTarget,0)} · {savingsTargetProgress===null?'χωρίς συγκρίσιμη βάση':`${Math.round(savingsTargetProgress*100)}% προόδου`}</small></article>
   <article className="report-headline-card positive"><span>Έσοδα</span><b><AnimatedAmount value={snapshot.flow.income}/></b><small>{changeLabel(change(snapshot.flow.income,snapshot.previous.income))} από τον προηγούμενο μήνα</small></article>
   <article className="report-headline-card negative"><span>Έξοδα</span><b><AnimatedAmount value={snapshot.flow.expense}/></b><small>{changeLabel(change(snapshot.flow.expense,snapshot.previous.expense))} από τον προηγούμενο μήνα</small></article>
  </section>

  <section className="report-kpis useful-report-kpis report-kpis-v2" aria-label="Δευτερεύοντες δείκτες">
   <article className="neo-raised"><span>Γενικό budget</span><b>{budget>0?<AnimatedAmount value={budget}/>:<>Δεν έχει οριστεί</>}</b><small>{budget>0?(budgetValue>=0?`${money.format(budgetValue)} διαθέσιμα`:`${money.format(Math.abs(budgetValue))} υπέρβαση`):'Ορίζεται από τις Ρυθμίσεις'}</small></article>
   <article className="neo-raised"><span>Προς είσπραξη</span><b><AnimatedAmount value={snapshot.receivables}/></b><small>Καταγεγραμμένες απαιτήσεις</small></article>
   <article className="neo-raised"><span>Πάγια / μήνα</span><b><AnimatedAmount value={snapshot.recurring}/></b><small>{insights.recurringBurden===null?'Χωρίς βάση εσόδων':`${percent(insights.recurringBurden)} των εσόδων`}</small></article>
   <article className="neo-raised"><span>Πιστωτικές · οφειλή</span><b><AnimatedAmount value={snapshot.creditDebt}/></b><small>{creditPercent===null?'Χωρίς συνολικό όριο':`${Math.round(creditPercent*100)}% του συνολικού ορίου`}</small></article>
  </section>

  <BudgetProgressPanel data={data} month={month}/>

  <section className="report-primary-grid" id="report-flow">
   <article className="panel neo-raised report-flow-panel"><div className="panel-head"><div><span>6μηνη οικονομική ροή</span><small>Έσοδα, έξοδα και αποταμίευση των τελευταίων 6 μηνών. Το γράφημα δείχνει κατεύθυνση και μέγεθος, όχι αιτιότητα.</small></div><div className="report-flow-legend" aria-hidden="true"><span><i className="income"/>Έσοδα</span><span><i className="expense"/>Έξοδα</span><span><i className="saving"/>Αποταμίευση</span></div></div><div className="report-chart-frame" aria-hidden="true"><ResponsiveContainer width="100%" height={340}><ComposedChart data={series} margin={{left:4,right:12,top:8,bottom:0}}><CartesianGrid stroke="#dbe4f0" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={{fontSize:11,fill:'#52627d'}}/><YAxis tick={{fontSize:10,fill:'#52627d'}}/><Tooltip formatter={(v)=>money.format(Number(v))}/><Bar dataKey="income" name="Έσοδα" fill="#20b892" radius={[6,6,0,0]}/><Bar dataKey="expense" name="Έξοδα" fill="#ff5068" radius={[6,6,0,0]}/><Line type="monotone" dataKey="saving" name="Αποταμίευση" stroke="#2f6fed" strokeWidth={3} dot={{r:3.5}}/></ComposedChart></ResponsiveContainer></div><details className="chart-alt"><summary>Ποσά 6 μηνών σε κείμενο</summary><ul className="chart-alt-list report-flow-alt">{series.map(row=><li key={row.month}><span>{row.label}</span><b>Έσοδα {money.format(row.income)} · Έξοδα {money.format(row.expense)} · Αποταμίευση {money.format(row.saving)}</b></li>)}</ul></details></article>
   <aside className="panel neo-raised report-insights report-insights-rail" aria-labelledby="report-insights-title"><div className="panel-head"><div><span id="report-insights-title">Σημαντικά insights</span><small>Αριθμητικές παρατηρήσεις με σαφή βάση σύγκρισης.</small></div></div><div className="report-insight-grid">{callouts.map((item,index)=><article key={`${item.title}-${index}`} className={`report-insight ${item.tone}`}>{item.tone==='negative'?<TriangleAlert aria-hidden="true"/>:item.tone==='positive'?<CircleCheck aria-hidden="true"/>:<ListChecks aria-hidden="true"/>}<div><b>{item.title}</b><small>{item.detail}</small></div></article>)}</div></aside>
  </section>

  <section className="panel neo-raised report-pressure" id="report-obligations"><div className="panel-head"><div><span>Πίεση από υποχρεώσεις</span><small>Πάγια, δόσεις, πιστωτικές και απαιτήσεις σε μία ενότητα, χωρίς διπλομέτρηση ως έξοδα.</small></div></div><div className="report-operations-grid report-pressure-grid">
   <article className="report-pressure-card"><div className="report-pressure-icon"><Landmark/></div><div><span>Πάγια & δόσεις / μήνα</span><b><AnimatedAmount value={combinedMonthlyBurden}/></b><small>Πάγια {money.format(snapshot.recurring)} · Δόσεις {money.format(loanBurden.total)}{loanBurden.count?` · ${loanBurden.count} δάνεια`:''}</small></div>{combinedBurdenRate!==null?<div className="report-meter" role="progressbar" aria-label="Ποσοστό παγίων και δόσεων επί των εσόδων" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.round(combinedBurdenRate*100))} aria-valuetext={`${Math.round(combinedBurdenRate*100)}%`}><i style={{width:`${Math.min(100,combinedBurdenRate*100)}%`}}/></div>:null}</article>
   <article className={`report-pressure-card ${creditPercent!==null&&creditPercent>1?'over-limit':''}`}><div className="report-pressure-icon"><CreditCard/></div><div><span>Χρήση πιστωτικών</span><b>{creditPercent!==null?`${Math.round(creditPercent*100)}%`:'Χωρίς όριο'}</b><small><AnimatedAmount value={snapshot.creditDebt}/> οφειλή · <AnimatedAmount value={snapshot.creditAvailable}/> διαθέσιμο</small></div>{creditPercent!==null?<div className="report-meter" role="progressbar" aria-label="Συνολική χρήση πιστωτικών" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.round(creditPercent*100))} aria-valuetext={`${Math.round(creditPercent*100)}% χρήση πιστωτικών${creditPercent>1?' · πάνω από το συνολικό όριο':''}`}><i style={{width:`${Math.min(100,creditPercent*100)}%`}}/></div>:null}</article>
   <article className="report-pressure-card"><div className="report-pressure-icon"><HandCoins/></div><div><span>Προς είσπραξη</span><b><AnimatedAmount value={snapshot.receivables}/></b><small>Καταγεγραμμένες απαιτήσεις προς άλλα πρόσωπα</small></div></article>
  </div>{snapshot.creditCardRows.length?<details className="credit-report-drilldown"><summary>Ανάλυση πιστωτικών καρτών</summary><div className="credit-report-list">{snapshot.creditCardRows.map(card=><div key={card.id}><span><b>{card.nickname}</b><small>{card.active?'Ενεργή':'Αρχειοθετημένη'}</small></span><span>Οφειλή <b>{money.format(card.debt)}</b></span><span>{card.limit>0?`Χρήση ${Math.round(card.usage*100)}% · Όριο ${money.format(card.limit)}`:'Χωρίς ενεργό όριο'}</span></div>)}</div></details>:<div className="empty-inline">Δεν υπάρχουν πιστωτικές κάρτες για ανάλυση.</div>}</section>

  <section className="report-expense-grid" id="report-expenses">
   <article className="panel neo-raised report-category-panel"><div className="panel-head"><div><span>Κατανομή & μεταβολή εξόδων</span><small>Η κατανομή εμφανίζεται μία φορά και η ίδια λίστα προσθέτει τη μεταβολή έναντι του προηγούμενου μήνα.</small></div></div>{momentum.length?<div className="report-category-layout"><div className="report-category-chart" aria-hidden="true"><ResponsiveContainer width="100%" height={320}><PieChart><Pie data={categoryDonut} dataKey="value" nameKey="name" innerRadius={72} outerRadius={116} paddingAngle={1.5}>{categoryDonut.map((row,index)=><Cell key={row.name} fill={CATEGORY_COLORS[index%CATEGORY_COLORS.length]}/>)}</Pie><Tooltip formatter={(v)=>money.format(Number(v))}/></PieChart></ResponsiveContainer><div className="report-donut-total"><b>{money.format(categoryTotal)}</b><span>Σύνολο εξόδων</span></div></div><div className="category-momentum-list report-category-list">{momentum.slice(0,10).map((row,index)=>{const [category,subcategory]=row.name.split(' › ');const share=categoryTotal>0?row.value/categoryTotal:null;return <div key={row.name}><span className="semantic-list-title"><i className="report-category-swatch" style={{background:CATEGORY_COLORS[index%CATEGORY_COLORS.length]}}/><FinanceIcon settings={data.state.settings} kind="expense" category={category} subcategory={subcategory} size={14}/>{row.name}</span><b>{money.format(row.value)} <em>{percent(share,1)}</em></b><small>{row.change===null?'Νέα βάση':`${row.change>=0?'+':''}${Math.round(row.change*100)}% από τον προηγούμενο μήνα`}</small></div>})}</div></div>:<div className="empty-state">Δεν υπάρχουν έξοδα για την επιλεγμένη περίοδο.</div>}</article>

   <article className="panel neo-raised report-counterparties"><div className="panel-head"><div><span>Top 5 έμποροι / περιγραφές</span><small>Οι μεγαλύτερες καταγεγραμμένες χρεώσεις της περιόδου, ομαδοποιημένες ανά περιγραφή και κατηγορία.</small></div></div>{counterparties.length?<div className="report-counterparty-list">{counterparties.map((row,index)=>{const [category,subcategory]=row.category.split(' › ');return <div key={`${row.title}-${row.category}`}><span className="report-counterparty-rank">{index+1}</span><FinanceIcon settings={data.state.settings} kind="expense" category={category} subcategory={subcategory} size={18}/><span><b>{row.title}</b><small>{row.category} · {row.count===1?'1 κίνηση':`${row.count} κινήσεις`}</small></span><strong>{money.format(row.amount)}<small>{percent(row.share,1)}</small></strong></div>})}</div>:<div className="empty-state">Δεν υπάρχουν καταγεγραμμένες χρεώσεις για την επιλεγμένη περίοδο.</div>}</article>
  </section>

  <section className="panel neo-raised report-comparison-panel" id="report-comparisons"><div className="panel-head"><div><span>Σύγκριση μηνών</span><small>{monthLabel} σε σχέση με τον αμέσως προηγούμενο μήνα. Τα ποσοστά δεν ερμηνεύονται ως αιτιότητα.</small></div></div><div className="report-comparison-table" role="table" aria-label="Σύγκριση τρέχοντος και προηγούμενου μήνα"><div className="report-comparison-head" role="row"><span role="columnheader">Κατηγορία</span><span role="columnheader">Τρέχων μήνας</span><span role="columnheader">Προηγούμενος</span><span role="columnheader">Μεταβολή</span></div>{comparisonRows.map(row=>{const tone=comparisonTone(row.label==='Καθαρή ροή'?'Έσοδα':row.label,row.value);const delta=row.kind==='rate'?(row.value===null?'—':`${row.value>=0?'+':''}${(row.value*100).toFixed(1)} π.μ.`):changeLabel(row.value);return <div className="report-comparison-row" role="row" key={row.label}><b role="cell">{row.label}</b><span role="cell">{comparisonValue(row.current,row.kind)}</span><span role="cell">{comparisonValue(row.previous,row.kind)}</span><span role="cell" className={tone}>{delta}</span></div>})}</div></section>

  <section className="report-secondary-grid" id="report-accounts">
   <article className="panel neo-raised report-account-history"><div className="panel-head"><div><span>Εξέλιξη βασικών λογαριασμών</span><small>Υπόλοιπα έως τεσσάρων διαθέσιμων μη πιστωτικών λογαριασμών στο τέλος κάθε μήνα.</small></div><button type="button" className="text-button report-eye" aria-pressed={accountsVisible} onClick={()=>setAccountsVisible(value=>!value)}>{accountsVisible?<EyeOff size={15}/>:<Eye size={15}/>} {accountsVisible?'Απόκρυψη':'Εμφάνιση'}</button></div>{accountsVisible&&accountIds.length?<><div className="report-account-legend">{accountIds.map((id,index)=><span key={id}><i style={{background:ACCOUNT_COLORS[index%ACCOUNT_COLORS.length]}}/>{accountDisplayName(data,id)}</span>)}</div><div aria-hidden="true"><ResponsiveContainer width="100%" height={285}><ComposedChart data={accountSeries}><CartesianGrid stroke="#dbe4f0" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={{fontSize:10,fill:'#52627d'}}/><YAxis tick={{fontSize:10,fill:'#52627d'}}/><Tooltip formatter={(v)=>money.format(Number(v))}/>{accountIds.map((id,index)=><Line key={id} type="monotone" dataKey={id} name={accountDisplayName(data,id)} stroke={ACCOUNT_COLORS[index%ACCOUNT_COLORS.length]} strokeWidth={2.4} dot={{r:2.5}}/>)}</ComposedChart></ResponsiveContainer></div><div className="account-report-list">{accountSeries.map(row=><div key={String(row.month)}><span>{String(row.label)}</span>{accountIds.map(id=><b key={id}>{accountDisplayName(data,id)}: {money.format(Number(row[id]||0))}</b>)}</div>)}</div></>:accountsVisible?<div className="empty-state">Δεν υπάρχουν διαθέσιμοι λογαριασμοί για ιστορική ανάλυση.</div>:<div className="private-report-placeholder"><Eye/><span>Τα υπόλοιπα είναι κρυμμένα. Πάτησε «Εμφάνιση» για να δεις την εξέλιξή τους.</span></div>}</article>
   <article className="panel neo-raised savings-report-breakdown report-savings-sources"><div className="panel-head"><div><span>Πηγές αποταμίευσης</span><small>Πώς σχηματίστηκε η αποταμίευση της περιόδου.</small></div><PiggyBank aria-hidden="true"/></div>{Object.entries(snapshot.savings.bySource).map(([source,value])=><div key={source}><span>{SAVING_SOURCE_LABELS[source as keyof typeof SAVING_SOURCE_LABELS]}</span><b><AnimatedAmount value={value}/></b></div>)}<div className="savings-total-row"><span><WalletCards size={16} aria-hidden="true"/> Σύνολο</span><b><AnimatedAmount value={snapshot.savings.total}/></b></div></article>
  </section>

  <section className="report-footnote neo-raised" aria-label="Σημείωση αναφορών"><CircleCheck aria-hidden="true"/><div><b>Σημείωση</b><span>Οι αναφορές βασίζονται στα καταχωρημένα δεδομένα του MyFinHub και ενημερώνονται από τις canonical οικονομικές ροές. Μεταφορές, αποπληρωμές πιστωτικών και άλλες ουδέτερες κινήσεις δεν μετατρέπονται σε διπλά έξοδα.</span></div></section>
 </div>
}
