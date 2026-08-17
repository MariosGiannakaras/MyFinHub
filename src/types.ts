export type AccountKind = 'cash' | 'bank' | 'savings' | 'credit';

export interface Account {
  id: string;
  name: string;
  short?: string;
  kind: AccountKind | string;
  excludeFromAvailable?: boolean;
}

export interface LegacyTransaction {
  id: string;
  date: string;
  type: 'income' | 'expense' | 'transfer' | 'adjustment';
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  amount: number;
  note: string;
  category?: string;
  source?: string;
  cell?: string;
  sheet?: string;
  formula?: string | null;
}

export type EventKind =
  | 'expense'
  | 'income'
  | 'transfer'
  | 'saving_cash_offset'
  | 'withdrawal'
  | 'refund'
  | 'lending'
  | 'repayment'
  | 'card_purchase'
  | 'card_payment'
  | 'reconciliation'
  | 'split';

export interface LedgerLeg {
  accountId: string;
  amount: number;
}

export interface SplitPart {
  id: string;
  label: string;
  category: string;
  amount: number;
  kind?: 'expense' | 'income' | 'refund' | 'saving' | 'transfer' | 'reconciliation';
}

export interface FinanceEvent {
  id: string;
  date: string;
  kind: EventKind;
  amount: number;
  note: string;
  category?: string;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  person?: string;
  legs: LedgerLeg[];
  parts?: SplitPart[];
  savingAmount?: number;
  receivableDelta?: number;
  creditDelta?: number;
  source?: 'user' | 'migration' | 'review';
  createdAt: string;
  updatedAt: string;
  loanId?: string;
}

export interface ReviewDecision {
  status: 'confirmed' | 'kept' | 'snoozed';
  semanticKind?: EventKind | 'split_required';
  category?: string;
  parts?: SplitPart[];
  decidedAt: string;
  snoozedUntil?: string;
}

export interface FinanceData {
  app: string;
  schemaVersion: number;
  updatedAt: string;
  source?: Record<string, unknown>;
  seed: {
    version?: number;
    generatedAt?: string;
    sourceName?: string;
    accounts: Account[];
    months: string[];
    transactions: LegacyTransaction[];
    snapshots: Array<{ date: string; balances: Record<string, number>; sheet?: string }>;
    monthlyRaw?: Array<Record<string, unknown>>;
    fixedHistory?: unknown[];
    recurring: RecurringItem[];
    subscriptions: Subscription[];
    loans: Loan[];
    lending: LendingPerson[];
    legacyBudget?: unknown;
    stats: Record<string, number>;
  };
  state: {
    customTransactions: LegacyTransaction[];
    overrides: Record<string, LegacyTransaction>;
    deleted: string[] | Record<string, boolean>;
    recurringCustom: RecurringItem[];
    recurringOverrides: Record<string, RecurringItem>;
    loanExtra: Record<string, number>;
    loanOverrides: Record<string, Loan>;
    customLoans: Loan[];
    lendingCustom: unknown[];
    settings: FinanceSettings;
    events?: FinanceEvent[];
    reviewDecisions?: Record<string, ReviewDecision>;
    migration?: { fromSchema: number; migratedAt: string };
  };
}

export interface FinanceSettings {
  excludedFromAvailable: string[];
  accountNames: Record<string, string>;
  expenseCategories: string[];
  incomeCategories: string[];
  customPresets: string[];
  pinnedPresets: string[];
  defaultExpenseAccount: string;
  defaultIncomeAccount: string;
  defaultLoanAccount: string;
  monthlyBudget?: number;
  savingsTargetRate?: number;
  motion?: 'system' | 'reduced' | 'full';
}

export interface RecurringItem {
  id: string;
  name: string;
  amount: number;
  day?: number | null;
  accountId: string;
  category: string;
  active: boolean;
  source?: string;
}

export interface Subscription {
  id: string;
  name: string;
  due?: string;
  period?: string;
  cost: number;
}

export interface Loan {
  id: string;
  name: string;
  total: number;
  installment: number;
  installments: number;
  day?: string;
  provider?: string;
  schedule?: Array<{ date: string; status: string }>;
  paidCount?: number;
  source?: string;
  accountingMode?: 'expense-per-installment' | 'liability-repayment';
}

export interface LendingPerson {
  person: string;
  entries: Array<{ date: string; lent: number; repaid: number; haircut?: number }>;
  outstanding: number;
}

export interface FlowImpact {
  income: number;
  expense: number;
  saving: number;
  refund: number;
}

export interface ReviewSuggestion {
  transaction: LegacyTransaction;
  semanticKind: EventKind | 'split_required' | 'iris_context';
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}
