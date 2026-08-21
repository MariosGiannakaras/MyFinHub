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
        creditLimit: state.settings?.creditLimit ?? 0,
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
  expectedReturnDate?: string;
  cardId?: string;
  recurringId?: string;
  loanId?: string;
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
    expectedReturnDate: args.expectedReturnDate,
    parts: args.parts,
    legs,
    savingAmount,
    receivableDelta,
    creditDelta,
    source: 'user',
    createdAt: now,
    updatedAt: now,
    cardId: args.cardId,
    recurringId: args.recurringId,
    loanId: args.loanId,
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
  return { income, expense, saving, refunds, net: income - expense };
}

export function accountBalances(data: FinanceData, asOf: string): Record<string, number> {
  const snapshots = [...(data.seed.snapshots ?? [])].filter((s) => s.date <= asOf).sort((a, b) => a.date.localeCompare(b.date));
  const latest = snapshots.at(-1);
  const base: Record<string, number> = { ...(latest?.balances ?? {}) };
  const start = latest?.date ?? '0000-00-00';
  for (const tx of effectiveLegacyTransactions(data)) {
    if (tx.date <= start || tx.date > asOf) continue;
    if (tx.type === 'income') base[tx.accountId ?? 'cash'] = (base[tx.accountId ?? 'cash'] ?? 0) + tx.amount;
    if (tx.type === 'expense') base[tx.accountId ?? 'cash'] = (base[tx.accountId ?? 'cash'] ?? 0) - tx.amount;
    if (tx.type === 'transfer') {
      if (tx.fromAccountId) base[tx.fromAccountId] = (base[tx.fromAccountId] ?? 0) - tx.amount;
      if (tx.toAccountId) base[tx.toAccountId] = (base[tx.toAccountId] ?? 0) + tx.amount;
    }
  }
  for (const event of data.state.events ?? []) {
    if (event.date <= start || event.date > asOf) continue;
    for (const leg of event.legs) base[leg.accountId] = (base[leg.accountId] ?? 0) + leg.amount;
  }
  return base;
}

export function availableBalance(data: FinanceData, asOf: string): number {
  const balances = accountBalances(data, asOf);
  const excluded = new Set(data.state.settings.excludedFromAvailable ?? []);
  return allAccounts(data).filter((a) => !excluded.has(a.id) && !a.excludeFromAvailable).reduce((s, a) => s + (balances[a.id] ?? 0), 0);
}

export function savingTotal(data: FinanceData, month?: string): number {
  const start = month ? `${month}-01` : '0000-00-00';
  const end = month ? `${month}-31` : '9999-99-99';
  return (data.state.events ?? []).filter((e) => e.date >= start && e.date <= end).reduce((s, e) => s + (flowImpactEvent(e).saving || 0), 0);
}

export function receivableTotal(data: FinanceData): number {
  return (data.seed.lending ?? []).reduce((s, p) => s + Number(p.outstanding || 0), 0) + (data.state.events ?? []).reduce((s, e) => s + Number(e.receivableDelta || 0), 0);
}

export function creditDebt(data: FinanceData, asOf: string): number {
  return Math.max(0, -(data.state.events ?? []).filter((e) => e.date <= asOf).reduce((s, e) => s + Number(e.creditDelta || 0), 0));
}

export function inferSuggestion(tx: LegacyTransaction): ReviewSuggestion {
  const note = cleanNote(tx.note).toUpperCase();
  if (/IRIS|P2P/.test(note)) return { transaction: tx, semanticKind: 'iris_context', confidence: 'low', reason: 'Η ένδειξη IRIS/P2P μπορεί να αφορά μεταφορά, αποπληρωμή, μοίρασμα εξόδου ή κανονική πληρωμή.' };
  if (/ATM|ΑΝΑΛΗΨ/.test(note)) return { transaction: tx, semanticKind: 'withdrawal', confidence: 'high', reason: 'Η περιγραφή μοιάζει με ανάληψη μετρητών.' };
  if (/ΠΙΣΤΩΤ|CREDIT CARD|CARD PAYMENT/.test(note)) return { transaction: tx, semanticKind: 'card_payment', confidence: 'medium', reason: 'Η περιγραφή μοιάζει με αποπληρωμή πιστωτικής.' };
  if (tx.type === 'transfer') return { transaction: tx, semanticKind: 'transfer', confidence: 'high', reason: 'Η αρχική κίνηση είναι ήδη σημειωμένη ως μεταφορά.' };
  return { transaction: tx, semanticKind: tx.type === 'income' ? 'income' : 'expense', confidence: 'medium', reason: 'Χρησιμοποιείται η αρχική ταξινόμηση μέχρι να την επιβεβαιώσεις.' };
}
