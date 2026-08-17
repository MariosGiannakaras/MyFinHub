import { allAccounts } from './domain.js';
import type { EventKind, FinanceData, RecurringItem, ReviewSuggestion } from '../types.js';

export function effectiveRecurringItems(data: FinanceData): RecurringItem[] {
  const seeded = (data.seed.recurring ?? []).map((item) => data.state.recurringOverrides?.[item.id] ?? item);
  return [...seeded, ...(data.state.recurringCustom ?? [])].filter((item) => item.active);
}

export function accountDisplayName(data: FinanceData, accountId?: string | null) {
  if (!accountId) return '—';
  return allAccounts(data).find((account) => account.id === accountId)?.name ?? accountId;
}

const EVENT_LABELS: Record<EventKind, string> = {
  expense: 'Έξοδο', income: 'Έσοδο', transfer: 'Μεταφορά', saving_cash_offset: 'Αποταμίευση', withdrawal: 'Ανάληψη', refund: 'Επιστροφή χρημάτων', lending: 'Δανεικά προς άλλον', repayment: 'Επιστροφή δανεικών', card_purchase: 'Αγορά με πιστωτική', card_payment: 'Εξόφληση πιστωτικής', reconciliation: 'Διόρθωση υπολοίπου', split: 'Σύνθετη κίνηση',
};

export function eventKindLabel(kind: string) {
  return EVENT_LABELS[kind as EventKind] ?? kind;
}

const REVIEW_LABELS: Record<ReviewSuggestion['semanticKind'], string> = {
  expense: 'Έξοδο', income: 'Έσοδο', transfer: 'Μεταφορά', saving_cash_offset: 'Αποταμίευση', withdrawal: 'Ανάληψη', refund: 'Επιστροφή χρημάτων', lending: 'Δανεικά προς άλλον', repayment: 'Επιστροφή δανεικών', card_purchase: 'Αγορά με πιστωτική', card_payment: 'Εξόφληση πιστωτικής', reconciliation: 'Διόρθωση υπολοίπου', split: 'Σύνθετη κίνηση', split_required: 'Χρειάζεται διαχωρισμό', iris_context: 'Χρειάζεται χειροκίνητο έλεγχο',
};

export function reviewSemanticLabel(kind: ReviewSuggestion['semanticKind']) {
  return REVIEW_LABELS[kind] ?? kind;
}

export function reviewConfidenceLabel(confidence: ReviewSuggestion['confidence']) {
  if (confidence === 'high') return 'Υψηλή βεβαιότητα';
  if (confidence === 'medium') return 'Μέτρια βεβαιότητα';
  return 'Χαμηλή βεβαιότητα';
}

export function ratioPercent(value: number, target: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0) return null;
  return Math.max(0, Math.min(100, (value / target) * 100));
}
