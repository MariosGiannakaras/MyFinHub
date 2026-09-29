import { describe, expect, it } from 'vitest';
import { migrateData } from '../src/lib/domain.js';
import { dashboardAccountHistory, dashboardBalanceChange, dashboardHistoryStart, dashboardPreviousMonthValues } from '../src/lib/dashboardAccounts.js';
import type { FinanceData } from '../src/types.js';

const stamp=(date:string)=>`${date}T08:00:00.000Z`;

function fixture():FinanceData{
  return migrateData({
    app:'MyFinHub',schemaVersion:3,updatedAt:'2026-08-12T10:00:00Z',
    seed:{
      accounts:[{id:'bank',name:'Bank',kind:'bank'},{id:'save',name:'Save',kind:'savings'}],
      months:['2026-07','2026-08'],
      transactions:[],
      snapshots:[{date:'2026-07-01',balances:{bank:1000,save:300}}],
      recurring:[],subscriptions:[],loans:[],lending:[],stats:{},
    },
    state:{
      customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],
      settings:{excludedFromAvailable:[],accountNames:{},expenseCategories:[],incomeCategories:[],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'bank',defaultIncomeAccount:'bank',defaultLoanAccount:'bank'},
      events:[
        {id:'income',date:'2026-08-05',kind:'income',amount:100,note:'Income',accountId:'bank',legs:[{accountId:'bank',amount:100}],source:'user',createdAt:stamp('2026-08-05'),updatedAt:stamp('2026-08-05')},
        {id:'expense',date:'2026-08-08',kind:'expense',amount:40,note:'Expense',accountId:'bank',legs:[{accountId:'bank',amount:-40}],source:'user',createdAt:stamp('2026-08-08'),updatedAt:stamp('2026-08-08')},
        {id:'transfer',date:'2026-08-10',kind:'transfer',amount:50,note:'Transfer',fromAccountId:'bank',toAccountId:'save',legs:[{accountId:'bank',amount:-50},{accountId:'save',amount:50}],source:'user',createdAt:stamp('2026-08-10'),updatedAt:stamp('2026-08-10')},
      ],
      scheduled:[],reviewDecisions:{},
    },
  } as FinanceData);
}

describe('Dashboard account history',()=>{
  it('builds daily balances from the canonical snapshot plus ledger events',()=>{
    const rows=dashboardAccountHistory(fixture(),['bank','save'],'2026-08-04','2026-08-11');
    expect(rows.bank.map(point=>point.value)).toEqual([1000,1100,1100,1100,1060,1060,1010,1010]);
    expect(rows.save.at(-1)?.value).toBe(350);
  });

  it('uses a small previous-month context window and same-day previous-month comparison',()=>{
    const data=fixture();
    expect(dashboardHistoryStart('2026-08')).toBe('2026-07-24');
    const comparison=dashboardPreviousMonthValues(data,'bank','2026-08','2026-08-12');
    expect(comparison).toHaveLength(12);
    expect(comparison.every(point=>point.date.startsWith('2026-07-'))).toBe(true);
  });

  it('reports an absolute 30-day balance change in account currency',()=>{
    expect(dashboardBalanceChange(fixture(),'bank','2026-08-12')).toBe(10);
  });
});
