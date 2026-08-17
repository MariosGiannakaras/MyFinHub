import { describe, expect, it } from 'vitest';
import { MAX_FINANCE_DOCUMENT_BYTES } from '../src/lib/limits.js';
import { validateFinanceData } from '../server/validation.js';

function validState() {
  return {
    app: 'RheomIQ',
    schemaVersion: 3,
    updatedAt: '2026-08-17T00:00:00.000Z',
    seed: {
      accounts: [],
      months: [],
      transactions: [],
      snapshots: [],
      recurring: [],
      subscriptions: [],
      loans: [],
      lending: [],
      stats: {},
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
      settings: {
        excludedFromAvailable: [],
        accountNames: {},
        expenseCategories: [],
        incomeCategories: [],
        customPresets: [],
        pinnedPresets: [],
        defaultExpenseAccount: '',
        defaultIncomeAccount: '',
        defaultLoanAccount: '',
        monthlyBudget: 0,
        savingsTargetRate: 0,
        motion: 'system',
      },
      events: [],
      reviewDecisions: {},
    },
  };
}

describe('finance document validation', () => {
  it('accepts a structurally valid finance state', () => {
    expect(() => validateFinanceData(validState())).not.toThrow();
  });

  it('rejects malformed nested transaction fields', () => {
    const state = validState();
    state.seed.transactions.push({
      id: 'tx-1',
      date: '2026-08-17',
      type: 'expense',
      amount: '12.50',
      note: 'invalid numeric type',
    } as never);
    expect(() => validateFinanceData(state)).toThrowError(/amount/i);
  });

  it('rejects malformed snapshot balances', () => {
    const state = validState();
    state.seed.snapshots.push({ date: '2026-08-17', balances: { bank: '100' } } as never);
    expect(() => validateFinanceData(state)).toThrowError(/balances/i);
  });

  it('rejects unsupported settings values', () => {
    const state = validState();
    state.state.settings.motion = 'turbo' as never;
    expect(() => validateFinanceData(state)).toThrowError(/motion/i);
  });

  it('rejects duplicate persistent ids', () => {
    const state = validState();
    state.seed.accounts.push(
      { id: 'bank', name: 'Bank', kind: 'bank' },
      { id: 'bank', name: 'Duplicate', kind: 'bank' },
    );
    expect(() => validateFinanceData(state)).toThrowError(/Duplicate id/i);
  });

  it('rejects finance documents beyond the production-safe size budget', () => {
    const state = { ...validState(), source: { padding: 'x'.repeat(MAX_FINANCE_DOCUMENT_BYTES) } };
    try {
      validateFinanceData(state);
      throw new Error('expected validation to fail');
    } catch (error: any) {
      expect(error).toMatchObject({ status: 413, code: 'PAYLOAD_TOO_LARGE' });
    }
  });
});
