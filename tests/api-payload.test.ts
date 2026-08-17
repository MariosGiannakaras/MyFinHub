import { describe, expect, it } from 'vitest';
import { mutableSavePayload } from '../src/lib/persistencePayload.js';
import type { FinanceData } from '../src/types.js';

describe('normal finance save payload', () => {
  it('contains only mutable state and updatedAt', () => {
    const data = {
      app: 'RheomIQ',
      schemaVersion: 3,
      updatedAt: '2026-08-17T16:00:00.000Z',
      seed: {
        transactions: [{ id: 'immutable-seed-row' }],
        snapshots: [{ date: '2026-08-01' }],
      },
      state: {
        settings: { monthlyBudget: 1200 },
        events: [{ id: 'mutable-event' }],
      },
    } as unknown as FinanceData;

    const payload = mutableSavePayload(data);
    expect(payload).toEqual({ state: data.state, updatedAt: data.updatedAt });
    expect(payload).not.toHaveProperty('seed');
    expect(JSON.stringify(payload)).not.toContain('immutable-seed-row');
  });
});
