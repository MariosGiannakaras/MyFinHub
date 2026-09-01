import { ArrowRight, BanknoteArrowDown, PiggyBank, Repeat2, Sparkles, Wallet, X } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { AnimatedAmount } from '../components/AnimatedAmount';
import { AppDateInput } from '../components/AppDateInput';
import { AppSelectInput } from '../components/AppSelectInput';
import { FormError } from '../components/FormError';
import { MoneyInput } from '../components/MoneyInput';
import type { QuickActionContext } from '../components/ContextualQuickAdd';
import { useModalFocus } from '../hooks/useModalFocus';
import { accountBalances, allAccounts, createEvent } from '../lib/domain';
import { money, shortDate } from '../lib/format';
import { SAVING_SOURCE_LABELS, operationalMonthlyFlow, savingsBreakdown, savingsHistoryPresentation } from '../lib/savings';
import { accountDisplayName, ratioPercent } from '../lib/ui';
import { userErrorMessage } from '../lib/userMessage';
import type { FinanceData, FinanceEvent, SavingSource } from '../types';

const ACTIONS:Array<{source:SavingSource;title:string;description:string;icon:typeof PiggyBank}>=[
  {source:'pay_and_save',title:'Pay & Save',description:'Στρογγυλοποίηση αγοράς της Πειραιώς που μεταφέρεται στην αποταμίευση.',icon:Sparkles},
  {source:'manual_transfer',title:'Μεταφορά στην άκρη',description:'Χειροκίνητη μεταφορά ποσού από λογαριασμό προς τον αποταμιευτικό.',icon:Repeat2},
  {source:'cash_offset',title:'Σύνθετη αποταμίευση',description:'Η συμφωνημένη κίνηση μετρητών και ψηφιακής μεταφοράς ως μία ενέργεια, χωρίς διπλομέτρηση.',icon:BanknoteArrowDown},
];

const euroCompact=new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR',maximumFractionDigits:0});

type SavingsQuickContext=Omit<Extract<QuickActionContext,{mode:'savings'}>,'token'>;

export function SavingsPage({data,month,asOf,onCreate,onQuickAdd}:{data:FinanceData;month:string;asOf:string;onCreate:(event:FinanceEvent)=>void;onQuickAdd?:(context:SavingsQuickContext)=>void}){
  const balances=accountBalances(data,asOf);
  const flow=operationalMonthlyFlow(data,month);
  const breakdown=savingsBreakdown(data,month);
  const target=data.state.settings.savingsTargetRate??.2;
  const rate=flow.income?flow.saving/flow.income:0;
  const progress=ratioPercent(rate,target);
  const accounts=allAccounts(data).filter(account=>account.kind!=='credit');
  const savingsAccounts=accounts.filter(account=>account.kind==='savings');
  const sourceAccounts=accounts.filter(account=>account.kind!=='savings');
  const defaultFrom=sourceAccounts.some(account=>account.id==='piraeus-payroll')?'piraeus-payroll':sourceAccounts[0]?.id||'';
  const defaultTo=savingsAccounts.some(account=>account.id==='piraeus-savings')?'piraeus-savings':savingsAccounts[0]?.id||'';
  const payrollName=accountDisplayName(data,'piraeus-payroll');
  const savingsName=accountDisplayName(data,'piraeus-savings');
  const [year,monthNumber]=month.split('-').map(Number);
  const daysInMonth=new Date(Date.UTC(year,monthNumber,0)).getUTCDate();
  const rawTrendDays=[1,8,15,22,daysInMonth];
  const trendDays=rawTrendDays.filter((day,index)=>rawTrendDays.indexOf(day)===index).sort((a,b)=>a-b);
  const targetTotal=target>0&&flow.income>0?flow.income*target:0;
  const actualSeries=trendDays.map(day=>breakdown.rows.reduce((sum,row)=>sum+(Number(row.date.slice(8,10))<=day?row.amount:0),0));
  const targetSeries=trendDays.map(day=>targetTotal*(day/daysInMonth));
  const trendMax=Math.max(1,targetTotal,flow.saving,...actualSeries);
  const trendPoint=(value:number,index:number)=>{
    const x=28+(trendDays.length===1?0:(index/(trendDays.length-1))*414);
    const y=145-(value/trendMax)*112;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };
  const actualPoints=actualSeries.map(trendPoint).join(' ');
  const targetPoints=targetSeries.map(trendPoint).join(' ');
  const goalProgress=targetTotal>0?Math.min(100,(flow.saving/targetTotal)*100):0;
  const goalDeadline=new Intl.DateTimeFormat('el-GR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,monthNumber,0)));
  const recent=breakdown.rows[0]??null;
  const recentPresentation=recent?savingsHistoryPresentation(recent):null;
  const [open,setOpen]=useState(false);
  const [source,setSource]=useState<SavingSource>('manual_transfer');
  const [amount,setAmount]=useState('');
  const [date,setDate]=useState(asOf);
  const [from,setFrom]=useState(defaultFrom);
  const [to,setTo]=useState(defaultTo);
  const [note,setNote]=useState('');
  const [error,setError]=useState('');
  const modalRef=useModalFocus<HTMLElement>(open,'[data-autofocus="true"]',()=>setOpen(false));

  const start=(next:SavingSource)=>{
    if(next==='manual_transfer'&&onQuickAdd){
      onQuickAdd({mode:'savings',fromAccountId:defaultFrom,toAccountId:defaultTo,note:'',savingSource:'manual_transfer'});
      return;
    }
    setSource(next);
    setAmount('');
    setDate(asOf);
    setFrom(defaultFrom);
    setTo(defaultTo);
    setNote('');
    setError('');
    setOpen(true);
  };
  const close=()=>{setOpen(false);setError('')};
  const submit=()=>{
    const numeric=Number(amount.replace(',','.'));
    if(!Number.isFinite(numeric)||numeric<=0){setError('Έλεγξε το ποσό αποταμίευσης — πρέπει να είναι μεγαλύτερο από μηδέν.');return}
    if(!sourceAccounts.some(account=>account.id===from)){setError(sourceAccounts.length?'Ο λογαριασμός προέλευσης δεν είναι πλέον διαθέσιμος. Επίλεξε έναν από τους διαθέσιμους λογαριασμούς.':'Δεν υπάρχει διαθέσιμος λογαριασμός προέλευσης για αυτή την αποταμίευση.');return}
    if(!savingsAccounts.some(account=>account.id===to)){setError(savingsAccounts.length?'Ο λογαριασμός αποταμίευσης δεν είναι πλέον διαθέσιμος. Επίλεξε έναν από τους διαθέσιμους αποταμιευτικούς λογαριασμούς.':'Δεν υπάρχει διαθέσιμος αποταμιευτικός λογαριασμός. Πρόσθεσε ή ενεργοποίησε έναν και δοκίμασε ξανά.');return}
    if(from===to){setError('Επίλεξε διαφορετικό λογαριασμό προέλευσης και αποταμίευσης.');return}
    try{
      const event=createEvent({kind:'saving_cash_offset',date,amount:numeric,note:note.trim()||SAVING_SOURCE_LABELS[source],fromAccountId:from,toAccountId:to});
      event.savingSource=source;
      onCreate(event);
      close();
    }catch(e){setError(userErrorMessage(e,'Δεν μπορέσαμε να καταχωρίσουμε την αποταμίευση. Έλεγξε τα στοιχεία και δοκίμασε ξανά.'))}
  };

  const actionGrid=<div className="savings-action-grid">{ACTIONS.map(action=>{const Icon=action.icon;return <button type="button" className="panel neo-raised savings-action" key={action.source} aria-label={`Νέα αποταμίευση: ${action.title}`} onClick={()=>start(action.source)}><span className="savings-action-icon"><Icon aria-hidden="true"/></span><div><b>{action.title}</b><small>{action.description}</small></div><strong>Νέα κίνηση <ArrowRight aria-hidden="true"/></strong></button>})}</div>;

  return <div className="page-stack savings-page">
    <section className="page-heading"><div><span className="eyebrow">ΑΠΟΤΑΜΙΕΥΣΗ</span><h1>Αποταμίευση</h1><p>Διάλεξε πρώτα τι θέλεις να κάνεις Pay & Save, απλή μεταφορά ή σύνθετη αποταμίευση. Οι τρεις επιλογές μετρούν μία φορά στην πραγματική αποταμίευση.</p></div></section>

    <div className="savings-desktop-target">
      <section className="savings-action-section" aria-label="Πώς θέλεις να αποταμιεύσεις;">{actionGrid}</section>

      <section className="savings-hero neo-raised savings-dashboard">
        <article className="savings-month-card">
          <h2>Αυτός ο μήνας</h2>
          <strong className="savings-month-amount"><AnimatedAmount value={flow.saving}/></strong>
          <div className="savings-rate"><b>{Math.round(rate*100)}%</b><span>των εσόδων</span></div>
          <div className="savings-rate-target"><span>Στόχος {target>0?`${Math.round(target*100)}%`:'—'}</span><b>{target>0?`${Math.round(progress??0)}%`:'—'}</b></div>
          <div className="savings-target-track" role="progressbar" aria-label="Πρόοδος μηνιαίου στόχου αποταμίευσης" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress??0)}><span style={{width:`${Math.min(100,progress??0)}%`}}/></div>
          <div className="saving-route savings-route-target"><span><Wallet/> <small>Κύριος λογαριασμός</small><b>{payrollName}<em><AnimatedAmount value={balances['piraeus-payroll']||0}/></em></b></span><ArrowRight/><span><PiggyBank/> <small>Αποταμίευση</small><b>{savingsName}<em><AnimatedAmount value={balances['piraeus-savings']||0}/></em></b></span></div>
        </article>

        <article className="savings-trend-card">
          <h2>Εξέλιξη αποταμίευσης</h2>
          <div className="savings-chart-legend"><span><i className="actual"/>Πραγματική αποταμίευση</span><span><i className="goal"/>Στόχος ({Math.round(target*100)}% εσόδων)</span></div>
          <svg className="savings-trend-chart" viewBox="0 0 470 172" role="img" aria-label="Σωρευτική πραγματική αποταμίευση και ρυθμός προς τον μηνιαίο στόχο">
            {[0,.5,1].map(step=><g key={step}><line className="grid" x1="28" x2="442" y1={145-step*112} y2={145-step*112}/><text x="0" y={149-step*112}>{euroCompact.format(trendMax*step)}</text></g>)}
            <polygon className="actual-area" points={`28,145 ${actualPoints} 442,145`}/>
            <polyline className="goal-line" points={targetPoints}/>
            <polyline className="actual-line" points={actualPoints}/>
            {actualSeries.map((value,index)=><circle className="actual-dot" key={trendDays[index]} cx={Number(trendPoint(value,index).split(',')[0])} cy={Number(trendPoint(value,index).split(',')[1])} r={index===actualSeries.length-1?4:2.2}/>)}
            {trendDays.map((day,index)=><text className="x-label" key={day} x={Number(trendPoint(0,index).split(',')[0])} y="166" textAnchor={index===0?'start':index===trendDays.length-1?'end':'middle'}>{day} Αυγ</text>)}
          </svg>
        </article>

        <aside className="savings-insight-column">
          <section className="savings-sources-compact"><h2>Πηγές αποταμίευσης</h2><div className="savings-source-list">{ACTIONS.map(action=><div key={action.source}><span>{action.title}</span><b><AnimatedAmount value={breakdown.bySource[action.source]}/></b></div>)}</div></section>
          <section className="savings-recent-compact"><h2>Πρόσφατη αποταμίευση</h2>{recent&&recentPresentation?<div className="saving-history"><div><span>{shortDate(recent.date)}</span><div><b>{recentPresentation.primary}</b><small>{recentPresentation.sourceLabel}</small></div><strong>{money.format(recent.amount)}</strong></div></div>:<div className="empty-state">Δεν υπάρχουν κινήσεις αποταμίευσης για αυτή την περίοδο.</div>}</section>
        </aside>
      </section>

      <section className="panel neo-raised savings-goals" aria-labelledby="savings-goals-title">
        <div className="panel-head"><div><span id="savings-goals-title">Στόχοι αποταμίευσης</span><small>Ο πραγματικός μηνιαίος στόχος και η κατάσταση των προσωπικών στόχων ποσού.</small></div></div>
        <div className="savings-goals-head"><span>Στόχος</span><span>Πρόοδος</span><span>Αποταμιευμένα</span><span>Στόχος</span><span>Προθεσμία</span></div>
        <div className="savings-goal-row supported"><div><span className="savings-goal-icon"><PiggyBank/></span><span><b>Μηνιαίος ρυθμός αποταμίευσης</b><small>{target>0?`${Math.round(target*100)}% των πραγματικών εσόδων`:'Δεν έχει οριστεί ποσοστιαίος στόχος'}</small></span></div><div className="savings-goal-progress"><span><i style={{width:`${goalProgress}%`}}/></span><b>{Math.round(goalProgress)}%</b></div><strong>{money.format(flow.saving)}</strong><strong>{targetTotal>0?money.format(targetTotal):'—'}</strong><span>{goalDeadline}</span></div>
        <div className="savings-goal-row placeholder"><div><span className="savings-goal-icon muted"><PiggyBank/></span><span><b>Προσωπικός στόχος ποσού</b><small>Δεν έχει οριστεί — δεν υπάρχει ακόμη ξεχωριστή αποθήκευση στόχων ποσού.</small></span></div><div className="savings-goal-progress muted"><span/><b>—</b></div><strong>—</strong><strong>—</strong><span>—</span></div>
        <div className="savings-goal-row placeholder"><div><span className="savings-goal-icon muted"><PiggyBank/></span><span><b>Στόχος με προθεσμία</b><small>Δεν έχει οριστεί — δεν εμφανίζουμε τεχνητά ποσά ή ημερομηνίες.</small></span></div><div className="savings-goal-progress muted"><span/><b>—</b></div><strong>—</strong><strong>—</strong><span>—</span></div>
      </section>

      <div className="logic-note compact savings-target-note"><PiggyBank/><div><b>Σύνθετη αποταμίευση</b><span>Η ενέργεια καταγράφει τη συμφωνημένη ψηφιακή μεταφορά προς τον αποταμιευτικό χωρίς να προσθέτει ή να αφαιρεί δεύτερη φορά τα φυσικά μετρητά.</span></div></div>
    </div>

    <div className="savings-mobile-legacy">
      <section className="savings-action-section" aria-labelledby="savings-actions-title">
        <div className="section-title"><div><span id="savings-actions-title">Πώς θέλεις να αποταμιεύσεις;</span><b>Οι τρεις επιλογές χρησιμοποιούν το ίδιο canonical savings flow, με διαφορετική πηγή.</b></div></div>
        {actionGrid}
      </section>

      <section className="savings-hero neo-raised"><div className="savings-gauge"><div className="gauge-ring" role="progressbar" aria-label={target>0?'Πρόοδος προς τον στόχο αποταμίευσης':'Δεν έχει οριστεί στόχος αποταμίευσης'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress===null?0:Math.round(progress)} style={{'--progress':`${progress??0}%`} as CSSProperties}><div><b>{Math.round(rate*100)}%</b><span>{target>0?'των εσόδων':'χωρίς στόχο'}</span></div></div></div><div><span className="eyebrow">ΑΥΤΟΣ Ο ΜΗΝΑΣ</span><h2><AnimatedAmount value={flow.saving}/></h2><p>{target>0?`Στόχος: ${Math.round(target*100)}% των πραγματικών εσόδων.`:'Δεν έχει οριστεί ποσοστιαίος στόχος αποταμίευσης.'} Οι κινήσεις αποταμίευσης δεν μετρούν ως έξοδο.</p><div className="saving-route"><span><Wallet/> {payrollName} <b><AnimatedAmount value={balances['piraeus-payroll']||0}/></b></span><ArrowRight/><span><PiggyBank/> {savingsName} <b><AnimatedAmount value={balances['piraeus-savings']||0}/></b></span></div></div></section>

      <section className="savings-breakdown-grid">
        <article className="panel neo-raised"><div className="panel-head"><div><span>Πηγές αποταμίευσης</span><small>Σύνολο για την επιλεγμένη περίοδο</small></div></div><div className="savings-source-list">{ACTIONS.map(action=><div key={action.source}><span>{action.title}</span><b><AnimatedAmount value={breakdown.bySource[action.source]}/></b></div>)}</div></article>
        <article className="panel neo-raised"><div className="panel-head"><div><span>Πρόσφατη αποταμίευση</span><small>Το σχόλιό σου εμφανίζεται πρώτο· η πηγή παραμένει δευτερεύουσα πληροφορία.</small></div></div>{breakdown.rows.length?<div className="saving-history">{breakdown.rows.slice(0,12).map(row=>{const presentation=savingsHistoryPresentation(row);return <div key={`${row.origin}-${row.id}`}><span>{shortDate(row.date)}</span><div><b>{presentation.primary}</b><small>{presentation.hasUserNote?`Τύπος: ${presentation.sourceLabel}`:'Χωρίς ξεχωριστό σχόλιο'}</small></div><strong>{money.format(row.amount)}</strong></div>})}</div>:<div className="empty-state">Δεν υπάρχουν κινήσεις αποταμίευσης για αυτή την περίοδο.</div>}</article>
      </section>

      <div className="logic-note compact"><PiggyBank/><div><b>Σύνθετη αποταμίευση</b><span>Η ενέργεια καταγράφει τη συμφωνημένη ψηφιακή μεταφορά προς τον αποταμιευτικό χωρίς να προσθέτει ή να αφαιρεί δεύτερη φορά τα φυσικά μετρητά.</span></div></div>
    </div>

    {open?<div className="editor-backdrop" onMouseDown={close}><section ref={modalRef} className="panel neo-raised editor-dialog savings-dialog" role="dialog" aria-modal="true" aria-labelledby="saving-editor-title" aria-describedby={error?'saving-editor-error':undefined} tabIndex={-1} onMouseDown={e=>e.stopPropagation()}><div className="panel-head"><div><span id="saving-editor-title">{SAVING_SOURCE_LABELS[source]}</span><small>{ACTIONS.find(action=>action.source===source)?.description}</small></div><button type="button" className="icon-button" aria-label="Κλείσιμο αποταμίευσης" onClick={close}><X/></button></div><div className="settings-form editor-grid"><label><span>Ποσό</span><MoneyInput data-autofocus="true" value={amount} onValueChange={setAmount} placeholder="0,00" invalid={Boolean(error)} aria-describedby={error?'saving-editor-error':undefined}/></label><label><span>Ημερομηνία</span><AppDateInput value={date} onChange={e=>setDate(e.target.value)}/></label><label><span>Από</span><AppSelectInput value={from} onChange={e=>setFrom(e.target.value)}>{sourceAccounts.map(account=><option key={account.id} value={account.id}>{accountDisplayName(data,account.id)}</option>)}</AppSelectInput></label><label><span>Προς αποταμίευση</span><AppSelectInput value={to} onChange={e=>setTo(e.target.value)}>{savingsAccounts.map(account=><option key={account.id} value={account.id}>{accountDisplayName(data,account.id)}</option>)}</AppSelectInput></label><label className="wide"><span>Σχόλιο / λόγος <em>προαιρετικό</em></span><input value={note} onChange={e=>setNote(e.target.value)} placeholder="π.χ. Ταξίδι, μαξιλάρι ασφαλείας"/></label></div>{source==='cash_offset'?<div className="logic-note compact"><BanknoteArrowDown/><div><b>Μία σύνθετη κίνηση</b><span>Το MyFinHub καταγράφει τη μεταφορά προς την αποταμίευση ως μία ενιαία κίνηση, ώστε να μη μετρηθούν δύο φορές η ανάληψη, τα μετρητά ή το έξοδο.</span></div></div>:null}{error?<FormError id="saving-editor-error">{error}</FormError>:null}<div className="editor-actions"><button type="button" className="secondary" onClick={close}>Ακύρωση</button><button type="button" className="save-button" onClick={submit}>Καταχώριση αποταμίευσης</button></div></section></div>:null}
  </div>;
}
