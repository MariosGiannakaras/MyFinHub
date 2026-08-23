import { describe, expect, it } from 'vitest';
import { MAX_FINANCE_DOCUMENT_BYTES } from '../src/lib/limits.js';
import { parseMutableWrite, validateFinanceState } from '../server/stateValidation.js';
import { validateFinanceData } from '../server/validation.js';

function validState(): any {
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
      cardBanks: [],
      cards: [],
      events: [],
      reviewDecisions: {},
    },
  };
}

describe('finance document validation', () => {
  it('accepts a structurally valid finance state', () => {
    expect(() => validateFinanceData(validState())).not.toThrow();
  });

  it('accepts the mutable subtree through the canonical validator', () => {
    expect(() => validateFinanceState(validState().state)).not.toThrow();
  });

  it('accepts cards and extended loan metadata used by current workspaces', () => {
    const full = validState();
    full.state.cardBanks.push({ id: 'bank-1', name: 'BANK', order: 10, custom: true });
    full.state.cards.push({ id: 'card-1', bankId: 'bank-1', nickname: 'Visa', kind: 'credit', network: 'visa', last4: '4242', active: true, createdAt: full.updatedAt, updatedAt: full.updatedAt });
    full.state.customLoans.push({ id: 'loan-1', name: 'Loan', total: 1200, installment: 100, installments: 12, paidCount: 0, kind: 'loan', firstExpectedDate: '2026-09-01', defaultAccountId: 'bank', forgivenAmount: 0, longTermRecurring: true });
    expect(() => validateFinanceData(full)).not.toThrow();
  });

  it('accepts positive integer installment coverage on canonical finance events and mutable writes', () => {
    const full = validState();
    full.state.events.push({
      id: 'loan-payment-1',
      date: '2026-08-17',
      kind: 'expense',
      amount: 75,
      note: 'Loan installments',
      accountId: 'bank',
      legs: [{ accountId: 'bank', amount: -75 }],
      loanId: 'loan-1',
      installmentCount: 3,
      createdAt: full.updatedAt,
      updatedAt: full.updatedAt,
    });
    expect(() => validateFinanceData(full)).not.toThrow();
    expect(() => validateFinanceState(full.state)).not.toThrow();
  });

  it.each([0, -1, 1.5, 100_001, '2'])('rejects malformed installment coverage value %s', (installmentCount) => {
    const full = validState();
    full.state.events.push({
      id: 'loan-payment-invalid',
      date: '2026-08-17',
      kind: 'expense',
      amount: 25,
      note: 'Loan installment',
      accountId: 'bank',
      legs: [{ accountId: 'bank', amount: -25 }],
      loanId: 'loan-1',
      installmentCount,
      createdAt: full.updatedAt,
      updatedAt: full.updatedAt,
    });
    expect(() => validateFinanceData(full)).toThrowError(/installmentCount/i);
    expect(() => validateFinanceState(full.state)).toThrowError(/installmentCount/i);
  });

  it('accepts only the compact mutable write envelope', () => {
    const full = validState();
    expect(parseMutableWrite({ state: full.state, updatedAt: full.updatedAt })).toEqual({
      state: full.state,
      updatedAt: full.updatedAt,
    });
  });

  it('rejects full-document fields on the normal write path', () => {
    const full = validState();
    expect(() => parseMutableWrite({ state: full.state, updatedAt: full.updatedAt, seed: full.seed })).toThrowError(/invalid/i);
  });

  it('rejects malformed mutable state independently of seed data', () => {
    const state = validState().state;
    state.settings.savingsTargetRate = 2;
    expect(() => validateFinanceState(state)).toThrowError(/savingsTargetRate/i);
  });

  it('rejects malformed nested transaction fields', () => {
    const state = validState();
    state.seed.transactions.push({
      id: 'tx-1',
      date: '2026-08-17',
      type: 'expense',
      amount: '12.50',
      note: 'invalid numeric type',
    });
    expect(() => validateFinanceData(state)).toThrowError(/amount/i);
  });

  it('rejects malformed snapshot balances', () => {
    const state = validState();
    state.seed.snapshots.push({ date: '2026-08-17', balances: { bank: '100' } });
    expect(() => validateFinanceData(state)).toThrowError(/balances/i);
  });

  it('rejects unsupported settings values', () => {
    const state = validState();
    state.state.settings.motion = 'turbo';
    expect(() => validateFinanceData(state)).toThrowError(/motion/i);
  });

  it('rejects malformed card and loan extension values', () => {
    const badCard = validState();
    badCard.state.cards.push({ id: 'card-1', bankId: 'bank', nickname: 'Card', kind: 'credit', network: 'visa', last4: '42', active: true, createdAt: badCard.updatedAt, updatedAt: badCard.updatedAt });
    expect(() => validateFinanceData(badCard)).toThrowError(/last4/i);

    const badLoan = validState();
    badLoan.state.customLoans.push({ id: 'loan-1', name: 'Loan', total: 100, installment: 10, installments: 10, kind: 'unknown' });
    expect(() => validateFinanceData(badLoan)).toThrowError(/kind/i);
  });

  it.each(['pan','cardNumber','full_card_number','expiry','expirationDate','cvv','cvc','securityCode'])('rejects payment-card secret field %s from ordinary finance state', (secretField) => {
    const state = validState();
    state.state.cards.push({ id: 'card-1', bankId: 'bank', nickname: 'Card', kind: 'credit', network: 'visa', last4: '4242', active: true, createdAt: state.updatedAt, updatedAt: state.updatedAt, [secretField]: 'secret' });
    expect(() => validateFinanceData(state)).toThrowError(/secret field/i);
    expect(() => validateFinanceState(state.state)).toThrowError(/secret field/i);
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