import { describe, expect, it } from 'vitest';
import { accountBalances, effectiveLegacyTransactions, monthlyFlow } from '../src/lib/domain.js';
import { effectiveLegacyTransaction, restoreLegacyOriginal, withLegacyOverride, withLegacyTombstone } from '../src/lib/legacyTransactions.js';
import type { FinanceData, LegacyTransaction } from '../src/types.js';

function fixture(): FinanceData {
  const original: LegacyTransaction = {
    id: 'legacy-1',
    date: '2026-08-10',
    type: 'expense',
    accountId: 'bank-a',
    amount: 40,
    note: 'Αρχική αγορά',
    category: 'Τρόφιμα',
    source: 'xlsx',
    sheet: 'August',
    cell: 'B12',
    formula: '=SUM(A1:A2)',
  };
  return {
    app: 'RheomIQ', schemaVersion: 3, updatedAt: '2026-08-10T10:00:00.000Z',
    seed: {
      accounts: [
        { id: 'bank-a', name: 'A', kind: 'bank' },
        { id: 'bank-b', name: 'B', kind: 'bank' },
      ],
      months: ['2026-08'],
      transactions: [original],
      snapshots: [{ date: '2026-08-01', balances: { 'bank-a': 1000, 'bank-b': 200 } }],
      recurring: [], subscriptions: [], loans: [], lending: [], stats: {},
    },
    state: {
      customTransactions: [], overrides: {}, deleted: [], recurringCustom: [], recurringOverrides: {}, loanExtra: {}, loanOverrides: {}, customLoans: [], lendingCustom: [],
      settings: { excludedFromAvailable: [], accountNames: {}, expenseCategories: ['Τρόφιμα', 'Μετακινήσεις'], incomeCategories: ['Μισθός'], customPresets: [], pinnedPresets: [], defaultExpenseAccount: 'bank-a', defaultIncomeAccount: 'bank-a', defaultLoanAccount: 'bank-a' },
      events: [], reviewDecisions: {},
    },
  };
}

describe('legacy transaction overrides and tombstones', () => {
  it('edits through an override without mutating immutable seed and applies balances/reports exactly once', () => {
    const data = fixture();
    const originalSeed = structuredClone(data.seed.transactions[0]);
    const next = withLegacyOverride(data, { ...data.seed.transactions[0], date: '2026-08-11', amount: 65, note: 'Διορθωμένη αγορά', category: 'Μετακινήσεις' });

    expect(next.seed.transactions[0]).toEqual(originalSeed);
    expect(next.state.overrides['legacy-1']).toMatchObject({ id: 'legacy-1', date: '2026-08-11', amount: 65, category: 'Μετακινήσεις' });
    expect(next.state.overrides['legacy-1']).toMatchObject({ source: 'xlsx', sheet: 'August', cell: 'B12', formula: '=SUM(A1:A2)' });
    expect(effectiveLegacyTransactions(next)).toHaveLength(1);
    expect(monthlyFlow(next, '2026-08').expense).toBe(65);
    expect(accountBalances(next, '2026-08-31')['bank-a']).toBe(975);
  });

  it('makes a later manual edit authoritative by clearing the prior confirmed review decision only for that row', () => {
    const data = fixture();
    data.state.reviewDecisions = {
      'legacy-1': { status: 'confirmed', semanticKind: 'saving_cash_offset', decidedAt: '2026-08-11T10:00:00.000Z' },
      other: { status: 'confirmed', semanticKind: 'refund', decidedAt: '2026-08-11T11:00:00.000Z' },
    };

    const next = withLegacyOverride(data, { ...data.seed.transactions[0], amount: 55, note: 'Manual correction' });

    expect(next.state.reviewDecisions?.['legacy-1']).toBeUndefined();
    expect(next.state.reviewDecisions?.other).toEqual(data.state.reviewDecisions.other);
    expect(monthlyFlow(next, '2026-08')).toMatchObject({ expense: 55, saving: 0, refunds: 0 });
  });

  it('clears prior confirmed split semantics when the row is manually edited', () => {
    const data = fixture();
    data.state.reviewDecisions = {
      'legacy-1': {
        status: 'confirmed',
        semanticKind: 'split',
        decidedAt: '2026-08-11T10:00:00.000Z',
        parts: [
          { id: 'part-1', label: 'Αγορά', category: 'Τρόφιμα', amount: 30, kind: 'expense' },
          { id: 'part-2', label: 'Επιστροφή', category: 'Τρόφιμα', amount: 10, kind: 'refund' },
        ],
      },
    };

    const next = withLegacyOverride(data, { ...data.seed.transactions[0], amount: 50, category: 'Μετακινήσεις' });

    expect(next.state.reviewDecisions?.['legacy-1']).toBeUndefined();
    expect(monthlyFlow(next, '2026-08')).toMatchObject({ expense: 50, refunds: 0 });
  });

  it('tombstones an overridden row without destroying its override or double-adjusting the seed baseline', () => {
    const edited = withLegacyOverride(fixture(), { ...fixture().seed.transactions[0], amount: 75 });
    const deleted = withLegacyTombstone(edited, 'legacy-1');

    expect(deleted.seed.transactions).toHaveLength(1);
    expect(deleted.state.overrides['legacy-1']?.amount).toBe(75);
    expect(effectiveLegacyTransaction(deleted, 'legacy-1')).toBeNull();
    expect(effectiveLegacyTransactions(deleted)).toEqual([]);
    expect(monthlyFlow(deleted, '2026-08').expense).toBe(0);
    expect(accountBalances(deleted, '2026-08-31')['bank-a']).toBe(1040);

    const restoredByUndoState = edited;
    expect(effectiveLegacyTransaction(restoredByUndoState, 'legacy-1')?.amount).toBe(75);
    expect(accountBalances(restoredByUndoState, '2026-08-31')['bank-a']).toBe(965);
  });

  it('restores original by clearing both override and tombstone', () => {
    const edited = withLegacyOverride(fixture(), { ...fixture().seed.transactions[0], amount: 75 });
    const deleted = withLegacyTombstone(edited, 'legacy-1');
    const restored = restoreLegacyOriginal(deleted, 'legacy-1');

    expect(restored.state.overrides['legacy-1']).toBeUndefined();
    expect(restored.state.deleted).toEqual([]);
    expect(effectiveLegacyTransaction(restored, 'legacy-1')).toEqual(restored.seed.transactions[0]);
    expect(monthlyFlow(restored, '2026-08').expense).toBe(40);
    expect(accountBalances(restored, '2026-08-31')['bank-a']).toBe(1000);
  });

  it('accepts legacy boolean-record tombstones and preserves unrelated deleted ids', () => {
    const data = fixture();
    data.state.deleted = { other: true, ignored: false };
    const next = withLegacyTombstone(data, 'legacy-1');
    expect(new Set(next.state.deleted as string[])).toEqual(new Set(['other', 'legacy-1']));
  });

  it('validates transfer routing and signed adjustments without converting them to FinanceEvents', () => {
    const data = fixture();
    const transfer = withLegacyOverride(data, { ...data.seed.transactions[0], type: 'transfer', accountId: undefined, fromAccountId: 'bank-a', toAccountId: 'bank-b', amount: 120 });
    expect(transfer.state.overrides['legacy-1']).toMatchObject({ type: 'transfer', fromAccountId: 'bank-a', toAccountId: 'bank-b', amount: 120 });
    expect(transfer.state.overrides['legacy-1'].accountId).toBeUndefined();
    expect(accountBalances(transfer, '2026-08-31')).toMatchObject({ 'bank-a': 920, 'bank-b': 320 });
    expect(monthlyFlow(transfer, '2026-08').expense).toBe(0);

    const adjustment = withLegacyOverride(data, { ...data.seed.transactions[0], type: 'adjustment', accountId: 'bank-a', amount: -25 });
    expect(adjustment.state.overrides['legacy-1'].amount).toBe(-25);
    expect(accountBalances(adjustment, '2026-08-31')['bank-a']).toBe(1015);
  });

  it('fails closed for unknown seed ids, invalid routes and non-positive normal amounts', () => {
    const data = fixture();
    expect(() => withLegacyOverride(data, { ...data.seed.transactions[0], id: 'missing' })).toThrow(/δεν υπάρχει/);
    expect(() => withLegacyOverride(data, { ...data.seed.transactions[0], amount: 0 })).toThrow(/μεγαλύτερο από μηδέν/);
    expect(() => withLegacyOverride(data, { ...data.seed.transactions[0], type: 'transfer', accountId: undefined, fromAccountId: 'bank-a', toAccountId: 'bank-a' })).toThrow(/δύο διαφορετικούς/);
  });
});
