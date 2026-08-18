import type { FinanceData } from '../src/types.js';
import { ApiError } from './http.js';
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

export function parseMutableWrite(value: unknown): { state: FinanceData['state']; updatedAt: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'INVALID_DATA', 'The finance data is invalid.');
  }
  const body = value as Record<string, unknown>;
  const allowed = new Set(['state', 'updatedAt']);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new ApiError(400, 'INVALID_DATA', 'The finance data is invalid.');
  }
  if (typeof body.updatedAt !== 'string' || !body.updatedAt || body.updatedAt.length > 64) {
    throw new ApiError(400, 'INVALID_DATA', 'The finance data is invalid.');
  }
  validateFinanceState(body.state);
  return { state: body.state, updatedAt: body.updatedAt };
}
