import { describe, expect, it } from 'vitest';
import { accountBalances } from '../src/lib/domain.js';
import { lendingRows } from '../src/lib/lending.js';
import type { FinanceData, FinanceEvent } from '../src/types.js';

function derivedData(): FinanceData {
  return {
    seed: {
      accounts: [{ id: 'cash', name: 'Μετρητά', kind: 'cash' }],
      transactions: [],
      snapshots: [
        { date: '2026-08-15', balances: { cash: 150 } },
        { date: '2026-08-10', balances: { cash: 100 } },
        { date: '2026-08-17', balances: { cash: 170 } },
      ],
      lending: [],
    },
    state: {
      deleted: [],
      overrides: {},
      customTransactions: [],
      events: [],
    },
  } as unknown as FinanceData;
}

describe('derived finance view robustness', () => {
  it('chooses the latest eligible snapshot regardless of input ordering', () => {
    const data = derivedData();
    expect(accountBalances(data, '2026-08-16').cash).toBe(150);
    expect(accountBalances(data, '2026-08-17').cash).toBe(170);
  });

  it('aggregates repeated legacy lending rows before adding linked events', () => {
    const data = derivedData();
    data.seed.lending = [
      { person: 'Alex', outstanding: 20, entries: [{ date: '2026-08-01', lent: 20, repaid: 0 }] },
      { person: 'Alex', outstanding: 30, entries: [
        { date: '2026-08-02', lent: 40, repaid: 0 },
        { date: '2026-08-03', lent: 0, repaid: 10 },
      ] },
    ];
    data.state.events = [{ person: 'Alex', receivableDelta: 5 } as FinanceEvent];

    expect(lendingRows(data)).toEqual([{ person: 'Alex', outstanding: 55, events: 4 }]);
  });
});
