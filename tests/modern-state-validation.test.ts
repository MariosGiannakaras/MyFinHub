import { describe, expect, it } from 'vitest';
import { ApiError } from '../server/http.js';
import { validateFinanceData } from '../server/validation.js';
import { migrateData } from '../src/lib/domain.js';
import type { FinanceData } from '../src/types.js';

function base():FinanceData{
  return migrateData({
    app:'RheomIQ',schemaVersion:3,updatedAt:'2026-10-01T12:00:00.000Z',
    seed:{accounts:[{id:'bank',name:'Bank',kind:'bank'}],months:[],transactions:[],snapshots:[],recurring:[],subscriptions:[],loans:[],lending:[],stats:{}},
    state:{
      customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],events:[],
      settings:{excludedFromAvailable:[],accountNames:{bank:'Bank'},expenseCategories:['Άλλο'],incomeCategories:['Έσοδα'],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'bank',defaultIncomeAccount:'bank',defaultLoanAccount:'bank'},
      reviewDecisions:{},
    },
  } as any);
}

const stamp='2026-10-01T12:00:00.000Z';

describe('modern mutable state validation',()=>{
  it('accepts valid scheduled, attention, budget and transaction-rule state',()=>{
    const data=base();
    data.state.scheduled=[{id:'scheduled',dueDate:'2026-10-20',kind:'expense',amount:20,note:'Bill',accountId:'bank',status:'pending',createdAt:stamp,updatedAt:stamp}];
    data.state.attentionDecisions={notice:{status:'snoozed',fingerprint:'fingerprint',decidedAt:stamp,snoozedUntil:'2026-10-04'}};
    data.state.budgets=[{id:'budget',month:'2026-10',scope:'overall',amount:500,alertThreshold:.8,createdAt:stamp,updatedAt:stamp}];
    data.state.transactionRules=[{id:'rule',name:'Groceries',enabled:true,priority:0,scopes:['manual'],match:{description:'market',mode:'contains'},action:{category:'Άλλο'},createdAt:stamp,updatedAt:stamp}];
    expect(()=>validateFinanceData(data)).not.toThrow();
  });

  it('rejects impossible scheduled dates and malformed transfer routes',()=>{
    const data=base();
    data.state.scheduled=[{id:'scheduled',dueDate:'2026-02-31',kind:'transfer',amount:20,note:'Move',fromAccountId:'bank',toAccountId:'bank',status:'pending',createdAt:stamp,updatedAt:stamp}];
    expect(()=>validateFinanceData(data)).toThrow(ApiError);
  });

  it('rejects malformed attention snooze dates',()=>{
    const data=base();
    data.state.attentionDecisions={notice:{status:'snoozed',fingerprint:'fingerprint',decidedAt:stamp,snoozedUntil:'2026-02-31'}};
    expect(()=>validateFinanceData(data)).toThrow(ApiError);
  });

  it('rejects invalid budget months, amounts and alert thresholds',()=>{
    const invalidMonth=base();
    invalidMonth.state.budgets=[{id:'budget',month:'2026-13',scope:'overall',amount:500,alertThreshold:.8,createdAt:stamp,updatedAt:stamp}];
    expect(()=>validateFinanceData(invalidMonth)).toThrow(ApiError);

    const invalidThreshold=base();
    invalidThreshold.state.budgets=[{id:'budget',month:'2026-10',scope:'overall',amount:500,alertThreshold:1.2,createdAt:stamp,updatedAt:stamp}];
    expect(()=>validateFinanceData(invalidThreshold)).toThrow(ApiError);
  });

  it('rejects no-op or ambiguous transaction rules at the persistence boundary',()=>{
    const noMatch=base();
    noMatch.state.transactionRules=[{id:'rule',name:'No match',enabled:true,priority:0,scopes:['manual'],match:{},action:{category:'Άλλο'},createdAt:stamp,updatedAt:stamp}];
    expect(()=>validateFinanceData(noMatch)).toThrow(ApiError);

    const duplicateScopes=base();
    duplicateScopes.state.transactionRules=[{id:'rule',name:'Duplicate scopes',enabled:true,priority:0,scopes:['manual','manual'],match:{description:'market'},action:{category:'Άλλο'},createdAt:stamp,updatedAt:stamp} as any];
    expect(()=>validateFinanceData(duplicateScopes)).toThrow(ApiError);
  });
});
