import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell, type PageId } from './components/AppShell';
import { PeriodControl } from './components/PeriodControl';
import { LoginScreen } from './components/LoginScreen';
import { MfaScreen } from './components/MfaScreen';
import { PageErrorBoundary } from './components/PageErrorBoundary';
import { PersistenceNotice } from './components/PersistenceNotice';
import { QuickAdd } from './components/QuickAdd';
import type { SaveState } from './hooks/useFinance';
import { archiveCardRecord } from './lib/cards';
import { accountBalances } from './lib/domain';
import { qaFinanceData } from './qaFixture';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ReviewPage } from './pages/ReviewPage';
import { SavingsPage } from './pages/SavingsPage';
import { CardsPage } from './pages/CardsPage';
import { CreditCardPage } from './pages/CreditCardPage';
import { LoansPage } from './pages/LoansPage';
import { LendingPage } from './pages/LendingPage';
import { RecurringPage } from './pages/RecurringPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import type { CardBank, EventKind, FinanceData, FinanceEvent, Loan, PaymentCard, RecurringItem, TextSizePreference } from './types';
import './styles.css';

const QA_PAGES:PageId[]=['dashboard','transactions','review','savings','cards','credit','loans','lending','recurring','reports','settings'];
function Crash(): never { throw new Error('synthetic-render-failure'); }
function initialSaveState(raw:string|null):SaveState{return raw==='error'||raw==='conflict'||raw==='saving'||raw==='loading'?raw:'saved'}
function initialPage(raw:string|null):PageId{return QA_PAGES.includes(raw as PageId)?raw as PageId:'dashboard'}
function initialTextSize(raw:string|null):TextSizePreference{return raw==='compact'||raw==='large'?raw:'normal'}
function buildQaData(params:URLSearchParams){
  const next=qaFinanceData();
  if(params.get('motion')==='reduced')next.state.settings.motion='reduced';
  next.state.settings.textSize=initialTextSize(params.get('text'));
  if(params.get('state')==='empty'){
    next.seed.transactions=[];next.seed.recurring=[];next.seed.loans=[];next.seed.lending=[];next.state.events=[];next.state.recurringCustom=[];next.state.recurringOverrides={};next.state.customLoans=[];next.state.loanOverrides={};next.state.cards=[];next.state.cardBanks=[];next.state.reviewDecisions={};
  }
  if(params.get('state')==='extreme'){
    next.state.settings.accountNames={...next.state.settings.accountNames,'piraeus-payroll':'Κύριος λογαριασμός μισθοδοσίας με εξαιρετικά μεγάλο όνομα για έλεγχο διάταξης'};
    next.state.events=[...(next.state.events??[]),...Array.from({length:36},(_,index)=>({id:`extreme-${index}`,date:`2026-08-${String((index%17)+1).padStart(2,'0')}`,kind:'expense' as const,amount:index===0?987654.32:10+index,note:index===0?'Πολύ μεγάλη περιγραφή συναλλαγής που ελέγχει αναδίπλωση κειμένου χωρίς να δημιουργεί οριζόντια κύλιση ή επικάλυψη στα κουμπιά και στα ποσά':'Επαναλαμβανόμενη δοκιμαστική κίνηση',category:'Σταθερά έξοδα',accountId:'piraeus-payroll',legs:[{accountId:'piraeus-payroll',amount:-(index===0?987654.32:10+index)}],source:'user' as const,createdAt:`2026-08-17T12:${String(index%60).padStart(2,'0')}:00.000Z`,updatedAt:`2026-08-17T12:${String(index%60).padStart(2,'0')}:00.000Z`}))];
    next.state.recurringCustom=[...(next.state.recurringCustom??[]),...Array.from({length:18},(_,index)=>({id:`rec-extreme-${index}`,name:`Συνδρομή με μεγάλο όνομα ${index+1}`,amount:10+index,day:(index%28)+1,accountId:'piraeus-payroll',category:'Σταθερά έξοδα',active:true,status:'active' as const,source:'qa'}))];
  }
  return next;
}

function QaWorkspace(){
  const params=new URLSearchParams(location.search);const [data,setData]=useState<FinanceData>(()=>buildQaData(params));const [undoStack,setUndoStack]=useState<FinanceData[]>([]);const [redoStack,setRedoStack]=useState<FinanceData[]>([]);const [saveState,setSaveState]=useState<SaveState>(()=>initialSaveState(params.get('save')));const [page,setPage]=useState<PageId>(()=>initialPage(params.get('page')));const [quickOpen,setQuickOpen]=useState(false);const [quickKind,setQuickKind]=useState<EventKind>('expense');const [editing,setEditing]=useState<string|null>(null);const [crash,setCrash]=useState(false);const [month,setMonth]=useState('2026-08');const today='2026-08-17';
  useEffect(()=>{document.documentElement.dataset.motion=data.state.settings.motion||'system';return()=>{delete document.documentElement.dataset.motion}},[data.state.settings.motion]);
  useEffect(()=>{document.documentElement.dataset.textSize=data.state.settings.textSize??'normal';return()=>{delete document.documentElement.dataset.textSize}},[data.state.settings.textSize]);
  const update=(recipe:(current:FinanceData)=>FinanceData)=>{const next=recipe(data);if(next===data)return;setUndoStack(stack=>[...stack.slice(-19),data]);setRedoStack([]);setData(next)};
  const undo=()=>{const previous=undoStack.at(-1);if(!previous)return;setUndoStack(stack=>stack.slice(0,-1));setRedoStack(stack=>[data,...stack].slice(0,20));setData(previous)};
  const redo=()=>{const next=redoStack[0];if(!next)return;setRedoStack(stack=>stack.slice(1));setUndoStack(stack=>[...stack.slice(-19),data]);setData(next)};
  const importData=(incoming:FinanceData)=>{setUndoStack(stack=>[...stack.slice(-19),data]);setRedoStack([]);setData(incoming)};
  const addEvent=(event:FinanceEvent)=>update(current=>({...current,state:{...current.state,events:[...(current.state.events??[]).filter(e=>e.id!==event.id),event]}}));
  const deleteEvent=(id:string)=>update(current=>({...current,state:{...current.state,events:(current.state.events??[]).filter(e=>e.id!==id)}}));
  const editEvent=(id:string)=>{setEditing(id);setQuickOpen(true)};const open=(kind:EventKind='expense')=>{setEditing(null);setQuickKind(kind);setQuickOpen(true)};
  const upsertRecurring=(item:RecurringItem)=>update(current=>{const seeded=current.seed.recurring.some(seed=>seed.id===item.id);if(seeded)return {...current,state:{...current.state,recurringOverrides:{...current.state.recurringOverrides,[item.id]:item}}};return {...current,state:{...current.state,recurringCustom:[...(current.state.recurringCustom??[]).filter(r=>r.id!==item.id),item]}}});
  const withLoan=(current:FinanceData,loan:Loan)=>{if(current.seed.loans.some(item=>item.id===loan.id))return {...current,state:{...current.state,loanOverrides:{...current.state.loanOverrides,[loan.id]:loan}}};return {...current,state:{...current.state,customLoans:[...(current.state.customLoans??[]).filter(item=>item.id!==loan.id),loan]}}};
  const upsertLoan=(loan:Loan)=>update(current=>withLoan(current,loan));
  const createSelfLoan=(loan:Loan,event:FinanceEvent)=>update(current=>{const next=withLoan(current,loan);return {...next,state:{...next.state,events:[...(next.state.events??[]).filter(existing=>existing.id!==event.id),event]}}});
  const upsertBank=(bank:CardBank)=>update(current=>({...current,state:{...current.state,cardBanks:[...(current.state.cardBanks??[]).filter(item=>item.id!==bank.id),bank]}}));
  const upsertCard=(card:PaymentCard)=>update(current=>({...current,state:{...current.state,cards:[...(current.state.cards??[]).filter(item=>item.id!==card.id),card]}}));
  const archiveCard=(card:PaymentCard)=>upsertCard(archiveCardRecord(card));
  const content=page==='dashboard'?<DashboardPage data={data} month={month} asOf={today} motionMode={data.state.settings.motion||'system'} onQuickAdd={()=>open()} onTransactions={()=>setPage('transactions')}/>:page==='transactions'?<TransactionsPage data={data} month={month} onEditEvent={editEvent} onDeleteEvent={deleteEvent}/>:page==='review'?<ReviewPage data={data} onDecision={(id,decision)=>update(c=>({...c,state:{...c.state,reviewDecisions:{...(c.state.reviewDecisions??{}),[id]:decision}}}))}/>:page==='savings'?<SavingsPage data={data} month={month} asOf={today} onCreate={addEvent}/>:page==='cards'?<CardsPage data={data} onUpsertBank={upsertBank} onUpsertCard={upsertCard} onArchiveCard={archiveCard} onOpenCredit={()=>setPage('credit')}/>:page==='credit'?<CreditCardPage data={data} asOf={today} onCreateEvent={addEvent} onEditEvent={editEvent} onDeleteEvent={deleteEvent} onUpsertCard={upsertCard} onArchiveCard={archiveCard}/>:page==='loans'?<LoansPage data={data} asOf={today} onUpsertLoan={upsertLoan} onCreateEvent={addEvent} onCreateSelfLoan={createSelfLoan}/>:page==='lending'?<LendingPage data={data} asOf={today} onCreateEvent={addEvent}/>:page==='recurring'?<RecurringPage data={data} asOf={today} onUpsert={upsertRecurring} onCreateEvent={addEvent} onOpenLoans={()=>setPage('loans')}/>:page==='reports'?<ReportsPage data={data} month={month}/>:<SettingsPage data={data} filePath="Synthetic QA" lastSavedAt={data.updatedAt} onImport={async incoming=>importData(incoming)} onBackup={async()=>({path:'synthetic/backup.json'})} onSettings={settings=>update(c=>({...c,state:{...c.state,settings:{...settings,motion:'full'}}}))}/>;
  const periodVisible=['dashboard','transactions','savings','reports'].includes(page);
  return <><AppShell page={page} onPage={next=>{setCrash(false);setPage(next)}} onQuickAdd={()=>open()} onUndo={undo} onRedo={redo} canUndo={undoStack.length>0} canRedo={redoStack.length>0} saveState={saveState} filePath="Synthetic QA" motionMode={data.state.settings.motion||'system'} userEmail="qa@example.invalid" onLogout={()=>{}}><PersistenceNotice saveState={saveState} onRecover={()=>setSaveState('saved')}/>{periodVisible?<div className="period-row"><PeriodControl month={month} onChange={setMonth}/><button type="button" className="text-button" data-qa-crash onClick={()=>setCrash(true)}>QA render failure</button></div>:<button type="button" className="text-button qa-crash-floating" data-qa-crash onClick={()=>setCrash(true)}>QA render failure</button>}<PageErrorBoundary resetKey={page} onDashboard={()=>{setCrash(false);setPage('dashboard')}}>{crash?<Crash/>:content}</PageErrorBoundary></AppShell><QuickAdd open={quickOpen} data={data} asOf={today} initial={(data.state.events??[]).find(e=>e.id===editing)||null} initialKind={quickKind} motionMode={data.state.settings.motion||'system'} onClose={()=>{setQuickOpen(false);setEditing(null)}} onCreate={addEvent} currentBalance={id=>accountBalances(data,today)[id]||0}/></>;
}

function QaApp(){const params=new URLSearchParams(location.search);const screen=params.get('screen');if(screen==='login')return <LoginScreen error={params.get('error')==='1'?'Τα στοιχεία σύνδεσης δεν είναι σωστά.':''} onLogin={async()=>false}/>;if(screen==='mfa'||screen==='mfa-enroll')return <MfaScreen mode={screen==='mfa-enroll'?'enroll':'challenge'} email="qa@example.invalid" error={params.get('error')==='1'?'Ο κωδικός επαλήθευσης δεν είναι σωστός.':''} onEnroll={async()=>({factorId:'qa-factor',qrCode:'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22/%3E',secret:'QA-ONLY-SECRET'})} onVerify={async()=>false} onLogout={async()=>{}}/>;return <QaWorkspace/>}

createRoot(document.getElementById('root')!).render(<StrictMode><QaApp/></StrictMode>);
