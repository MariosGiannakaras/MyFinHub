import { describe, expect, it } from 'vitest';
import { ApiError, assertSameOrigin } from '../server/http.js';
import { validateFinanceData } from '../server/validation.js';
import { migrateData } from '../src/lib/domain.js';

function request(headers: Record<string,string>) { return { headers }; }

describe('HTTP trust boundary', () => {
  it('accepts same-origin state-changing requests', () => {
    expect(() => assertSameOrigin(request({
      origin: 'https://rheomiq.vercel.app',
      host: 'rheomiq.vercel.app',
      'x-forwarded-proto': 'https',
      'sec-fetch-site': 'same-origin',
    }))).not.toThrow();
  });

  it('rejects cross-site requests', () => {
    expect(() => assertSameOrigin(request({
      origin: 'https://evil.example',
      host: 'rheomiq.vercel.app',
      'x-forwarded-proto': 'https',
      'sec-fetch-site': 'cross-site',
    }))).toThrowError(ApiError);
  });
});

describe('finance state validation', () => {
  const minimal = migrateData({
    app: 'RheomIQ', schemaVersion: 3, updatedAt: new Date().toISOString(),
    seed: { accounts: [], months: [], transactions: [], snapshots: [], recurring: [], subscriptions: [], loans: [], lending: [], stats: {} },
    state: {
      customTransactions: [], overrides: {}, deleted: [], recurringCustom: [], recurringOverrides: {}, loanExtra: {}, loanOverrides: {}, customLoans: [], lendingCustom: [],
      settings: { excludedFromAvailable: [], accountNames: {}, expenseCategories: [], incomeCategories: [], customPresets: [], pinnedPresets: [], defaultExpenseAccount: '', defaultIncomeAccount: '', defaultLoanAccount: '' },
      events: [], reviewDecisions: {},
    },
  } as any);

  it('accepts a migrated RheomIQ document', () => {
    expect(() => validateFinanceData(minimal)).not.toThrow();
  });

  it('rejects invalid schema versions', () => {
    expect(() => validateFinanceData({ ...minimal, schemaVersion: 0 })).toThrowError(ApiError);
  });

  it('rejects unbounded event collections', () => {
    const oversized = { ...minimal, state: { ...minimal.state, events: new Array(100_001).fill({}) } };
    expect(() => validateFinanceData(oversized)).toThrowError(ApiError);
  });
});
