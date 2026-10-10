import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell, type PageId } from './components/AppShell';
import { AppSkeleton, PageSkeleton } from './components/AppSkeleton';
import { Button } from './components/Button';
import type { QuickActionContext } from './components/ContextualQuickAdd';
import { LoginScreen } from './components/LoginScreen';
import { MfaScreen } from './components/MfaScreen';
import { PageErrorBoundary } from './components/PageErrorBoundary';
import { NotFoundPage } from './pages/NotFoundPage';
import { PeriodControl } from './components/PeriodControl';
import { PersistenceNotice } from './components/PersistenceNotice';
import type { QuickPrefill } from './components/QuickAdd';
import { useFinance } from './hooks/useFinance';
import { useLocalDate } from './hooks/useLocalDate';
import { useSession } from './hooks/useSession';
import type { AttentionItem } from './lib/attention';
import { archiveCardRecord, canPermanentlyDeleteCreditCard, withCardSecretCleanupPending } from './lib/cards';
import type { RankedCommandSearchItem } from './lib/commandSearch';
import { prepareCreditStatementEvent } from './lib/creditStatements';
import { accountBalances, allAccounts } from './lib/domain';
import { withLegacyOverride, withLegacyTombstone } from './lib/legacyTransactions';
import { reportingMonthForDate } from './lib/localDate';
import { pageHash, resolveHashRoute, settingsHash, type SettingsTabId } from './lib/routing';
import type { TaxonomyOperation } from './lib/taxonomyManagement';
import { applyTransactionRules } from './lib/transactionRules';
import type {
  AttentionDecision,
  CardBank,
  EventKind,
  FinanceData,
  FinanceEvent,
  LegacyTransaction,
  Loan,
  MonthlyBudget,
  PaymentCard,
  RecurringItem,
  ReviewDecision,
  SavingsGoal,
  ScheduledTransaction,
  TransactionRule,
} from './types';

const CommandPalette = lazy(() => import('./components/CommandPalette').then((module) => ({ default: module.CommandPalette })));
const ContextualQuickAdd = lazy(() => import('./components/ContextualQuickAdd').then((module) => ({ default: module.ContextualQuickAdd })));
const ConfirmDialog = lazy(() => import('./components/ConfirmDialog').then((module) => ({ default: module.ConfirmDialog })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage').then((module) => ({ default: module.TransactionsPage })));
const SavingsPage = lazy(() => import('./pages/SavingsPage').then((module) => ({ default: module.SavingsPage })));
const CardsPage = lazy(() => import('./pages/CardsPage').then((module) => ({ default: module.CardsPage })));
const CreditCardPage = lazy(() => import('./pages/CreditCardPage').then((module) => ({ default: module.CreditCardPage })));
const LoansPage = lazy(() => import('./pages/LoansPage').then((module) => ({ default: module.LoansPage })));
const RecurringPage = lazy(() => import('./pages/RecurringPage').then((module) => ({ default: module.RecurringPage })));
const LendingPage = lazy(() => import('./pages/LendingPage').then((module) => ({ default: module.LendingPage })));
const PlanningPage = lazy(() => import('./pages/PlanningPage').then((module) => ({ default: module.PlanningPage })));
const AttentionPage = lazy(() => import('./pages/AttentionPage').then((module) => ({ default: module.AttentionPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));

const PERIOD_PAGES = new Set<PageId>(['dashboard','transactions','savings','reports']);

function routeFromLocation() {
  const route = resolveHashRoute(location.hash);
  if (route.redirectHash && location.hash !== route.redirectHash) history.replaceState(null, '', route.redirectHash);
  return route;
}

function PageLoading() { return <PageSkeleton/>; }
const quickToken = () => `quick-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type SpecialQuickContext = DistributiveOmit<Exclude<QuickActionContext, { mode: 'generic' }>, 'token'>;

function FinanceApp({ userEmail, onLogout }: { userEmail: string | null; onLogout: () => void }) {
  const finance = useFinance();
  const today = useLocalDate();
  const initialRoute = routeFromLocation();
  const [page, setPage] = useState<PageId>(initialRoute.page);
  const [settingsTab,setSettingsTab]=useState<SettingsTabId>(initialRoute.settingsTab??'general');
  const [notFound, setNotFound] = useState(initialRoute.notFound);
  const [quickOpen, setQuickOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [quickContext, setQuickContext] = useState<QuickActionContext | null>(null);
  const [month, setMonth] = useState(() => today.slice(0,7));
  const [monthIsManual, setMonthIsManual] = useState(false);
  const [recoverOpen,setRecoverOpen]=useState(false);
  const [privacyVisible,setPrivacyVisible]=useState(false);
  const cleanupAttempted=useRef(new Set<string>());
  const cleanupInFlight=useRef(new Map<string,Promise<void>>());
  const [cleanupBusy,setCleanupBusy]=useState(false);
  const [cleanupFailure,setCleanupFailure]=useState<string|null>(null);

  const navigate = (next: PageId, replace = false) => {
    const hash = pageHash(next);
    if (location.hash !== hash) {
      if (replace) history.replaceState(null, '', hash);
      else history.pushState(null, '', hash);
    }
    setNotFound(false);
    setPage(next);
    if(next==='settings')setSettingsTab('general');
  };
  const navigateSettingsTab=(tab:SettingsTabId)=>{
    const hash=settingsHash(tab);
    if(location.hash!==hash)history.pushState(null,'',hash);
    setNotFound(false);setPage('settings');setSettingsTab(tab);
  };

  useEffect(() => {
    const sync = () => { const next = routeFromLocation(); setPage(next.page); setSettingsTab(next.settingsTab??'general'); setNotFound(next.notFound); };
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync); };
  }, []);

  const openGeneric = (kind: EventKind = 'expense', prefill: QuickPrefill | null = null) => {
    setEditingEventId(null);
    setQuickContext({ token: quickToken(), mode: 'generic', kind, prefill });
    setQuickOpen(true);
  };
  const openSpecial = (context: SpecialQuickContext) => {
    setEditingEventId(null);
    setQuickContext({ ...context, token: quickToken() } as QuickActionContext);
    setQuickOpen(true);
  };
  const openCommand = () => {
    if (quickOpen) return;
    setCommandOpen(true);
  };

  useEffect(() => { setMonth((current) => reportingMonthForDate(current, today, monthIsManual)); }, [today, monthIsManual]);
  useEffect(() => {
    if (notFound) return;
    requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>('#main-workspace h1');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    });
  }, [page, notFound]);

  const data = finance.data;
  // One shared operation for user-initiated, automatic-on-reload and manual
  // retry. Never issue duplicate protected vault deletes for the same marker.
  const runCardCleanup=useCallback((id:string):Promise<void>=>{
    const inFlight=cleanupInFlight.current.get(id);
    if(inFlight)return inFlight;
    cleanupAttempted.current.add(id);
    setCleanupBusy(true);
    setCleanupFailure(null);
    const task=import('./lib/cardSecretDeletion').then(m=>m.finishCardDeletion(id,finance.updateDurably))
      .catch(error=>{
        setCleanupFailure('Το προφίλ έχει διαγραφεί, αλλά εκκρεμεί ο ασφαλής καθαρισμός. Έλεγξε τη σύνδεση ή την επιβεβαίωση δύο παραγόντων και δοκίμασε ξανά.');
        throw error;
      }).finally(()=>{
        cleanupInFlight.current.delete(id);
        setCleanupBusy(cleanupInFlight.current.size>0);
      });
    cleanupInFlight.current.set(id,task);
    return task;
  },[finance.updateDurably]);
  const pendingCleanup=useMemo(()=>data?(data.state.pendingCardSecretDeletes??[]).filter(id=>!(data.state.cards??[]).some(card=>card.id===id)):[],[data]);
  useEffect(()=>{
    if(!data||finance.saveState!=='saved')return;
    const id=pendingCleanup.find(key=>!cleanupAttempted.current.has(key));
    if(!id)return;
    // One automatic attempt per persisted marker and mounted session.
    // Failure retains the marker AND surfaces a recoverable notice.
    void runCardCleanup(id).catch(()=>{});
  },[data,finance.saveState,runCardCleanup,pendingCleanup]);
  const retryCardCleanup=()=>{
    const id=pendingCleanup.find(key=>!cleanupInFlight.current.has(key));
    if(id)void runCardCleanup(id).catch(()=>{});
  };
  const textSize = data?.state.settings.textSize ?? 'normal';
  useEffect(() => { document.documentElement.dataset.motion = 'full'; return () => { delete document.documentElement.dataset.motion; }; }, []);
  useEffect(() => { document.documentElement.dataset.textSize = textSize; return () => { delete document.documentElement.dataset.textSize; }; }, [textSize]);

  if (!data) return <AppSkeleton/>;
  if (notFound) return <NotFoundPage onHome={() => navigate('dashboard', true)} onBack={() => { if (history.length > 1) history.back(); else navigate('dashboard', true); }}/>;

  const addEvent = (event: FinanceEvent) => finance.update((current) => {
    const events = current.state.events ?? [];
    const exists = events.some((existing) => existing.id === event.id);
    const ruledEvent = exists ? event : applyTransactionRules(current,event);
    const prepared=prepareCreditStatementEvent(current,ruledEvent);
    const nextEvent=prepared.event;
    return { ...current, state: { ...current.state, creditStatements:prepared.statements, events: exists ? events.map((existing) => existing.id === event.id ? nextEvent : existing) : [...events, nextEvent] } };
  });
  const deleteEvent = (id: string) => finance.update((current) => ({ ...current, state: { ...current.state, events: (current.state.events ?? []).filter((event) => event.id !== id) } }));
  const editEvent = (id: string) => {
    const event = (data.state.events ?? []).find((item) => item.id === id);
    setEditingEventId(id);
    setQuickContext({ token: quickToken(), mode: 'generic', kind: event?.kind || 'expense', prefill: null });
    setQuickOpen(true);
  };
  const editLegacy = (transaction: LegacyTransaction) => finance.update((current) => withLegacyOverride(current, transaction));
  const deleteLegacy = (id: string) => finance.update((current) => withLegacyTombstone(current, id));
  const withRecurring=(current:FinanceData,item:RecurringItem):FinanceData=>{
    const seeded=current.seed.recurring.some((existing)=>existing.id===item.id);
    if(seeded)return {...current,state:{...current.state,recurringOverrides:{...current.state.recurringOverrides,[item.id]:item}}};
    const custom=current.state.recurringCustom??[];
    const exists=custom.some((existing)=>existing.id===item.id);
    return {...current,state:{...current.state,recurringCustom:exists?custom.map((existing)=>existing.id===item.id?item:existing):[...custom,item]}};
  };
  const upsertRecurring=(item:RecurringItem)=>finance.update(current=>withRecurring(current,item));
  const upsertRecurringDurably=(item:RecurringItem)=>finance.updateDurably(current=>withRecurring(current,item));
  const withLoan = (current: FinanceData, loan: Loan) => {
    if (current.seed.loans.some((existing) => existing.id === loan.id)) return { ...current, state: { ...current.state, loanOverrides: { ...current.state.loanOverrides, [loan.id]: loan } } };
    const custom = current.state.customLoans ?? [];
    const exists = custom.some((existing) => existing.id === loan.id);
    return { ...current, state: { ...current.state, customLoans: exists ? custom.map((existing) => existing.id === loan.id ? loan : existing) : [...custom, loan] } };
  };
  const upsertLoan = (loan: Loan) => finance.update((current) => withLoan(current, loan));
  const createSelfLoan = (loan: Loan, event: FinanceEvent) => finance.update((current) => {
    const next = withLoan(current, loan);
    const events = next.state.events ?? [];
    return { ...next, state: { ...next.state, events: [...events.filter((existing) => existing.id !== event.id), event] } };
  });
  const upsertBank = (bank: CardBank) => finance.update((current) => {
    const banks = current.state.cardBanks ?? [];
    const exists = banks.some((item) => item.id === bank.id);
    return { ...current, state: { ...current.state, cardBanks: exists ? banks.map((item) => item.id === bank.id ? bank : item) : [...banks, bank] } };
  });
  const withCard=(current:FinanceData,card:PaymentCard)=>{
    const cards=current.state.cards??[];
    return {...current,state:{...current.state,cards:cards.some(item=>item.id===card.id)?cards.map(item=>item.id===card.id?card:item):[...cards,card]}};
  };
  const upsertCard=(card:PaymentCard)=>finance.update(current=>withCard(current,card));
  const upsertCardDurably=(card:PaymentCard)=>finance.updateDurably(current=>withCard(current,card));
  const stageNewCard=(card:PaymentCard)=>finance.updateDurably(current=>
    (current.state.cards??[]).some(item=>item.id===card.id)?current:withCard(current,{...card,last4:undefined,vaultRef:undefined}));
  const archiveCard = (card: PaymentCard) => upsertCard(archiveCardRecord(card));
  const deleteCard=async(card:PaymentCard)=>{
    if(card.kind==='credit'&&!canPermanentlyDeleteCreditCard(data,card.id,today))throw new Error('CREDIT_CARD_HAS_OUTSTANDING_BALANCE');
    await finance.updateDurably(current=>withCardSecretCleanupPending(current,card,new Date().toISOString(),today));
    try{
      await runCardCleanup(card.id);
    }catch{
      throw new Error('Το προφίλ διαγράφηκε και αποθηκεύτηκε, αλλά ο καθαρισμός των ασφαλών στοιχείων εκκρεμεί. Θα επαναληφθεί μετά από νέα σύνδεση.');
    }
  };
  const upsertScheduled = (item: ScheduledTransaction) => finance.update((current) => {
    const items = current.state.scheduled ?? [];
    const exists = items.some((existing) => existing.id === item.id);
    return { ...current, state: { ...current.state, scheduled: exists ? items.map((existing) => existing.id === item.id ? item : existing) : [...items, item] } };
  });
  const completeScheduled = (item: ScheduledTransaction, event: FinanceEvent) => finance.update((current) => {
    const scheduled = current.state.scheduled ?? [];
    const events = current.state.events ?? [];
    const nextEvent=applyTransactionRules(current,event);
    return { ...current, state: { ...current.state, scheduled: [...scheduled.filter((existing) => existing.id !== item.id), item], events: [...events.filter((existing) => existing.id !== nextEvent.id), nextEvent] } };
  });
  const upsertBudget=(budget:MonthlyBudget)=>finance.update(current=>{const rows=current.state.budgets??[];const exists=rows.some(item=>item.id===budget.id);return {...current,state:{...current.state,budgets:exists?rows.map(item=>item.id===budget.id?budget:item):[...rows,budget]}}});
  const deleteBudget=(id:string)=>finance.update(current=>({...current,state:{...current.state,budgets:(current.state.budgets??[]).filter(item=>item.id!==id)}}));
  const updateSavingsTarget=(rate:number)=>finance.update(current=>({...current,state:{...current.state,settings:{...current.state.settings,savingsTargetRate:rate}}}));
  const upsertSavingsGoal=(goal:SavingsGoal)=>finance.update(current=>{const rows=current.state.savingsGoals??[];const exists=rows.some(item=>item.id===goal.id);return {...current,state:{...current.state,savingsGoals:exists?rows.map(item=>item.id===goal.id?goal:item):[...rows,goal]}}});
  const deleteSavingsGoal=(id:string)=>finance.update(current=>({...current,state:{...current.state,savingsGoals:(current.state.savingsGoals??[]).filter(item=>item.id!==id)}}));
  const upsertRule=(rule:TransactionRule)=>finance.update(current=>{const rows=current.state.transactionRules??[];const exists=rows.some(item=>item.id===rule.id);return {...current,state:{...current.state,transactionRules:exists?rows.map(item=>item.id===rule.id?rule:item):[...rows,rule]}}});
  const deleteRule=(id:string)=>finance.update(current=>({...current,state:{...current.state,transactionRules:(current.state.transactionRules??[]).filter(item=>item.id!==id)}}));
  const updateTaxonomy=async(operation:TaxonomyOperation)=>{
    const {applyTaxonomyOperation}=await import('./lib/taxonomyManagement');
    finance.update(current=>applyTaxonomyOperation(current,operation,today));
  };
  const decide = (id: string, decision: ReviewDecision) => finance.update((current) => ({ ...current, state: { ...current.state, reviewDecisions: { ...(current.state.reviewDecisions ?? {}), [id]: decision } } }));
  const decideAttention = (id: string, decision: AttentionDecision) => finance.update((current) => ({ ...current, state: { ...current.state, attentionDecisions: { ...(current.state.attentionDecisions ?? {}), [id]: decision } } }));

  const handleAttention = (item: AttentionItem) => {
    if (item.action === 'pay_recurring' && item.recurringId) { openSpecial({ mode: 'recurring', recurringId: item.recurringId, amount: item.amount, accountId: item.accountId }); return; }
    if (item.action === 'pay_loan' && item.loanId) { openSpecial({ mode: 'loan', loanId: item.loanId, amount: item.amount, accountId: item.accountId }); return; }
    if (item.action === 'pay_credit' && item.cardId) { openSpecial({ mode: 'credit', action: 'payment', cardId: item.cardId, statementId:item.statementId, amount: item.amount }); return; }
    if (item.action === 'collect_lending' && item.person) { openSpecial({ mode: 'lending', action: 'repay', person: item.person, amount: item.amount, accountId: data.state.settings.defaultIncomeAccount }); return; }
    if (item.action === 'complete_scheduled' && item.scheduledId) { openSpecial({ mode: 'scheduled', scheduledId: item.scheduledId }); return; }
    if (item.action === 'open_forecast') { navigate('planning'); return; }
    if (item.action === 'open_budgets') { navigate('reports');const url=new URL(location.href);url.searchParams.set('reportSection','budgets');history.replaceState(history.state,'',url.toString());return; }
  };

  const handleCommand=(row:RankedCommandSearchItem)=>{
    setCommandOpen(false);const action=row.action;
    if(action.type==='navigate'){navigate(action.page);return}
    if(action.type==='budget_management'){
      setMonth(action.month);setMonthIsManual(true);
      if(page==='reports'){
        const section=document.getElementById('report-budgets') as HTMLDetailsElement|null;
        if(section){section.open=true;section.scrollIntoView({block:'start',behavior:'auto'});section.querySelector<HTMLElement>('summary')?.focus({preventScroll:true})}
      }else{
        const url=new URL(location.href);url.searchParams.set('reportSection','budgets');history.replaceState(history.state,'',url.toString());navigate('reports');
      }
      return;
    }
    if(action.type==='quick_add'){
      if(action.accountId){const account=allAccounts(data).find(item=>item.id===action.accountId);if(account?.kind==='savings'||account?.bankAccountCategory==='savings'){openSpecial({mode:'savings',toAccountId:action.accountId,savingSource:'manual_transfer'});return}openGeneric(action.kind,{note:'',amount:0,accountId:action.accountId});return}
      openGeneric(action.kind);return;
    }
    if(action.type==='credit_payment'){openSpecial({mode:'credit',action:'payment',cardId:action.cardId});return}
    if(action.type==='loan_payment'){openSpecial({mode:'loan',loanId:action.loanId,accountId:action.accountId});return}
    if(action.type==='lending_repayment'){openSpecial({mode:'lending',action:'repay',person:action.person,accountId:action.accountId??data.state.settings.defaultIncomeAccount});return}
    if(action.type==='recurring_payment'){openSpecial({mode:'recurring',recurringId:action.recurringId,accountId:action.accountId});return}
    if(action.type==='scheduled_complete'){openSpecial({mode:'scheduled',scheduledId:action.scheduledId});}
  };

  const balance = (accountId: string) => accountBalances(data, today)[accountId] || 0;
  const recover = () => {
    if (finance.saveState === 'error' || finance.saveState === 'conflict') { setRecoverOpen(true); return; }
    void finance.reload();
  };
  const confirmRecover=()=>{setRecoverOpen(false);void finance.reload()};

  const content = page === 'dashboard'
    ? <DashboardPage data={data} month={month} asOf={today} motionMode="full" privacyVisible={privacyVisible} onPrivacyVisibleChange={setPrivacyVisible} onQuickAdd={(prefill?: QuickPrefill) => openGeneric('expense', prefill || null)} onAccountQuickAdd={(accountId, kind) => kind === 'savings' ? openSpecial({ mode: 'savings', toAccountId: accountId, savingSource: 'manual_transfer' }) : openGeneric('expense', { note: '', amount: 0, accountId })} onTransactions={() => navigate('transactions')} onPlanning={() => navigate('planning')} onAttention={() => navigate('attention')} onReports={()=>navigate('reports')}/>
    : page === 'transactions' ? <TransactionsPage data={data} month={month} onEditEvent={editEvent} onDeleteEvent={deleteEvent} onEditLegacy={editLegacy} onDeleteLegacy={deleteLegacy}/>
    : page === 'savings' ? <SavingsPage data={data} month={month} asOf={today} onCreate={addEvent} onQuickAdd={openSpecial} onSavingsTargetChange={updateSavingsTarget} onUpsertGoal={upsertSavingsGoal} onDeleteGoal={deleteSavingsGoal}/>
    : page === 'cards' ? <CardsPage data={data} onUpsertBank={upsertBank} onUpsertCard={upsertCard} onUpsertCardDurably={upsertCardDurably} onStageNewCard={stageNewCard} onArchiveCard={archiveCard} onDeleteCard={deleteCard}/>
    : page === 'credit' ? <CreditCardPage data={data} asOf={today} onCreateEvent={addEvent} onEditEvent={editEvent} onDeleteEvent={deleteEvent} onUpsertCard={upsertCard} onUpsertCardDurably={upsertCardDurably} onStageNewCard={stageNewCard} onArchiveCard={archiveCard} onDeleteCard={deleteCard} onPayCard={(cardId,statementId)=>openSpecial({mode:'credit',action:'payment',cardId,statementId})}/>
    : page === 'loans' ? <LoansPage data={data} asOf={today} onUpsertLoan={upsertLoan} onCreateSelfLoan={createSelfLoan} onPayLoan={(loanId)=>openSpecial({mode:'loan',loanId})}/>
    : page === 'lending' ? <LendingPage data={data} asOf={today} privacyVisible={privacyVisible} onPrivacyVisibleChange={setPrivacyVisible} onCreateEvent={addEvent} onQuickAdd={openSpecial}/>
    : page === 'recurring' ? <RecurringPage data={data} asOf={today} onUpsert={upsertRecurring} onUpsertDurably={upsertRecurringDurably} onOpenLoans={() => navigate('loans')} onPayLoan={(loanId)=>openSpecial({mode:'loan',loanId})} onPayRecurring={(recurringId)=>openSpecial({mode:'recurring',recurringId})}/>
    : page === 'planning' ? <PlanningPage data={data} asOf={today} onUpsertScheduled={upsertScheduled} onCompleteScheduled={completeScheduled}/>
    : page === 'attention' ? <AttentionPage data={data} asOf={today} onAction={handleAttention} onDecision={decideAttention} onReviewDecision={decide}/>
    : page === 'reports' ? <ReportsPage data={data} month={month} asOf={today} privacyVisible={privacyVisible} onPrivacyVisibleChange={setPrivacyVisible} onUpsertBudget={upsertBudget} onDeleteBudget={deleteBudget} onUpsertRule={upsertRule} onDeleteRule={deleteRule}/>
    : <SettingsPage data={data} asOf={today} filePath={finance.filePath} lastSavedAt={finance.lastSavedAt} activeTab={settingsTab} onActiveTabChange={navigateSettingsTab} onImport={finance.importData} onBackup={finance.createBackup} onSettings={(settings) => finance.update((current) => ({ ...current, state: { ...current.state, settings } }))} onFinanceDurably={finance.updateDurably} onTaxonomyOperation={updateTaxonomy} onUpsertRule={upsertRule} onDeleteRule={deleteRule}/>;

  return <>
    <AppShell page={page} onPage={navigate} onQuickAdd={() => openGeneric('expense')} onCommand={openCommand} onRefresh={() => { void finance.reload(); }} onUndo={() => { finance.undo(); }} onRedo={() => { finance.redo(); }} canUndo={finance.canUndo} canRedo={finance.canRedo} history={finance.changeHistory} saveState={finance.saveState} filePath={finance.filePath} motionMode="full" userEmail={userEmail} onLogout={onLogout}>
      <PersistenceNotice saveState={finance.saveState} errorMessage={finance.saveErrorMessage} onRecover={recover} cleanupPending={pendingCleanup.length} cleanupBusy={cleanupBusy} cleanupError={cleanupFailure} onRetryCleanup={retryCardCleanup}/>
      {PERIOD_PAGES.has(page) ? <div className="period-row"><PeriodControl month={month} onChange={(next) => { setMonth(next); setMonthIsManual(true); }}/><span>Στοιχεία περιόδου</span></div> : null}
      {finance.saveState === 'loading' ? <PageSkeleton/> : <PageErrorBoundary resetKey={page} onDashboard={() => navigate('dashboard')}><Suspense fallback={<PageLoading/>}>{content}</Suspense></PageErrorBoundary>}
    </AppShell>
    {commandOpen ? <Suspense fallback={null}><CommandPalette open={commandOpen} data={data} asOf={today} motionMode="full" onClose={()=>setCommandOpen(false)} onExecute={handleCommand}/></Suspense> : null}
    {quickOpen ? <Suspense fallback={null}><ContextualQuickAdd open={quickOpen} data={data} asOf={today} context={quickContext} motionMode="full" initial={(data.state.events ?? []).find((event) => event.id === editingEventId) || null} onClose={() => { setQuickOpen(false); setEditingEventId(null); setQuickContext(null); }} onCreate={addEvent} onCompleteScheduled={completeScheduled} currentBalance={balance}/></Suspense> : null}
    {recoverOpen ? <Suspense fallback={null}><ConfirmDialog open title="Φόρτωση τελευταίας αποθηκευμένης έκδοσης;" description="Η επαναφόρτωση θα απορρίψει τυχόν τοπικές αλλαγές που δεν αποθηκεύτηκαν και θα φορτώσει την τελευταία έκδοση από τη βάση." confirmLabel="Επαναφόρτωση" tone="destructive" motionMode="full" onConfirm={confirmRecover} onCancel={()=>setRecoverOpen(false)}/></Suspense> : null}
  </>;
}

export default function App() {
  const session = useSession();
  if (session.state === 'loading') return <div className="boot-screen"><img src="/brand/icon-192.png" alt="MyFinHub"/><div className="boot-pulse"/><b>MyFinHub</b><span>Έλεγχος ασφαλούς συνεδρίας…</span></div>;
  if (session.state === 'error') return <div className="boot-screen"><img src="/brand/icon-192.png" alt="MyFinHub"/><b>MyFinHub</b><span>{session.error || 'Δεν ήταν δυνατός ο έλεγχος της συνεδρίας.'}</span><Button variant="secondary" type="button" onClick={() => void session.refresh()}>Δοκιμή ξανά</Button></div>;
  if (session.state === 'mfa' || session.state === 'mfa-enroll') return <MfaScreen mode={session.state === 'mfa-enroll' ? 'enroll' : 'challenge'} email={session.email} error={session.error} onEnroll={session.enrollMfa} onVerify={session.verifyMfa} onLogout={async () => { await session.logout(); }}/>
  if (session.state !== 'authenticated') return <LoginScreen onLogin={session.login} error={session.error}/>;
  return <><FinanceApp userEmail={session.email} onLogout={() => { void session.logout(); }}/>{session.error ? <div className="session-error-banner" role="alert">{session.error}</div> : null}</>;
}
