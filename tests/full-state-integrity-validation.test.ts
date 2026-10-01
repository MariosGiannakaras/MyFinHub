import { describe, expect, it } from 'vitest';
import { validateFinanceData } from '../server/validation.js';

function base():any{
  return {
    app:'RheomIQ',
    schemaVersion:3,
    updatedAt:'2026-10-01T12:00:00.000Z',
    seed:{
      accounts:[{id:'cash',name:'Cash',kind:'cash'}],
      months:['2026-10'],
      transactions:[],
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
      customLoans:[],
      lendingCustom:[],
      settings:{
        excludedFromAvailable:[],
        accountNames:{},
        expenseCategories:['Άλλο'],
        incomeCategories:['Μισθός'],
        customPresets:[],
        pinnedPresets:[],
        defaultExpenseAccount:'cash',
        defaultIncomeAccount:'cash',
        defaultLoanAccount:'cash',
      },
      events:[],
      reviewDecisions:{},
      scheduled:[],
      attentionDecisions:{},
      budgets:[],
      savingsGoals:[],
      transactionRules:[],
      cards:[],
      deletedCards:[],
      creditStatements:[],
    },
  };
}

describe('full mutable collection validation',()=>{
  it('accepts current scheduled, attention, budget and rule schemas',()=>{
    const data=base();
    data.state.scheduled.push({
      id:'scheduled-1',dueDate:'2026-10-31',kind:'expense',amount:12.5,note:'Bill',category:'Άλλο',
      accountId:'cash',status:'pending',createdAt:data.updatedAt,updatedAt:data.updatedAt,
    });
    data.state.attentionDecisions['scheduled:scheduled-1']={
      status:'snoozed',fingerprint:'scheduled|scheduled-1',decidedAt:data.updatedAt,snoozedUntil:'2026-10-03',
    };
    data.state.budgets.push({
      id:'budget:2026-10:overall',month:'2026-10',scope:'overall',amount:500,alertThreshold:.8,
      createdAt:data.updatedAt,updatedAt:data.updatedAt,
    });
    data.state.transactionRules.push({
      id:'rule-1',name:'Market',enabled:true,priority:1,scopes:['manual'],
      match:{description:'market',mode:'contains'},action:{category:'Άλλο'},
      createdAt:data.updatedAt,updatedAt:data.updatedAt,
    });
    expect(()=>validateFinanceData(data)).not.toThrow();
  });

  it('rejects impossible dates across imported finance state',()=>{
    const cases:Array<[string,(data:any)=>void]>=[
      ['seed transaction',data=>data.seed.transactions.push({id:'tx',date:'2026-02-31',type:'expense',amount:10,note:'bad'})],
      ['snapshot',data=>data.seed.snapshots.push({date:'2026-04-31',balances:{cash:10}})],
      ['recurring',data=>data.state.recurringCustom.push({id:'r',name:'R',amount:10,day:1,firstExpectedDate:'2026-02-31',accountId:'cash',category:'Άλλο',active:true})],
      ['loan schedule',data=>data.state.customLoans.push({id:'l',name:'L',total:100,installment:10,installments:10,schedule:[{date:'2026-02-31',status:'pending'}]})],
      ['event',data=>data.state.events.push({id:'e',date:'2026-02-31',kind:'expense',amount:10,note:'bad',accountId:'cash',legs:[{accountId:'cash',amount:-10}]})],
      ['scheduled',data=>data.state.scheduled.push({id:'s',dueDate:'2026-02-31',kind:'expense',amount:10,note:'bad',accountId:'cash',status:'pending',createdAt:data.updatedAt,updatedAt:data.updatedAt})],
      ['goal',data=>data.state.savingsGoals.push({id:'g',name:'G',targetAmount:100,targetDate:'2026-02-31',createdAt:data.updatedAt,updatedAt:data.updatedAt})],
    ];
    for(const [,mutate] of cases){
      const data=base();mutate(data);
      expect(()=>validateFinanceData(data)).toThrow();
    }
  });

  it('rejects malformed months and monetary values that cannot be represented safely',()=>{
    const badMonth=base();badMonth.seed.months=['2026-13'];
    expect(()=>validateFinanceData(badMonth)).toThrowError(/months/i);

    const badBudgetMonth=base();badBudgetMonth.state.budgets=[{id:'b',month:'2026-13',scope:'overall',amount:10,createdAt:badBudgetMonth.updatedAt,updatedAt:badBudgetMonth.updatedAt}];
    expect(()=>validateFinanceData(badBudgetMonth)).toThrowError(/month/i);

    const unsafeEvent=base();unsafeEvent.state.events=[{id:'e',date:'2026-10-01',kind:'expense',amount:Number.MAX_SAFE_INTEGER,note:'huge',accountId:'cash',legs:[{accountId:'cash',amount:-Number.MAX_SAFE_INTEGER}]}];
    expect(()=>validateFinanceData(unsafeEvent)).toThrowError(/amount/i);

    const unsafeBalance=base();unsafeBalance.seed.snapshots=[{date:'2026-10-01',balances:{cash:Number.MAX_SAFE_INTEGER}}];
    expect(()=>validateFinanceData(unsafeBalance)).toThrowError(/balances/i);
  });

  it('rejects malformed scheduled, attention, budget and transaction-rule payloads',()=>{
    const badTransfer=base();badTransfer.state.scheduled=[{id:'s',dueDate:'2026-10-02',kind:'transfer',amount:10,note:'bad',fromAccountId:'cash',toAccountId:'cash',status:'pending',createdAt:badTransfer.updatedAt,updatedAt:badTransfer.updatedAt}];
    expect(()=>validateFinanceData(badTransfer)).toThrowError(/transfer accounts/i);

    const badAttention=base();badAttention.state.attentionDecisions={x:{status:'dismissed',fingerprint:'x',decidedAt:badAttention.updatedAt,snoozedUntil:'2026-10-02'}};
    expect(()=>validateFinanceData(badAttention)).toThrowError(/snoozedUntil/i);

    const badBudget=base();badBudget.state.budgets=[{id:'b',month:'2026-10',scope:'category',amount:10,createdAt:badBudget.updatedAt,updatedAt:badBudget.updatedAt}];
    expect(()=>validateFinanceData(badBudget)).toThrowError(/category/i);

    const badRule=base();badRule.state.transactionRules=[{id:'r',name:'R',enabled:true,priority:0,scopes:['manual','manual'],match:{description:'x'},action:{category:'Άλλο'},createdAt:badRule.updatedAt,updatedAt:badRule.updatedAt}];
    expect(()=>validateFinanceData(badRule)).toThrowError(/scopes/i);
  });

  it('rejects override key/id mismatches instead of persisting ambiguous identity',()=>{
    const tx=base();tx.state.overrides['expected']={id:'different',date:'2026-10-01',type:'expense',amount:10,note:'bad'};
    expect(()=>validateFinanceData(tx)).toThrowError(/overrides/i);

    const recurring=base();recurring.state.recurringOverrides['expected']={id:'different',name:'R',amount:10,day:1,accountId:'cash',category:'Άλλο',active:true};
    expect(()=>validateFinanceData(recurring)).toThrowError(/recurringOverrides/i);

    const loan=base();loan.state.loanOverrides['expected']={id:'different',name:'L',total:100,installment:10,installments:10};
    expect(()=>validateFinanceData(loan)).toThrowError(/loanOverrides/i);
  });

  it('runs card and recurring extension invariants directly from full-document validation',()=>{
    const badStatement=base();
    badStatement.state.cards=[{id:'cc',bankId:'bank',nickname:'Credit',kind:'credit',network:'visa',active:true,createdAt:badStatement.updatedAt,updatedAt:badStatement.updatedAt}];
    badStatement.state.creditStatements=[{id:'cc:bad',cardId:'cc',openDate:'2026-02-31',closeDate:'2026-03-10',dueDate:'2026-03-20',boundaryRule:'include-closing-day',createdAt:badStatement.updatedAt,updatedAt:badStatement.updatedAt}];
    expect(()=>validateFinanceData(badStatement)).toThrow();

    const badCadence=base();
    badCadence.state.recurringCustom=[{id:'r',name:'Annual',amount:10,accountId:'cash',category:'Άλλο',active:true,recurrenceUnit:'year',recurrenceInterval:1}];
    expect(()=>validateFinanceData(badCadence)).toThrow();
  });
});
