import { describe, expect, it } from 'vitest';
import { accountBalances } from '../src/lib/domain.js';
import { cashFlowForecast } from '../src/lib/forecast.js';
import { migrateProductData } from '../src/lib/productMigration.js';
import { createScheduledTransaction, scheduledLifecycle, scheduledToEvent, transitionScheduled } from '../src/lib/scheduled.js';
import type { FinanceData } from '../src/types.js';

function baseData(): FinanceData {
  return migrateProductData({
    app: 'RheomIQ', schemaVersion: 3, updatedAt: '2026-08-17T00:00:00.000Z',
    seed: {
      accounts: [
        { id: 'bank', name: 'Τράπεζα', kind: 'bank' },
        { id: 'savings', name: 'Ταμιευτήριο', kind: 'savings' },
      ],
      months: ['2026-08'], transactions: [], snapshots: [{ date: '2026-08-17', balances: { bank: 1000, savings: 500 } }],
      recurring: [], subscriptions: [], loans: [], lending: [], stats: {},
    },
    state: {
      customTransactions: [], overrides: {}, deleted: [], recurringCustom: [], recurringOverrides: {}, loanExtra: {}, loanOverrides: {}, customLoans: [], lendingCustom: [],
      settings: { excludedFromAvailable: [], accountNames: {}, expenseCategories: ['Άλλο'], incomeCategories: ['Μισθός'], customPresets: [], pinnedPresets: [], defaultExpenseAccount: 'bank', defaultIncomeAccount: 'bank', defaultLoanAccount: 'bank' },
      events: [], scheduled: [], reviewDecisions: {},
    },
  } as FinanceData);
}

describe('time-aware finance model', () => {
  it('keeps a pending scheduled expense outside actual balances until completion', () => {
    const data = baseData();
    const item = createScheduledTransaction(data, { kind: 'expense', dueDate: '2026-08-20', amount: 125.55, accountId: 'bank', category: 'Άλλο', note: 'Service' });
    data.state.scheduled = [item];
    expect(accountBalances(data, '2026-08-20').bank).toBe(1000);
    const event = scheduledToEvent(data, item, { date: '2026-08-21', amount: 120, accountId: 'bank' });
    data.state.events = [event];
    data.state.scheduled = [transitionScheduled(item, 'completed', event.id)];
    expect(accountBalances(data, '2026-08-21').bank).toBe(880);
    expect(data.state.scheduled[0].completedEventId).toBe(event.id);
  });

  it('derives upcoming and due lifecycle from date without mutating stored state', () => {
    const data = baseData();
    const item = createScheduledTransaction(data, { kind: 'income', dueDate: '2026-08-20', amount: 50, accountId: 'bank' });
    expect(item.status).toBe('pending');
    expect(scheduledLifecycle(item, '2026-08-19')).toBe('upcoming');
    expect(scheduledLifecycle(item, '2026-08-20')).toBe('due');
    expect(scheduledLifecycle(item, '2026-08-30')).toBe('due');
  });

  it('keeps scheduled transfers portfolio-neutral while projecting both account legs', () => {
    const data = baseData();
    data.state.scheduled = [createScheduledTransaction(data, { kind: 'transfer', dueDate: '2026-08-22', amount: 200, fromAccountId: 'bank', toAccountId: 'savings' })];
    const forecast = cashFlowForecast(data, '2026-08-17', 30);
    expect(forecast.currentPortfolio).toBe(1500);
    expect(forecast.projectedPortfolio).toBe(1500);
    expect(forecast.accounts.find((row) => row.accountId === 'bank')?.projected).toBe(800);
    expect(forecast.accounts.find((row) => row.accountId === 'savings')?.projected).toBe(700);
    expect(forecast.movements[0].portfolioDelta).toBe(0);
  });

  it('projects scheduled, recurring and external loan obligations deterministically', () => {
    const data = baseData();
    data.state.scheduled = [createScheduledTransaction(data, { kind: 'income', dueDate: '2026-08-25', amount: 300, accountId: 'bank', note: 'Known refund' })];
    data.state.recurringCustom = [{ id: 'rec', name: 'Internet', amount: 40, day: 20, accountId: 'bank', category: 'Άλλο', active: true, status: 'active' }];
    data.state.customLoans = [{ id: 'loan', name: 'Laptop', total: 600, installment: 100, installments: 6, paidCount: 2, day: '25', defaultAccountId: 'bank', kind: 'loan' }];
    const forecast = cashFlowForecast(data, '2026-08-17', 30);
    expect(forecast.sourceCounts.scheduled).toBe(1);
    expect(forecast.sourceCounts.recurring).toBe(1);
    expect(forecast.sourceCounts.loan).toBe(1);
    expect(forecast.projectedPortfolio).toBe(1660);
    expect(forecast.insufficientData).toBe(false);
  });

  it('excludes skipped and cancelled scheduled items from forecast', () => {
    const data = baseData();
    const skipped = transitionScheduled(createScheduledTransaction(data, { kind: 'expense', dueDate: '2026-08-18', amount: 900, accountId: 'bank' }), 'skipped');
    const cancelled = transitionScheduled(createScheduledTransaction(data, { kind: 'income', dueDate: '2026-08-19', amount: 900, accountId: 'bank' }), 'cancelled');
    data.state.scheduled = [skipped, cancelled];
    const forecast = cashFlowForecast(data, '2026-08-17', 30);
    expect(forecast.movements).toHaveLength(0);
    expect(forecast.projectedPortfolio).toBe(1500);
    expect(forecast.insufficientData).toBe(true);
  });

  it('surfaces stale-account scheduled flows as omissions instead of guessing', () => {
    const data = baseData();
    data.state.scheduled = [{ id: 'stale', dueDate: '2026-08-18', kind: 'expense', amount: 50, note: 'Old account', accountId: 'removed', status: 'pending', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' }];
    const forecast = cashFlowForecast(data, '2026-08-17', 30);
    expect(forecast.movements).toHaveLength(0);
    expect(forecast.omitted.join(' ')).toContain('Old account');
    expect(forecast.projectedPortfolio).toBe(1500);
  });

  it('preserves scheduled state through the additive product migration wrapper', () => {
    const data = baseData();
    const item = createScheduledTransaction(data, { kind: 'expense', dueDate: '2026-08-20', amount: 25, accountId: 'bank' });
    data.state.scheduled = [item];
    const migrated = migrateProductData(data);
    expect(migrated.state.scheduled).toEqual([item]);
  });
});
