import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowDown, ArrowLeftRight, ArrowUp, CalendarClock, Check, CircleSlash2, Clock3, Pencil, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppDateInput } from '../components/AppDateInput';
import { AppSelectInput } from '../components/AppSelectInput';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FinanceIcon } from '../components/FinanceIcon';
import { MoneyInput } from '../components/MoneyInput';
import { Tooltip } from '../components/Tooltip';
import { useModalFocus } from '../hooks/useModalFocus';
import { genericCategoryTree, subcategoriesFor } from '../lib/categories';
import { allAccounts } from '../lib/domain';
import { cashFlowForecast, LOW_BALANCE_THRESHOLD, type ForecastHorizon } from '../lib/forecast';
import { defaultTransferPair } from '../lib/ledgerFoundations';
import { money, shortDate } from '../lib/format';
import { createScheduledTransaction, pendingScheduled, scheduledHistory, scheduledLifecycle, scheduledToEvent, transitionScheduled } from '../lib/scheduled';
import { accountDisplayName } from '../lib/ui';
import { userErrorMessage } from '../lib/userMessage';
import type { FinanceData, FinanceEvent, ScheduledKind, ScheduledTransaction } from '../types';

type Draft = {
  id?: string;
  createdAt?: string;
  kind: ScheduledKind;
  dueDate: string;
  amount: string;
  note: string;
  category: string;
  subcategory: string;
  accountId: string;
  fromAccountId: string;
  toAccountId: string;
};
type LifecycleTarget={item:ScheduledTransaction;status:'skipped'|'cancelled'};

const sourceLabel = { scheduled: 'Προγραμματισμένο', recurring: 'Πάγιο', loan: 'Δόση', dated_event: 'Μελλοντική εγγραφή' } as const;
const lifecycleLabel = { upcoming: 'Επερχόμενο', due: 'Εκκρεμεί τώρα', completed: 'Ολοκληρώθηκε', skipped: 'Παραλείφθηκε', cancelled: 'Ακυρώθηκε' } as const;
const kindLabel: Record<ScheduledKind, string> = { expense: 'Πληρωμή', income: 'Έσοδο', transfer: 'Μεταφορά' };

export function PlanningPage({ data, asOf, onUpsertScheduled, onCompleteScheduled }: {
  data: FinanceData;
  asOf: string;
  onUpsertScheduled: (item: ScheduledTransaction) => void;
  onCompleteScheduled: (item: ScheduledTransaction, event: FinanceEvent) => void;
}) {
  const accounts = allAccounts(data).filter((account) => account.kind !== 'credit');
  const pair = defaultTransferPair(data);
  const [horizon, setHorizon] = useState<ForecastHorizon>(30);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [complete, setComplete] = useState<ScheduledTransaction | null>(null);
  const [lifecycleTarget,setLifecycleTarget]=useState<LifecycleTarget|null>(null);
  const [actualDate, setActualDate] = useState(asOf);
  const [actualAmount, setActualAmount] = useState('');
  const [actualAccount, setActualAccount] = useState('');
  const [actualFrom, setActualFrom] = useState('');
  const [actualTo, setActualTo] = useState('');
  const [error, setError] = useState('');
  const [completeError, setCompleteError] = useState('');
  const [message, setMessage] = useState('');
  const forecast = useMemo(() => cashFlowForecast(data, asOf, horizon), [data, asOf, horizon]);
  const pending = pendingScheduled(data);
  const history = scheduledHistory(data);
  const due = pending.filter((item) => scheduledLifecycle(item, asOf) === 'due');
  const upcoming = pending.filter((item) => scheduledLifecycle(item, asOf) === 'upcoming');
  const draftRef = useModalFocus<HTMLElement>(Boolean(draft), '[data-autofocus="true"]', () => closeDraft());
  const completeRef = useModalFocus<HTMLElement>(Boolean(complete), '[data-autofocus="true"]', () => closeComplete());

  const newDraft = (): Draft => ({
    kind: 'expense', dueDate: asOf, amount: '', note: '', category: data.state.settings.expenseCategories[0] || 'Άλλο', subcategory: '',
    accountId: data.state.settings.defaultExpenseAccount || accounts[0]?.id || '', fromAccountId: pair.from, toAccountId: pair.to,
  });
  const startNew = () => { setError(''); setDraft(newDraft()); };
  const startEdit = (item: ScheduledTransaction) => {
    if (item.status !== 'pending') return;
    setError('');
    setDraft({ id: item.id, createdAt: item.createdAt, kind: item.kind, dueDate: item.dueDate, amount: String(item.amount), note: item.note, category: item.category || (item.kind === 'income' ? data.state.settings.incomeCategories[0] : data.state.settings.expenseCategories[0]) || 'Άλλο', subcategory: item.subcategory || '', accountId: item.accountId || data.state.settings.defaultExpenseAccount || accounts[0]?.id || '', fromAccountId: item.fromAccountId || pair.from, toAccountId: item.toAccountId || pair.to });
  };
  const closeDraft = () => { setDraft(null); setError(''); };
  const changeKind = (kind: ScheduledKind) => {
    if (!draft) return;
    const category = kind === 'income' ? data.state.settings.incomeCategories[0] || 'Άλλο' : data.state.settings.expenseCategories[0] || 'Άλλο';
    const accountId = kind === 'income' ? data.state.settings.defaultIncomeAccount || accounts[0]?.id || '' : data.state.settings.defaultExpenseAccount || accounts[0]?.id || '';
    setDraft({ ...draft, kind, category, subcategory: '', accountId, fromAccountId: pair.from, toAccountId: pair.to });
  };
  const saveDraft = () => {
    if (!draft) return;
    try {
      const item = createScheduledTransaction(data, { id: draft.id, createdAt: draft.createdAt, kind: draft.kind, dueDate: draft.dueDate, amount: Number(draft.amount.replace(',', '.')), note: draft.note, category: draft.category, subcategory: draft.subcategory || undefined, accountId: draft.accountId, fromAccountId: draft.fromAccountId, toAccountId: draft.toAccountId });
      onUpsertScheduled(item);
      setMessage(draft.id ? 'Η προγραμματισμένη κίνηση ενημερώθηκε.' : 'Η προγραμματισμένη κίνηση προστέθηκε. Δεν επηρεάζει το πραγματικό υπόλοιπο μέχρι να ολοκληρωθεί.');
      closeDraft();
    } catch (cause) { setError(userErrorMessage(cause, 'Δεν μπορέσαμε να αποθηκεύσουμε την προγραμματισμένη κίνηση. Έλεγξε τα στοιχεία.')); }
  };

  const startComplete = (item: ScheduledTransaction) => {
    setComplete(item); setCompleteError(''); setActualDate(asOf); setActualAmount(String(item.amount));
    setActualAccount(item.accountId || data.state.settings.defaultExpenseAccount || accounts[0]?.id || ''); setActualFrom(item.fromAccountId || pair.from); setActualTo(item.toAccountId || pair.to);
  };
  const closeComplete = () => { setComplete(null); setCompleteError(''); };
  const submitComplete = () => {
    if (!complete) return;
    try {
      const event = scheduledToEvent(data, complete, { date: actualDate, amount: Number(actualAmount.replace(',', '.')), accountId: actualAccount, fromAccountId: actualFrom, toAccountId: actualTo });
      const completed = transitionScheduled(complete, 'completed', event.id);
      onCompleteScheduled(completed, event);
      setMessage(`Καταχωρίστηκε πραγματική κίνηση ${money.format(event.amount)} για «${complete.note}».`);
      closeComplete();
    } catch (cause) { setCompleteError(userErrorMessage(cause, 'Δεν μπορέσαμε να ολοκληρώσουμε την κίνηση. Έλεγξε ποσό, ημερομηνία και λογαριασμό.')); }
  };
  const requestLifecycle=(item:ScheduledTransaction,status:'skipped'|'cancelled')=>setLifecycleTarget({item,status});
  const confirmLifecycle=()=>{
    if(!lifecycleTarget)return;
    const {item,status}=lifecycleTarget;
    onUpsertScheduled(transitionScheduled(item,status));
    setMessage(status==='cancelled'?'Η προγραμματισμένη κίνηση ακυρώθηκε και διατηρήθηκε στο ιστορικό.':'Η προγραμματισμένη κίνηση σημειώθηκε ως παραλειφθείσα.');
    setLifecycleTarget(null);
  };

  const draftCategoryKind = draft?.kind === 'income' ? 'income' : 'expense';
  const draftCategories = genericCategoryTree(data.state.settings, draftCategoryKind);
  const draftSubs = draft ? subcategoriesFor(data.state.settings, draftCategoryKind, draft.category) : [];
  const portfolioDelta = forecast.projectedPortfolio - forecast.currentPortfolio;
  const lowAccounts = forecast.accounts.filter((row) => row.firstLowDate || row.firstNegativeDate);

  return <div className="page-stack planning-page">
    <section className="page-heading"><div><span className="eyebrow">ΠΡΟΓΡΑΜΜΑΤΙΣΜΟΣ</span><h1>Προγραμματισμός & πρόβλεψη ρευστότητας</h1><p>Οι προγραμματισμένες κινήσεις είναι one-off σχέδια και δεν αλλάζουν τα πραγματικά υπόλοιπα. Η πρόβλεψη είναι ντετερμινιστική προβολή γνωστών ροών, όχι βεβαιότητα για το μέλλον.</p></div><button type="button" className="save-button" onClick={startNew}><Plus size={17}/> Νέα προγραμματισμένη</button></section>
    {message ? <div className="action-status" role="status" aria-live="polite">{message}</div> : null}

    <section className="planning-summary-grid" aria-label="Σύνοψη προγραμματισμού">
      <article className="neo-raised"><span>Εκκρεμούν τώρα</span><b className={due.length ? 'negative' : ''}>{due.length}</b><small>{due.length ? 'Προγραμματισμένες κινήσεις με ημερομηνία έως σήμερα' : 'Δεν υπάρχει scheduled κίνηση που να εκκρεμεί τώρα'}</small></article>
      <article className="neo-raised"><span>Επερχόμενα</span><b>{upcoming.length}</b><small>{upcoming[0] ? `${shortDate(upcoming[0].dueDate)} · ${upcoming[0].note}` : 'Δεν υπάρχει επόμενη one-off κίνηση'}</small></article>
      <article className="neo-raised"><span>Τρέχουσα ρευστότητα</span><b>{money.format(forecast.currentPortfolio)}</b><small>Άθροισμα ενεργών εσωτερικών λογαριασμών, χωρίς πιστωτική</small></article>
      <article className="neo-raised"><span>Σε {horizon} ημέρες</span><b className={forecast.projectedPortfolio < 0 ? 'negative' : ''}>{money.format(forecast.projectedPortfolio)}</b><small>{portfolioDelta === 0 ? 'Καμία καθαρή γνωστή μεταβολή' : `${portfolioDelta > 0 ? '+' : '−'}${money.format(Math.abs(portfolioDelta))} από τις γνωστές ροές`}</small></article>
    </section>

    <section className="panel neo-raised forecast-panel">
      <div className="forecast-head"><div><span className="eyebrow">DETERMINISTIC FORECAST</span><h2>Προβολή ρευστότητας</h2><p>Υπολογίζεται από σημερινά υπόλοιπα + pending scheduled + ενεργά πάγια + γνωστές εξωτερικές δόσεις + ήδη καταχωρισμένες future-dated κινήσεις.</p></div><div className="horizon-control" role="group" aria-label="Ορίζοντας πρόβλεψης">{([30, 60, 90] as ForecastHorizon[]).map((value) => <button type="button" key={value} aria-pressed={horizon === value} className={horizon === value ? 'active' : ''} onClick={() => setHorizon(value)}>{value} ημέρες</button>)}</div></div>
      {forecast.insufficientData ? <div className="forecast-insufficient"><CalendarClock/><div><b>Δεν υπάρχουν αρκετές γνωστές μελλοντικές ροές για ουσιαστική μεταβολή.</b><span>Η γραμμή παραμένει στα σημερινά υπόλοιπα. Πρόσθεσε scheduled κινήσεις ή ημερομηνίες στα πάγια/δάνεια για πλουσιότερη προβολή.</span></div></div> : null}
      <div className="forecast-layout"><div className="forecast-chart" aria-hidden="true"><ResponsiveContainer width="100%" height={280}><AreaChart data={forecast.points}><defs><linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2f6fed" stopOpacity=".28"/><stop offset="100%" stopColor="#2f6fed" stopOpacity="0"/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#dbe4f0" vertical={false}/><XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5)} tick={{ fontSize: 10, fill: '#52627d' }} axisLine={false} tickLine={false}/><YAxis tick={{ fontSize: 10, fill: '#52627d' }} tickFormatter={(value) => `${Math.round(Number(value))}€`} axisLine={false} tickLine={false}/><ChartTooltip formatter={(value) => money.format(Number(value))} labelFormatter={(value) => `Ημερομηνία ${shortDate(String(value))}`}/><Area type="stepAfter" dataKey="portfolio" stroke="#2f6fed" strokeWidth={2.5} fill="url(#forecastFill)" isAnimationActive={false}/></AreaChart></ResponsiveContainer></div><div className="forecast-facts"><div><span>Χαμηλότερη συνολική ρευστότητα</span><b className={forecast.minimumPortfolio < 0 ? 'negative' : ''}>{money.format(forecast.minimumPortfolio)}</b><small>{shortDate(forecast.minimumPortfolioDate)}</small></div><div><span>Γνωστές κινήσεις στον ορίζοντα</span><b>{forecast.movements.length}</b><small>{forecast.sourceCounts.scheduled} scheduled · {forecast.sourceCounts.recurring} πάγια · {forecast.sourceCounts.loan} δόσεις</small></div><div><span>Λογαριασμοί με χαμηλό/αρνητικό σημείο</span><b className={lowAccounts.some((row) => row.firstNegativeDate) ? 'negative' : ''}>{lowAccounts.length}</b><small>Χαμηλό = κάτω από {money.format(LOW_BALANCE_THRESHOLD)}</small></div></div></div>
      <details className="chart-alt"><summary>Πρόβλεψη σε κείμενο</summary><ul className="chart-alt-list">{forecast.points.map((point) => <li key={point.date}><span>{shortDate(point.date)}</span><b>{money.format(point.portfolio)}</b></li>)}</ul></details>
      <div className="forecast-account-grid">{forecast.accounts.map((row) => <article key={row.accountId} className={row.firstNegativeDate ? 'forecast-account danger' : row.firstLowDate ? 'forecast-account warning' : 'forecast-account'}><div><b>{accountDisplayName(data, row.accountId)}</b><small>Τώρα {money.format(row.current)} → {money.format(row.projected)}</small></div><strong>{money.format(row.minimum)}</strong>{row.firstNegativeDate ? <span><AlertTriangle size={14}/> Αρνητικό από {shortDate(row.firstNegativeDate)}</span> : row.firstLowDate ? <span><Clock3 size={14}/> Κάτω από {money.format(LOW_BALANCE_THRESHOLD)} από {shortDate(row.firstLowDate)}</span> : <span><Check size={14}/> Δεν περνά το χαμηλό όριο</span>}</article>)}</div>
      {forecast.omitted.length ? <details className="forecast-assumptions"><summary>Παραλείψεις λόγω ανεπαρκών στοιχείων ({forecast.omitted.length})</summary><ul>{forecast.omitted.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></details> : null}
      <div className="forecast-assumption-note"><b>Παραδοχή:</b> Δεν προβλέπονται άγνωστες αγορές, μεταβολές εισοδήματος ή συμπεριφορά. Οι εσωτερικές μεταφορές αλλάζουν τους επιμέρους λογαριασμούς αλλά έχουν καθαρή επίδραση 0€ στη συνολική ρευστότητα.</div>
    </section>

    <section className="panel neo-raised scheduled-panel"><div className="panel-head"><div><span>Προγραμματισμένες one-off κινήσεις</span><small>Upcoming και due κινήσεις. Καμία δεν έχει γίνει πραγματική συναλλαγή ακόμη.</small></div><CalendarClock/></div>{pending.length ? <div className="scheduled-list">{pending.map((item) => { const lifecycle = scheduledLifecycle(item, asOf); return <article key={item.id} className={`scheduled-row ${lifecycle}`} data-scheduled-id={item.id}><div className="scheduled-main"><span className={`scheduled-kind-icon ${item.kind}`}><FinanceIcon kind={item.kind} category={item.category} note={item.note} size={18}/></span><div><div className="scheduled-title"><b>{item.note}</b><em className={`scheduled-status ${lifecycle}`}>{lifecycleLabel[lifecycle]}</em></div><small>{kindLabel[item.kind]} · {shortDate(item.dueDate)} · {item.kind === 'transfer' ? `${accountDisplayName(data, item.fromAccountId)} → ${accountDisplayName(data, item.toAccountId)}` : accountDisplayName(data, item.accountId)}</small></div></div><strong>{money.format(item.amount)}</strong><div className="scheduled-actions"><button type="button" className="save-button compact" onClick={() => startComplete(item)}><Check size={15}/> Ολοκλήρωση</button><Tooltip label={`Επεξεργασία: ${item.note}`} side="left"><button type="button" aria-label={`Επεξεργασία ${item.note}`} onClick={() => startEdit(item)}><Pencil/></button></Tooltip><Tooltip label={`Παράλειψη: ${item.note}`} side="left"><button type="button" aria-label={`Παράλειψη ${item.note}`} onClick={() => requestLifecycle(item, 'skipped')}><CircleSlash2/></button></Tooltip><Tooltip label={`Ακύρωση: ${item.note}`} side="left"><button type="button" className="danger" aria-label={`Ακύρωση ${item.note}`} onClick={() => requestLifecycle(item, 'cancelled')}><X/></button></Tooltip></div></article> })}</div> : <div className="empty-state">Δεν υπάρχουν pending προγραμματισμένες κινήσεις.</div>}</section>

    <section className="planning-lower-grid"><article className="panel neo-raised"><div className="panel-head"><div><span>Επόμενες γνωστές ροές</span><small>Η σειρά που χρησιμοποιεί η προβολή.</small></div></div>{forecast.movements.length ? <div className="forecast-movement-list">{forecast.movements.slice(0, 8).map((movement) => <div key={movement.id}><span><b>{movement.label}</b><small>{sourceLabel[movement.source]} · {shortDate(movement.date)}</small></span><strong className={movement.portfolioDelta < 0 ? 'negative' : movement.portfolioDelta > 0 ? 'positive' : ''}>{movement.portfolioDelta === 0 ? '0€ καθαρά' : `${movement.portfolioDelta > 0 ? '+' : '−'}${money.format(Math.abs(movement.portfolioDelta))}`}</strong></div>)}</div> : <div className="empty-inline">Δεν υπάρχει γνωστή μελλοντική ροή στον επιλεγμένο ορίζοντα.</div>}</article><article className="panel neo-raised"><div className="panel-head"><div><span>Ιστορικό scheduled</span><small>Completed, skipped και cancelled διατηρούνται για audit.</small></div></div>{history.length ? <div className="scheduled-history-list">{history.slice(0, 8).map((item) => { const lifecycle = scheduledLifecycle(item, asOf); return <div key={item.id}><span><b>{item.note}</b><small>{shortDate(item.dueDate)} · {kindLabel[item.kind]}</small></span><em className={`scheduled-status ${lifecycle}`}>{lifecycleLabel[lifecycle]}</em><strong>{money.format(item.amount)}</strong></div> })}</div> : <div className="empty-inline">Δεν υπάρχει ιστορικό προγραμματισμένων κινήσεων.</div>}</article></section>

    {draft ? <div className="editor-backdrop" onMouseDown={closeDraft}><section ref={draftRef} className="panel neo-raised editor-dialog planning-editor" role="dialog" aria-modal="true" aria-labelledby="scheduled-editor-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}><div className="panel-head"><div><span id="scheduled-editor-title">{draft.id ? 'Επεξεργασία προγραμματισμένης' : 'Νέα προγραμματισμένη κίνηση'}</span><small>Το σχέδιο δεν επηρεάζει το πραγματικό υπόλοιπο πριν την ολοκλήρωση.</small></div><button type="button" className="icon-button" aria-label="Κλείσιμο" onClick={closeDraft}><X/></button></div><div className="kind-grid scheduled-kind-grid" role="group" aria-label="Είδος προγραμματισμένης κίνησης"><button type="button" className={draft.kind === 'expense' ? 'active' : ''} aria-pressed={draft.kind === 'expense'} onClick={() => changeKind('expense')}><ArrowDown/><b>Πληρωμή</b><small>Μελλοντικό έξοδο</small></button><button type="button" className={draft.kind === 'income' ? 'active' : ''} aria-pressed={draft.kind === 'income'} onClick={() => changeKind('income')}><ArrowUp/><b>Έσοδο</b><small>Γνωστό μελλοντικό έσοδο</small></button><button type="button" className={draft.kind === 'transfer' ? 'active' : ''} aria-pressed={draft.kind === 'transfer'} onClick={() => changeKind('transfer')}><ArrowLeftRight/><b>Μεταφορά</b><small>Εσωτερική, καθαρά 0€</small></button></div><div className="form-grid"><label><span>Ποσό</span><MoneyInput data-autofocus="true" value={draft.amount} onValueChange={(amount)=>setDraft({...draft,amount})}/></label><label><span>Προγραμματισμένη ημερομηνία</span><AppDateInput value={draft.dueDate} min={draft.id ? undefined : asOf} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })}/></label>{draft.kind === 'transfer' ? <><label><span>Από</span><AppSelectInput value={draft.fromAccountId} onChange={(event) => setDraft({ ...draft, fromAccountId: event.target.value })}>{accounts.map((account) => <option key={account.id} value={account.id}>{accountDisplayName(data, account.id)}</option>)}</AppSelectInput></label><label><span>Προς</span><AppSelectInput value={draft.toAccountId} onChange={(event) => setDraft({ ...draft, toAccountId: event.target.value })}>{accounts.map((account) => <option key={account.id} value={account.id}>{accountDisplayName(data, account.id)}</option>)}</AppSelectInput></label></> : <><label><span>Λογαριασμός</span><AppSelectInput value={draft.accountId} onChange={(event) => setDraft({ ...draft, accountId: event.target.value })}>{accounts.map((account) => <option key={account.id} value={account.id}>{accountDisplayName(data, account.id)}</option>)}</AppSelectInput></label><label><span>Κατηγορία</span><AppSelectInput value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value, subcategory: '' })}>{draftCategories.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}</AppSelectInput></label>{draftSubs.length ? <label><span>Υποκατηγορία</span><AppSelectInput value={draft.subcategory} onChange={(event) => setDraft({ ...draft, subcategory: event.target.value })}><option value="">Χωρίς υποκατηγορία</option>{draftSubs.map((value) => <option key={value} value={value}>{value}</option>)}</AppSelectInput></label> : null}</>}<label className="wide"><span>Περιγραφή</span><input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="π.χ. Ετήσια ασφάλεια"/></label></div>{error ? <div className="form-error" role="alert" aria-live="assertive">{error}</div> : null}<div className="editor-actions"><button type="button" className="secondary" onClick={closeDraft}>Ακύρωση</button><button type="button" className="save-button" onClick={saveDraft}><Check size={16}/> {draft.id ? 'Αποθήκευση αλλαγών' : 'Προσθήκη στο πρόγραμμα'}</button></div></section></div> : null}

    {complete ? <div className="editor-backdrop" onMouseDown={closeComplete}><section ref={completeRef} className="panel neo-raised editor-dialog completion-dialog" role="dialog" aria-modal="true" aria-labelledby="scheduled-complete-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}><div className="panel-head"><div><span id="scheduled-complete-title">Ολοκλήρωση πραγματικής κίνησης</span><small>«{complete.note}» · προγραμματισμένο {money.format(complete.amount)} στις {shortDate(complete.dueDate)}</small></div><button type="button" className="icon-button" aria-label="Κλείσιμο" onClick={closeComplete}><X/></button></div><div className="completion-note">Εδώ επιβεβαιώνεις τι έγινε πραγματικά. Μπορείς να αλλάξεις ημερομηνία, ποσό και λογαριασμό χωρίς να αλλάξει το αρχικό scheduled ιστορικό.</div><div className="form-grid"><label><span>Πραγματικό ποσό</span><MoneyInput data-autofocus="true" value={actualAmount} onValueChange={setActualAmount}/></label><label><span>Πραγματική ημερομηνία</span><AppDateInput value={actualDate} onChange={(event) => setActualDate(event.target.value)}/></label>{complete.kind === 'transfer' ? <><label><span>Από λογαριασμό</span><AppSelectInput value={actualFrom} onChange={(event) => setActualFrom(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{accountDisplayName(data, account.id)}</option>)}</AppSelectInput></label><label><span>Προς λογαριασμό</span><AppSelectInput value={actualTo} onChange={(event) => setActualTo(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{accountDisplayName(data, account.id)}</option>)}</AppSelectInput></label></> : <label><span>Πραγματικός λογαριασμός</span><AppSelectInput value={actualAccount} onChange={(event) => setActualAccount(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{accountDisplayName(data, account.id)}</option>)}</AppSelectInput></label>}</div>{completeError ? <div className="form-error" role="alert" aria-live="assertive">{completeError}</div> : null}<div className="editor-actions"><button type="button" className="secondary" onClick={closeComplete}>Πίσω</button><button type="button" className="save-button" onClick={submitComplete}><Check size={16}/> Καταχώριση πραγματικής κίνησης</button></div></section></div> : null}
    <ConfirmDialog open={Boolean(lifecycleTarget)} title={lifecycleTarget?.status==='cancelled'?'Ακύρωση προγραμματισμένης;':'Παράλειψη προγραμματισμένης;'} description={lifecycleTarget?`Η κίνηση «${lifecycleTarget.item.note}» θα ${lifecycleTarget.status==='cancelled'?'ακυρωθεί':'σημειωθεί ως παραλειφθείσα'}, θα παραμείνει στο ιστορικό και δεν θα επηρεάσει υπόλοιπα.`:'Η κίνηση θα παραμείνει στο ιστορικό χωρίς επίδραση στα υπόλοιπα.'} confirmLabel={lifecycleTarget?.status==='cancelled'?'Ακύρωση':'Παράλειψη'} tone={lifecycleTarget?.status==='cancelled'?'destructive':'default'} motionMode={data.state.settings.motion} onConfirm={confirmLifecycle} onCancel={()=>setLifecycleTarget(null)}/>
  </div>;
}