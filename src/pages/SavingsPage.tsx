import { ArrowRight, BanknoteArrowDown, Pencil, PiggyBank, Plus, Repeat2, Sparkles, Wallet, X } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { AnimatedAmount } from '../components/AnimatedAmount';
import { AppDateInput } from '../components/AppDateInput';
import { AppSelectInput } from '../components/AppSelectInput';
import { AppTextInput } from '../components/AppTextInput';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormError } from '../components/FormError';
import { IconButton } from '../components/IconButton';
import { MoneyInput } from '../components/MoneyInput';
import type { QuickActionContext } from '../components/ContextualQuickAdd';
import { useModalFocus } from '../hooks/useModalFocus';
import { accountBalances, createEvent } from '../lib/domain';
import { calendarMonthRange, dateOnlyToUtcDate, monthOnlyToUtcDate } from '../lib/dateOnly';
import { financeAccountChoices } from '../lib/accountSelection';
import { money, shortDate } from '../lib/format';
import { SAVING_SOURCE_LABELS, operationalMonthlyFlow, savingsBreakdown, savingsHistoryPresentation } from '../lib/savings';
import { savingsGoalBalance, savingsGoalProgress } from '../lib/savingsGoals';
import { accountDisplayName, ratioPercent } from '../lib/ui';
import { userErrorMessage } from '../lib/userMessage';
import type { FinanceData, FinanceEvent, SavingSource, SavingsGoal } from '../types';
import './SavingsCompletion.css';

const ACTIONS:Array<{source:SavingSource;title:string;description:string;icon:typeof PiggyBank}>=[
  {source:'pay_and_save',title:'Pay & Save',description:'Στρογγυλοποίηση αγοράς που μεταφέρεται στην αποταμίευση.',icon:Sparkles},
  {source:'manual_transfer',title:'Μεταφορά στην άκρη',description:'Χειροκίνητη μεταφορά ποσού από λογαριασμό προς τον αποταμιευτικό.',icon:Repeat2},
  {source:'cash_offset',title:'Σύνθετη αποταμίευση',description:'Η συμφωνημένη κίνηση μετρητών και ψηφιακής μεταφοράς ως μία ενέργεια, χωρίς διπλομέτρηση.',icon:BanknoteArrowDown},
];

const euroCompact=new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR',maximumFractionDigits:0});

type SavingsQuickContext=Omit<Extract<QuickActionContext,{mode:'savings'}>,'token'>;

export function SavingsPage({data,month,asOf,onCreate,onQuickAdd,onSavingsTargetChange,onUpsertGoal,onDeleteGoal}:{data:FinanceData;month:string;asOf:string;onCreate:(event:FinanceEvent)=>void;onQuickAdd?:(context:SavingsQuickContext)=>void;onSavingsTargetChange:(rate:number)=>void;onUpsertGoal:(goal:SavingsGoal)=>void;onDeleteGoal:(id:string)=>void}){
  const balances=accountBalances(data,asOf);
  const flow=operationalMonthlyFlow(data,month);
  const breakdown=savingsBreakdown(data,month);
  const target=data.state.settings.savingsTargetRate??.2;
  const rate=flow.income?flow.saving/flow.income:0;
  const progress=ratioPercent(rate,target);
  const accountChoices=financeAccountChoices(data);const accounts=accountChoices.accounts;
  const savingsAccounts=accounts.filter(account=>account.kind==='savings'||(account.kind==='bank'&&account.bankAccountCategory==='savings'));
  const savingsIds=new Set(savingsAccounts.map(account=>account.id));
  const sourceAccounts=accounts.filter(account=>!savingsIds.has(account.id));
  const defaultFrom=accountChoices.operating?.id??'';
  const defaultTo=accountChoices.dashboardSavings?.id??accountChoices.savings?.id??'';
  const sourceName=defaultFrom?accountDisplayName(data,defaultFrom):'Δεν έχει οριστεί';
  const savingsName=defaultTo?accountDisplayName(data,defaultTo):'Δεν έχει οριστεί';
  const savingsBalance=savingsGoalBalance(data,asOf);
  const goals=data.state.savingsGoals??[];
  const monthRange=calendarMonthRange(month);
  const selectedMonthIsCurrent=month===asOf.slice(0,7);
  const selectedMonthLabel=(()=>{const text=new Intl.DateTimeFormat('el-GR',{month:'long',year:'numeric',timeZone:'UTC'}).format(monthOnlyToUtcDate(month)!);return text.charAt(0).toUpperCase()+text.slice(1)})();
  const selectedPeriodHeading=selectedMonthIsCurrent?'Αυτός ο μήνας':selectedMonthLabel;
  const daysInMonth=Number(monthRange.end.slice(8,10));
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
  const goalDeadline=new Intl.DateTimeFormat('el-GR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(dateOnlyToUtcDate(monthRange.end)!);
  const trendMonthLabel=new Intl.DateTimeFormat('el-GR',{month:'short',timeZone:'UTC'}).format(monthOnlyToUtcDate(month)!);
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
  const [targetEditing,setTargetEditing]=useState(false);
  const [targetText,setTargetText]=useState(String(Math.round(target*100)));
  const [targetError,setTargetError]=useState('');
  const [goalEdit,setGoalEdit]=useState<SavingsGoal|null>(null);
  const [goalAmountText,setGoalAmountText]=useState('');
  const [goalError,setGoalError]=useState('');
  const [deleteGoalTarget,setDeleteGoalTarget]=useState<SavingsGoal|null>(null);
  const [goalLimit,setGoalLimit]=useState(12);
  const modalRef=useModalFocus<HTMLElement>(open,'[data-autofocus="true"]',()=>setOpen(false));
  const goalModalRef=useModalFocus<HTMLElement>(Boolean(goalEdit),'[data-goal-autofocus="true"]',()=>setGoalEdit(null));

  useEffect(()=>{if(!targetEditing)setTargetText(String(Math.round(target*100)))},[target,targetEditing]);

  const startTargetEdit=()=>{setTargetText(String(Math.round(target*100)));setTargetError('');setTargetEditing(true)};
  const cancelTargetEdit=()=>{setTargetText(String(Math.round(target*100)));setTargetError('');setTargetEditing(false)};
  const saveTarget=()=>{
    const numeric=Number(targetText.replace(',','.'));
    if(!Number.isFinite(numeric)||numeric<0||numeric>100){setTargetError('Βάλε ποσοστό από 0 έως 100.');return}
    onSavingsTargetChange(numeric/100);setTargetError('');setTargetEditing(false);
  };
  const renderTargetEditor=(surface:'desktop'|'mobile')=>targetEditing?<div className="settings-form savings-target-editor" data-savings-target-editor={surface}>
    <label><span>Στόχος αποταμίευσης %</span><AppTextInput inputMode="decimal" value={targetText} onChange={event=>setTargetText(event.target.value)} aria-invalid={Boolean(targetError)} /></label>
    {targetError?<FormError id={`savings-target-error-${surface}`}>{targetError}</FormError>:null}
    <div className="editor-actions"><Button type="button" variant="secondary" onClick={cancelTargetEdit}>Ακύρωση</Button><Button type="button" variant="primary" onClick={saveTarget}>Αποθήκευση στόχου</Button></div>
  </div>:null;

  const startGoal=(goal?:SavingsGoal)=>{
    const now=new Date().toISOString();
    const next=goal?{...goal}:{id:`savings-goal-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name:'',targetAmount:0,targetDate:null,createdAt:now,updatedAt:now};
    setGoalEdit(next);
    setGoalAmountText(goal?String(goal.targetAmount):'');
    setGoalError('');
  };
  const closeGoal=()=>{setGoalEdit(null);setGoalAmountText('');setGoalError('')};
  const saveGoal=()=>{
    if(!goalEdit)return;
    const name=goalEdit.name.trim();
    const targetAmount=Number(goalAmountText.replace(',','.'));
    if(!name){setGoalError('Δώσε ένα όνομα στον στόχο.');return}
    if(!Number.isFinite(targetAmount)||targetAmount<=0){setGoalError('Ο στόχος ποσού πρέπει να είναι μεγαλύτερος από μηδέν.');return}
    if(goalEdit.targetDate&&goalEdit.targetDate<asOf){setGoalError('Η προθεσμία δεν μπορεί να είναι πριν από σήμερα.');return}
    onUpsertGoal({...goalEdit,name,targetAmount,targetDate:goalEdit.targetDate||null,updatedAt:new Date().toISOString()});
    closeGoal();
  };
  const goalRows=goals.map(goal=>({goal,progress:savingsGoalProgress(goal,savingsBalance)}));
  const visibleGoalRows=goalRows.slice(0,goalLimit);
  const renderGoals=(surface:'desktop'|'mobile')=><section className={`panel surface-raised savings-goals savings-goals-${surface}`} aria-labelledby={`savings-goals-title-${surface}`}>
    <div className="panel-head"><div><span id={`savings-goals-title-${surface}`}>Στόχοι αποταμίευσης</span><small>Όλοι οι προσωπικοί στόχοι συγκρίνονται με το ίδιο κοινό υπόλοιπο αποταμίευσης. Τα χρήματα δεν δεσμεύονται αποκλειστικά σε κάποιον στόχο.</small></div><Button type="button" variant="secondary" onClick={()=>startGoal()}><Plus size={15}/> Νέος στόχος</Button></div>
    <div className="savings-goals-head"><span>Στόχος</span><span>Πρόοδος</span><span>Κοινό υπόλοιπο</span><span>Στόχος</span><span>Προθεσμία</span></div>
    <div className="savings-goal-row supported"><div><span className="savings-goal-icon"><PiggyBank/></span><span><b>Μηνιαίος ρυθμός αποταμίευσης</b><small>{target>0?`${Math.round(target*100)}% των πραγματικών εσόδων`:'Δεν έχει οριστεί ποσοστιαίος στόχος'}</small></span></div><div className="savings-goal-progress"><span><i style={{width:`${goalProgress}%`}}/></span><b>{Math.round(goalProgress)}%</b></div><strong>{money.format(flow.saving)}</strong><strong>{targetTotal>0?money.format(targetTotal):'—'}</strong><span>{goalDeadline}</span></div>
    {goalRows.length?visibleGoalRows.map(({goal,progress:personalProgress})=><div className="savings-goal-row personal" key={goal.id}><div><span className="savings-goal-icon"><PiggyBank/></span><span><b>{goal.name}</b><small><Button type="button" variant="ghost" className="savings-goal-inline-action" onClick={()=>startGoal(goal)}>Επεξεργασία</Button><Button type="button" variant="ghost" className="savings-goal-inline-action danger" onClick={()=>setDeleteGoalTarget(goal)}>Διαγραφή</Button></small></span></div><div className="savings-goal-progress"><span><i style={{width:`${personalProgress}%`}}/></span><b>{Math.round(personalProgress)}%</b></div><strong>{money.format(savingsBalance)}</strong><strong>{money.format(goal.targetAmount)}</strong><span>{goal.targetDate?shortDate(goal.targetDate):'Χωρίς προθεσμία'}</span></div>):<div className="empty-state savings-goals-empty"><b>Δεν έχεις προσωπικό στόχο</b><span>Το κοινό υπόλοιπο αποταμίευσης είναι {money.format(savingsBalance)} και δεν ανήκει σε κάποιον στόχο. Πρόσθεσε στόχο ποσού μόνο αν θέλεις να παρακολουθείς την πρόοδό σου.</span></div>}{goalRows.length>visibleGoalRows.length?<Button type="button" variant="secondary" className="savings-goals-more" onClick={()=>setGoalLimit(limit=>limit+12)}>Προβολή περισσότερων · {goalRows.length-visibleGoalRows.length} ακόμη</Button>:null}
  </section>;

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
    if(!savingsAccounts.some(account=>account.id===to)){setError(savingsAccounts.length?'Ο λογαριασμός αποταμίευσης δεν είναι πλέον διαθέσιμος. Επίλεξε έναν από τους διαθέσιμους αποταμιευτικούς λογαριασμούς.':'Δεν υπάρχει διαθέσιμος λογαριασμός αποταμίευσης. Πρόσθεσε ή ενεργοποίησε έναν και δοκίμασε ξανά.');return}
    if(from===to){setError('Επίλεξε διαφορετικό λογαριασμό προέλευσης και αποταμίευσης.');return}
    try{
      const event=createEvent({kind:'saving_cash_offset',date,amount:numeric,note:note.trim()||SAVING_SOURCE_LABELS[source],fromAccountId:from,toAccountId:to});
      event.savingSource=source;
      onCreate(event);
      close();
    }catch(e){setError(userErrorMessage(e,'Δεν μπορέσαμε να καταχωρίσουμε την αποταμίευση. Έλεγξε τα στοιχεία και δοκίμασε ξανά.'))}
  };

  const actionGrid=<div className="savings-action-grid">{ACTIONS.map(action=>{const Icon=action.icon;return <button type="button" className="panel surface-raised savings-action" key={action.source} aria-label={`Νέα αποταμίευση: ${action.title}`} onClick={()=>start(action.source)}><span className="savings-action-icon"><Icon aria-hidden="true"/></span><div><b>{action.title}</b><small>{action.description}</small></div><strong>Νέα κίνηση <ArrowRight aria-hidden="true"/></strong></button>})}</div>;

  return <div className="page-stack savings-page">
    <PageHeader eyebrow="ΑΠΟΤΑΜΙΕΥΣΗ" title="Αποταμίευση" description={<p>Διάλεξε πρώτα τι θέλεις να κάνεις: Pay & Save, απλή μεταφορά ή σύνθετη αποταμίευση. Οι τρεις επιλογές μετρούν μία φορά στην πραγματική αποταμίευση.</p>}/>

    <section className="savings-action-section" aria-labelledby="savings-actions-title">
      <div className="section-title"><div><span id="savings-actions-title">Πώς θέλεις να αποταμιεύσεις;</span><b>Όποια επιλογή κι αν χρησιμοποιήσεις, η αποταμίευση μετρά μία φορά στα σύνολα.</b></div></div>
      {actionGrid}
    </section>

    <div className="savings-desktop-target">
      <section className="savings-hero surface-raised savings-dashboard">
        <article className="savings-month-card">
          <h2>{selectedPeriodHeading}</h2>
          <strong className="savings-month-amount"><AnimatedAmount value={flow.saving}/></strong>
          <div className="savings-rate"><b>{Math.round(rate*100)}%</b><span>των εσόδων</span></div>
          <div className="savings-rate-target"><span>Στόχος {target>0?`${Math.round(target*100)}%`:'—'}</span><b>{target>0?`${Math.round(progress??0)}%`:'—'}</b></div>
          <Button type="button" variant="secondary" aria-label="Αλλαγή στόχου αποταμίευσης" onClick={startTargetEdit}><Pencil size={15}/> Αλλαγή στόχου</Button>
          {renderTargetEditor('desktop')}
          <div className="savings-target-track" role="progressbar" aria-label="Πρόοδος μηνιαίου στόχου αποταμίευσης" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress??0)}><span style={{width:`${Math.min(100,progress??0)}%`}}/></div>
          <div className="saving-route savings-route-target"><span><Wallet/> <small>Κύριος λογαριασμός</small><b>{sourceName}<em><AnimatedAmount value={defaultFrom?balances[defaultFrom]||0:0}/></em></b></span><ArrowRight/><span><PiggyBank/> <small>Αποταμίευση</small><b>{savingsName}<em><AnimatedAmount value={defaultTo?balances[defaultTo]||0:0}/></em></b></span></div>
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
            {trendDays.map((day,index)=><text className="x-label" key={day} x={Number(trendPoint(0,index).split(',')[0])} y="166" textAnchor={index===0?'start':index===trendDays.length-1?'end':'middle'}>{day} {trendMonthLabel}</text>)}
          </svg>
        </article>

        <aside className="savings-insight-column">
          <section className="savings-sources-compact"><h2>Πηγές αποταμίευσης</h2><div className="savings-source-list">{ACTIONS.map(action=><div key={action.source}><span>{action.title}</span><b><AnimatedAmount value={breakdown.bySource[action.source]}/></b></div>)}</div></section>
          <section className="savings-recent-compact"><h2>Πρόσφατη αποταμίευση</h2>{recent&&recentPresentation?<div className="saving-history"><div><span>{shortDate(recent.date)}</span><div><b>{recentPresentation.primary}</b><small>{recentPresentation.sourceLabel}</small></div><strong>{money.format(recent.amount)}</strong></div></div>:<div className="empty-state">Δεν υπάρχουν κινήσεις αποταμίευσης για αυτή την περίοδο.</div>}</section>
        </aside>
      </section>

      {renderGoals('desktop')}

      <div className="logic-note compact savings-target-note"><PiggyBank/><div><b>Σύνθετη αποταμίευση</b><span>Η ενέργεια καταγράφει τη συμφωνημένη ψηφιακή μεταφορά προς τον αποταμιευτικό χωρίς να προσθέτει ή να αφαιρεί δεύτερη φορά τα φυσικά μετρητά.</span></div></div>
    </div>

    <div className="savings-mobile-legacy">
      <section className="savings-hero surface-raised"><div className="savings-gauge"><div className="gauge-ring" role="progressbar" aria-label={target>0?'Πρόοδος προς τον στόχο αποταμίευσης':'Δεν έχει οριστεί στόχος αποταμίευσης'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress===null?0:Math.round(progress)} style={{'--progress':`${progress??0}%`} as CSSProperties}><div><b>{Math.round(rate*100)}%</b><span>{target>0?'των εσόδων':'χωρίς στόχο'}</span></div></div></div><div><span className="eyebrow">{selectedMonthIsCurrent?'ΑΥΤΟΣ Ο ΜΗΝΑΣ':selectedMonthLabel.toLocaleUpperCase('el-GR')}</span><h2><AnimatedAmount value={flow.saving}/></h2><p>{target>0?`Στόχος: ${Math.round(target*100)}% των πραγματικών εσόδων.`:'Δεν έχει οριστεί ποσοστιαίος στόχος αποταμίευσης.'} Οι κινήσεις αποταμίευσης δεν μετρούν ως έξοδο.</p><Button type="button" variant="secondary" aria-label="Αλλαγή στόχου αποταμίευσης" onClick={startTargetEdit}><Pencil size={15}/> Αλλαγή στόχου</Button>{renderTargetEditor('mobile')}<div className="saving-route"><span><Wallet/> {sourceName} <b><AnimatedAmount value={defaultFrom?balances[defaultFrom]||0:0}/></b></span><ArrowRight/><span><PiggyBank/> {savingsName} <b><AnimatedAmount value={defaultTo?balances[defaultTo]||0:0}/></b></span></div></div></section>

      <section className="savings-breakdown-grid">
        <article className="panel surface-raised"><div className="panel-head"><div><span>Πηγές αποταμίευσης</span><small>Σύνολο για την επιλεγμένη περίοδο</small></div></div><div className="savings-source-list">{ACTIONS.map(action=><div key={action.source}><span>{action.title}</span><b><AnimatedAmount value={breakdown.bySource[action.source]}/></b></div>)}</div></article>
        <article className="panel surface-raised"><div className="panel-head"><div><span>Πρόσφατη αποταμίευση</span><small>Το σχόλιό σου εμφανίζεται πρώτο· η πηγή παραμένει δευτερεύουσα πληροφορία.</small></div></div>{breakdown.rows.length?<div className="saving-history">{breakdown.rows.slice(0,12).map(row=>{const presentation=savingsHistoryPresentation(row);return <div key={`${row.origin}-${row.id}`}><span>{shortDate(row.date)}</span><div><b>{presentation.primary}</b><small>{presentation.hasUserNote?`Τύπος: ${presentation.sourceLabel}`:'Χωρίς ξεχωριστό σχόλιο'}</small></div><strong>{money.format(row.amount)}</strong></div>})}</div>:<div className="empty-state">Δεν υπάρχουν κινήσεις αποταμίευσης για αυτή την περίοδο.</div>}</article>
      </section>

      {renderGoals('mobile')}

      <div className="logic-note compact"><PiggyBank/><div><b>Σύνθετη αποταμίευση</b><span>Η ενέργεια καταγράφει τη συμφωνημένη ψηφιακή μεταφορά προς τον αποταμιευτικό χωρίς να προσθέτει ή να αφαιρεί δεύτερη φορά τα φυσικά μετρητά.</span></div></div>
    </div>

    {goalEdit?<div className="editor-backdrop" onMouseDown={closeGoal}><section ref={goalModalRef} className="panel surface-raised editor-dialog savings-dialog" role="dialog" aria-modal="true" aria-labelledby="savings-goal-editor-title" aria-describedby={goalError?'savings-goal-editor-error':undefined} tabIndex={-1} onMouseDown={event=>event.stopPropagation()}><div className="panel-head"><div><span id="savings-goal-editor-title">{goals.some(goal=>goal.id===goalEdit.id)?'Επεξεργασία στόχου':'Νέος στόχος αποταμίευσης'}</span><small>Το ποσό είναι στόχος αναφοράς πάνω στο συνολικό υπόλοιπο αποταμίευσης. Η προθεσμία είναι προαιρετική.</small></div><IconButton type="button" aria-label="Κλείσιμο στόχου" onClick={closeGoal}><X/></IconButton></div><div className="settings-form editor-grid"><label className="wide"><span>Όνομα στόχου</span><AppTextInput data-goal-autofocus="true" value={goalEdit.name} maxLength={80} onChange={event=>{setGoalEdit({...goalEdit,name:event.target.value});if(goalError)setGoalError('')}} placeholder="π.χ. Ταξίδι, ταμείο ασφαλείας"/></label><label><span>Στόχος ποσού</span><MoneyInput value={goalAmountText} onValueChange={value=>{setGoalAmountText(value);if(goalError)setGoalError('')}} placeholder="0,00" invalid={Boolean(goalError)}/></label><label><span>Προθεσμία <em>προαιρετική</em></span><AppDateInput min={asOf} value={goalEdit.targetDate??''} onChange={event=>{setGoalEdit({...goalEdit,targetDate:event.target.value||null});if(goalError)setGoalError('')}}/></label></div>{goalError?<FormError id="savings-goal-editor-error">{goalError}</FormError>:null}<div className="editor-actions"><Button type="button" variant="secondary" onClick={closeGoal}>Ακύρωση</Button><Button type="button" variant="primary" onClick={saveGoal}>Αποθήκευση στόχου</Button></div></section></div>:null}
    <ConfirmDialog open={Boolean(deleteGoalTarget)} title="Διαγραφή στόχου αποταμίευσης;" description={deleteGoalTarget?`Ο στόχος «${deleteGoalTarget.name}» θα αφαιρεθεί. Δεν διαγράφεται καμία οικονομική κίνηση ή υπόλοιπο.`:''} confirmLabel="Διαγραφή" tone="destructive" motionMode={data.state.settings.motion} onConfirm={()=>{if(deleteGoalTarget)onDeleteGoal(deleteGoalTarget.id);setDeleteGoalTarget(null)}} onCancel={()=>setDeleteGoalTarget(null)}/>
    {open?<div className="editor-backdrop" onMouseDown={close}><section ref={modalRef} className="panel surface-raised editor-dialog savings-dialog" role="dialog" aria-modal="true" aria-labelledby="saving-editor-title" aria-describedby={error?'saving-editor-error':undefined} tabIndex={-1} onMouseDown={e=>e.stopPropagation()}><div className="panel-head"><div><span id="saving-editor-title">{SAVING_SOURCE_LABELS[source]}</span><small>{ACTIONS.find(action=>action.source===source)?.description}</small></div><IconButton type="button" aria-label="Κλείσιμο αποταμίευσης" onClick={close}><X/></IconButton></div><div className="settings-form editor-grid"><label><span>Ποσό</span><MoneyInput data-autofocus="true" value={amount} onValueChange={setAmount} placeholder="0,00" invalid={Boolean(error)} aria-describedby={error?'saving-editor-error':undefined}/></label><label><span>Ημερομηνία</span><AppDateInput value={date} onChange={e=>setDate(e.target.value)}/></label><label><span>Από</span><AppSelectInput value={from} onChange={e=>setFrom(e.target.value)}>{sourceAccounts.map(account=><option key={account.id} value={account.id}>{accountDisplayName(data,account.id)}</option>)}</AppSelectInput></label><label><span>Προς αποταμίευση</span><AppSelectInput value={to} onChange={e=>setTo(e.target.value)}>{savingsAccounts.map(account=><option key={account.id} value={account.id}>{accountDisplayName(data,account.id)}</option>)}</AppSelectInput></label><label className="wide"><span>Σχόλιο / λόγος <em>προαιρετικό</em></span><AppTextInput value={note} onChange={e=>setNote(e.target.value)} placeholder="π.χ. Ταξίδι, μαξιλάρι ασφαλείας"/></label></div>{source==='cash_offset'?<div className="logic-note compact"><BanknoteArrowDown/><div><b>Μία σύνθετη κίνηση</b><span>Το MyFinHub καταγράφει τη μεταφορά προς την αποταμίευση ως μία ενιαία κίνηση, ώστε να μη μετρηθούν δύο φορές η ανάληψη, τα μετρητά ή το έξοδο.</span></div></div>:null}{error?<FormError id="saving-editor-error">{error}</FormError>:null}<div className="editor-actions"><Button type="button" variant="secondary" onClick={close}>Ακύρωση</Button><Button type="button" variant="primary" onClick={submit}>Καταχώριση αποταμίευσης</Button></div></section></div>:null}
  </div>;
}
