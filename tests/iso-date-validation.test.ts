import { describe, expect, it } from 'vitest';
import { ApiError } from '../server/http.js';
import { validateFinanceData } from '../server/validation.js';
import { migrateData } from '../src/lib/domain.js';
import { isIsoCalendarDate } from '../src/lib/isoDate.js';
import { createScheduledTransaction } from '../src/lib/scheduled.js';
import type { FinanceData } from '../src/types.js';

function minimal():FinanceData{
  return migrateData({
    app:'RheomIQ',schemaVersion:3,updatedAt:'2026-10-01T12:00:00.000Z',
    seed:{accounts:[{id:'bank',name:'Bank',kind:'bank'}],months:[],transactions:[],snapshots:[],recurring:[],subscriptions:[],loans:[],lending:[],stats:{}},
    state:{
      customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],events:[],
      settings:{excludedFromAvailable:[],accountNames:{bank:'Bank'},expenseCategories:[],incomeCategories:[],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'bank',defaultIncomeAccount:'bank',defaultLoanAccount:'bank'},
      reviewDecisions:{},
    },
  } as any);
}

describe('strict finance calendar dates',()=>{
  it('accepts real leap/calendar dates and rejects normalized impossible dates',()=>{
    expect(isIsoCalendarDate('2024-02-29')).toBe(true);
    expect(isIsoCalendarDate('2026-02-28')).toBe(true);
    expect(isIsoCalendarDate('2026-02-29')).toBe(false);
    expect(isIsoCalendarDate('2026-02-31')).toBe(false);
    expect(isIsoCalendarDate('2026-04-31')).toBe(false);
    expect(isIsoCalendarDate('2026-13-01')).toBe(false);
    expect(isIsoCalendarDate('2026-00-10')).toBe(false);
    expect(isIsoCalendarDate('not-a-date')).toBe(false);
  });

  it('rejects impossible event dates at the server finance-document boundary',()=>{
    const data=minimal();
    data.state.events=[{
      id:'bad-date',date:'2026-02-31',kind:'expense',amount:10,note:'Invalid date',
      accountId:'bank',legs:[{accountId:'bank',amount:-10}],source:'user',
      createdAt:'2026-10-01T12:00:00.000Z',updatedAt:'2026-10-01T12:00:00.000Z',
    }];
    expect(()=>validateFinanceData(data)).toThrow(ApiError);
  });

  it('rejects impossible optional finance dates rather than accepting their shape only',()=>{
    const data=minimal();
    data.state.savingsGoals=[{
      id:'goal',name:'Goal',targetAmount:100,targetDate:'2026-02-31',
      createdAt:'2026-10-01T12:00:00.000Z',updatedAt:'2026-10-01T12:00:00.000Z',
    }];
    expect(()=>validateFinanceData(data)).toThrow(ApiError);
  });

  it('rejects impossible scheduled dates before creating user state',()=>{
    const data=minimal();
    expect(()=>createScheduledTransaction(data,{
      kind:'expense',dueDate:'2026-04-31',amount:10,accountId:'bank',
    })).toThrow('Διάλεξε έγκυρη ημερομηνία');
  });
});
