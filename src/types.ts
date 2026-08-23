export type AccountKind = 'cash' | 'bank' | 'savings' | 'credit';
export type SavingSource = 'pay_and_save' | 'manual_transfer' | 'cash_offset';
export type RecurringStatus = 'active' | 'paused' | 'stopped';
export type CardKind = 'debit' | 'prepaid' | 'credit';
export type CardNetwork = 'visa' | 'mastercard' | 'other';
export type CardFormFactor = 'physical' | 'virtual';
export type LoanKind = 'installment' | 'loan' | 'self-loan';
export type TextSizePreference = 'compact' | 'normal' | 'large';
export type ScheduledKind = 'expense' | 'income' | 'transfer';
export type ScheduledTransactionStatus = 'pending' | 'completed' | 'skipped' | 'cancelled';
export type TransactionRuleScope = 'manual' | 'imported' | 'review';

export interface Account {
  id: string;
  name: string;
  short?: string;
  kind: AccountKind | string;
  excludeFromAvailable?: boolean;
}

export interface CategoryDefinition {
  name: string;
  subcategories: string[];
}

export interface CardBank {
  id: string;
  name: string;
  order: number;
  custom?: boolean;
}

export interface PaymentCard {
  id: string;
  bankId: string;
  nickname: string;
  kind: CardKind;
  network: CardNetwork;
  formFactor?: CardFormFactor;
  designId?: string;
  holderName?: string;
  last4?: string;
  vaultRef?: string;
  creditLimit?: number;
  active: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
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
  subcategory?: string;
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
  subcategory?: string;
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
  subcategory?: string;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  person?: string;
  expectedReturnDate?: string;
  legs: LedgerLeg[];
  parts?: SplitPart[];
  savingAmount?: number;
  savingSource?: SavingSource;
  receivableDelta?: number;
  creditDelta?: number;
  source?: 'user' | 'migration' | 'review';
  createdAt: string;
  updatedAt: string;
  loanId?: string;
  installmentCount?: number;
  recurringId?: string;
  cardId?: string;
}

export interface ScheduledTransaction {
  id: string;
  dueDate: string;
  kind: ScheduledKind;
  amount: number;
  note: string;
  category?: string;
  subcategory?: string;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  status: ScheduledTransactionStatus;
  completedEventId?: string;
  completedAt?: string;
  skippedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewDecision {
  status: 'confirmed' | 'kept' | 'snoozed';
  semanticKind?: EventKind | 'split_required';
  category?: string;
  parts?: SplitPart[];
  decidedAt: string;
  snoozedUntil?: string;
}

export interface AttentionDecision {
  status: 'snoozed' | 'dismissed';
  fingerprint: string;
  decidedAt: string;
  snoozedUntil?: string;
}

export interface MonthlyBudget {
  id: string;
  month: string;
  scope: 'category' | 'overall';
  category?: string;
  amount: number;
  alertThreshold?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionRuleMatch {
  description?: string;
  merchant?: string;
  accountId?: string;
  mode?: 'contains' | 'equals';
}

export interface TransactionRuleAction {
  category?: string;
  subcategory?: string;
  note?: string;
}

export interface TransactionRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  scopes: TransactionRuleScope[];
  match: TransactionRuleMatch;
  action: TransactionRuleAction;
  createdAt: string;
  updatedAt: string;
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
    cardBanks?: CardBank[];
    cards?: PaymentCard[];
    events?: FinanceEvent[];
    scheduled?: ScheduledTransaction[];
    reviewDecisions?: Record<string, ReviewDecision>;
    attentionDecisions?: Record<string, AttentionDecision>;
    budgets?: MonthlyBudget[];
    transactionRules?: TransactionRule[];
    migration?: { fromSchema: number; migratedAt: string };
  };
}

export interface FinanceSettings {
  excludedFromAvailable: string[];
  accountNames: Record<string, string>;
  expenseCategories: string[];
  incomeCategories: string[];
  expenseCategoryTree?: CategoryDefinition[];
  incomeCategoryTree?: CategoryDefinition[];
  categoryIcons?: Record<string, string>;
  subcategoryIcons?: Record<string, string>;
  customPresets: string[];
  pinnedPresets: string[];
  defaultExpenseAccount: string;
  defaultIncomeAccount: string;
  defaultLoanAccount: string;
  monthlyBudget?: number;
  savingsTargetRate?: number;
  creditLimit?: number;
  motion?: 'system' | 'reduced' | 'full';
  textSize?: TextSizePreference;
}

export interface RecurringItem {
  id: string;
  name: string;
  amount: number;
  day?: number | null;
  firstExpectedDate?: string | null;
  accountId: string;
  category: string;
  active: boolean;
  status?: RecurringStatus;
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
  kind?: LoanKind;
  firstExpectedDate?: string | null;
  defaultAccountId?: string;
  forgivenAmount?: number;
  longTermRecurring?: boolean;
}

export interface LendingEntry {
  date: string;
  lent: number;
  repaid: number;
  haircut?: number;
}

export interface LendingPerson {
  person: string;
  entries: LendingEntry[];
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
