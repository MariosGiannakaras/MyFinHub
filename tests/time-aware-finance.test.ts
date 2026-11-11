import { describe, expect, it } from 'vitest';
import { accountBalances } from '../src/lib/domain.js';
import { cashFlowForecast } from '../src/lib/forecast.js';
import { migrateProductData } from '../src/lib/productMigration.js';
import { createScheduledTransaction, pendingScheduled, scheduledHistory, scheduledLifecycle, scheduledToEvent, transitionScheduled } from '../src/lib/scheduled.js';
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

  it('edits a scheduled item in place, then posts one real event and restores by undo (#649 I12.04)',()=>{
    const initial=baseData();
    const original=createScheduledTransaction(initial,{id:'scheduled-regression',kind:'expense',dueDate:'2026-08-20',amount:125,accountId:'bank',category:'Άλλο',note:'Original'});
    const pending={...initial,state:{...initial.state,scheduled:[original]}};
    const edited=createScheduledTransaction(pending,{id:original.id,createdAt:original.createdAt,kind:'expense',dueDate:'2026-08-20',amount:90.25,accountId:'bank',category:'Άλλο',note:'Edited'});
    const draft={...pending,state:{...pending.state,scheduled:[edited]}};
    expect(edited).toMatchObject({id:original.id,createdAt:original.createdAt,amount:90.25,status:'pending',note:'Edited'});
    expect(pendingScheduled(draft)).toHaveLength(1);
    expect(accountBalances(draft,'2026-08-21').bank).toBe(1000);
    const event=scheduledToEvent(draft,edited,{date:'2026-08-21',amount:90.25,accountId:'bank'});
    const completed=transitionScheduled(edited,'completed',event.id);
    const saved={...draft,state:{...draft.state,scheduled:[completed],events:[event]}};
    expect(saved.state.events).toHaveLength(1);
    expect(saved.state.events?.[0]).toMatchObject({id:event.id,kind:'expense',amount:90.25,legs:[{accountId:'bank',amount:-90.25}]});
    expect(pendingScheduled(saved)).toEqual([]);
    expect(scheduledHistory(saved)).toContainEqual(expect.objectContaining({id:original.id,status:'completed',completedEventId:event.id}));
    expect(accountBalances(saved,'2026-08-21').bank).toBeCloseTo(909.75,2);
    expect(()=>scheduledToEvent(saved,completed,{date:'2026-08-21'})).toThrow(/ήδη κλείσει/);
    // A confirmed history undo restores the prior immutable state; this unit test
    // checks its accounting semantics, not the remote server's history receipt.
    expect(accountBalances(draft,'2026-08-21').bank).toBe(1000);
    expect(draft.state.scheduled?.[0]).toMatchObject({id:original.id,status:'pending'});
    expect(draft.state.events).toEqual([]);
    expect(pending.state.scheduled?.[0]).toMatchObject({amount:125,note:'Original',status:'pending'});
  });

  it('keeps skip/cancel and invalid completion drafts nonposting (#649 I12.04)',()=>{
    const data=baseData();
    const item=createScheduledTransaction(data,{id:'scheduled-negative',kind:'expense',dueDate:'2026-08-20',amount:80,accountId:'bank',note:'No actual charge'});
    for(const status of ['skipped','cancelled'] as const){
      const closed=transitionScheduled(item,status);
      const state={...data,state:{...data.state,scheduled:[closed]}};
      expect(scheduledLifecycle(closed,'2026-08-21')).toBe(status);
      expect(pendingScheduled(state)).toEqual([]);
      expect(scheduledHistory(state)).toHaveLength(1);
      expect(cashFlowForecast(state,'2026-08-17',30).movements).toEqual([]);
      expect(accountBalances(state,'2026-08-31').bank).toBe(1000);
      expect(state.state.events).toEqual([]);
      expect(()=>scheduledToEvent(state,closed,{date:'2026-08-21'})).toThrow(/ήδη κλείσει/);
    }
    expect(item.status).toBe('pending');
    expect(()=>createScheduledTransaction(data,{kind:'expense',dueDate:'2026-08-20',amount:0,accountId:'bank'})).toThrow();
    expect(()=>createScheduledTransaction(data,{kind:'expense',dueDate:'2026-08-20',amount:40,accountId:'missing'})).toThrow();
    expect(()=>createScheduledTransaction(data,{kind:'transfer',dueDate:'2026-08-20',amount:40,fromAccountId:'bank',toAccountId:'bank'})).toThrow();
    expect(()=>scheduledToEvent(data,item,{date:'2026-08-21',accountId:'missing'})).toThrow();
  });

  it('derives upcoming and due lifecycle from date without mutating stored state', () => {
    const data = baseData();
    const item = createScheduledTransaction(data, { kind: 'income', dueDate: '2026-08-20', amount: 50, accountId: 'bank' });
    expect(item.status).toBe('pending');
    expect(scheduledLifecycle(item, '2026-08-19')).toBe('upcoming');
    expect(scheduledLifecycle(item, '2026-08-20')).toBe('due');
    expect(scheduledLifecycle(item, '2026-08-30')).toBe('due');
  });

  it('keeps a flat 90-day forecast anchored to booked balances without inventing movement (#649 I12.02)',()=>{
    const data=baseData(),seed=JSON.stringify(data);
    const forecast=cashFlowForecast(data,'2026-08-17',90);
    expect(forecast.currentPortfolio).toBe(1500);
    expect(forecast.projectedPortfolio).toBe(1500);
    expect(forecast.insufficientData).toBe(true);
    expect(forecast.movements).toHaveLength(0);
    expect(forecast.points).toHaveLength(2);
    expect(forecast.points[0]).toMatchObject({date:'2026-08-17',portfolio:1500,balances:{bank:1000,savings:500}});
    expect(forecast.points.at(-1)).toMatchObject({date:forecast.endDate,portfolio:1500,balances:{bank:1000,savings:500}});
    expect(forecast.accounts.map(row=>[row.accountId,row.current,row.projected])).toEqual([['bank',1000,1000],['savings',500,500]]);
    expect(JSON.stringify(data)).toBe(seed);
  });

  it('separates pending 30/60/90 forecasts from booked cash, keeping one movement (#649 I12.02)',()=>{
    const data=baseData();
    data.state.scheduled=[createScheduledTransaction(data,{kind:'expense',dueDate:'2026-08-22',amount:75,accountId:'bank',note:'Known future bill'})];
    const eventCount=data.state.events?.length??0;
    for(const horizon of [30,60,90] as const){
      const forecast=cashFlowForecast(data,'2026-08-17',horizon);
      expect(forecast.currentPortfolio).toBe(1500);
      expect(forecast.projectedPortfolio).toBe(1425);
      expect(forecast.movements).toHaveLength(1);
      expect(forecast.movements[0]).toMatchObject({date:'2026-08-22',source:'scheduled',portfolioDelta:-75});
      expect(forecast.points.map(point=>point.portfolio)).toEqual([1500,1425,1425]);
      expect(forecast.accounts.find(row=>row.accountId==='bank')).toMatchObject({current:1000,projected:925});
      expect(forecast.accounts.find(row=>row.accountId==='savings')).toMatchObject({current:500,projected:500});
    }
    expect(accountBalances(data,'2026-08-17')).toMatchObject({bank:1000,savings:500});
    expect(accountBalances(data,'2026-08-31')).toMatchObject({bank:1000,savings:500});
    expect(data.state.scheduled[0].status).toBe('pending');
    expect(data.state.events?.length??0).toBe(eventCount);
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
