import { describe, expect, it } from 'vitest';
import { cashFlowForecast } from '../src/lib/forecast.js';
import { createEvent } from '../src/lib/domain.js';
import { nextRecurringDate } from '../src/lib/recurring.js';
import type { FinanceData, RecurringItem } from '../src/types.js';

type CadencedRecurring = RecurringItem & { recurrenceUnit?: 'month' | 'year'; recurrenceInterval?: number };

function dataWith(item: CadencedRecurring): FinanceData {
  return {
    app: 'RheomIQ', schemaVersion: 3, updatedAt: '2026-08-25T00:00:00.000Z',
    seed: {
      accounts: [{ id: 'bank', name: 'Bank', kind: 'bank' }], months: [], transactions: [], snapshots: [{ date: '2026-08-25', balances: { bank: 1000 } }],
      recurring: [item], subscriptions: [], loans: [], lending: [], stats: {},
    },
    state: {
      customTransactions: [], overrides: {}, deleted: [], recurringCustom: [], recurringOverrides: {}, loanExtra: {}, loanOverrides: {}, customLoans: [], lendingCustom: [], events: [], scheduled: [],
      settings: { excludedFromAvailable: [], accountNames: {}, expenseCategories: ['Συνδρομές'], incomeCategories: ['Μισθός'], customPresets: [], pinnedPresets: [], defaultExpenseAccount: 'bank', defaultIncomeAccount: 'bank', defaultLoanAccount: 'bank' },
    },
  } as FinanceData;
}

describe('recurring cadence forecast', () => {
  it('does not repeat an annual renewal every month', () => {
    const item: CadencedRecurring = { id: 'annual', name: 'Annual plan', amount: 120, firstExpectedDate: '2023-09-03', day: 3, accountId: 'bank', category: 'Συνδρομές', active: true, status: 'active', recurrenceUnit: 'year', recurrenceInterval: 1 };
    const forecast = cashFlowForecast(dataWith(item), '2026-08-25', 90);
    const recurring = forecast.movements.filter((movement) => movement.source === 'recurring');
    expect(recurring).toHaveLength(1);
    expect(recurring[0]).toMatchObject({ date: '2026-09-03', label: 'Annual plan', portfolioDelta: -120 });
  });

  it('does not forecast a duplicate monthly service charge after an early linked payment',()=>{
    const item:CadencedRecurring={id:'monthly-early',name:'Monthly plan',amount:25,day:28,firstExpectedDate:'2026-06-28',accountId:'bank',category:'Συνδρομές',active:true,recurrenceUnit:'month',recurrenceInterval:1};
    const data=dataWith(item);
    const payments=['2026-06-28','2026-07-28','2026-08-10'].map(date=>({
      ...createEvent({kind:'expense',date,amount:25,note:'Service',accountId:'bank'}),recurringId:item.id,
    }));
    data.state.events=payments;
    expect(nextRecurringDate(data,item,'2026-08-11')).toBe('2026-09-22');
    const charges=cashFlowForecast(data,'2026-08-11',60).movements.filter(m=>m.source==='recurring');
    expect(charges[0]?.date).toBe('2026-09-22');
    expect(charges.some(m=>m.date.startsWith('2026-08'))).toBe(false);
  });

  it('does not forecast a second loan installment in a month already paid early',()=>{
    const service:CadencedRecurring={id:'inactive',name:'Inactive',amount:10,day:28,accountId:'bank',category:'Συνδρομές',active:false};
    const data=dataWith(service);data.seed.recurring=[];
    data.state.customLoans=[{id:'loan-early',name:'Loan',total:1200,installment:100,installments:12,day:'28',firstExpectedDate:'2026-06-28',defaultAccountId:'bank',kind:'loan'}];
    data.state.events=['2026-06-28','2026-07-28','2026-08-10'].map(date=>({
      ...createEvent({kind:'expense',date,amount:100,note:'Loan payment',accountId:'bank'}),loanId:'loan-early',
    }));
    const movements=cashFlowForecast(data,'2026-08-11',60).movements.filter(m=>m.source==='loan');
    expect(movements[0]?.date).toBe('2026-09-22');
    expect(movements.some(m=>m.date.startsWith('2026-08'))).toBe(false);
  });

  it('does not project a stopped workbook subscription', () => {
    const item: CadencedRecurring = { id: 'stopped', name: 'Stopped plan', amount: 40, firstExpectedDate: '2026-09-03', day: 3, accountId: 'bank', category: 'Συνδρομές', active: false, status: 'stopped', recurrenceUnit: 'month', recurrenceInterval: 1 };
    const forecast = cashFlowForecast(dataWith(item), '2026-08-25', 90);
    expect(forecast.movements.filter((movement) => movement.source === 'recurring')).toEqual([]);
  });
});
