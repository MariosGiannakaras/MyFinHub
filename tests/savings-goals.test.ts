import { describe, expect, it } from 'vitest';
import { migrateData } from '../src/lib/domain.js';
import { savingsGoalBalance, savingsGoalProgress, validSavingsGoalDeadline } from '../src/lib/savingsGoals.js';
import { isSavingsAccount } from '../src/lib/accountSelection.js';
import type { FinanceData, SavingsGoal } from '../src/types.js';

function fixture():FinanceData{
  return migrateData({
    app:'RheomIQ',schemaVersion:3,updatedAt:'2026-09-28T00:00:00.000Z',
    seed:{
      accounts:[
        {id:'current',name:'Current',kind:'bank'},
        {id:'save-a',name:'Savings A',kind:'savings'},
        {id:'save-b',name:'Savings B',kind:'savings'},
        {id:'bank-save',name:'Bank Savings',kind:'bank',bankAccountCategory:'savings'},
        {id:'bank-current',name:'Bank Current',kind:'bank',bankAccountCategory:'current'},
      ],
      months:[],transactions:[],
      snapshots:[{date:'2026-09-28',balances:{current:900,'save-a':600,'save-b':-50,'bank-save':250,'bank-current':300}}],
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
    expect(savingsGoalBalance(data,'2026-09-28')).toBe(850);
    expect(isSavingsAccount({kind:'bank',bankAccountCategory:'savings'})).toBe(true);
    expect(isSavingsAccount({kind:'bank',bankAccountCategory:'current'})).toBe(false);
    expect(isSavingsAccount({kind:'cash'})).toBe(false);
  });

  it('retains an unchanged expired personal deadline but rejects a newly introduced past deadline',()=>{
    const asOf='2026-10-12';
    expect(validSavingsGoalDeadline('2026-09-30',asOf,'2026-09-30')).toBe(true);
    expect(validSavingsGoalDeadline('2026-09-30',asOf,null)).toBe(false);
    expect(validSavingsGoalDeadline('2026-10-01',asOf,'2026-09-30')).toBe(false);
    expect(validSavingsGoalDeadline('2026-10-12',asOf,null)).toBe(true);
    expect(validSavingsGoalDeadline('2026-11-01',asOf,'2026-09-30')).toBe(true);
    expect(validSavingsGoalDeadline(null,asOf,'2026-09-30')).toBe(true);
  });

  it('calculates bounded progress without fabricating a target',()=>{
    const base={id:'goal',name:'Trip',targetDate:null,createdAt:'2026-09-28T00:00:00.000Z',updatedAt:'2026-09-28T00:00:00.000Z'};
    expect(savingsGoalProgress({...base,targetAmount:1200} as SavingsGoal,600)).toBe(50);
    expect(savingsGoalProgress({...base,targetAmount:500} as SavingsGoal,600)).toBe(100);
    expect(savingsGoalProgress({...base,targetAmount:0} as SavingsGoal,600)).toBe(0);
  });
});
