import { allAccounts, createEvent } from './domain.js';
import { createTransferEvent, centsToMoney, moneyToCents, transferDraftError } from './ledgerFoundations.js';
import type { FinanceData, FinanceEvent, ScheduledKind, ScheduledTransaction, ScheduledTransactionStatus } from '../types.js';

export type ScheduledLifecycle = 'upcoming' | 'due' | 'completed' | 'skipped' | 'cancelled';

const validDate = /^\d{4}-\d{2}-\d{2}$/;

export function scheduledItems(data: FinanceData): ScheduledTransaction[] {
  return [...(data.state.scheduled ?? [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt.localeCompare(b.createdAt));
}

export function scheduledLifecycle(item: ScheduledTransaction, asOf: string): ScheduledLifecycle {
  if (item.status === 'completed') return 'completed';
  if (item.status === 'skipped') return 'skipped';
  if (item.status === 'cancelled') return 'cancelled';
  return item.dueDate <= asOf ? 'due' : 'upcoming';
}

export function pendingScheduled(data: FinanceData) {
  return scheduledItems(data).filter((item) => item.status === 'pending');
}

export function scheduledHistory(data: FinanceData) {
  return scheduledItems(data).filter((item) => item.status !== 'pending').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function eligibleAccountIds(data: FinanceData) {
  return new Set(allAccounts(data).filter((account) => account.kind !== 'credit').map((account) => account.id));
}

export function scheduledDraftError(data: FinanceData, draft: {
  kind: ScheduledKind;
  dueDate: string;
  amount: number;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
}) {
  if (!validDate.test(draft.dueDate)) return 'Διάλεξε έγκυρη ημερομηνία προγραμματισμένης κίνησης.';
  if (!Number.isFinite(draft.amount) || draft.amount <= 0) return 'Συμπλήρωσε θετικό ποσό.';
  if (draft.kind === 'transfer') return transferDraftError(data, { fromAccountId: draft.fromAccountId ?? '', toAccountId: draft.toAccountId ?? '', amount: draft.amount });
  const ids = eligibleAccountIds(data);
  if (!draft.accountId || !ids.has(draft.accountId)) return 'Ο επιλεγμένος λογαριασμός δεν είναι πλέον διαθέσιμος. Διάλεξε έναν ενεργό λογαριασμό.';
  return null;
}

export function createScheduledTransaction(data: FinanceData, args: {
  kind: ScheduledKind;
  dueDate: string;
  amount: number;
  note?: string;
  category?: string;
  subcategory?: string;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  id?: string;
  createdAt?: string;
}): ScheduledTransaction {
  const error = scheduledDraftError(data, args);
  if (error) throw new Error(error);
  const now = new Date().toISOString();
  return {
    id: args.id ?? `sch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    dueDate: args.dueDate,
    kind: args.kind,
    amount: centsToMoney(moneyToCents(args.amount)),
    note: args.note?.trim() || (args.kind === 'income' ? 'Προγραμματισμένο έσοδο' : args.kind === 'transfer' ? 'Προγραμματισμένη μεταφορά' : 'Προγραμματισμένη πληρωμή'),
    category: args.category?.trim() || undefined,
    subcategory: args.subcategory?.trim() || undefined,
    accountId: args.kind === 'transfer' ? undefined : args.accountId,
    fromAccountId: args.kind === 'transfer' ? args.fromAccountId : undefined,
    toAccountId: args.kind === 'transfer' ? args.toAccountId : undefined,
    status: 'pending',
    createdAt: args.createdAt ?? now,
    updatedAt: now,
  };
}

export function transitionScheduled(item: ScheduledTransaction, status: Exclude<ScheduledTransactionStatus, 'pending'>, completedEventId?: string): ScheduledTransaction {
  const now = new Date().toISOString();
  return {
    ...item,
    status,
    completedEventId: status === 'completed' ? completedEventId : item.completedEventId,
    completedAt: status === 'completed' ? now : item.completedAt,
    skippedAt: status === 'skipped' ? now : item.skippedAt,
    cancelledAt: status === 'cancelled' ? now : item.cancelledAt,
    updatedAt: now,
  };
}

export function scheduledToEvent(data: FinanceData, item: ScheduledTransaction, overrides: {
  date: string;
  amount?: number;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
}): FinanceEvent {
  if (item.status !== 'pending') throw new Error('Η προγραμματισμένη κίνηση έχει ήδη κλείσει και δεν μπορεί να καταχωριστεί ξανά.');
  const amount = overrides.amount ?? item.amount;
  if (item.kind === 'transfer') {
    return createTransferEvent(data, {
      date: overrides.date,
      amount,
      note: item.note,
      fromAccountId: overrides.fromAccountId ?? item.fromAccountId ?? '',
      toAccountId: overrides.toAccountId ?? item.toAccountId ?? '',
    });
  }
  const accountId = overrides.accountId ?? item.accountId;
  const error = scheduledDraftError(data, { kind: item.kind, dueDate: item.dueDate, amount, accountId });
  if (error) throw new Error(error);
  return createEvent({
    kind: item.kind,
    date: overrides.date,
    amount: centsToMoney(moneyToCents(amount)),
    note: item.note,
    category: item.category,
    accountId,
  });
}
