import { lazy, Suspense, useEffect, useState } from 'react';
import { AppShell, type PageId } from './components/AppShell';
import { AppSkeleton, PageSkeleton } from './components/AppSkeleton';
import { CommandPalette } from './components/CommandPalette';
import { ContextualQuickAdd, type QuickActionContext } from './components/ContextualQuickAdd';
import { LoginScreen } from './components/LoginScreen';
import { MfaScreen } from './components/MfaScreen';
import { PageErrorBoundary } from './components/PageErrorBoundary';
import { PeriodControl } from './components/PeriodControl';
import { PersistenceNotice } from './components/PersistenceNotice';
import type { QuickPrefill } from './components/QuickAdd';
import { useFinance } from './hooks/useFinance';
import { useLocalDate } from './hooks/useLocalDate';
import { useSession } from './hooks/useSession';
import type { AttentionItem } from './lib/attention';
import { archiveCardRecord } from './lib/cards';
import type { RankedCommandSearchItem } from './lib/commandSearch';
import { accountBalances, allAccounts } from './lib/domain';
import { reportingMonthForDate } from './lib/localDate';
import { applyTransactionRules } from './lib/transactionRules';
import type {
  AttentionDecision,
  CardBank,
  EventKind,
  FinanceData,
  FinanceEvent,
  Loan,
  MonthlyBudget,
  PaymentCard,
  RecurringItem,
  ReviewDecision,
  ScheduledTransaction,
  TransactionRule,
} from './types';

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
const AttentionPage = lazy(() => import('./pages/AttentionPage').then((module) => ({ default: module.AttentionPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));

const PAGE_IDS: PageId[] = ['dashboard','transactions','review','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings'];
const PERIOD_PAGES = new Set<PageId>(['dashboard','transactions','savings','reports']);

function routeFromHash() {
  const raw = location.hash.replace(/^#\/?/, '').trim();
  if (!raw) return { page: 'dashboard' as PageId, notFound: false };
  if (PAGE_IDS.includes(raw as PageId)) return { page: raw as PageId, notFound: false };
  return { page: 'dashboard' as PageId, notFound: true };
}

function pageHash(page: PageId) { return `#/${page}`; }
function PageLoading() { return <PageSkeleton/>; }
function NotFound({ onHome }: { onHome: () => void }) {
  return <main className="login-screen"><section className="not-found neo-raised" aria-labelledby="not-found-title"><span className="eyebrow">404 · PRIVATE ROUTE</span><h1 id="not-found-title">Η ενότητα δεν υπάρχει</h1><p>Η διεύθυνση δεν αντιστοιχεί σε ενότητα του MyFinHub. Δεν εμφανίζονται οικονομικά στοιχεία σε αυτή την οθόνη.</p><div className="editor-actions"><button type="button" className="save-button" onClick={onHome}>Επιστροφή στο Dashboard</button></div></section></main>;
}
const quickToken = () => `quick-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type SpecialQuickContext = DistributiveOmit<Exclude<QuickActionContext, { mode: 'generic' }>, 'token'>;

function FinanceApp({ userEmail, onLogout }: { userEmail: string | null; onLogout: () => void }) {
  const finance = useFinance();
  const today = useLocalDate();
  const initialRoute = routeFromHash();
  const [page, setPage] = useState<PageId>(initialRoute.page);
  const [notFound, setNotFound] = useState(initialRoute.notFound);
  const [quickOpen, setQuickOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [quickContext, setQuickContext] = useState<QuickActionContext | null>(null);
  const [month, setMonth] = useState(() => today.slice(0,7));
  const [monthIsManual, setMonthIsManual] = useState(false);

  const navigate = (next: PageId, replace = false) => {
    const hash = pageHash(next);
    if (location.hash !== hash) {
      if (replace) history.replaceState(null, '', hash);
      else history.pushState(null, '', hash);
    }
    setNotFound(false);
    setPage(next);
  };

  useEffect(() => {
    const sync = () => { const next = routeFromHash(); setPage(next.page); setNotFound(next.notFound); };
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      if (quickOpen || commandOpen) return;
      setCommandOpen(true);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [quickOpen, commandOpen]);

  useEffect(() => { setMonth((current) => reportingMonthForDate(current, today, monthIsManual)); }, [today, monthIsManual]);
  useEffect(() => {
    if (notFound) return;
    requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>('#main-workspace h1');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    });
  }, [page, notFound]);

  const data = finance.data;
  const textSize = data?.state.settings.textSize ?? 'normal';
  useEffect(() => { document.documentElement.dataset.motion = 'full'; return () => { delete document.documentElement.dataset.motion; }; }, []);
  useEffect(() => { document.documentElement.dataset.textSize = textSize; return () => { delete document.documentElement.dataset.textSize; }; }, [textSize]);

  if (!data) return <AppSkeleton/>;
  if (notFound) return <NotFound onHome={() => navigate('dashboard', true)}/>;

  const addEvent = (event: FinanceEvent) => finance.update((current) => {
    const events = current.state.events ?? [];
    const exists = events.some((existing) => existing.id === event.id);
    const nextEvent = exists ? event : applyTransactionRules(current,event);
    return { ...current, state: { ...current.state, events: exists ? events.map((existing) => existing.id === event.id ? nextEvent : existing) : [...events, nextEvent] } };
  });
  const deleteEvent = (id: string) => finance.update((current) => ({ ...current, state: { ...current.state, events: (current.state.events ?? []).filter((event) => event.id !== id) } }));
  const editEvent = (id: string) => {
    const event = (data.state.events ?? []).find((item) => item.id === id);
    setEditingEventId(id);
    setQuickContext({ token: quickToken(), mode: 'generic', kind: event?.kind || 'expense', prefill: null });
    setQuickOpen(true);
  };
  const upsertRecurring = (item: RecurringItem) => finance.update((current) => {
    const seeded = current.seed.recurring.some((existing) => existing.id === item.id);
    if (seeded) return { ...current, state: { ...current.state, recurringOverrides: { ...current.state.recurringOverrides, [item.id]: item } } };
    const custom = current.state.recurringCustom ?? [];
    const exists = custom.some((existing) => existing.id === item.id);
    return { ...current, state: { ...current.state, recurringCustom: exists ? custom.map((existing) => existing.id === item.id ? item : existing) : [...custom, item] } };
  });
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
  const upsertCard = (card: PaymentCard) => finance.update((current) => {
    const cards = current.state.cards ?? [];
    const exists = cards.some((item) => item.id === card.id);
    return { ...current, state: { ...current.state, cards: exists ? cards.map((item) => item.id === card.id ? card : item) : [...cards, card] } };
  });
  const archiveCard = (card: PaymentCard) => upsertCard(archiveCardRecord(card));
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
  const upsertRule=(rule:TransactionRule)=>finance.update(current=>{const rows=current.state.transactionRules??[];const exists=rows.some(item=>item.id===rule.id);return {...current,state:{...current.state,transactionRules:exists?rows.map(item=>item.id===rule.id?rule:item):[...rows,rule]}}});
  const deleteRule=(id:string)=>finance.update(current=>({...current,state:{...current.state,transactionRules:(current.state.transactionRules??[]).filter(item=>item.id!==id)}}));
  const decide = (id: string, decision: ReviewDecision) => finance.update((current) => ({ ...current, state: { ...current.state, reviewDecisions: { ...(current.state.reviewDecisions ?? {}), [id]: decision } } }));
  const decideAttention = (id: string, decision: AttentionDecision) => finance.update((current) => ({ ...current, state: { ...current.state, attentionDecisions: { ...(current.state.attentionDecisions ?? {}), [id]: decision } } }));

  const handleAttention = (item: AttentionItem) => {
    if (item.action === 'pay_recurring' && item.recurringId) { openSpecial({ mode: 'recurring', recurringId: item.recurringId, amount: item.amount, accountId: item.accountId }); return; }
    if (item.action === 'pay_loan' && item.loanId) { openSpecial({ mode: 'loan', loanId: item.loanId, amount: item.amount, accountId: item.accountId }); return; }
    if (item.action === 'pay_credit' && item.cardId) { openSpecial({ mode: 'credit', action: 'payment', cardId: item.cardId, amount: item.amount }); return; }
    if (item.action === 'collect_lending' && item.person) { openSpecial({ mode: 'lending', action: 'repay', person: item.person, amount: item.amount, accountId: data.state.settings.defaultIncomeAccount }); return; }
    if (item.action === 'complete_scheduled' && item.scheduledId) { openSpecial({ mode: 'scheduled', scheduledId: item.scheduledId }); return; }
    if (item.action === 'open_forecast') { navigate('planning'); return; }
    if (item.action === 'open_budgets') { navigate('reports'); return; }
  };

  const handleCommand=(row:RankedCommandSearchItem)=>{
    setCommandOpen(false);const action=row.action;
    if(action.type==='navigate'){navigate(action.page);return}
    if(action.type==='quick_add'){
      if(action.accountId){const account=allAccounts(data).find(item=>item.id===action.accountId);if(account?.kind==='savings'){openSpecial({mode:'savings',toAccountId:action.accountId,savingSource:'manual_transfer'});return}openGeneric(action.kind,{note:'',amount:0,accountId:action.accountId});return}
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
    if ((finance.saveState === 'error' || finance.saveState === 'conflict') && !window.confirm('Η επαναφόρτωση θα απορρίψει τυχόν τοπικές αλλαγές που δεν αποθηκεύτηκαν. Να φορτωθεί η τελευταία έκδοση από τη βάση;')) return;
    void finance.reload();
  };

  const content = page === 'dashboard'
    ? <DashboardPage data={data} month={month} asOf={today} motionMode="full" onQuickAdd={(prefill?: QuickPrefill) => openGeneric('expense', prefill || null)} onAccountQuickAdd={(accountId, kind) => kind === 'savings' ? openSpecial({ mode: 'savings', toAccountId: accountId, savingSource: 'manual_transfer' }) : openGeneric('expense', { note: '', amount: 0, accountId })} onTransactions={() => navigate('transactions')} onPlanning={() => navigate('planning')} onAttention={() => navigate('attention')} onReports={()=>navigate('reports')}/>
    : page === 'transactions' ? <TransactionsPage data={data} month={month} onEditEvent={editEvent} onDeleteEvent={deleteEvent}/>
    : page === 'review' ? <ReviewPage data={data} onDecision={decide}/>
    : page === 'savings' ? <SavingsPage data={data} month={month} asOf={today} onCreate={addEvent} onQuickAdd={openSpecial}/>
    : page === 'cards' ? <CardsPage data={data} onUpsertBank={upsertBank} onUpsertCard={upsertCard} onArchiveCard={archiveCard} onOpenCredit={() => navigate('credit')}/>
    : page === 'credit' ? <CreditCardPage data={data} asOf={today} onCreateEvent={addEvent} onEditEvent={editEvent} onDeleteEvent={deleteEvent} onUpsertCard={upsertCard} onArchiveCard={archiveCard} onPayCard={(cardId)=>openSpecial({mode:'credit',action:'payment',cardId})}/>
    : page === 'loans' ? <LoansPage data={data} asOf={today} onUpsertLoan={upsertLoan} onCreateSelfLoan={createSelfLoan} onPayLoan={(loanId)=>openSpecial({mode:'loan',loanId})}/>
    : page === 'lending' ? <LendingPage data={data} asOf={today} onCreateEvent={addEvent} onQuickAdd={openSpecial}/>
    : page === 'recurring' ? <RecurringPage data={data} asOf={today} onUpsert={upsertRecurring} onOpenLoans={() => navigate('loans')} onPayRecurring={(recurringId)=>openSpecial({mode:'recurring',recurringId})}/>
    : page === 'planning' ? <PlanningPage data={data} asOf={today} onUpsertScheduled={upsertScheduled} onCompleteScheduled={completeScheduled}/>
    : page === 'attention' ? <AttentionPage data={data} asOf={today} onAction={handleAttention} onDecision={decideAttention}/>
    : page === 'reports' ? <ReportsPage data={data} month={month}/>
    : <SettingsPage data={data} asOf={today} filePath={finance.filePath} lastSavedAt={finance.lastSavedAt} onImport={finance.importData} onBackup={finance.createBackup} onSettings={(settings) => finance.update((current) => ({ ...current, state: { ...current.state, settings: { ...settings, motion: 'full' } } }))} onUpsertBudget={upsertBudget} onDeleteBudget={deleteBudget} onUpsertRule={upsertRule} onDeleteRule={deleteRule}/>;

  return <>
    <AppShell page={page} onPage={navigate} onQuickAdd={() => openGeneric('expense')} onCommand={openCommand} onRefresh={() => { void finance.reload(); }} onUndo={() => { finance.undo(); }} onRedo={() => { finance.redo(); }} canUndo={finance.canUndo} canRedo={finance.canRedo} history={finance.changeHistory} saveState={finance.saveState} filePath={finance.filePath} motionMode="full" userEmail={userEmail} onLogout={onLogout}>
      <PersistenceNotice saveState={finance.saveState} onRecover={recover}/>
      {PERIOD_PAGES.has(page) ? <div className="period-row"><PeriodControl month={month} onChange={(next) => { setMonth(next); setMonthIsManual(true); }}/><span>Στοιχεία περιόδου</span></div> : null}
      {finance.saveState === 'loading' ? <PageSkeleton/> : <PageErrorBoundary resetKey={page} onDashboard={() => navigate('dashboard')}><Suspense fallback={<PageLoading/>}>{content}</Suspense></PageErrorBoundary>}
    </AppShell>
    <CommandPalette open={commandOpen} data={data} motionMode="full" onClose={()=>setCommandOpen(false)} onExecute={handleCommand}/>
    <ContextualQuickAdd open={quickOpen} data={data} asOf={today} context={quickContext} motionMode="full" initial={(data.state.events ?? []).find((event) => event.id === editingEventId) || null} onClose={() => { setQuickOpen(false); setEditingEventId(null); setQuickContext(null); }} onCreate={addEvent} onCompleteScheduled={completeScheduled} currentBalance={balance}/>
  </>;
}

export default function App() {
  const session = useSession();
  if (session.state === 'loading') return <div className="boot-screen"><img src="/brand/icon-192.png" alt="MyFinHub"/><div className="boot-pulse"/><b>MyFinHub</b><span>Έλεγχος ασφαλούς συνεδρίας…</span></div>;
  if (session.state === 'error') return <div className="boot-screen"><img src="/brand/icon-192.png" alt="MyFinHub"/><b>MyFinHub</b><span>{session.error || 'Δεν ήταν δυνατός ο έλεγχος της συνεδρίας.'}</span><button className="secondary" type="button" onClick={() => void session.refresh()}>Δοκιμή ξανά</button></div>;
  if (session.state === 'mfa' || session.state === 'mfa-enroll') return <MfaScreen mode={session.state === 'mfa-enroll' ? 'enroll' : 'challenge'} email={session.email} error={session.error} onEnroll={session.enrollMfa} onVerify={session.verifyMfa} onLogout={async () => { await session.logout(); }}/>;
  if (session.state !== 'authenticated') return <LoginScreen onLogin={session.login} error={session.error}/>;
  return <><FinanceApp userEmail={session.email} onLogout={() => { void session.logout(); }}/>{session.error ? <div className="session-error-banner" role="alert">{session.error}</div> : null}</>;
}