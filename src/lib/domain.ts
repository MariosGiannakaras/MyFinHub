import type {
  Account,
  EventKind,
  FinanceData,
  FinanceEvent,
  FlowImpact,
  LegacyTransaction,
  ReviewDecision,
  ReviewSuggestion,
  SplitPart,
} from '../types.js';
import { cleanNote } from './format.js';

export const CREDIT_ACCOUNT: Account = {
  id: 'credit-card',
  name: 'Πιστωτική κάρτα',
  short: 'CC',
  kind: 'credit',
  excludeFromAvailable: true,
};

export function migrateData(input: FinanceData): FinanceData {
  const fromSchema = Number(input.schemaVersion || 1);
  const state = input.state ?? ({} as FinanceData['state']);
  return {
    ...input,
    app: 'RheomIQ',
    schemaVersion: 3,
    updatedAt: input.updatedAt || new Date().toISOString(),
    state: {
      customTransactions: state.customTransactions ?? [],
      overrides: state.overrides ?? {},
      deleted: state.deleted ?? [],
      recurringCustom: state.recurringCustom ?? [],
      recurringOverrides: state.recurringOverrides ?? {},
      loanExtra: state.loanExtra ?? {},
      loanOverrides: state.loanOverrides ?? {},
      customLoans: state.customLoans ?? [],
      lendingCustom: state.lendingCustom ?? [],
      settings: {
        excludedFromAvailable: state.settings?.excludedFromAvailable ?? ['piraeus-savings'],
        accountNames: state.settings?.accountNames ?? {},
        expenseCategories: state.settings?.expenseCategories ?? [],
        incomeCategories: state.settings?.incomeCategories ?? [],
        customPresets: state.settings?.customPresets ?? [],
        pinnedPresets: state.settings?.pinnedPresets ?? [],
        defaultExpenseAccount: state.settings?.defaultExpenseAccount ?? 'piraeus-payroll',
        defaultIncomeAccount: state.settings?.defaultIncomeAccount ?? 'piraeus-payroll',
        defaultLoanAccount: state.settings?.defaultLoanAccount ?? 'piraeus-payroll',
        monthlyBudget: state.settings?.monthlyBudget ?? 1200,
        savingsTargetRate: state.settings?.savingsTargetRate ?? 0.2,
        motion: state.settings?.motion ?? 'system',
      },
      events: state.events ?? [],
      reviewDecisions: state.reviewDecisions ?? {},
      migration: state.migration ?? (fromSchema < 3 ? { fromSchema, migratedAt: new Date().toISOString() } : undefined),
    },
  };
}

export function allAccounts(data: FinanceData): Account[] {
  const accounts = data.seed.accounts ?? [];
  return accounts.some((a) => a.id === CREDIT_ACCOUNT.id) ? accounts : [...accounts, CREDIT_ACCOUNT];
}

function deletedSet(data: FinanceData) {
  const raw = data.state.deleted;
  return new Set(Array.isArray(raw) ? raw : Object.keys(raw ?? {}).filter((k) => Boolean((raw as Record<string, boolean>)[k])));
}

export function effectiveLegacyTransactions(data: FinanceData): LegacyTransaction[] {
  const deleted = deletedSet(data);
  const base = data.seed.transactions
    .filter((tx) => !deleted.has(tx.id))
    .map((tx) => data.state.overrides?.[tx.id] ?? tx);
  return [...base, ...(data.state.customTransactions ?? [])].sort((a, b) => a.date.localeCompare(b.date));
}

export function reviewDecision(data: FinanceData, txId: string): ReviewDecision | undefined {
  return data.state.reviewDecisions?.[txId];
}

export function flowImpactLegacy(data: FinanceData, tx: LegacyTransaction): FlowImpact {
  const decision = reviewDecision(data, tx.id);
  if (decision?.status === 'confirmed' && decision.semanticKind) {
    switch (decision.semanticKind) {
      case 'saving_cash_offset': return { income: 0, expense: 0, saving: tx.amount, refund: 0 };
      case 'withdrawal':
      case 'transfer':
      case 'card_payment':
      case 'reconciliation': return { income: 0, expense: 0, saving: 0, refund: 0 };
      case 'refund': return { income: 0, expense: -tx.amount, saving: 0, refund: tx.amount };
      case 'split': {
        return (decision.parts ?? []).reduce<FlowImpact>((acc,p)=>{const kind=p.kind||'expense';if(kind==='income')acc.income+=p.amount;else if(kind==='refund'){acc.expense-=p.amount;acc.refund+=p.amount}else if(kind==='saving')acc.saving+=p.amount;else if(kind==='expense')acc.expense+=p.amount;return acc},{income:0,expense:0,saving:0,refund:0});
      }
      default: break;
    }
  }
  if (tx.type === 'income') return { income: tx.amount, expense: 0, saving: 0, refund: 0 };
  if (tx.type === 'expense') return { income: 0, expense: tx.amount, saving: 0, refund: 0 };
  return { income: 0, expense: 0, saving: 0, refund: 0 };
}

export function flowImpactEvent(event: FinanceEvent): FlowImpact {
  switch (event.kind) {
    case 'income': return { income: event.amount, expense: 0, saving: 0, refund: 0 };
    case 'expense':
    case 'card_purchase': return { income: 0, expense: event.amount, saving: 0, refund: 0 };
    case 'split': return { income: 0, expense: (event.parts ?? []).reduce((s, p) => s + p.amount, 0), saving: 0, refund: 0 };
    case 'saving_cash_offset': return { income: 0, expense: 0, saving: event.savingAmount ?? event.amount, refund: 0 };
    case 'refund': return { income: 0, expense: -event.amount, saving: 0, refund: event.amount };
    default: return { income: 0, expense: 0, saving: 0, refund: 0 };
  }
}

export function createEvent(args: {
  kind: EventKind;
  date: string;
  amount: number;
  note: string;
  category?: string;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  person?: string;
  parts?: SplitPart[];
  actualBalance?: number;
  currentBalance?: number;
}): FinanceEvent {
  const now = new Date().toISOString();
  const id = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const amount = Number(args.amount);
  const legs: FinanceEvent['legs'] = [];
  let savingAmount = 0;
  let receivableDelta = 0;
  let creditDelta = 0;

  const requireAccount = (id?: string) => {
    if (!id) throw new Error('Απαιτείται λογαριασμός.');
    return id;
  };

  switch (args.kind) {
    case 'expense': legs.push({ accountId: requireAccount(args.accountId), amount: -amount }); break;
    case 'income': legs.push({ accountId: requireAccount(args.accountId), amount }); break;
    case 'transfer':
    case 'withdrawal':
      if (!args.fromAccountId || !args.toAccountId || args.fromAccountId === args.toAccountId) throw new Error('Η μεταφορά χρειάζεται δύο διαφορετικούς λογαριασμούς.');
      legs.push({ accountId: args.fromAccountId, amount: -amount }, { accountId: args.toAccountId, amount });
      break;
    case 'saving_cash_offset':
      if (!args.fromAccountId || !args.toAccountId || args.fromAccountId === args.toAccountId) throw new Error('Η αποταμίευση χρειάζεται λογαριασμό προέλευσης και ταμιευτηρίου.');
      legs.push({ accountId: args.fromAccountId, amount: -amount }, { accountId: args.toAccountId, amount });
      savingAmount = amount;
      break;
    case 'refund': legs.push({ accountId: requireAccount(args.accountId), amount }); break;
    case 'lending':
      legs.push({ accountId: requireAccount(args.accountId), amount: -amount });
      receivableDelta = amount;
      break;
    case 'repayment':
      legs.push({ accountId: requireAccount(args.accountId), amount });
      receivableDelta = -amount;
      break;
    case 'card_purchase':
      legs.push({ accountId: CREDIT_ACCOUNT.id, amount: -amount });
      creditDelta = -amount;
      break;
    case 'card_payment':
      legs.push({ accountId: requireAccount(args.fromAccountId), amount: -amount }, { accountId: CREDIT_ACCOUNT.id, amount });
      creditDelta = amount;
      break;
    case 'reconciliation': {
      const delta = Number(args.actualBalance ?? 0) - Number(args.currentBalance ?? 0);
      legs.push({ accountId: requireAccount(args.accountId), amount: delta });
      break;
    }
    case 'split': {
      const total = (args.parts ?? []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
      if (Math.abs(total - amount) > 0.009) throw new Error(`Τα επιμέρους ποσά (${total.toFixed(2)}€) δεν ισούνται με το σύνολο (${amount.toFixed(2)}€).`);
      legs.push({ accountId: requireAccount(args.accountId), amount: -amount });
      break;
    }
  }

  return {
    id,
    date: args.date,
    kind: args.kind,
    amount,
    note: args.note,
    category: args.category,
    accountId: args.accountId,
    fromAccountId: args.fromAccountId,
    toAccountId: args.toAccountId,
    person: args.person,
    parts: args.parts,
    legs,
    savingAmount,
    receivableDelta,
    creditDelta,
    source: 'user',
    createdAt: now,
    updatedAt: now,
  };
}

export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, '0')}` };
}

export function monthlyFlow(data: FinanceData, month: string) {
  const { start, end } = monthRange(month);
  let income = 0, expense = 0, saving = 0, refunds = 0;
  for (const tx of effectiveLegacyTransactions(data)) {
    if (tx.date < start || tx.date > end) continue;
    const f = flowImpactLegacy(data, tx);
    income += f.income; expense += f.expense; saving += f.saving; refunds += f.refund;
  }
  for (const event of data.state.events ?? []) {
    if (event.date < start || event.date > end) continue;
    const f = flowImpactEvent(event);
    income += f.income; expense += f.expense; saving += f.saving; refunds += f.refund;
  }
  return { income, expense: Math.max(0, expense), saving, refunds, net: income - expense };
}

function baseSnapshot(data: FinanceData, asOf: string) {
  const snapshots = data.seed.snapshots.filter((s) => s.date <= asOf);
  if (snapshots.length) return snapshots[snapshots.length - 1];
  return { date: '0000-00-00', balances: Object.fromEntries(data.seed.accounts.map((a) => [a.id, 0])) };
}

function legacyDeltaAgainstSeed(data: FinanceData, asOf: string, balances: Record<string, number>) {
  const baseById = new Map(data.seed.transactions.map((tx) => [tx.id, tx]));
  const deleted = deletedSet(data);
  const addTx = (tx: LegacyTransaction, sign = 1) => {
    if (tx.date > asOf) return;
    if (tx.type === 'income' && tx.accountId) balances[tx.accountId] = (balances[tx.accountId] ?? 0) + sign * tx.amount;
    if (tx.type === 'expense' && tx.accountId) balances[tx.accountId] = (balances[tx.accountId] ?? 0) - sign * tx.amount;
    if (tx.type === 'adjustment' && tx.accountId) balances[tx.accountId] = (balances[tx.accountId] ?? 0) + sign * tx.amount;
    if (tx.type === 'transfer' && tx.fromAccountId && tx.toAccountId) {
      balances[tx.fromAccountId] = (balances[tx.fromAccountId] ?? 0) - sign * tx.amount;
      balances[tx.toAccountId] = (balances[tx.toAccountId] ?? 0) + sign * tx.amount;
    }
  };
  for (const id of deleted) {
    const original = baseById.get(id); if (original) addTx(original, -1);
  }
  for (const [id, override] of Object.entries(data.state.overrides ?? {})) {
    const original = baseById.get(id); if (original) addTx(original, -1);
    addTx(override, 1);
  }
  for (const tx of data.state.customTransactions ?? []) addTx(tx, 1);
}

export function accountBalances(data: FinanceData, asOf: string): Record<string, number> {
  const snapshot = baseSnapshot(data, asOf);
  const balances: Record<string, number> = { ...snapshot.balances, [CREDIT_ACCOUNT.id]: 0 };
  legacyDeltaAgainstSeed(data, asOf, balances);
  for (const event of data.state.events ?? []) {
    if (event.date > asOf) continue;
    for (const leg of event.legs) balances[leg.accountId] = (balances[leg.accountId] ?? 0) + leg.amount;
  }
  return balances;
}

export function legacyOutstandingReceivables(data: FinanceData) {
  return (data.seed.lending ?? []).reduce((sum, p) => sum + Number(p.outstanding || 0), 0);
}

export function eventReceivables(data: FinanceData) {
  return (data.state.events ?? []).reduce((sum, e) => sum + Number(e.receivableDelta || 0), 0);
}

export function netWorth(data: FinanceData, asOf: string) {
  const balances = accountBalances(data, asOf);
  const assets = allAccounts(data).filter((a) => a.kind !== 'credit').reduce((sum, a) => sum + (balances[a.id] ?? 0), 0);
  const credit = Math.min(0, balances[CREDIT_ACCOUNT.id] ?? 0);
  return assets + credit + legacyOutstandingReceivables(data) + eventReceivables(data);
}

export function availableMoney(data: FinanceData, asOf: string) {
  const balances = accountBalances(data, asOf);
  const excluded = new Set(data.state.settings.excludedFromAvailable ?? []);
  return allAccounts(data)
    .filter((a) => a.kind !== 'credit' && !excluded.has(a.id) && !a.excludeFromAvailable)
    .reduce((sum, a) => sum + (balances[a.id] ?? 0), 0);
}

export function categoryTotals(data: FinanceData, month: string) {
  const { start, end } = monthRange(month);
  const totals = new Map<string, number>();
  const add = (cat: string, amount: number) => totals.set(cat || 'Άλλο', (totals.get(cat || 'Άλλο') ?? 0) + amount);
  for (const tx of effectiveLegacyTransactions(data)) {
    if (tx.date < start || tx.date > end) continue;
    const decision = reviewDecision(data, tx.id);
    if (decision?.status === 'confirmed' && decision.semanticKind === 'split' && decision.parts?.length) {
      decision.parts.forEach((p) => { const kind=p.kind||'expense'; if(kind==='expense')add(p.category,p.amount); else if(kind==='refund')add(p.category,-p.amount); });
      continue;
    }
    const impact = flowImpactLegacy(data, tx);
    if (impact.expense !== 0) add(decision?.category || tx.category || 'Άλλο', impact.expense);
  }
  for (const event of data.state.events ?? []) {
    if (event.date < start || event.date > end) continue;
    if (event.kind === 'split') (event.parts ?? []).forEach((p) => add(p.category, p.amount));
    else {
      const impact = flowImpactEvent(event);
      if (impact.expense !== 0) add(event.category || 'Άλλο', impact.expense);
    }
  }
  return [...totals.entries()].map(([name, value]) => ({ name, value: Math.max(0, value) })).filter((x) => x.value > 0.005).sort((a, b) => b.value - a.value);
}

const amountRegex = /(?:^|[^\d])(\d{1,4}(?:[.,]\d{1,2})?)\s*€/g;
function moneyMentions(note: string) {
  return [...note.matchAll(amountRegex)].map((m) => Number(m[1].replace(',', '.'))).filter(Number.isFinite);
}

export function suggestSplitParts(noteInput: string, fallbackCategory = 'Άλλο'): SplitPart[] {
  const note = cleanNote(noteInput);
  const parts: SplitPart[] = [];
  for (const rawLine of note.split(/\n+/)) {
    const line = rawLine.trim(); if (!line) continue;
    const values = [...line.matchAll(/(\d{1,5}(?:[.,]\d{1,2})?)\s*€/g)].map(m=>Number(m[1].replace(',','.'))).filter(v=>v>0);
    if (!values.length) continue;
    const amount = values.reduce((s,v)=>s+v,0);
    const upper=line.toLocaleUpperCase('el-GR');
    const kind: SplitPart['kind'] = /ΕΠΙΣΤΡΟΦ/.test(upper)?'refund':/(ΜΙΣΘ|ΕΠΙΔΟΜ|ΔΩΡΟ)/.test(upper)?'income':/ΑΠΟΤΑΜΙΕΥΣ|PAY&SAVE/.test(upper)?'saving':/ΔΙ[ΟΌ]ΡΘΩΣ/.test(upper)?'reconciliation':/ΜΕΤΑΦΟΡ|ΑΝΑΛΗΨ/.test(upper)?'transfer':'expense';
    const label=line.replace(/\s*[:=]?\s*\d[\d.,]*(?:\s*€)?[\s\S]*$/,'').trim()||line.slice(0,40);
    parts.push({id:`sp-${parts.length}-${Math.random().toString(36).slice(2,6)}`,label,category:fallbackCategory,amount:Number(amount.toFixed(2)),kind});
  }
  return parts;
}

export function reviewSuggestions(data: FinanceData): ReviewSuggestion[] {
  const decisions = data.state.reviewDecisions ?? {};
  const suggestions: ReviewSuggestion[] = [];
  for (const tx of effectiveLegacyTransactions(data)) {
    const existingDecision=decisions[tx.id];
    if(existingDecision?.status==='confirmed'||existingDecision?.status==='kept') continue;
    if(existingDecision?.status==='snoozed'&&existingDecision.snoozedUntil&&existingDecision.snoozedUntil>new Date().toISOString()) continue;
    const note = cleanNote(tx.note);
    const upper = note.toLocaleUpperCase('el-GR');
    const mentions = moneyMentions(note);
    const mixed = mentions.length >= 2 || /\n\s*\+|\n.+:/m.test(note);
    if (/PAY&SAVE/.test(upper)) suggestions.push({ transaction: tx, semanticKind: 'saving_cash_offset', confidence: 'high', reason: 'Το Pay&Save είναι αποταμίευση/εσωτερική κίνηση, όχι νέο εισόδημα ή έξοδο.' });
    else if (/ΑΠΟΤΑΜΙΕΥΣ/.test(upper)) suggestions.push({ transaction: tx, semanticKind: mixed ? 'split_required' : 'saving_cash_offset', confidence: mixed ? 'medium' : 'high', reason: mixed ? 'Το σχόλιο περιέχει αποταμίευση μαζί με άλλο οικονομικό γεγονός και χρειάζεται split.' : 'Η κίνηση περιγράφεται ρητά ως αποταμίευση.' });
    else if (/ΑΝΑΛΗΨΗ ΑΠΟ/.test(upper)) suggestions.push({ transaction: tx, semanticKind: mixed ? 'split_required' : 'withdrawal', confidence: mixed ? 'medium' : 'high', reason: mixed ? 'Ανάληψη και πραγματικά έξοδα εμφανίζονται στην ίδια εγγραφή.' : 'Η ανάληψη είναι μεταφορά τραπεζικού υπολοίπου σε μετρητά, όχι expense.' });
    else if (/ΠΛΗΡΩΜΗ ΠΙΣΤΩΤΙΚΗΣ/.test(upper)) suggestions.push({ transaction: tx, semanticKind: 'card_payment', confidence: 'medium', reason: 'Η εξόφληση πιστωτικής συνήθως είναι liability transfer. Απαιτεί έλεγχο επειδή το legacy ιστορικό ίσως περιέχει τις αγορές μέσα στο ίδιο σχόλιο.' });
    else if (/ΔΙ[ΟΌ]ΡΘΩΣ/.test(upper)) suggestions.push({ transaction: tx, semanticKind: mixed ? 'split_required' : 'reconciliation', confidence: mixed ? 'medium' : 'high', reason: mixed ? 'Η διόρθωση είναι αναμεμειγμένη με πραγματική αγορά.' : 'Η καθαρή διόρθωση υπολοίπου πρέπει να εξαιρεθεί από spending.' });
    else if (/ΕΠΙΣΤΡΟΦ/.test(upper)) suggestions.push({ transaction: tx, semanticKind: mixed ? 'split_required' : 'refund', confidence: mixed ? 'medium' : 'medium', reason: mixed ? 'Η επιστροφή είναι μαζί με άλλο έσοδο/έξοδο.' : 'Η επιστροφή αγοράς πρέπει να μειώνει spending αντί να εμφανίζεται ως κανονικό income.' });
    else if (/IRIS/.test(upper)) suggestions.push({ transaction: tx, semanticKind: 'iris_context', confidence: 'low', reason: 'Το IRIS μπορεί να είναι πληρωμή, επιστροφή, δανεικό ή ανταλλαγή μετρητών και χρειάζεται ανθρώπινη επιβεβαίωση.' });
  }
  return suggestions.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.confidence] - { high: 0, medium: 1, low: 2 }[b.confidence]));
}

export function frequentDescriptions(data: FinanceData, type: 'expense' | 'income' = 'expense', limit = 12) {
  const map = new Map<string, { label: string; count: number; category: string; accountId?: string; lastAmount: number; lastDate: string }>();
  for (const tx of effectiveLegacyTransactions(data)) {
    if (tx.type !== type) continue;
    const label = cleanNote(tx.note).split('\n')[0].replace(/:\s*[-+]?\d.*$/, '').trim().slice(0, 42);
    if (!label || label.length < 2) continue;
    const prev = map.get(label) ?? { label, count: 0, category: tx.category || '', accountId: tx.accountId, lastAmount: tx.amount, lastDate: tx.date };
    prev.count += 1;
    if (tx.date >= prev.lastDate) { prev.lastDate = tx.date; prev.lastAmount = tx.amount; prev.category = tx.category || prev.category; prev.accountId = tx.accountId || prev.accountId; }
    map.set(label, prev);
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export function dailyExpenseSeries(data: FinanceData, month: string) {
  const { start, end } = monthRange(month);
  const map = new Map<string, number>();
  for (const tx of effectiveLegacyTransactions(data)) {
    if (tx.date < start || tx.date > end) continue;
    const f = flowImpactLegacy(data, tx); map.set(tx.date, (map.get(tx.date) ?? 0) + f.expense);
  }
  for (const event of data.state.events ?? []) {
    if (event.date < start || event.date > end) continue;
    const f = flowImpactEvent(event); map.set(event.date, (map.get(event.date) ?? 0) + f.expense);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date: date.slice(-2), value: Math.max(0, value) }));
}
