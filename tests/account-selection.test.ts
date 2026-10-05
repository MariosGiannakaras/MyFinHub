import { describe, expect, it } from 'vitest';
import { financeAccountChoices } from '../src/lib/accountSelection.js';
import { migrateData } from '../src/lib/domain.js';
import type { FinanceData } from '../src/types.js';

function base(accounts:FinanceData['seed']['accounts']):FinanceData{
  return {
    app:'RheomIQ',
    schemaVersion:2,
    updatedAt:'2026-09-28T00:00:00.000Z',
    seed:{accounts,months:[],transactions:[],snapshots:[],recurring:[],subscriptions:[],loans:[],lending:[],stats:{}},
    state:{
      customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},
      loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],
      settings:{
        excludedFromAvailable:[],accountNames:{},expenseCategories:[],incomeCategories:[],
        customPresets:[],pinnedPresets:[],defaultExpenseAccount:'',defaultIncomeAccount:'',defaultLoanAccount:'',
      },
    },
  };
}

describe('canonical account selection',()=>{
  it('normalizes legacy seed defaults from account semantics instead of a bank-specific id',()=>{
    const input=base([
      {id:'wallet',name:'Wallet',kind:'cash',cashRole:'daily'},
      {id:'bank-custom',name:'Custom Bank',kind:'bank',provider:'custom-provider'},
      {id:'save-custom',name:'Reserve',kind:'savings'},
    ]);
    delete (input.state.settings as Partial<FinanceData['state']['settings']>).defaultExpenseAccount;
    delete (input.state.settings as Partial<FinanceData['state']['settings']>).defaultIncomeAccount;
    delete (input.state.settings as Partial<FinanceData['state']['settings']>).defaultLoanAccount;

    const migrated=migrateData(input);
    expect(migrated.state.settings.defaultExpenseAccount).toBe('bank-custom');
    expect(migrated.state.settings.defaultIncomeAccount).toBe('bank-custom');
    expect(migrated.state.settings.defaultLoanAccount).toBe('bank-custom');
    expect(JSON.stringify(migrated)).not.toContain('piraeus-payroll');
  });

  it('uses the exact semantic Dashboard hierarchy independently of configured operating defaults or display names',()=>{
    const data=migrateData(base([
      {id:'cash-daily',name:'Pocket A',kind:'cash',cashRole:'daily'},
      {id:'bank-current',name:'Looks Like Payroll But Is Current',kind:'bank',bankAccountCategory:'current'},
      {id:'bank-payroll',name:'Unrelated Label B',kind:'bank',bankAccountCategory:'payroll'},
      {id:'save-seed',name:'Unrelated Label C',kind:'savings'},
    ]));
    data.state.settings.customAccounts=[
      {id:'custom-current',name:'Default Operating',kind:'bank',bankAccountCategory:'current',custom:true,showInQuickChoices:true},
      {id:'custom-savings-bank',name:'Savings Category Bank',kind:'bank',bankAccountCategory:'savings',custom:true,showInQuickChoices:true},
    ];
    data.state.settings.defaultExpenseAccount='custom-current';
    data.state.settings.defaultIncomeAccount='custom-current';
    data.state.settings.accountOverrides={
      'save-seed':{id:'save-seed',name:'Unrelated Label C',kind:'savings',showInQuickChoices:false},
    };

    const choices=financeAccountChoices(data);
    expect(choices.operating?.id).toBe('custom-current');
    expect(choices.dashboardPrimary.map(account=>account.id)).toEqual(['cash-daily','bank-payroll','custom-savings-bank']);
    expect(choices.dashboardPrimarySlots.map(slot=>slot.role)).toEqual(['cash','payroll','savings']);
  });

  it('keeps a missing payroll slot explicit instead of substituting a current/default account',()=>{
    const data=migrateData(base([
      {id:'cash-daily',name:'A',kind:'cash',cashRole:'daily'},
      {id:'bank-current',name:'B',kind:'bank',bankAccountCategory:'current'},
      {id:'save-bank',name:'C',kind:'bank',bankAccountCategory:'savings'},
    ]));
    data.state.settings.defaultExpenseAccount='bank-current';
    data.state.settings.defaultIncomeAccount='bank-current';

    const choices=financeAccountChoices(data);
    expect(choices.dashboardPrimary.map(account=>account.id)).toEqual(['cash-daily','save-bank']);
    expect(choices.dashboardPrimarySlots.map(slot=>[slot.role,slot.account?.id??null])).toEqual([
      ['cash','cash-daily'],
      ['payroll',null],
      ['savings','save-bank'],
    ]);
    expect(choices.dashboardPayroll).toBeUndefined();
  });

  it('keeps stable seed ids while overlays change their presentation metadata',()=>{
    const data=migrateData(base([{id:'stable-bank',name:'Original',kind:'bank'}]));
    data.state.settings.accountOverrides={
      'stable-bank':{id:'attempted-replacement',name:'Renamed',kind:'bank',provider:'provider-x',showInQuickChoices:true},
    };
    const choices=financeAccountChoices(data);
    expect(choices.accounts.find(account=>account.name==='Renamed')).toMatchObject({id:'stable-bank',provider:'provider-x'});
  });
});
