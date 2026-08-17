import { describe, expect, it } from 'vitest';
import { accountBalances, availableMoney, categoryTotals, dailyExpenseSeries, monthlyFlow, netWorth } from '../src/lib/domain.js';
import { selectAccountBalances, selectAvailableMoney, selectCategoryTotals, selectDailyExpenseSeries, selectMonthlyFlow, selectNetWorth } from '../src/lib/selectors.js';
import type { FinanceData } from '../src/types.js';

function fixture(): FinanceData {
  return {
    app: 'RheomIQ',
    schemaVersion: 3,
    updatedAt: '2026-08-17T00:00:00.000Z',
    seed: {
      accounts: [{ id: 'cash', name: 'Cash', kind: 'cash' }],
      months: ['2026-08'],
      transactions: [
        { id: 'tx-1', date: '2026-08-01', type: 'income', amount: 1000, note: 'Salary', accountId: 'cash', category: 'Income' },
        { id: 'tx-2', date: '2026-08-02', type: 'expense', amount: 120, note: 'Groceries', accountId: 'cash', category: 'Food' },
      ],
      snapshots: [{ date: '2026-07-31', balances: { cash: 500 } }],
      recurring: [],
      subscriptions: [],
      loans: [],
      lending: [],
    },
    state: {
      customTransactions: [],
      overrides: {},
      deleted: [],
      recurringCustom: [],
      recurringOverrides: {},
      loanExtra: {},
      loanOverrides: {},
      customLoans: [],
      lendingCustom: [],
      events: [],
      reviewDecisions: {},
      settings: {
        excludedFromAvailable: [],
        accountNames: {},
        expenseCategories: [],
        incomeCategories: [],
        customPresets: [],
        pinnedPresets: [],
        defaultExpenseAccount: 'cash',
        defaultIncomeAccount: 'cash',
        defaultLoanAccount: 'cash',
        monthlyBudget: 1200,
        savingsTargetRate: 0.2,
        motion: 'system',
      },
    },
  } as FinanceData;
}

describe('memoized finance selectors', () => {
  it('preserves domain results', () => {
    const data = fixture();
    expect(selectAccountBalances(data, '2026-08-17')).toEqual(accountBalances(data, '2026-08-17'));
    expect(selectAvailableMoney(data, '2026-08-17')).toBe(availableMoney(data, '2026-08-17'));
    expect(selectNetWorth(data, '2026-08-17')).toBe(netWorth(data, '2026-08-17'));
    expect(selectMonthlyFlow(data, '2026-08')).toEqual(monthlyFlow(data, '2026-08'));
    expect(selectCategoryTotals(data, '2026-08')).toEqual(categoryTotals(data, '2026-08'));
    expect(selectDailyExpenseSeries(data, '2026-08')).toEqual(dailyExpenseSeries(data, '2026-08'));
  });

  it('reuses cached object results for unchanged data and reporting keys', () => {
    const data = fixture();
    expect(selectAccountBalances(data, '2026-08-17')).toBe(selectAccountBalances(data, '2026-08-17'));
    expect(selectMonthlyFlow(data, '2026-08')).toBe(selectMonthlyFlow(data, '2026-08'));
    expect(selectCategoryTotals(data, '2026-08')).toBe(selectCategoryTotals(data, '2026-08'));
    expect(selectDailyExpenseSeries(data, '2026-08')).toBe(selectDailyExpenseSeries(data, '2026-08'));
  });
});
