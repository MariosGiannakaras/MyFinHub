import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell, type PageId } from './components/AppShell';
import { PeriodControl } from './components/PeriodControl';
import { LoginScreen } from './components/LoginScreen';
import { PageErrorBoundary } from './components/PageErrorBoundary';
import { PersistenceNotice } from './components/PersistenceNotice';
import { QuickAdd } from './components/QuickAdd';
import type { SaveState } from './hooks/useFinance';
import { accountBalances, createEvent } from './lib/domain';
import { qaFinanceData } from './qaFixture';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ReviewPage } from './pages/ReviewPage';
import { SavingsPage } from './pages/SavingsPage';
import { CreditLoansPage } from './pages/CreditLoansPage';
import { LendingPage } from './pages/LendingPage';
import { RecurringPage } from './pages/RecurringPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import type { EventKind, FinanceData, FinanceEvent, Loan, RecurringItem } from './types';
import './styles.css';

function Crash(): never { throw new Error('synthetic-render-failure'); }
function initialSaveState(raw:string|null):SaveState{return raw==='error'||raw==='conflict'||raw==='saving'||raw==='loading'?raw:'saved'}

function QaWorkspace(){
  const params=new URLSearchParams(location.search);const [data,setData]=useState<FinanceData>(()=>{const next=qaFinanceData();if(params.get('motion')==='reduced')next.state.settings.motion='reduced';return next});const [saveState,setSaveState]=useState<SaveState>(()=>initialSaveState(params.get('save')));const [page,setPage]=useState<PageId>('dashboard');const [quickOpen,setQuickOpen]=useState(false);const [quickKind,setQuickKind]=useState<EventKind>('expense');const [editing,setEditing]=useState<string|null>(null);const [crash,setCrash]=useState(false);const [month,setMonth]=useState('2026-08');const today='2026-08-17';
  useEffect(()=>{document.documentElement.dataset.motion=data.state.settings.motion||'system';return()=>{delete document.documentElement.dataset.motion}},[data.state.settings.motion]);
  const update=(recipe:(current:FinanceData)=>FinanceData)=>setData(current=>recipe(current));
  const addEvent=(event:FinanceEvent)=>update(current=>({...current,state:{...current.state,events:[...(current.state.events??[]).filter(e=>e.id!==event.id),event]}}));
  const editEvent=(id:string)=>{setEditing(id);setQuickOpen(true)};const open=(kind:EventKind='expense')=>{setEditing(null);setQuickKind(kind);setQuickOpen(true)};
  const upsertRecurring=(item:RecurringItem)=>update(current=>({...current,state:{...current.state,recurringCustom:[...(current.state.recurringCustom??[]).filter(r=>r.id!==item.id),item]}}));
  const upsertLoan=(loan:Loan)=>update(current=>({...current,state:{...current.state,customLoans:[...(current.state.customLoans??[]).filter(l=>l.id!==loan.id),loan]}}));
  const payLoan=(loan:Loan)=>{const event=createEvent({kind:'expense',date:today,amount:loan.installment,note:`Δόση: ${loan.name}`,category:'Δόσεις / δάνεια',accountId:data.state.settings.defaultLoanAccount});event.loanId=loan.id;addEvent(event)};
  const content=page==='dashboard'?<DashboardPage data={data} month={month} asOf={today} motionMode={data.state.settings.motion||'system'} onQuickAdd={()=>open()} onTransactions={()=>setPage('transactions')}/>:page==='transactions'?<TransactionsPage data={data} month={month} onEditEvent={editEvent} onDeleteEvent={id=>update(c=>({...c,state:{...c.state,events:(c.state.events??[]).filter(e=>e.id!==id)}}))}/>:page==='review'?<ReviewPage data={data} onDecision={(id,decision)=>update(c=>({...c,state:{...c.state,reviewDecisions:{...(c.state.reviewDecisions??{}),[id]:decision}}}))}/>:page==='savings'?<SavingsPage data={data} month={month} asOf={today} onCreate={addEvent}/>:page==='credit'?<CreditLoansPage data={data} asOf={today} onCardPurchase={()=>open('card_purchase')} onCardPayment={()=>open('card_payment')} onEditEvent={editEvent} onUpsertLoan={upsertLoan} onPayLoan={payLoan}/>:page==='lending'?<LendingPage data={data} onQuickAdd={()=>open('lending')}/>:page==='recurring'?<RecurringPage data={data} onUpsert={upsertRecurring} onDelete={id=>update(c=>({...c,state:{...c.state,recurringCustom:(c.state.recurringCustom??[]).filter(r=>r.id!==id),recurringOverrides:c.seed.recurring.some(r=>r.id===id)?{...c.state.recurringOverrides,[id]:{...c.seed.recurring.find(r=>r.id===id)!,active:false}}:c.state.recurringOverrides}}))}/>:page==='reports'?<ReportsPage data={data} month={month}/>:<SettingsPage data={data} filePath="Synthetic QA" lastSavedAt={data.updatedAt} onImport={async incoming=>setData(incoming)} onBackup={async()=>({path:'synthetic/backup.json'})} onSettings={settings=>update(c=>({...c,state:{...c.state,settings:{...settings,motion:'full'}}}))}/>;
  const periodVisible=['dashboard','transactions','savings','reports'].includes(page);
  return <><AppShell page={page} onPage={next=>{setCrash(false);setPage(next)}} onQuickAdd={()=>open()} saveState={saveState} filePath="Synthetic QA" motionMode={data.state.settings.motion||'system'} userEmail="qa@example.invalid" onLogout={()=>{}}><PersistenceNotice saveState={saveState} onRecover={()=>setSaveState('saved')}/>{periodVisible?<div className="period-row"><PeriodControl month={month} onChange={setMonth}/><button type="button" className="text-button" data-qa-crash onClick={()=>setCrash(true)}>QA render failure</button></div>:<button type="button" className="text-button qa-crash-floating" data-qa-crash onClick={()=>setCrash(true)}>QA render failure</button>}<PageErrorBoundary resetKey={page} onDashboard={()=>{setCrash(false);setPage('dashboard')}}>{crash?<Crash/>:content}</PageErrorBoundary></AppShell><QuickAdd open={quickOpen} data={data} asOf={today} initial={(data.state.events??[]).find(e=>e.id===editing)||null} initialKind={quickKind} motionMode={data.state.settings.motion||'system'} onClose={()=>{setQuickOpen(false);setEditing(null)}} onCreate={addEvent} currentBalance={id=>accountBalances(data,today)[id]||0}/></>;
}

function QaApp(){const params=new URLSearchParams(location.search);if(params.get('screen')==='login')return <LoginScreen error="" onLogin={async()=>false}/>;return <QaWorkspace/>}

createRoot(document.getElementById('root')!).render(<StrictMode><QaApp/></StrictMode>);
