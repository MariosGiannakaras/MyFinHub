import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell, type PageId } from './components/AppShell';
import { CommandPalette } from './components/CommandPalette';
import { ContextualQuickAdd, type QuickActionContext } from './components/ContextualQuickAdd';
import { PageSkeleton } from './components/AppSkeleton';
import { PeriodControl } from './components/PeriodControl';
import { LoginScreen } from './components/LoginScreen';
import { MfaScreen } from './components/MfaScreen';
import { PageErrorBoundary } from './components/PageErrorBoundary';
import { PersistenceNotice } from './components/PersistenceNotice';
import type { QuickPrefill } from './components/QuickAdd';
import { financeChangeLabel, type ChangeHistoryEntry, type SaveState } from './hooks/useFinance';
import type { AttentionItem } from './lib/attention';
import { archiveCardRecord } from './lib/cards';
import type { RankedCommandSearchItem } from './lib/commandSearch';
import { accountBalances, allAccounts, createEvent } from './lib/domain';
import { applyTransactionRules } from './lib/transactionRules';
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
import { PlanningPage } from './pages/PlanningPage';
import { AttentionPage } from './pages/AttentionPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import type { AttentionDecision, CardBank, EventKind, FinanceData, FinanceEvent, Loan, MonthlyBudget, PaymentCard, RecurringItem, ScheduledTransaction, TextSizePreference, TransactionRule } from './types';
import './styles.css';

const QA_PAGES:PageId[]=['dashboard','transactions','review','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings'];
const QA_PAGE_HEADINGS:Record<PageId,string>={dashboard:'Οι λογαριασμοί μου',transactions:'Συναλλαγές',review:'Έλεγχος παλιών κινήσεων',savings:'Αποταμίευση',cards:'Κάρτες',credit:'Πιστωτική Κάρτα',loans:'Δόσεις & Δάνεια',lending:'Δανεικά & επιστροφές',recurring:'Πάγια & Συνδρομές',planning:'Προγραμματισμός & πρόβλεψη ρευστότητας',attention:'Τι χρειάζεται προσοχή',reports:'Αναφορές · Η οικονομική εικόνα του μήνα',settings:'Ρυθμίσεις'};
const quickToken=()=>`qa-quick-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
type DistributiveOmit<T,K extends PropertyKey>=T extends unknown?Omit<T,K>:never;
type SpecialQuickContext=DistributiveOmit<Exclude<QuickActionContext,{mode:'generic'}>,'token'>;

function Crash(): never { throw new Error('synthetic-render-failure'); }
function initialSaveState(raw:string|null):SaveState{return raw==='error'||raw==='conflict'||raw==='saving'||raw==='loading'?raw:'saved'}
function initialPage(raw:string|null):PageId{return QA_PAGES.includes(raw as PageId)?raw as PageId:'dashboard'}
function initialTextSize(raw:string|null):TextSizePreference{return raw==='compact'||raw==='large'?raw:'normal'}
function buildQaData(params:URLSearchParams){
  const next=qaFinanceData();
  if(params.get('motion')==='reduced')next.state.settings.motion='reduced';
  next.state.settings.textSize=initialTextSize(params.get('text'));
  next.state.budgets=next.state.budgets??[];next.state.transactionRules=next.state.transactionRules??[];
  if(params.get('state')==='empty'){
    next.seed.transactions=[];next.seed.recurring=[];next.seed.loans=[];next.seed.lending=[];next.seed.snapshots=next.seed.snapshots.map(snapshot=>({...snapshot,balances:{...snapshot.balances,'piraeus-payroll':1000,'piraeus-savings':1000,cash:1000}}));next.state.events=[];next.state.scheduled=[];next.state.recurringCustom=[];next.state.recurringOverrides={};next.state.customLoans=[];next.state.loanOverrides={};next.state.cards=[];next.state.cardBanks=[];next.state.reviewDecisions={};next.state.attentionDecisions={};next.state.budgets=[];next.state.transactionRules=[];
  }
  if(params.get('state')==='extreme'){
    next.state.settings.accountNames={...next.state.settings.accountNames,'piraeus-payroll':'Κύριος λογαριασμός μισθοδοσίας με εξαιρετικά μεγάλο όνομα για έλεγχο διάταξης'};
    next.state.events=[...(next.state.events??[]),...Array.from({length:36},(_,index)=>({id:`extreme-${index}`,date:`2026-08-${String((index%17)+1).padStart(2,'0')}`,kind:'expense' as const,amount:index===0?987654.32:10+index,note:index===0?'Πολύ μεγάλη περιγραφή συναλλαγής που ελέγχει αναδίπλωση κειμένου χωρίς να δημιουργεί οριζόντια κύλιση ή επικάλυψη στα κουμπιά και στα ποσά':'Επαναλαμβανόμενη δοκιμαστική κίνηση',category:'Σταθερά έξοδα',accountId:'piraeus-payroll',legs:[{accountId:'piraeus-payroll',amount:-(index===0?987654.32:10+index)}],source:'user' as const,createdAt:`2026-08-17T12:${String(index%60).padStart(2,'0')}:00.000Z`,updatedAt:`2026-08-17T12:${String(index%60).padStart(2,'0')}:00.000Z`}))];
    next.state.recurringCustom=[...(next.state.recurringCustom??[]),...Array.from({length:18},(_,index)=>({id:`rec-extreme-${index}`,name:`Συνδρομή με μεγάλο όνομα ${index+1}`,amount:10+index,day:(index%28)+1,accountId:'piraeus-payroll',category:'Σταθερά έξοδα',active:true,status:'active' as const,source:'qa'}))];
    next.state.scheduled=[...(next.state.scheduled??[]),...Array.from({length:18},(_,index)=>({id:`scheduled-extreme-${index}`,dueDate:`2026-${String(8+Math.floor((index+1)/28)).padStart(2,'0')}-${String((index%27)+1).padStart(2,'0')}`,kind:'expense' as const,amount:index===0?123456.78:20+index,note:index===0?'Πολύ μεγάλη περιγραφή προγραμματισμένης πληρωμής για έλεγχο αναδίπλωσης χωρίς overlap στα actions και στο ποσό':`Προγραμματισμένη κίνηση ${index+1}`,category:'Σταθερά έξοδα',accountId:'piraeus-payroll',status:'pending' as const,createdAt:'2026-08-10T10:00:00.000Z',updatedAt:'2026-08-10T10:00:00.000Z'}))];
  }
  if(params.get('state')==='overlimit')next.state.cards=(next.state.cards??[]).map(card=>card.kind==='credit'?{...card,creditLimit:100}:card);
  if(params.get('state')==='forecast-negative')next.state.scheduled=[...(next.state.scheduled??[]),{id:'qa-negative-forecast',dueDate:'2026-08-18',kind:'expense',amount:3000,note:'Μεγάλη γνωστή υποχρέωση',category:'Σταθερά έξοδα',accountId:'piraeus-payroll',status:'pending',createdAt:'2026-08-10T10:00:00.000Z',updatedAt:'2026-08-10T10:00:00.000Z'}];
  if(params.get('state')==='budget-rules'){
    const stamp='2026-08-17T12:00:00.000Z';
    const event=createEvent({kind:'expense',date:'2026-08-16',amount:90,note:'QA Market Match',category:'Σταθερά έξοδα',accountId:'piraeus-payroll'});event.createdAt=stamp;event.updatedAt=stamp;
    next.state.events=[...(next.state.events??[]),event];
    next.state.budgets=[{id:'budget:2026-08:%CF%83%CF%84%CE%B1%CE%B8%CE%B5%CF%81%CE%AC%20%CE%AD%CE%BE%CE%BF%CE%B4%CE%B1',month:'2026-08',scope:'category',category:'Σταθερά έξοδα',amount:50,alertThreshold:.8,createdAt:stamp,updatedAt:stamp}];
    next.state.transactionRules=[];
  }
  return next;
}

function QaWorkspace(){
  const params=new URLSearchParams(location.search);
  const [data,setData]=useState<FinanceData>(()=>buildQaData(params));
  const [undoStack,setUndoStack]=useState<FinanceData[]>([]);
  const [redoStack,setRedoStack]=useState<FinanceData[]>([]);
  const [changeHistory,setChangeHistory]=useState<ChangeHistoryEntry[]>([]);
  const [saveState,setSaveState]=useState<SaveState>(()=>initialSaveState(params.get('save')));
  const [page,setPage]=useState<PageId>(()=>initialPage(params.get('page')));
  const [quickOpen,setQuickOpen]=useState(false);
  const [commandOpen,setCommandOpen]=useState(false);
  const [quickContext,setQuickContext]=useState<QuickActionContext|null>(null);
  const [editing,setEditing]=useState<string|null>(null);
  const [crash,setCrash]=useState(false);
  const [month,setMonth]=useState('2026-08');
  const today='2026-08-17';

  useEffect(()=>{document.documentElement.dataset.motion=data.state.settings.motion||'system';return()=>{delete document.documentElement.dataset.motion}},[data.state.settings.motion]);
  useEffect(()=>{document.documentElement.dataset.textSize=data.state.settings.textSize??'normal';return()=>{delete document.documentElement.dataset.textSize}},[data.state.settings.textSize]);

  const recordHistory=(kind:ChangeHistoryEntry['kind'],label:string)=>{const entry:ChangeHistoryEntry={id:`qa-history-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,kind,label,at:new Date().toISOString()};setChangeHistory(items=>[entry,...items].slice(0,20))};
  const update=(recipe:(current:FinanceData)=>FinanceData)=>{const current=data;const next=recipe(current);if(next===current)return;setUndoStack(stack=>[...stack.slice(-19),current]);setRedoStack([]);recordHistory('change',financeChangeLabel(current,next));setData(next)};
  const undo=()=>{const previous=undoStack.at(-1);if(!previous)return;setUndoStack(stack=>stack.slice(0,-1));setRedoStack(stack=>[data,...stack].slice(0,20));recordHistory('undo','Αναίρεση τελευταίας αλλαγής');setData(previous)};
  const redo=()=>{const next=redoStack[0];if(!next)return;setRedoStack(stack=>stack.slice(1));setUndoStack(stack=>[...stack.slice(-19),data]);recordHistory('redo','Επαναφορά τελευταίας αναιρεμένης αλλαγής');setData(next)};
  const refresh=()=>{setSaveState('loading');window.setTimeout(()=>setSaveState('saved'),350)};
  const importData=(incoming:FinanceData)=>{setUndoStack(stack=>[...stack.slice(-19),data]);setRedoStack([]);setData(incoming)};
  const addEvent=(event:FinanceEvent)=>update(current=>{const events=current.state.events??[];const exists=events.some(existing=>existing.id===event.id);const nextEvent=exists?event:applyTransactionRules(current,event);return {...current,state:{...current.state,events:exists?events.map(existing=>existing.id===event.id?nextEvent:existing):[...events,nextEvent]}}});
  const deleteEvent=(id:string)=>update(current=>({...current,state:{...current.state,events:(current.state.events??[]).filter(e=>e.id!==id)}}));
  const editEvent=(id:string)=>{const event=(data.state.events??[]).find(item=>item.id===id);setEditing(id);setQuickContext({token:quickToken(),mode:'generic',kind:event?.kind||'expense',prefill:null});setQuickOpen(true)};
  const openGeneric=(kind:EventKind='expense',prefill:QuickPrefill|null=null)=>{setEditing(null);setQuickContext({token:quickToken(),mode:'generic',kind,prefill});setQuickOpen(true)};
  const openSpecial=(context:SpecialQuickContext)=>{setEditing(null);setQuickContext({...context,token:quickToken()} as QuickActionContext);setQuickOpen(true)};
  const openCommand=()=>{if(quickOpen)return;setCommandOpen(true)};
  const upsertRecurring=(item:RecurringItem)=>update(current=>{const seeded=current.seed.recurring.some(seed=>seed.id===item.id);if(seeded)return {...current,state:{...current.state,recurringOverrides:{...current.state.recurringOverrides,[item.id]:item}}};return {...current,state:{...current.state,recurringCustom:[...(current.state.recurringCustom??[]).filter(r=>r.id!==item.id),item]}}});
  const withLoan=(current:FinanceData,loan:Loan)=>{if(current.seed.loans.some(item=>item.id===loan.id))return {...current,state:{...current.state,loanOverrides:{...current.state.loanOverrides,[loan.id]:loan}}};return {...current,state:{...current.state,customLoans:[...(current.state.customLoans??[]).filter(item=>item.id!==loan.id),loan]}}};
  const upsertLoan=(loan:Loan)=>update(current=>withLoan(current,loan));
  const createSelfLoan=(loan:Loan,event:FinanceEvent)=>update(current=>{const next=withLoan(current,loan);return {...next,state:{...next.state,events:[...(next.state.events??[]).filter(existing=>existing.id!==event.id),event]}}});
  const upsertBank=(bank:CardBank)=>update(current=>({...current,state:{...current.state,cardBanks:[...(current.state.cardBanks??[]).filter(item=>item.id!==bank.id),bank]}}));
  const upsertCard=(card:PaymentCard)=>update(current=>({...current,state:{...current.state,cards:[...(current.state.cards??[]).filter(item=>item.id!==card.id),card]}}));
  const archiveCard=(card:PaymentCard)=>upsertCard(archiveCardRecord(card));
  const upsertScheduled=(item:ScheduledTransaction)=>update(current=>({...current,state:{...current.state,scheduled:[...(current.state.scheduled??[]).filter(existing=>existing.id!==item.id),item]}}));
  const completeScheduled=(item:ScheduledTransaction,event:FinanceEvent)=>update(current=>{const nextEvent=applyTransactionRules(current,event);return {...current,state:{...current.state,scheduled:[...(current.state.scheduled??[]).filter(existing=>existing.id!==item.id),item],events:[...(current.state.events??[]).filter(existing=>existing.id!==nextEvent.id),nextEvent]}}});
  const upsertBudget=(budget:MonthlyBudget)=>update(current=>({...current,state:{...current.state,budgets:[...(current.state.budgets??[]).filter(item=>item.id!==budget.id),budget]}}));
  const deleteBudget=(id:string)=>update(current=>({...current,state:{...current.state,budgets:(current.state.budgets??[]).filter(item=>item.id!==id)}}));
  const upsertRule=(rule:TransactionRule)=>update(current=>({...current,state:{...current.state,transactionRules:[...(current.state.transactionRules??[]).filter(item=>item.id!==rule.id),rule]}}));
  const deleteRule=(id:string)=>update(current=>({...current,state:{...current.state,transactionRules:(current.state.transactionRules??[]).filter(item=>item.id!==id)}}));
  const decideAttention=(id:string,decision:AttentionDecision)=>update(current=>({...current,state:{...current.state,attentionDecisions:{...(current.state.attentionDecisions??{}),[id]:decision}}}));
  const handleAttention=(item:AttentionItem)=>{
    if(item.action==='pay_recurring'&&item.recurringId){openSpecial({mode:'recurring',recurringId:item.recurringId,amount:item.amount,accountId:item.accountId});return}
    if(item.action==='pay_loan'&&item.loanId){openSpecial({mode:'loan',loanId:item.loanId,amount:item.amount,accountId:item.accountId});return}
    if(item.action==='pay_credit'&&item.cardId){openSpecial({mode:'credit',action:'payment',cardId:item.cardId,amount:item.amount});return}
    if(item.action==='collect_lending'&&item.person){openSpecial({mode:'lending',action:'repay',person:item.person,amount:item.amount,accountId:data.state.settings.defaultIncomeAccount});return}
    if(item.action==='complete_scheduled'&&item.scheduledId){openSpecial({mode:'scheduled',scheduledId:item.scheduledId});return}
    if(item.action==='open_forecast'){setPage('planning');return}
    if(item.action==='open_budgets'){setPage('reports')}
  };
  const handleCommand=(row:RankedCommandSearchItem)=>{
    setCommandOpen(false);const action=row.action;
    if(action.type==='navigate'){setPage(action.page);return}
    if(action.type==='quick_add'){
      if(action.accountId){const account=allAccounts(data).find(item=>item.id===action.accountId);if(account?.kind==='savings'){openSpecial({mode:'savings',toAccountId:action.accountId,savingSource:'manual_transfer'});return}openGeneric(action.kind,{note:'',amount:0,accountId:action.accountId});return}
      openGeneric(action.kind);return;
    }
    if(action.type==='credit_payment'){openSpecial({mode:'credit',action:'payment',cardId:action.cardId});return}
    if(action.type==='loan_payment'){openSpecial({mode:'loan',loanId:action.loanId,accountId:action.accountId});return}
    if(action.type==='lending_repayment'){openSpecial({mode:'lending',action:'repay',person:action.person,accountId:action.accountId??data.state.settings.defaultIncomeAccount});return}
    if(action.type==='recurring_payment'){openSpecial({mode:'recurring',recurringId:action.recurringId,accountId:action.accountId});return}
    if(action.type==='scheduled_complete'){openSpecial({mode:'scheduled',scheduledId:action.scheduledId})}
  };

  const content=page==='dashboard'
    ?<DashboardPage data={data} month={month} asOf={today} motionMode={data.state.settings.motion||'system'} onQuickAdd={(prefill?:QuickPrefill)=>openGeneric('expense',prefill||null)} onAccountQuickAdd={(accountId,kind)=>kind==='savings'?openSpecial({mode:'savings',toAccountId:accountId,savingSource:'manual_transfer'}):openGeneric('expense',{note:'',amount:0,accountId})} onTransactions={()=>setPage('transactions')} onPlanning={()=>setPage('planning')} onAttention={()=>setPage('attention')} onReports={()=>setPage('reports')}/>
    :page==='transactions'?<TransactionsPage data={data} month={month} onEditEvent={editEvent} onDeleteEvent={deleteEvent}/>
    :page==='review'?<ReviewPage data={data} onDecision={(id,decision)=>update(current=>({...current,state:{...current.state,reviewDecisions:{...(current.state.reviewDecisions??{}),[id]:decision}}}))}/>
    :page==='savings'?<SavingsPage data={data} month={month} asOf={today} onCreate={addEvent} onQuickAdd={openSpecial}/>
    :page==='cards'?<CardsPage data={data} onUpsertBank={upsertBank} onUpsertCard={upsertCard} onArchiveCard={archiveCard} onOpenCredit={()=>setPage('credit')}/>
    :page==='credit'?<CreditCardPage data={data} asOf={today} onCreateEvent={addEvent} onEditEvent={editEvent} onDeleteEvent={deleteEvent} onUpsertCard={upsertCard} onArchiveCard={archiveCard} onPayCard={cardId=>openSpecial({mode:'credit',action:'payment',cardId})}/>
    :page==='loans'?<LoansPage data={data} asOf={today} onUpsertLoan={upsertLoan} onCreateSelfLoan={createSelfLoan} onPayLoan={loanId=>openSpecial({mode:'loan',loanId})}/>
    :page==='lending'?<LendingPage data={data} asOf={today} onCreateEvent={addEvent} onQuickAdd={openSpecial}/>
    :page==='recurring'?<RecurringPage data={data} asOf={today} onUpsert={upsertRecurring} onOpenLoans={()=>setPage('loans')} onPayRecurring={recurringId=>openSpecial({mode:'recurring',recurringId})}/>
    :page==='planning'?<PlanningPage data={data} asOf={today} onUpsertScheduled={upsertScheduled} onCompleteScheduled={completeScheduled}/>
    :page==='attention'?<AttentionPage data={data} asOf={today} onAction={handleAttention} onDecision={decideAttention}/>
    :page==='reports'?<ReportsPage data={data} month={month}/>
    :<SettingsPage data={data} asOf={today} filePath="Synthetic QA" lastSavedAt={data.updatedAt} onImport={async incoming=>importData(incoming)} onBackup={async()=>({path:'synthetic/backup.json'})} onSettings={settings=>update(current=>({...current,state:{...current.state,settings:{...settings,motion:'full'}}}))} onUpsertBudget={upsertBudget} onDeleteBudget={deleteBudget} onUpsertRule={upsertRule} onDeleteRule={deleteRule}/>;
  const periodVisible=['dashboard','transactions','savings','reports'].includes(page);

  return <>
    <AppShell page={page} onPage={next=>{setCrash(false);setPage(next)}} onQuickAdd={()=>openGeneric()} onCommand={openCommand} onRefresh={refresh} onUndo={undo} onRedo={redo} canUndo={undoStack.length>0} canRedo={redoStack.length>0} history={changeHistory} saveState={saveState} filePath="Synthetic QA" motionMode={data.state.settings.motion||'system'} userEmail="qa@example.invalid" onLogout={()=>{}}>
      <PersistenceNotice saveState={saveState} onRecover={()=>setSaveState('saved')}/>
      {periodVisible?<div className="period-row"><PeriodControl month={month} onChange={setMonth}/><button type="button" className="text-button" data-qa-crash onClick={()=>setCrash(true)}>QA render failure</button></div>:<button type="button" className="text-button qa-crash-floating" data-qa-crash onClick={()=>setCrash(true)}>QA render failure</button>}
      {saveState==='loading'?<div className="qa-loading-route"><h1 className="sr-only">{QA_PAGE_HEADINGS[page]}</h1><PageSkeleton/></div>:<PageErrorBoundary resetKey={page} onDashboard={()=>{setCrash(false);setPage('dashboard')}}>{crash?<Crash/>:content}</PageErrorBoundary>}
    </AppShell>
    <CommandPalette open={commandOpen} data={data} motionMode={data.state.settings.motion||'system'} onClose={()=>setCommandOpen(false)} onExecute={handleCommand}/>
    <ContextualQuickAdd open={quickOpen} data={data} asOf={today} context={quickContext} initial={(data.state.events??[]).find(event=>event.id===editing)||null} motionMode={data.state.settings.motion||'system'} onClose={()=>{setQuickOpen(false);setEditing(null);setQuickContext(null)}} onCreate={addEvent} onCompleteScheduled={completeScheduled} currentBalance={id=>accountBalances(data,today)[id]||0}/>
  </>;
}

function QaApp(){const params=new URLSearchParams(location.search);const screen=params.get('screen');if(screen==='login')return <LoginScreen error={params.get('error')==='1'?'Τα στοιχεία σύνδεσης δεν είναι σωστά.':''} onLogin={async()=>false}/>;if(screen==='mfa'||screen==='mfa-enroll')return <MfaScreen mode={screen==='mfa-enroll'?'enroll':'challenge'} email="qa@example.invalid" error={params.get('error')==='1'?'Ο κωδικός επαλήθευσης δεν είναι σωστός.':''} onEnroll={async()=>({factorId:'qa-factor',qrCode:'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22/%3E',secret:'QA-ONLY-SECRET'})} onVerify={async()=>false} onLogout={async()=>{}}/>;return <QaWorkspace/>}

createRoot(document.getElementById('root')!).render(<StrictMode><QaApp/></StrictMode>);