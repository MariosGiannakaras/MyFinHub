import { describe, expect, it } from 'vitest';
import { cashFlowForecast } from '../src/lib/forecast.js';
import { createEvent, monthlyFlow } from '../src/lib/domain.js';
import { recurringDue } from '../src/lib/attention.js';
import { activeRecurringItems, nextRecurringDate, recurringPayments } from '../src/lib/recurring.js';
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

  it('settles an early first monthly cycle once across Attention and forecast, preserving real partial bookings (#649 I11.03)',()=>{
    const item:CadencedRecurring={id:'first-paid-early',name:'New monthly plan',amount:25,day:28,firstExpectedDate:'2026-02-28',accountId:'bank',category:'Συνδρομές',active:true,status:'active',recurrenceUnit:'month',recurrenceInterval:1};
    const data=dataWith(item);
    const partial=(date:string,amount:number)=>({...createEvent({kind:'expense',date,amount,note:'New monthly plan',accountId:'bank'}),recurringId:item.id});
    data.state.events=[
      partial('2026-02-20',10),
      partial('2026-02-21',15),
      createEvent({kind:'expense',date:'2026-02-21',amount:25,note:'New monthly plan',accountId:'bank'}),
    ];
    expect(recurringPayments(data,item.id)).toHaveLength(2);
    expect(monthlyFlow(data,'2026-02').expense).toBe(50);
    expect(recurringDue(data,item,'2026-02-23')).toBeNull();
    expect(nextRecurringDate(data,item,'2026-02-23')).toBe('2026-03-21');
    const forecast=cashFlowForecast(data,'2026-02-23',60).movements.filter(row=>row.source==='recurring');
    expect(forecast.some(row=>row.date.startsWith('2026-02'))).toBe(false);
    expect(forecast[0]?.date).toBe('2026-03-21');
    expect(data.state.events).toHaveLength(3);
    // A payment in February must not silently pull a future first billing
    // date from April into February or March.
    expect(nextRecurringDate(data,{...item,firstExpectedDate:'2026-04-28'},'2026-02-23')).toBe('2026-04-28');
    for(const status of ['paused','stopped'] as const){
      data.seed.recurring=[{...item,active:false,status}];
      expect(activeRecurringItems(data)).toHaveLength(0);
      expect(cashFlowForecast(data,'2026-02-23',60).movements.filter(row=>row.source==='recurring')).toEqual([]);
    }
    data.seed.recurring=[item];
    expect(activeRecurringItems(data).map(row=>row.id)).toEqual([item.id]);
    expect(nextRecurringDate(data,item,'2026-02-23')).toBe('2026-03-21');
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
