import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveData } from '../src/lib/api.js';
import type { FinanceData } from '../src/types.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('normal finance save payload', () => {
  it('sends only mutable state and updatedAt', async () => {
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

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      revision: '3',
      filePath: 'Supabase/PostgreSQL',
      lastSavedAt: '2026-08-17T16:00:01.000Z',
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    globalThis.fetch = fetchMock as typeof fetch;

    await saveData(data, '2');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
    expect(input).toBe('/api/data');
    expect(init.method).toBe('PUT');
    expect(init.headers).toMatchObject({ 'content-type': 'application/json', 'if-match': '2' });

    const payload = JSON.parse(String(init.body));
    expect(payload).toEqual({ state: data.state, updatedAt: data.updatedAt });
    expect(payload).not.toHaveProperty('seed');
    expect(JSON.stringify(payload)).not.toContain('immutable-seed-row');
  });
});
