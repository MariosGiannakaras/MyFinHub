import type { EventKind, FinanceSettings, Loan, RecurringItem, SplitPart } from '../types.js';

export function entryDefaults(kind: EventKind, settings: FinanceSettings, fallbackAccount: string) {
  if (kind === 'income') {
    return {
      accountId: settings.defaultIncomeAccount || fallbackAccount,
      category: settings.incomeCategories[0] || 'Άλλο',
    };
  }
  return {
    accountId: settings.defaultExpenseAccount || fallbackAccount,
    category: settings.expenseCategories[0] || 'Άλλο',
  };
}

export function entryDraftError(kind: EventKind, draft: { amount: string; person: string; actualBalance: string; parts: SplitPart[] }) {
  if (kind === 'split') {
    if (draft.parts.length < 2) return 'Ο διαχωρισμός χρειάζεται τουλάχιστον δύο επιμέρους μέρη.';
    if (draft.parts.some((part) => !Number.isFinite(Number(part.amount)) || Number(part.amount) <= 0)) return 'Κάθε επιμέρους ποσό πρέπει να είναι θετικό.';
    return null;
  }
  const amount = Number(draft.amount);
  if (kind !== 'reconciliation' && (!Number.isFinite(amount) || amount <= 0)) return 'Συμπλήρωσε θετικό ποσό.';
  if ((kind === 'lending' || kind === 'repayment') && !draft.person.trim()) return 'Συμπλήρωσε το πρόσωπο για τα δανεικά.';
  if (kind === 'reconciliation' && (!draft.actualBalance.trim() || !Number.isFinite(Number(draft.actualBalance)))) return 'Συμπλήρωσε έγκυρο πραγματικό υπόλοιπο.';
  return null;
}

export function loanDraftError(loan: Loan) {
  if (!loan.name.trim()) return 'Συμπλήρωσε όνομα.';
  if (!Number.isFinite(loan.total) || loan.total <= 0) return 'Το συνολικό ποσό πρέπει να είναι θετικό.';
  if (!Number.isFinite(loan.installment) || loan.installment <= 0) return 'Η δόση πρέπει να είναι θετική.';
  if (!Number.isInteger(loan.installments) || loan.installments <= 0) return 'Ο αριθμός δόσεων πρέπει να είναι θετικός ακέραιος.';
  const paid = loan.paidCount ?? 0;
  if (!Number.isInteger(paid) || paid < 0 || paid > loan.installments) return 'Οι ήδη πληρωμένες δόσεις πρέπει να είναι ακέραιες από 0 έως το σύνολο των δόσεων.';
  return null;
}

export function recurringDraftError(item: RecurringItem) {
  if (!item.name.trim()) return 'Συμπλήρωσε όνομα.';
  if (!Number.isFinite(item.amount) || item.amount <= 0) return 'Το ποσό πρέπει να είναι θετικό.';
  if (item.day !== undefined && item.day !== null && (!Number.isInteger(item.day) || item.day < 1 || item.day > 31)) return 'Η ημέρα πρέπει να είναι ακέραιος από 1 έως 31.';
  return null;
}
