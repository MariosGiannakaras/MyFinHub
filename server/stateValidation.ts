import type { FinanceData } from '../src/types.js';
import { validateFinanceData } from './validation.js';

const EMPTY_SEED: FinanceData['seed'] = {
  accounts: [],
  months: [],
  transactions: [],
  snapshots: [],
  recurring: [],
  subscriptions: [],
  loans: [],
  lending: [],
  stats: {},
};

/**
 * Reuse the canonical full-document validator for the mutable subtree without
 * duplicating finance validation rules. The synthetic seed is deliberately
 * empty and valid; every state-specific invariant is therefore checked by the
 * same code path used for full imports and stored-state reads.
 */
export function validateFinanceState(value: unknown): asserts value is FinanceData['state'] {
  validateFinanceData({
    app: 'RheomIQ',
    schemaVersion: 3,
    updatedAt: '1970-01-01T00:00:00.000Z',
    seed: EMPTY_SEED,
    state: value,
  });
}
