import { describe, expect, it } from 'vitest';
import { createEvent } from '../src/lib/domain.js';
import { reportExpenseCounterparties, reportLoanBurden } from '../src/lib/reports.js';
import type { FinanceData } from '../src/types.js';

function fixture():FinanceData{return {
  app:'RheomIQ',
  schemaVersion:3,
  updatedAt:'2026-09-02T00:00:00.000Z',
  seed:{
    accounts:[{id:'cash',name:'Cash',kind:'cash'},{id:'savings',name:'Savings',kind:'savings'}],
    months:['2026-09'],
    transactions:[
      {id:'market-a',date:'2026-09-02',type:'expense',accountId:'cash',amount:20,note:'Market',category:'Τρόφιμα'},
      {id:'market-b',date:'2026-09-08',type:'expense',accountId:'cash',amount:30,note:'Market',category:'Τρόφιμα'},
      {id:'salary',date:'2026-09-01',type:'income',accountId:'cash',amount:1000,note:'Salary',category:'Μισθός'},
    ],
    snapshots:[],
    recurring:[],
    subscriptions:[],
    loans:[],
    lending:[],
    stats:{},
  },
  state:{
    customTransactions:[],
    overrides:{},
    deleted:[],
    recurringCustom:[],
    recurringOverrides:{},
    loanExtra:{},
    loanOverrides:{},
    customLoans:[{id:'loan-long',name:'Home loan',total:1200,installment:100,installments:12,paidCount:1,kind:'loan',longTermRecurring:true,firstExpectedDate:'2026-09-15',defaultAccountId:'cash'}],
    lendingCustom:[],
    events:[],
    reviewDecisions:{},
    settings:{
      excludedFromAvailable:[],
      accountNames:{},
      expenseCategories:['Τρόφιμα','Μετακινήσεις'],
      incomeCategories:['Μισθός'],
      customPresets:[],
      pinnedPresets:[],
      defaultExpenseAccount:'cash',
      defaultIncomeAccount:'cash',
      defaultLoanAccount:'cash',
      motion:'full',
    },
  },
} as FinanceData}

describe('composite Reports analytics',()=>{
  it('groups top expense counterparties from recorded expense semantics only',()=>{
    const data=fixture();
    const taxi=createEvent({kind:'expense',date:'2026-09-12',amount:10,note:'Taxi',category:'Μετακινήσεις',accountId:'cash'});
    const transfer=createEvent({kind:'transfer',date:'2026-09-13',amount:500,note:'Move savings',fromAccountId:'cash',toAccountId:'savings'});
    data.state.events=[taxi,transfer];
    const rows=reportExpenseCounterparties(data,'2026-09',5);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({title:'Market',category:'Τρόφιμα',amount:50,count:2});
    expect(rows[0].share).toBeCloseTo(5/6);
    expect(rows[1]).toMatchObject({title:'Taxi',amount:10,count:1});
    expect(rows.some(row=>row.title==='Move savings')).toBe(false);
  });

  it('reports the next monthly long-term loan burden without cloning recurring items',()=>{
    const data=fixture();
    const before=data.state.recurringCustom.map(row=>row.id);
    const burden=reportLoanBurden(data);
    expect(burden.total).toBe(100);
    expect(burden.count).toBe(1);
    expect(burden.rows[0]).toMatchObject({id:'loan-long',name:'Home loan',amount:100,remainingInstallments:11});
    expect(data.state.recurringCustom.map(row=>row.id)).toEqual(before);
  });
});
