import { useEffect, useMemo, useState } from 'react';
import { AppShell, type PageId } from './components/AppShell';
import { LoginScreen } from './components/LoginScreen';
import { MfaScreen } from './components/MfaScreen';
import { QuickAdd } from './components/QuickAdd';
import { useFinance } from './hooks/useFinance';
import { useSession } from './hooks/useSession';
import { accountBalances, createEvent, reviewSuggestions } from './lib/domain';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ReviewPage } from './pages/ReviewPage';
import { SavingsPage } from './pages/SavingsPage';
import { CreditLoansPage } from './pages/CreditLoansPage';
import { RecurringPage } from './pages/RecurringPage';
import { LendingPage } from './pages/LendingPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import type { EventKind, FinanceEvent, Loan, RecurringItem, ReviewDecision } from './types';

const TODAY = new Date().toLocaleDateString('en-CA');

function FinanceApp({userEmail,onLogout}:{userEmail:string|null;onLogout:()=>void}){
  const finance=useFinance();
  const [page,setPage]=useState<PageId>('dashboard');
  const [quickOpen,setQuickOpen]=useState(false);
  const [editingEventId,setEditingEventId]=useState<string|null>(null);
  const [quickKind,setQuickKind]=useState<EventKind>('expense');
  const [month,setMonth]=useState(TODAY.slice(0,7));

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setEditingEventId(null);setQuickKind('expense');setQuickOpen(true)}
      if(e.key==='Escape')setQuickOpen(false);
    };
    addEventListener('keydown',onKey); return()=>removeEventListener('keydown',onKey);
  },[]);

  const data=finance.data;
  useEffect(()=>{
    const mode=data?.state.settings.motion||'system';
    document.documentElement.dataset.motion=mode;
    return()=>{ delete document.documentElement.dataset.motion; };
  },[data?.state.settings.motion]);
  const reviews=useMemo(()=>data?reviewSuggestions(data).length:0,[data]);
  if(!data)return <div className="boot-screen"><img src="/brand/icon-192.png" alt="RheomIQ"/><div className="boot-pulse"/><b>RheomIQ</b><span>{finance.saveState==='error'?'Δεν ήταν δυνατή η φόρτωση της βάσης':'Φόρτωση οικονομικού ledger…'}</span></div>;

  const addEvent=(event:FinanceEvent)=>finance.update(current=>{const events=current.state.events??[];const exists=events.some(e=>e.id===event.id);return {...current,state:{...current.state,events:exists?events.map(e=>e.id===event.id?event:e):[...events,event]}}});
  const deleteEvent=(id:string)=>finance.update(current=>({...current,state:{...current.state,events:(current.state.events??[]).filter(e=>e.id!==id)}}));
  const editEvent=(id:string)=>{setEditingEventId(id);setQuickOpen(true)};
  const openQuick=(kind:EventKind='expense')=>{setEditingEventId(null);setQuickKind(kind);setQuickOpen(true)};
  const upsertRecurring=(item:RecurringItem)=>finance.update(current=>{const seed=current.seed.recurring.some(r=>r.id===item.id);if(seed)return {...current,state:{...current.state,recurringOverrides:{...current.state.recurringOverrides,[item.id]:item}}};const custom=current.state.recurringCustom??[];const exists=custom.some(r=>r.id===item.id);return {...current,state:{...current.state,recurringCustom:exists?custom.map(r=>r.id===item.id?item:r):[...custom,item]}}});
  const deleteRecurring=(id:string)=>finance.update(current=>{if(current.seed.recurring.some(r=>r.id===id)){const original=current.seed.recurring.find(r=>r.id===id)!;return {...current,state:{...current.state,recurringOverrides:{...current.state.recurringOverrides,[id]:{...original,active:false}}}}}return {...current,state:{...current.state,recurringCustom:(current.state.recurringCustom??[]).filter(r=>r.id!==id)}}});
  const upsertLoan=(loan:Loan)=>finance.update(current=>{if(current.seed.loans.some(l=>l.id===loan.id))return {...current,state:{...current.state,loanOverrides:{...current.state.loanOverrides,[loan.id]:loan}}};const custom=current.state.customLoans??[];const exists=custom.some(l=>l.id===loan.id);return {...current,state:{...current.state,customLoans:exists?custom.map(l=>l.id===loan.id?loan:l):[...custom,loan]}}});
  const payLoan=(loan:Loan)=>{const mode=loan.accountingMode||'expense-per-installment';const event=createEvent({kind:mode==='liability-repayment'?'card_payment':'expense',date:TODAY,amount:loan.installment,note:`Δόση: ${loan.name}`,category:'Δόσεις / δάνεια',accountId:data.state.settings.defaultLoanAccount,fromAccountId:data.state.settings.defaultLoanAccount});event.loanId=loan.id;addEvent(event)};
  const decide=(id:string,decision:ReviewDecision)=>finance.update(current=>({...current,state:{...current.state,reviewDecisions:{...(current.state.reviewDecisions??{}),[id]:decision}}}));
  const balance=(accountId:string)=>accountBalances(data,TODAY)[accountId]||0;
  const content=page==='dashboard'?<DashboardPage data={data} month={month} asOf={TODAY} onQuickAdd={()=>openQuick('expense')} onReview={()=>setPage('review')} onTransactions={()=>setPage('transactions')}/>
    :page==='transactions'?<TransactionsPage data={data} month={month} onEditEvent={editEvent} onDeleteEvent={deleteEvent}/>
    :page==='review'?<ReviewPage data={data} onDecision={decide}/>
    :page==='savings'?<SavingsPage data={data} month={month} asOf={TODAY} onQuickAdd={()=>openQuick('saving_cash_offset')}/>
    :page==='credit'?<CreditLoansPage data={data} asOf={TODAY} onCardPurchase={()=>openQuick('card_purchase')} onCardPayment={()=>openQuick('card_payment')} onUpsertLoan={upsertLoan} onPayLoan={payLoan}/>
    :page==='lending'?<LendingPage data={data} onQuickAdd={()=>openQuick('lending')}/>
    :page==='recurring'?<RecurringPage data={data} onUpsert={upsertRecurring} onDelete={deleteRecurring}/>
    :page==='reports'?<ReportsPage data={data} month={month}/>
    :<SettingsPage data={data} filePath={finance.filePath} lastSavedAt={finance.lastSavedAt} onImport={finance.importData} onBackup={finance.createBackup} onSettings={settings=>finance.update(c=>({...c,state:{...c.state,settings}}))}/>;

  return <>
    <AppShell page={page} onPage={setPage} onQuickAdd={()=>openQuick('expense')} saveState={finance.saveState} filePath={finance.filePath} reviewCount={reviews} motionMode={data.state.settings.motion||'system'} userEmail={userEmail} onLogout={onLogout}>
      <div className="month-toolbar"><label>Περίοδος <input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><span>Οι κινήσεις μετά την {TODAY.split('-').reverse().join('/')} δεν επηρεάζουν το σημερινό balance.</span></div>
      {content}
    </AppShell>
    <QuickAdd open={quickOpen} data={data} asOf={TODAY} motionMode={data.state.settings.motion||'system'} initial={(data.state.events??[]).find(e=>e.id===editingEventId)||null} initialKind={quickKind} onClose={()=>{setQuickOpen(false);setEditingEventId(null)}} onCreate={addEvent} currentBalance={balance}/>
  </>;
}

export default function App(){
  const session=useSession();
  if(session.state==='loading')return <div className="boot-screen"><img src="/brand/icon-192.png" alt="RheomIQ"/><div className="boot-pulse"/><b>RheomIQ</b><span>Έλεγχος ασφαλούς συνεδρίας…</span></div>;
  if(session.state==='mfa'||session.state==='mfa-enroll')return <MfaScreen mode={session.state==='mfa-enroll'?'enroll':'challenge'} email={session.email} error={session.error} onEnroll={session.enrollMfa} onVerify={session.verifyMfa} onLogout={session.logout}/>;
  if(session.state!=='authenticated')return <LoginScreen onLogin={session.login} error={session.error}/>;
  return <FinanceApp userEmail={session.email} onLogout={session.logout}/>;
}
