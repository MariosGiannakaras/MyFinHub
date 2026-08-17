import { describe, expect, it } from 'vitest';
import { accessTokenAal } from '../server/auth.js';
import { ApiError, assertSameOrigin } from '../server/http.js';
import { validateFinanceData } from '../server/validation.js';
import { migrateData } from '../src/lib/domain.js';

function request(headers: Record<string,string>) { return { headers }; }
function tokenWithAal(aal?: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ ...(aal ? { aal } : {}) })).toString('base64url');
  return `${header}.${payload}.test`;
}

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

describe('MFA assurance gate', () => {
  it('recognizes an AAL2 session claim', () => {
    expect(accessTokenAal(tokenWithAal('aal2'))).toBe('aal2');
  });

  it('fails closed for missing or unexpected AAL claims', () => {
    expect(accessTokenAal(tokenWithAal())).toBe('aal1');
    expect(accessTokenAal(tokenWithAal('unexpected'))).toBe('aal1');
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
