import { allAccounts, createEvent } from './domain.js';
import type { FinanceData, FinanceEvent, SplitPart } from '../types.js';

const CENTS = 100;

export function moneyToCents(value: number) {
  if (!Number.isFinite(value)) return Number.NaN;
  return Math.round((value + Number.EPSILON) * CENTS);
}

export function centsToMoney(value: number) {
  return Number((value / CENTS).toFixed(2));
}

export function transferEligibleAccounts(data: FinanceData) {
  return allAccounts(data).filter((account) => account.kind !== 'credit');
}

export function defaultTransferPair(data: FinanceData) {
  const accounts = transferEligibleAccounts(data);
  const preferredFrom = data.state.settings.defaultExpenseAccount;
  const from = accounts.find((account) => account.id === preferredFrom)?.id ?? accounts[0]?.id ?? '';
  const to = accounts.find((account) => account.id !== from && account.kind === 'savings')?.id
    ?? accounts.find((account) => account.id !== from)?.id
    ?? '';
  return { from, to };
}

export function transferDraftError(data: FinanceData, draft: { fromAccountId: string; toAccountId: string; amount: number }) {
  const ids = new Set(transferEligibleAccounts(data).map((account) => account.id));
  if (!Number.isFinite(draft.amount) || draft.amount <= 0) return 'Συμπλήρωσε θετικό ποσό μεταφοράς.';
  if (!draft.fromAccountId || !ids.has(draft.fromAccountId)) return 'Διάλεξε υπαρκτό λογαριασμό προέλευσης.';
  if (!draft.toAccountId || !ids.has(draft.toAccountId)) return 'Διάλεξε υπαρκτό λογαριασμό προορισμού.';
  if (draft.fromAccountId === draft.toAccountId) return 'Ο λογαριασμός προέλευσης και προορισμού πρέπει να είναι διαφορετικοί.';
  return null;
}

export function createTransferEvent(data: FinanceData, args: {
  date: string;
  amount: number;
  note?: string;
  fromAccountId: string;
  toAccountId: string;
}) {
  const error = transferDraftError(data, args);
  if (error) throw new Error(error);
  return createEvent({
    kind: 'transfer',
    date: args.date,
    amount: centsToMoney(moneyToCents(args.amount)),
    note: args.note?.trim() || 'Μεταφορά μεταξύ λογαριασμών',
    fromAccountId: args.fromAccountId,
    toAccountId: args.toAccountId,
  });
}

export type SplitAllocation = {
  totalCents: number;
  total: number;
  normalizedParts: SplitPart[];
};

/**
 * Split parts are the economic source of truth. The parent amount is always
 * derived in integer cents so 0.1 + 0.2 cannot create reconciliation drift.
 */
export function splitAllocation(parts: SplitPart[]): SplitAllocation {
  const normalizedParts = parts.map((part) => ({
    ...part,
    label: part.label.trim(),
    category: part.category.trim() || 'Άλλο',
    subcategory: part.subcategory?.trim() || undefined,
    amount: centsToMoney(moneyToCents(Number(part.amount))),
    kind: 'expense' as const,
  }));
  const totalCents = normalizedParts.reduce((sum, part) => sum + moneyToCents(part.amount), 0);
  return { totalCents, total: centsToMoney(totalCents), normalizedParts };
}

export function splitDraftError(data: FinanceData, draft: { accountId: string; parts: SplitPart[] }) {
  const accountIds = new Set(transferEligibleAccounts(data).map((account) => account.id));
  if (!draft.accountId || !accountIds.has(draft.accountId)) return 'Διάλεξε υπαρκτό λογαριασμό πληρωμής.';
  if (draft.parts.length < 2) return 'Ο διαχωρισμός χρειάζεται τουλάχιστον δύο μέρη.';
  if (draft.parts.some((part) => !Number.isFinite(Number(part.amount)) || Number(part.amount) <= 0)) return 'Κάθε επιμέρους ποσό πρέπει να είναι θετικό.';
  const allocation = splitAllocation(draft.parts);
  if (!Number.isFinite(allocation.totalCents) || allocation.normalizedParts.some((part) => !Number.isFinite(moneyToCents(part.amount)))) return 'Έλεγξε τα επιμέρους ποσά.';
  if (allocation.totalCents <= 0) return 'Το σύνολο των επιμέρους ποσών πρέπει να είναι θετικό.';
  return null;
}

export function createExpenseSplitEvent(data: FinanceData, args: {
  date: string;
  note?: string;
  accountId: string;
  parts: SplitPart[];
}): FinanceEvent {
  const error = splitDraftError(data, args);
  if (error) throw new Error(error);
  const allocation = splitAllocation(args.parts);
  return createEvent({
    kind: 'split',
    date: args.date,
    amount: allocation.total,
    note: args.note?.trim() || 'Διαχωρισμένη αγορά',
    accountId: args.accountId,
    parts: allocation.normalizedParts,
  });
}

export function splitCategorySummary(event: FinanceEvent) {
  if (event.kind !== 'split' || !event.parts?.length) return [];
  return event.parts.map((part) => ({
    id: part.id,
    label: part.label || part.category,
    category: part.category,
    subcategory: part.subcategory,
    amount: part.amount,
  }));
}
