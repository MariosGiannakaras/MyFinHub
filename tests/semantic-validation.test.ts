import { describe, expect, it } from 'vitest';
import { validateFinanceData } from '../server/validation.js';

function validState(): any {
  return {
    app: 'RheomIQ', schemaVersion: 3, updatedAt: '2026-08-17T00:00:00.000Z',
    seed: { accounts: [], months: [], transactions: [], snapshots: [], recurring: [], subscriptions: [], loans: [], lending: [], stats: {} },
    state: {
      customTransactions: [], overrides: {}, deleted: [], recurringCustom: [], recurringOverrides: {}, loanExtra: {}, loanOverrides: {}, customLoans: [], lendingCustom: [],
      settings: { excludedFromAvailable: [], accountNames: {}, expenseCategories: [], incomeCategories: [], customPresets: [], pinnedPresets: [], defaultExpenseAccount: '', defaultIncomeAccount: '', defaultLoanAccount: '', monthlyBudget: 0, savingsTargetRate: 0, motion: 'system' },
      events: [], reviewDecisions: {},
    },
  };
}

const recurring = { id: 'rec', name: 'Rent', amount: 500, day: 1, accountId: '', category: '', active: true };
const loan = { id: 'loan', name: 'Loan', total: 100, installment: 25, installments: 4, paidCount: 1 };

describe('finance semantic range validation', () => {
  it('rejects non-positive recurring amounts and invalid days', () => {
    const amount = validState(); amount.state.recurringCustom = [{ ...recurring, amount: 0 }];
    expect(() => validateFinanceData(amount)).toThrowError(/amount/i);
    const day = validState(); day.state.recurringCustom = [{ ...recurring, day: 32 }];
    expect(() => validateFinanceData(day)).toThrowError(/day/i);
  });

  it('requires positive loan values, integer installment counts and bounded paid counts', () => {
    for (const invalidLoan of [
      { ...loan, total: 0 },
      { ...loan, installment: 0 },
      { ...loan, installments: 0 },
      { ...loan, installments: 2.5 },
      { ...loan, paidCount: -1 },
      { ...loan, paidCount: 5 },
      { ...loan, paidCount: 1.5 },
    ]) {
      const state = validState(); state.state.customLoans = [invalidLoan];
      expect(() => validateFinanceData(state)).toThrow();
    }
  });

  it('accepts the valid loan and recurring boundaries', () => {
    const state = validState(); state.state.customLoans = [loan]; state.state.recurringCustom = [recurring]; state.state.settings.savingsTargetRate = 1;
    expect(() => validateFinanceData(state)).not.toThrow();
  });

  it('rejects negative budgets and savings target ratios outside 0..1', () => {
    const budget = validState(); budget.state.settings.monthlyBudget = -0.01;
    expect(() => validateFinanceData(budget)).toThrowError(/monthlyBudget/i);
    const highTarget = validState(); highTarget.state.settings.savingsTargetRate = 1.01;
    expect(() => validateFinanceData(highTarget)).toThrowError(/savingsTargetRate/i);
    const lowTarget = validState(); lowTarget.state.settings.savingsTargetRate = -0.01;
    expect(() => validateFinanceData(lowTarget)).toThrowError(/savingsTargetRate/i);
  });
});
