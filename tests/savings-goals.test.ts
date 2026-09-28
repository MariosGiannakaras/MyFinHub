import { describe, expect, it } from 'vitest';
import { migrateData } from '../src/lib/domain.js';
import { savingsGoalBalance, savingsGoalProgress } from '../src/lib/savingsGoals.js';
import type { FinanceData, SavingsGoal } from '../src/types.js';

function fixture():FinanceData{
  return migrateData({
    app:'RheomIQ',schemaVersion:3,updatedAt:'2026-09-28T00:00:00.000Z',
    seed:{
      accounts:[
        {id:'current',name:'Current',kind:'bank'},
        {id:'save-a',name:'Savings A',kind:'savings'},
        {id:'save-b',name:'Savings B',kind:'savings'},
      ],
      months:[],transactions:[],
      snapshots:[{date:'2026-09-28',balances:{current:900,'save-a':600,'save-b':-50}}],
      recurring:[],subscriptions:[],loans:[],lending:[],stats:{},
    },
    state:{
      customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},
      loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],
      settings:{excludedFromAvailable:[],accountNames:{},expenseCategories:[],incomeCategories:[],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'current',defaultIncomeAccount:'current',defaultLoanAccount:'current'},
      events:[],
    },
  } as FinanceData);
}

describe('savings goal semantics',()=>{
  it('uses only positive balances from savings accounts as goal progress backing',()=>{
    const data=fixture();
    expect(savingsGoalBalance(data,'2026-09-28')).toBe(600);
  });

  it('calculates bounded progress without fabricating a target',()=>{
    const base={id:'goal',name:'Trip',targetDate:null,createdAt:'2026-09-28T00:00:00.000Z',updatedAt:'2026-09-28T00:00:00.000Z'};
    expect(savingsGoalProgress({...base,targetAmount:1200} as SavingsGoal,600)).toBe(50);
    expect(savingsGoalProgress({...base,targetAmount:500} as SavingsGoal,600)).toBe(100);
    expect(savingsGoalProgress({...base,targetAmount:0} as SavingsGoal,600)).toBe(0);
  });
});
