import { lazy, Suspense, useEffect, useState } from 'react';
import { AppShell, type PageId } from './components/AppShell';
import { AppSkeleton, PageSkeleton } from './components/AppSkeleton';
import { LoginScreen } from './components/LoginScreen';
import { MfaScreen } from './components/MfaScreen';
import { PageErrorBoundary } from './components/PageErrorBoundary';
import { PeriodControl } from './components/PeriodControl';
import { PersistenceNotice } from './components/PersistenceNotice';
import { QuickAdd, type QuickPrefill } from './components/QuickAdd';
import { useFinance } from './hooks/useFinance';
import { useLocalDate } from './hooks/useLocalDate';
import { useSession } from './hooks/useSession';
import { archiveCardRecord } from './lib/cards';
import { accountBalances } from './lib/domain';
import { reportingMonthForDate } from './lib/localDate';
import type { CardBank, EventKind, FinanceData, FinanceEvent, Loan, PaymentCard, RecurringItem, ReviewDecision, ScheduledTransaction } from './types';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage').then((module) => ({ default: module.TransactionsPage })));
const ReviewPage = lazy(() => import('./pages/ReviewPage').then((module) => ({ default: module.ReviewPage })));
const SavingsPage = lazy(() => import('./pages/SavingsPage').then((module) => ({ default: module.SavingsPage })));
const CardsPage = lazy(() => import('./pages/CardsPage').then((module) => ({ default: module.CardsPage })));
const CreditCardPage = lazy(() => import('./pages/CreditCardPage').then((module) => ({ default: module.CreditCardPage })));
const LoansPage = lazy(() => import('./pages/LoansPage').then((module) => ({ default: module.LoansPage })));
const RecurringPage = lazy(() => import('./pages/RecurringPage').then((module) => ({ default: module.RecurringPage })));
const LendingPage = lazy(() => import('./pages/LendingPage').then((module) => ({ default: module.LendingPage })));
const PlanningPage = lazy(() => import('./pages/PlanningPage').then((module) => ({ default: module.PlanningPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));

const PAGE_IDS: PageId[] = ['dashboard','transactions','review','savings','cards','credit','loans','lending','recurring','planning','reports','settings'];
const GENERIC_ENTRY_PAGES = new Set<PageId>(['dashboard','transactions']);
const PERIOD_PAGES = new Set<PageId>(['dashboard','transactions','savings','reports']);
function routeFromHash() { const raw=location.hash.replace(/^#\/?/,'').trim(); if(!raw)return {page:'dashboard' as PageId,notFound:false}; if(PAGE_IDS.includes(raw as PageId))return {page:raw as PageId,notFound:false}; return {page:'dashboard' as PageId,notFound:true}; }
function pageHash(page:PageId){return `#/${page}`;}
function PageLoading(){return <PageSkeleton/>;}
function NotFound({onHome}:{onHome:()=>void}){return <main className="login-screen"><section className="not-found neo-raised" aria-labelledby="not-found-title"><span className="eyebrow">404 · PRIVATE ROUTE</span><h1 id="not-found-title">Η ενότητα δεν υπάρχει</h1><p>Η διεύθυνση δεν αντιστοιχεί σε ενότητα του MyFinHub. Δεν εμφανίζονται οικονομικά στοιχεία σε αυτή την οθόνη.</p><div className="editor-actions"><button type="button" className="save-button" onClick={onHome}>Επιστροφή στο Dashboard</button></div></section></main>}

function FinanceApp({userEmail,onLogout}:{userEmail:string|null;onLogout:()=>void}){
  const finance=useFinance(); const today=useLocalDate(); const initialRoute=routeFromHash();
  const [page,setPage]=useState<PageId>(initialRoute.page); const [notFound,setNotFound]=useState(initialRoute.notFound); const [quickOpen,setQuickOpen]=useState(false); const [editingEventId,setEditingEventId]=useState<string|null>(null); const [quickKind,setQuickKind]=useState<EventKind>('expense'); const [quickPrefill,setQuickPrefill]=useState<QuickPrefill|null>(null); const [month,setMonth]=useState(()=>today.slice(0,7)); const [monthIsManual,setMonthIsManual]=useState(false);
  const navigate=(next:PageId,replace=false)=>{const hash=pageHash(next);if(location.hash!==hash){if(replace)history.replaceState(null,'',hash);else history.pushState(null,'',hash)}setNotFound(false);setPage(next)};
  useEffect(()=>{const sync=()=>{const next=routeFromHash();setPage(next.page);setNotFound(next.notFound)};window.addEventListener('hashchange',sync);window.addEventListener('popstate',sync);return()=>{window.removeEventListener('hashchange',sync);window.removeEventListener('popstate',sync)}},[]);
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){if(!GENERIC_ENTRY_PAGES.has(page))return;e.preventDefault();if(quickOpen)return;setEditingEventId(null);setQuickPrefill(null);setQuickKind('expense');setQuickOpen(true)}};addEventListener('keydown',onKey);return()=>removeEventListener('keydown',onKey)},[quickOpen,page]);
  useEffect(()=>{setMonth(current=>reportingMonthForDate(current,today,monthIsManual));},[today,monthIsManual]);
  useEffect(()=>{if(notFound)return;requestAnimationFrame(()=>{const heading=document.querySelector<HTMLElement>('#main-workspace h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true})}})},[page,notFound]);
  const data=finance.data; const textSize=data?.state.settings.textSize??'normal'; useEffect(()=>{document.documentElement.dataset.motion='full';return()=>{delete document.documentElement.dataset.motion}},[]); useEffect(()=>{document.documentElement.dataset.textSize=textSize;return()=>{delete document.documentElement.dataset.textSize}},[textSize]); if(!data)return <AppSkeleton/>; if(notFound)return <NotFound onHome={()=>navigate('dashboard',true)}/>;
  const addEvent=(event:FinanceEvent)=>finance.update(current=>{const events=current.state.events??[];const exists=events.some(e=>e.id===event.id);return {...current,state:{...current.state,events:exists?events.map(e=>e.id===event.id?event:e):[...events,event]}}});
  const deleteEvent=(id:string)=>finance.update(current=>({...current,state:{...current.state,events:(current.state.events??[]).filter(e=>e.id!==id)}}));
  const editEvent=(id:string)=>{setEditingEventId(id);setQuickPrefill(null);setQuickOpen(true)};
  const openQuick=(kind:EventKind='expense',prefill:QuickPrefill|null=null)=>{setEditingEventId(null);setQuickKind(kind);setQuickPrefill(prefill);setQuickOpen(true)};
  const upsertRecurring=(item:RecurringItem)=>finance.update(current=>{const seed=current.seed.recurring.some(r=>r.id===item.id);if(seed)return {...current,state:{...current.state,recurringOverrides:{...current.state.recurringOverrides,[item.id]:item}}};const custom=current.state.recurringCustom??[];const exists=custom.some(r=>r.id===item.id);return {...current,state:{...current.state,recurringCustom:exists?custom.map(r=>r.id===item.id?item:r):[...custom,item]}}});
  const withLoan=(current:FinanceData,loan:Loan)=>{if(current.seed.loans.some(l=>l.id===loan.id))return {...current,state:{...current.state,loanOverrides:{...current.state.loanOverrides,[loan.id]:loan}}};const custom=current.state.customLoans??[];const exists=custom.some(l=>l.id===loan.id);return {...current,state:{...current.state,customLoans:exists?custom.map(l=>l.id===loan.id?loan:l):[...custom,loan]}}};
  const upsertLoan=(loan:Loan)=>finance.update(current=>withLoan(current,loan));
  const createSelfLoan=(loan:Loan,event:FinanceEvent)=>finance.update(current=>{const next=withLoan(current,loan);const events=next.state.events??[];return {...next,state:{...next.state,events:[...events.filter(existing=>existing.id!==event.id),event]}}});
  const upsertBank=(bank:CardBank)=>finance.update(current=>{const banks=current.state.cardBanks??[];const exists=banks.some(item=>item.id===bank.id);return {...current,state:{...current.state,cardBanks:exists?banks.map(item=>item.id===bank.id?bank:item):[...banks,bank]}}});
  const upsertCard=(card:PaymentCard)=>finance.update(current=>{const cards=current.state.cards??[];const exists=cards.some(item=>item.id===card.id);return {...current,state:{...current.state,cards:exists?cards.map(item=>item.id===card.id?card:item):[...cards,card]}}});
  const archiveCard=(card:PaymentCard)=>upsertCard(archiveCardRecord(card));
  const upsertScheduled=(item:ScheduledTransaction)=>finance.update(current=>{const items=current.state.scheduled??[];const exists=items.some(existing=>existing.id===item.id);return {...current,state:{...current.state,scheduled:exists?items.map(existing=>existing.id===item.id?item:existing):[...items,item]}}});
  const completeScheduled=(item:ScheduledTransaction,event:FinanceEvent)=>finance.update(current=>{const scheduled=current.state.scheduled??[];const events=current.state.events??[];return {...current,state:{...current.state,scheduled:[...scheduled.filter(existing=>existing.id!==item.id),item],events:[...events.filter(existing=>existing.id!==event.id),event]}}});
  const decide=(id:string,decision:ReviewDecision)=>finance.update(current=>({...current,state:{...current.state,reviewDecisions:{...(current.state.reviewDecisions??{}),[id]:decision}}}));
  const balance=(accountId:string)=>accountBalances(data,today)[accountId]||0;
  const recover=()=>{if((finance.saveState==='error'||finance.saveState==='conflict')&&!window.confirm('Η επαναφόρτωση θα απορρίψει τυχόν τοπικές αλλαγές που δεν αποθηκεύτηκαν. Να φορτωθεί η τελευταία έκδοση από τη βάση;'))return;void finance.reload()};

  const content=page==='dashboard'?<DashboardPage data={data} month={month} asOf={today} motionMode="full" onQuickAdd={(prefill?:QuickPrefill)=>openQuick('expense',prefill||null)} onTransactions={()=>navigate('transactions')} onPlanning={()=>navigate('planning')}/>
    :page==='transactions'?<TransactionsPage data={data} month={month} onEditEvent={editEvent} onDeleteEvent={deleteEvent}/>
    :page==='review'?<ReviewPage data={data} onDecision={decide}/>
    :page==='savings'?<SavingsPage data={data} month={month} asOf={today} onCreate={addEvent}/>
    :page==='cards'?<CardsPage data={data} onUpsertBank={upsertBank} onUpsertCard={upsertCard} onArchiveCard={archiveCard} onOpenCredit={()=>navigate('credit')}/>
    :page==='credit'?<CreditCardPage data={data} asOf={today} onCreateEvent={addEvent} onEditEvent={editEvent} onDeleteEvent={deleteEvent} onUpsertCard={upsertCard} onArchiveCard={archiveCard}/>
    :page==='loans'?<LoansPage data={data} asOf={today} onUpsertLoan={upsertLoan} onCreateEvent={addEvent} onCreateSelfLoan={createSelfLoan}/>
    :page==='lending'?<LendingPage data={data} asOf={today} onCreateEvent={addEvent}/>
    :page==='recurring'?<RecurringPage data={data} asOf={today} onUpsert={upsertRecurring} onCreateEvent={addEvent} onOpenLoans={()=>navigate('loans')}/>
    :page==='planning'?<PlanningPage data={data} asOf={today} onUpsertScheduled={upsertScheduled} onCompleteScheduled={completeScheduled}/>
    :page==='reports'?<ReportsPage data={data} month={month}/>
    :<SettingsPage data={data} filePath={finance.filePath} lastSavedAt={finance.lastSavedAt} onImport={finance.importData} onBackup={finance.createBackup} onSettings={settings=>finance.update(c=>({...c,state:{...c.state,settings:{...settings,motion:'full'}}}))}/>;

  return <><AppShell page={page} onPage={navigate} onQuickAdd={()=>openQuick('expense')} onRefresh={()=>{void finance.reload()}} onUndo={()=>{finance.undo()}} onRedo={()=>{finance.redo()}} canUndo={finance.canUndo} canRedo={finance.canRedo} saveState={finance.saveState} filePath={finance.filePath} motionMode="full" userEmail={userEmail} onLogout={onLogout}><PersistenceNotice saveState={finance.saveState} onRecover={recover}/>{PERIOD_PAGES.has(page)?<div className="period-row"><PeriodControl month={month} onChange={next=>{setMonth(next);setMonthIsManual(true)}}/><span>Στοιχεία περιόδου</span></div>:null}{finance.saveState==='loading'?<PageSkeleton/>:<PageErrorBoundary resetKey={page} onDashboard={()=>navigate('dashboard')}><Suspense fallback={<PageLoading/>}>{content}</Suspense></PageErrorBoundary>}</AppShell><QuickAdd open={quickOpen} data={data} asOf={today} motionMode="full" initial={(data.state.events??[]).find(e=>e.id===editingEventId)||null} initialKind={quickKind} prefill={quickPrefill} onClose={()=>{setQuickOpen(false);setEditingEventId(null);setQuickPrefill(null)}} onCreate={addEvent} currentBalance={balance}/></>;
}

export default function App(){const session=useSession();if(session.state==='loading')return <div className="boot-screen"><img src="/brand/icon-192.png" alt="MyFinHub"/><div className="boot-pulse"/><b>MyFinHub</b><span>Έλεγχος ασφαλούς συνεδρίας…</span></div>;if(session.state==='error')return <div className="boot-screen"><img src="/brand/icon-192.png" alt="MyFinHub"/><b>MyFinHub</b><span>{session.error||'Δεν ήταν δυνατός ο έλεγχος της συνεδρίας.'}</span><button className="secondary" type="button" onClick={()=>void session.refresh()}>Δοκιμή ξανά</button></div>;if(session.state==='mfa'||session.state==='mfa-enroll')return <MfaScreen mode={session.state==='mfa-enroll'?'enroll':'challenge'} email={session.email} error={session.error} onEnroll={session.enrollMfa} onVerify={session.verifyMfa} onLogout={async()=>{await session.logout()}}/>;if(session.state!=='authenticated')return <LoginScreen onLogin={session.login} error={session.error}/>;return <><FinanceApp userEmail={session.email} onLogout={()=>{void session.logout()}}/>{session.error?<div className="session-error-banner" role="alert">{session.error}</div>:null}</>}
