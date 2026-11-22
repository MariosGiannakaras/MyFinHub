import { allAccounts } from './domain.js';
import { money } from './format.js';
import type { EventKind, FinanceData, RecurringItem, ReviewSuggestion } from '../types.js';

export function effectiveRecurringItems(data: FinanceData): RecurringItem[] {
  const seeded = (data.seed.recurring ?? []).map((item) => data.state.recurringOverrides?.[item.id] ?? item);
  return [...seeded, ...(data.state.recurringCustom ?? [])].filter((item) => item.active && (item.status ?? 'active') === 'active');
}

export function accountDisplayName(data: FinanceData, accountId?: string | null) {
  if (!accountId) return '—';
  const configured=data.state.settings.accountNames?.[accountId]?.trim();
  return configured || allAccounts(data).find((account) => account.id === accountId)?.name || accountId;
}

const EVENT_LABELS: Record<EventKind, string> = {
  expense: 'Έξοδο', income: 'Έσοδο', transfer: 'Μεταφορά', saving_cash_offset: 'Αποταμίευση', withdrawal: 'Ανάληψη', refund: 'Επιστροφή χρημάτων', lending: 'Δανεικά προς άλλον', repayment: 'Επιστροφή δανεικών', lending_writeoff: 'Διαγραφή απαίτησης', card_purchase: 'Αγορά με πιστωτική', card_payment: 'Εξόφληση πιστωτικής', reconciliation: 'Διόρθωση υπολοίπου', split: 'Σύνθετη κίνηση',
};

export function eventKindLabel(kind: string) {
  return EVENT_LABELS[kind as EventKind] ?? kind;
}

const REVIEW_LABELS: Record<ReviewSuggestion['semanticKind'], string> = {
  expense: 'Έξοδο', income: 'Έσοδο', transfer: 'Μεταφορά', saving_cash_offset: 'Αποταμίευση', withdrawal: 'Ανάληψη', refund: 'Επιστροφή χρημάτων', lending: 'Δανεικά προς άλλον', repayment: 'Επιστροφή δανεικών', lending_writeoff: 'Διαγραφή απαίτησης', card_purchase: 'Αγορά με πιστωτική', card_payment: 'Εξόφληση πιστωτικής', reconciliation: 'Διόρθωση υπολοίπου', split: 'Σύνθετη κίνηση', split_required: 'Χρειάζεται διαχωρισμό', iris_context: 'Χρειάζεται χειροκίνητο έλεγχο',
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

/** Monthly change is undefined without a meaningful prior amount; never invent a percentage. */
export function monthComparisonPercent(current:number,previous:number):number|null{
  if(!Number.isFinite(current)||!Number.isFinite(previous)||Math.abs(previous)<=.005)return null;
  const percentage=((current-previous)/Math.abs(previous))*100;
  return Number.isFinite(percentage)?Math.round(percentage):null;
}

/** Keep zero-baseline explanations consistent across the two finance summaries. */
export function monthComparisonLabel(change:number|null,previousLabel:string):string{
  return change===null?'— χωρίς βάση σύγκρισης':
    `${change>0?'↑':change<0?'↓':'→'} ${Math.abs(change)}% από ${previousLabel}`;
}

/** Presentation-only signs follow the EUR cent actually rendered. */
export function expenseMoneyLabel(amount:number):string{
  const abs=Math.abs(amount);
  return `${amount>=.005?'−':amount<=-.005?'+':''}${money.format(abs)}`;
}

/** Avoid reporting +0,00 € or −0,00 € in zero-balance summaries. */
export function signedNetMoneyLabel(amount:number):string{
  const abs=Math.abs(amount);
  return `${amount>=.005?'+':amount<=-.005?'−':''}${money.format(abs)}`;
}
