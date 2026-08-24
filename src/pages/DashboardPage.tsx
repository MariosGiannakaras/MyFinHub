import { motion, useReducedMotion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, BellRing, CalendarClock, CalendarRange, Eye, EyeOff, PiggyBank, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { AnimatedAmount } from '../components/AnimatedAmount';
import { BankBrandMark } from '../components/BankBrandMark';
import { BudgetProgressPanel } from '../components/BudgetProgressPanel';
import { FinanceIcon } from '../components/FinanceIcon';
import { MetricCard } from '../components/MetricCard';
import type { QuickPrefill } from '../components/QuickAdd';
import { visibleAttentionItems } from '../lib/attention';
import { allAccounts } from '../lib/domain';
import { selectAccountBalances, selectCategoryTotals, selectDailyExpenseSeries, selectFrequentDescriptions, selectMonthlyFlow } from '../lib/selectors';
import { compactMoney, money, shortDate } from '../lib/format';
import { pendingScheduled, scheduledLifecycle } from '../lib/scheduled';
import { accountDisplayName, effectiveRecurringItems } from '../lib/ui';
import type { FinanceData } from '../types';

const chartColors=['#2f6fed','#25b9d7','#55c2a3','#f3b43f','#845ef7','#ef6675','#174ea6','#89a9ff'];
const PRIMARY_ACCOUNTS=['cash','piraeus-payroll','piraeus-savings'];
const primaryRole=(kind:string)=>kind==='cash'?'Μετρητά':kind==='savings'?'Αποταμιευτικός':'Μισθοδοσίας';

export function DashboardPage({ data, month, asOf, motionMode='system', onQuickAdd, onAccountQuickAdd, onTransactions, onPlanning, onAttention, onReports }: {data:FinanceData;month:string;asOf:string;motionMode?:'system'|'reduced'|'full';onQuickAdd:(prefill?:QuickPrefill)=>void;onAccountQuickAdd:(accountId:string,kind:string)=>void;onTransactions:()=>void;onPlanning:()=>void;onAttention:()=>void;onReports:()=>void}) {
  const systemReduced=useReducedMotion();
  const reduce=Boolean(systemReduced)||motionMode==='reduced';
  const [balancesVisible,setBalancesVisible]=useState(false);
  const flow=selectMonthlyFlow(data,month);
  const balances=selectAccountBalances(data,asOf);
  const accounts=allAccounts(data).filter(account=>account.kind!=='credit');
  const primary=PRIMARY_ACCOUNTS.map(id=>accounts.find(account=>account.id===id)).filter(Boolean) as typeof accounts;
  const remaining=accounts.filter(account=>!PRIMARY_ACCOUNTS.includes(account.id));
  const categories=selectCategoryTotals(data,month).slice(0,8);
  const daily=selectDailyExpenseSeries(data,month);
  const recurring=effectiveRecurringItems(data).slice(0,4);
  const scheduled=pendingScheduled(data).slice(0,3);
  const dueScheduled=scheduled.filter(item=>scheduledLifecycle(item,asOf)==='due').length;
  const attention=visibleAttentionItems(data,asOf).slice(0,3);
  const dangerAttention=attention.filter(item=>item.severity==='danger').length;
  const saveRate=flow.income>0?flow.saving/flow.income:0;
  const budget=data.state.settings.monthlyBudget ?? 1200;
  const savingsTarget=data.state.settings.savingsTargetRate ?? .2;
  const frequent=selectFrequentDescriptions(data,'expense',5);
  const budgetHint=budget>0?`${Math.round((flow.expense/budget)*100)}% του προϋπολογισμού`:'Δεν έχει οριστεί προϋπολογισμός';

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">ΕΠΙΣΚΟΠΗΣΗ</span><h1>Οι λογαριασμοί μου</h1><p>Πρώτα τα πραγματικά διαθέσιμα σε κάθε λογαριασμό. Τα ποσά είναι κρυμμένα μέχρι να επιλέξεις εμφάνιση.</p></div><div className="heading-actions"><button type="button" className="secondary privacy-toggle" aria-pressed={balancesVisible} onClick={()=>setBalancesVisible(value=>!value)}>{balancesVisible?<EyeOff size={17}/>:<Eye size={17}/>} {balancesVisible?'Απόκρυψη ποσών':'Εμφάνιση ποσών'}</button></div></section>

    <section className="primary-balance-grid" aria-label="Κύριοι λογαριασμοί" data-dashboard-section="primary-accounts">{primary.map(account=><article className="primary-balance-card neo-raised" key={account.id} data-account-id={account.id}><div className="primary-balance-head"><BankBrandMark id={account.id} name={accountDisplayName(data,account.id)}/><div><small>{accountDisplayName(data,account.id)}</small><span>{primaryRole(account.kind)}</span></div></div><AnimatedAmount value={balances[account.id]||0} hidden={!balancesVisible} className={(balances[account.id]||0)<0?'negative':''}/><button type="button" className="text-button account-context-action" data-account-quick-entry={account.id} onClick={()=>onAccountQuickAdd(account.id,account.kind)}>{account.kind==='savings'?'Μεταφορά':'Νέα κίνηση'}</button></article>)}</section>

    {remaining.length?<section className="panel neo-raised account-balance-panel" data-dashboard-section="other-balances"><div className="section-title"><div><span>Υπόλοιποι λογαριασμοί</span><b>Υπόλοιπα έως {asOf.split('-').reverse().join('/')}</b></div><button type="button" className="text-button" onClick={onTransactions}>Προβολή κινήσεων</button></div><div className="compact-account-grid">{remaining.map(account=><motion.div className="compact-account-row" key={account.id} whileHover={reduce?undefined:{y:-1}}><BankBrandMark id={account.id} name={accountDisplayName(data,account.id)}/><div><small>{accountDisplayName(data,account.id)}</small><AnimatedAmount value={balances[account.id]||0} hidden={!balancesVisible} className={(balances[account.id]||0)<0?'negative':''}/></div><button type="button" className="text-button account-context-action" data-account-quick-entry={account.id} onClick={()=>onAccountQuickAdd(account.id,account.kind)} aria-label={`Νέα κίνηση για ${accountDisplayName(data,account.id)}`}>Νέα</button></motion.div>)}</div></section>:null}

    <section className="lower-grid dashboard-pending-grid" data-dashboard-section="pending"><article className="panel neo-raised"><div className="panel-head"><div><span>Εκκρεμή πάγια</span><small>Ενεργές επαναλαμβανόμενες υποχρεώσεις</small></div><CalendarClock size={17}/></div>{recurring.length?<div className="recurring-mini">{recurring.map(r=><div key={r.id}><span className="semantic-list-title"><FinanceIcon kind="expense" note={r.name} category={r.category} size={14}/>{r.name}</span><b>{money.format(r.amount)}</b><small>{r.day?`${r.day} του μήνα`:'χωρίς ημερομηνία'}</small></div>)}</div>:<div className="empty-inline">Δεν υπάρχουν ενεργά πάγια.</div>}</article><article className="panel neo-raised dashboard-scheduled-card"><div className="panel-head"><div><span>Προγραμματισμένα one-off</span><small>{dueScheduled?`${dueScheduled} εκκρεμούν τώρα`:'Δεν υπάρχει due scheduled κίνηση'}</small></div><CalendarRange size={17}/></div>{scheduled.length?<div className="recurring-mini">{scheduled.map(item=><div key={item.id}><span className="semantic-list-title"><FinanceIcon kind={item.kind} note={item.note} category={item.category} size={14}/>{item.note}</span><b>{money.format(item.amount)}</b><small>{scheduledLifecycle(item,asOf)==='due'?'Εκκρεμεί τώρα':shortDate(item.dueDate)}</small></div>)}</div>:<div className="empty-inline">Δεν υπάρχουν προγραμματισμένες one-off κινήσεις.</div>}<button type="button" className="wide-action" onClick={onPlanning}>Άνοιγμα προγραμματισμού</button></article><article className="panel neo-raised dashboard-attention-card"><div className="panel-head"><div><span>Χρειάζεται προσοχή</span><small>{dangerAttention?`${dangerAttention} επείγοντα στα πρώτα στοιχεία`:'Οι σημαντικότερες επόμενες ενέργειες'}</small></div><BellRing size={17}/></div>{attention.length?<div className="attention-dashboard-list">{attention.map(item=><div className={`attention-dashboard-item ${item.severity}`} key={item.id}><i aria-hidden="true"/><div><b>{item.title}</b><small>{item.reason}</small></div><strong>{item.dueDate?shortDate(item.dueDate):item.severity==='danger'?'Τώρα':'—'}</strong></div>)}</div>:<div className="empty-inline">Δεν υπάρχει κάτι που χρειάζεται άμεση ενέργεια.</div>}<button type="button" className="wide-action" onClick={onAttention}>Άνοιγμα όλων των ενεργειών</button></article></section>

    <section className="dashboard-grid"><article className="panel neo-raised quick-panel" data-dashboard-section="quick-entry"><div className="panel-head"><div><span>Συχνές κινήσεις</span><small>Συντομεύσεις με προ-συμπληρωμένα στοιχεία</small></div><Sparkles size={18}/></div><div className="frequent-grid">{frequent.map(f=><button type="button" key={f.label} data-prefilled-quick-entry={f.label} onClick={()=>onQuickAdd({note:f.label,amount:f.lastAmount,category:f.category,accountId:f.accountId})}><span className="frequent-icon"><FinanceIcon kind="expense" note={f.label} category={f.category} size={15}/></span><b>{f.label}</b><span>{f.count} φορές</span><strong>{money.format(f.lastAmount)}</strong></button>)}</div></article>
      <article className="panel neo-raised chart-panel"><div className="panel-head"><div><span>Έξοδα ανά κατηγορία</span><small>{money.format(flow.expense)} αυτόν τον μήνα</small></div></div>{categories.length?<><div className="pie-layout"><div className="chart-wrap" aria-hidden="true"><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={categories} dataKey="value" nameKey="name" innerRadius={58} outerRadius={85} paddingAngle={2} isAnimationActive={!reduce}>{categories.map((_,i)=><Cell key={i} fill={chartColors[i%chartColors.length]}/>)}</Pie><Tooltip formatter={(v)=>money.format(Number(v))}/></PieChart></ResponsiveContainer><div className="pie-center"><b>{compactMoney.format(flow.expense)}</b><span>σύνολο</span></div></div><div className="legend">{categories.map((c,i)=><div key={c.name}><i style={{background:chartColors[i%chartColors.length]}} aria-hidden="true"/><span className="legend-category"><FinanceIcon kind="expense" category={c.name} size={13}/>{c.name}</span><b>{money.format(c.value)}</b></div>)}</div></div></>:<div className="empty-state">Δεν υπάρχουν έξοδα για την επιλεγμένη περίοδο.</div>}</article>
      <article className="panel neo-raised chart-panel"><div className="panel-head"><div><span>Εξέλιξη εξόδων</span><small>Ημερήσια ροή</small></div></div>{daily.length?<><div aria-hidden="true"><ResponsiveContainer width="100%" height={245}><AreaChart data={daily}><defs><linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef6675" stopOpacity=".3"/><stop offset="100%" stopColor="#ef6675" stopOpacity="0"/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#dbe4f0" vertical={false}/><XAxis dataKey="date" tick={{fontSize:10,fill:'#52627d'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:10,fill:'#52627d'}} axisLine={false} tickLine={false}/><Tooltip formatter={(v)=>money.format(Number(v))}/><Area type="monotone" dataKey="value" stroke="#c8334c" strokeWidth={2.4} fill="url(#expenseFill)" animationDuration={reduce?0:700} isAnimationActive={!reduce}/></AreaChart></ResponsiveContainer></div><details className="chart-alt"><summary>Ημερήσια ποσά σε κείμενο</summary><ul className="chart-alt-list">{daily.map(d=><li key={d.date}><span>Ημέρα {d.date}</span><b>{money.format(d.value)}</b></li>)}</ul></details></>:<div className="empty-state">Δεν υπάρχουν ημερήσια έξοδα για την επιλεγμένη περίοδο.</div>}</article></section>

    <section className="metric-grid flow-metric-grid" data-dashboard-section="rest"><MetricCard reduceMotion={reduce} label={`Έσοδα ${month.slice(5)}/${month.slice(0,4)}`} value={money.format(flow.income)} hint="Πραγματικά έσοδα" icon={<ArrowUpRight size={17}/>} tone="green"/><MetricCard reduceMotion={reduce} label={`Έξοδα ${month.slice(5)}/${month.slice(0,4)}`} value={money.format(flow.expense)} hint={budgetHint} icon={<ArrowDownRight size={17}/>} tone="red" progress={budget>0?flow.expense/budget:undefined}/><MetricCard reduceMotion={reduce} label="Αποταμίευση" value={money.format(flow.saving)} hint={`${Math.round(saveRate*100)}% των εσόδων`} icon={<PiggyBank size={17}/>} tone="cyan" progress={saveRate}/></section>

    <BudgetProgressPanel data={data} month={month} compact onOpen={onReports}/>

    <article className="panel neo-raised"><div className="panel-head"><div><span>Αποταμίευση & στόχος</span><small>Η μηνιαία εικόνα με βάση τα πραγματικά έσοδα</small></div><PiggyBank size={17}/></div><div className="insight-list"><div><span className="insight-icon saving"><PiggyBank/></span><div><b>Ρυθμός αποταμίευσης {Math.round(saveRate*100)}%</b><small>Στόχος {Math.round(savingsTarget*100)}%</small></div><strong>{savingsTarget===0?'Χωρίς στόχο':saveRate>=savingsTarget?'Εντός στόχου':'Κάτω από στόχο'}</strong></div></div></article>
  </div>;
}
