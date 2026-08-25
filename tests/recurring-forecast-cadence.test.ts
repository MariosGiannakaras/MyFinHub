import { describe, expect, it } from 'vitest';
import { cashFlowForecast } from '../src/lib/forecast.js';
import type { FinanceData, RecurringItem } from '../src/types.js';

type CadencedRecurring = RecurringItem & { recurrenceUnit?: 'month' | 'year'; recurrenceInterval?: number };

function dataWith(item: CadencedRecurring): FinanceData {
  return {
    app: 'RheomIQ', schemaVersion: 3, updatedAt: '2026-08-25T00:00:00.000Z',
    seed: {
      accounts: [{ id: 'bank', name: 'Bank', kind: 'bank' }], months: [], transactions: [], snapshots: [{ date: '2026-08-25', balances: { bank: 1000 } }],
      recurring: [item], subscriptions: [], loans: [], lending: [], stats: {},
    },
    state: {
      customTransactions: [], overrides: {}, deleted: [], recurringCustom: [], recurringOverrides: {}, loanExtra: {}, loanOverrides: {}, customLoans: [], lendingCustom: [], events: [], scheduled: [],
      settings: { excludedFromAvailable: [], accountNames: {}, expenseCategories: ['Συνδρομές'], incomeCategories: ['Μισθός'], customPresets: [], pinnedPresets: [], defaultExpenseAccount: 'bank', defaultIncomeAccount: 'bank', defaultLoanAccount: 'bank' },
    },
  } as FinanceData;
}

describe('recurring cadence forecast', () => {
  it('does not repeat an annual renewal every month', () => {
    const item: CadencedRecurring = { id: 'annual', name: 'Annual plan', amount: 120, firstExpectedDate: '2023-09-03', day: 3, accountId: 'bank', category: 'Συνδρομές', active: true, status: 'active', recurrenceUnit: 'year', recurrenceInterval: 1 };
    const forecast = cashFlowForecast(dataWith(item), '2026-08-25', 90);
    const recurring = forecast.movements.filter((movement) => movement.source === 'recurring');
    expect(recurring).toHaveLength(1);
    expect(recurring[0]).toMatchObject({ date: '2026-09-03', label: 'Annual plan', portfolioDelta: -120 });
  });

  it('does not project a stopped workbook subscription', () => {
    const item: CadencedRecurring = { id: 'stopped', name: 'Stopped plan', amount: 40, firstExpectedDate: '2026-09-03', day: 3, accountId: 'bank', category: 'Συνδρομές', active: false, status: 'stopped', recurrenceUnit: 'month', recurrenceInterval: 1 };
    const forecast = cashFlowForecast(dataWith(item), '2026-08-25', 90);
    expect(forecast.movements.filter((movement) => movement.source === 'recurring')).toEqual([]);
  });
});
