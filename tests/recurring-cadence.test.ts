import { describe, expect, it } from 'vitest';
import { nextRecurringDate, recurringMonthlyTotal } from '../src/lib/recurring.js';
import { addRecurringInterval, recurringCadenceLabel } from '../src/lib/recurringCadence.js';
import type { FinanceData, RecurringItem } from '../src/types.js';

type CadencedRecurring = RecurringItem & { recurrenceUnit?: 'month' | 'year'; recurrenceInterval?: number };

function dataWith(items: CadencedRecurring[]): FinanceData {
  return {
    app: 'RheomIQ', schemaVersion: 3, updatedAt: '2026-08-25T00:00:00.000Z',
    seed: { accounts: [{ id: 'bank', name: 'Bank', kind: 'bank' }], months: [], transactions: [], snapshots: [], recurring: items, subscriptions: [], loans: [], lending: [], stats: {} },
    state: {
      customTransactions: [], overrides: {}, deleted: [], recurringCustom: [], recurringOverrides: {}, loanExtra: {}, loanOverrides: {}, customLoans: [], lendingCustom: [], events: [],
      settings: { excludedFromAvailable: [], accountNames: {}, expenseCategories: ['Συνδρομές'], incomeCategories: ['Μισθός'], customPresets: [], pinnedPresets: [], defaultExpenseAccount: 'bank', defaultIncomeAccount: 'bank', defaultLoanAccount: 'bank' },
    },
  } as FinanceData;
}

const recurring = (partial: Partial<CadencedRecurring>): CadencedRecurring => ({
  id: 'rec', name: 'Subscription', amount: 12, day: null, firstExpectedDate: '2024-02-03', accountId: 'bank', category: 'Συνδρομές', active: true, status: 'active', ...partial,
});

describe('recurring cadence', () => {
  it('keeps legacy recurring items monthly by default', () => {
    const item = recurring({ firstExpectedDate: '2026-08-05' });
    expect(recurringCadenceLabel(item)).toBe('Κάθε μήνα');
    expect(nextRecurringDate(dataWith([item]), item, '2026-08-25')).toBe('2026-09-05');
  });

  it('advances a six-month workbook subscription from its real anchor', () => {
    const item = recurring({ amount: 7.99, recurrenceUnit: 'month', recurrenceInterval: 6 });
    expect(recurringCadenceLabel(item)).toBe('Κάθε 6 μήνες');
    expect(nextRecurringDate(dataWith([item]), item, '2026-08-25')).toBe('2027-02-03');
  });

  it('advances annual and two-year renewals without monthly coercion', () => {
    const annual = recurring({ id: 'annual', amount: 17, firstExpectedDate: '2023-12-15', recurrenceUnit: 'year', recurrenceInterval: 1 });
    const biennial = recurring({ id: 'biennial', amount: 33.66, firstExpectedDate: '2025-06-12', recurrenceUnit: 'year', recurrenceInterval: 2 });
    const data = dataWith([annual, biennial]);
    expect(nextRecurringDate(data, annual, '2026-08-25')).toBe('2026-12-15');
    expect(nextRecurringDate(data, biennial, '2026-08-25')).toBe('2027-06-12');
    expect(addRecurringInterval('2024-02-29', annual)).toBe('2025-02-28');
  });

  it('uses monthly-equivalent totals for mixed recurrence intervals', () => {
    const monthly = recurring({ id: 'm', amount: 12, firstExpectedDate: '2026-08-05' });
    const annual = recurring({ id: 'y', amount: 120, recurrenceUnit: 'year', recurrenceInterval: 1 });
    const stopped = recurring({ id: 's', amount: 999, active: false, status: 'stopped' });
    expect(recurringMonthlyTotal(dataWith([monthly, annual, stopped]))).toBe(22);
  });
});
