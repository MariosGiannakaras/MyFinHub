import { describe, expect, it } from 'vitest';
import { entryDefaults, entryDraftError, loanDraftError, recurringDraftError } from '../src/lib/inputSemantics.js';
import type { FinanceSettings, Loan, RecurringItem } from '../src/types.js';

const settings: FinanceSettings = {
  excludedFromAvailable: [],
  accountNames: {},
  expenseCategories: ['Έξοδα'],
  incomeCategories: ['Μισθός'],
  customPresets: [],
  pinnedPresets: [],
  defaultExpenseAccount: 'expense-account',
  defaultIncomeAccount: 'income-account',
  defaultLoanAccount: 'expense-account',
};

const part = { id: 'p1', label: 'part', category: 'Έξοδα', amount: 10 };

describe('finance input semantics', () => {
  it('uses income-specific account and category defaults', () => {
    expect(entryDefaults('income', settings, 'fallback')).toEqual({ accountId: 'income-account', category: 'Μισθός' });
    expect(entryDefaults('expense', settings, 'fallback')).toEqual({ accountId: 'expense-account', category: 'Έξοδα' });
  });

  it('requires attribution, an explicit reconciliation balance and positive split parts', () => {
    expect(entryDraftError('lending', { amount: '10', person: ' ', actualBalance: '', parts: [part] })).toMatch(/πρόσωπο/i);
    expect(entryDraftError('reconciliation', { amount: '', person: '', actualBalance: '', parts: [part] })).toMatch(/υπόλοιπο/i);
    expect(entryDraftError('split', { amount: '10', person: '', actualBalance: '', parts: [{ ...part, amount: 0 }] })).toMatch(/επιμέρους/i);
    expect(entryDraftError('split', { amount: '10', person: '', actualBalance: '', parts: [part] })).toBeNull();
  });

  it('rejects invalid loan installment counts and paid baselines', () => {
    const valid: Loan = { id: 'loan', name: 'Loan', total: 100, installment: 25, installments: 4, paidCount: 1 };
    expect(loanDraftError(valid)).toBeNull();
    expect(loanDraftError({ ...valid, installments: 0 })).toMatch(/δόσεων/i);
    expect(loanDraftError({ ...valid, installments: 2.5 })).toMatch(/δόσεων/i);
    expect(loanDraftError({ ...valid, paidCount: 5 })).toMatch(/πληρωμένες/i);
  });

  it('rejects non-positive recurring amounts and invalid calendar days', () => {
    const valid: RecurringItem = { id: 'rec', name: 'Rent', amount: 500, day: 1, accountId: 'expense-account', category: 'Έξοδα', active: true };
    expect(recurringDraftError(valid)).toBeNull();
    expect(recurringDraftError({ ...valid, amount: 0 })).toMatch(/ποσό/i);
    expect(recurringDraftError({ ...valid, day: 32 })).toMatch(/ημέρα/i);
    expect(recurringDraftError({ ...valid, day: 1.5 })).toMatch(/ημέρα/i);
  });
});
