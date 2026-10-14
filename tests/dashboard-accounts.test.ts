import { describe, expect, it } from 'vitest';
import { migrateData } from '../src/lib/domain.js';
import { dashboardAccountHistory, dashboardBalanceChange, dashboardHistoryStart, dashboardPreviousMonthValues, dashboardSavingsGoal } from '../src/lib/dashboardAccounts.js';
import type { FinanceData } from '../src/types.js';

function fixture():FinanceData{
  return migrateData({
    app:'MyFinHub',schemaVersion:3,updatedAt:'2026-08-12T10:00:00Z',
    seed:{
      accounts:[{id:'bank',name:'Bank',kind:'bank'},{id:'save',name:'Save',kind:'savings'}],
      months:['2026-07','2026-08'],
      transactions:[
        {id:'income',date:'2026-08-05',type:'income',accountId:'bank',amount:100,note:'Income'},
        {id:'expense',date:'2026-08-08',type:'expense',accountId:'bank',amount:40,note:'Expense'},
        {id:'transfer',date:'2026-08-10',type:'transfer',fromAccountId:'bank',toAccountId:'save',amount:50,note:'Transfer'},
      ],
      snapshots:[
        {date:'2026-07-01',balances:{bank:1000,save:300}},
        {date:'2026-08-11',balances:{bank:1010,save:350}},
      ],
      recurring:[],subscriptions:[],loans:[],lending:[],stats:{},
    },
    state:{
      customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],
      settings:{excludedFromAvailable:[],accountNames:{},expenseCategories:[],incomeCategories:[],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'bank',defaultIncomeAccount:'bank',defaultLoanAccount:'bank'},
      events:[],scheduled:[],reviewDecisions:{},
    },
  } as FinanceData);
}

describe('Dashboard account history',()=>{
  it('shapes history from effective movements while anchoring the final point to the canonical snapshot balance',()=>{
    const rows=dashboardAccountHistory(fixture(),['bank','save'],'2026-08-04','2026-08-11');
    expect(rows.bank.map(point=>point.value)).toEqual([1000,1100,1100,1100,1060,1060,1010,1010]);
    expect(rows.bank.at(-1)?.value).toBe(1010);
    expect(rows.save.at(-1)?.value).toBe(350);
  });

  it('uses a small previous-month context window and same-day previous-month comparison',()=>{
    const data=fixture();
    expect(dashboardHistoryStart('2026-08')).toBe('2026-07-24');
    const comparison=dashboardPreviousMonthValues(data,'bank','2026-08','2026-08-12');
    expect(comparison).toHaveLength(12);
    expect(comparison.every(point=>point.date.startsWith('2026-07-'))).toBe(true);
    expect(comparison.at(-1)?.value).toBe(1000);

    const fullHistoricalComparison=dashboardPreviousMonthValues(data,'bank','2026-08','2026-08-31');
    expect(fullHistoricalComparison).toHaveLength(31);
    expect(fullHistoricalComparison.at(-1)?.date).toBe('2026-07-31');
  });

  it('reports the movement-derived 30-day balance change in account currency',()=>{
    expect(dashboardBalanceChange(fixture(),'bank','2026-08-12')).toBe(10);
  });

  it('resets the reconstructed curve at an authoritative snapshot inside the visible window',()=>{
    const data=fixture();
    data.seed.snapshots=[
      {date:'2026-07-01',balances:{bank:1000,save:300}},
      {date:'2026-08-09',balances:{bank:900,save:325}},
      {date:'2026-08-11',balances:{bank:1010,save:350}},
    ];
    const rows=dashboardAccountHistory(data,['bank'],'2026-08-04','2026-08-11').bank;
    expect(rows.find(point=>point.date==='2026-08-08')?.value).toBe(1060);
    expect(rows.find(point=>point.date==='2026-08-09')?.value).toBe(900);
    expect(rows.at(-1)?.value).toBe(1010);
  });

  it('only returns a card-level savings goal when both the account and goal are unambiguous',()=>{
    const goal={id:'goal-1',name:'Emergency',targetAmount:3000,createdAt:'2026-08-01T00:00:00Z',updatedAt:'2026-08-01T00:00:00Z'};
    expect(dashboardSavingsGoal([goal],1)?.id).toBe('goal-1');
    expect(dashboardSavingsGoal([goal],2)).toBeUndefined();
    expect(dashboardSavingsGoal([goal,{...goal,id:'goal-2',name:'Trip'}],1)).toBeUndefined();
    expect(dashboardSavingsGoal([{...goal,targetAmount:0}],1)).toBeUndefined();
  });

});
