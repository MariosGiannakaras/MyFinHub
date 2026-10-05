import { describe, expect, it } from 'vitest';
import { createEvent } from '../src/lib/domain.js';
import type { FinanceData, FinanceEvent } from '../src/types.js';
import { validateCompleteFinanceData } from '../server/financeDataValidation.js';
import { validateCompleteFinanceSemantics, validateFinanceStateSemantics } from '../server/financeSemanticValidation.js';

function baseData():FinanceData{
  return {
    app:'RheomIQ',
    schemaVersion:3,
    updatedAt:'2026-10-01T00:00:00.000Z',
    seed:{
      accounts:[
        {id:'bank',name:'Bank',kind:'bank'},
        {id:'savings',name:'Savings',kind:'savings'},
        {id:'cash',name:'Cash',kind:'cash'},
      ],
      months:[],
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
        excludedFromAvailable:['savings'],
        accountNames:{},
        expenseCategories:['Άλλο'],
        incomeCategories:['Μισθός'],
        customPresets:[],
        pinnedPresets:[],
        defaultExpenseAccount:'bank',
        defaultIncomeAccount:'bank',
        defaultLoanAccount:'bank',
      },
      events:[],
      reviewDecisions:{},
      scheduled:[],
      attentionDecisions:{},
      budgets:[],
      savingsGoals:[],
      transactionRules:[],
    },
  };
}

function canonicalEvents():FinanceEvent[]{
  return [
    createEvent({kind:'expense',date:'2026-10-01',amount:10,note:'Expense',accountId:'bank'}),
    createEvent({kind:'income',date:'2026-10-01',amount:20,note:'Income',accountId:'bank'}),
    createEvent({kind:'transfer',date:'2026-10-01',amount:30,note:'Transfer',fromAccountId:'bank',toAccountId:'savings'}),
    createEvent({kind:'withdrawal',date:'2026-10-01',amount:40,note:'Withdrawal',fromAccountId:'bank',toAccountId:'cash'}),
    createEvent({kind:'saving_cash_offset',date:'2026-10-01',amount:50,note:'Saving',fromAccountId:'bank',toAccountId:'savings'}),
    createEvent({kind:'refund',date:'2026-10-01',amount:6,note:'Refund',accountId:'bank'}),
    createEvent({kind:'lending',date:'2026-10-01',amount:7,note:'Lend',accountId:'bank',person:'Alex'}),
    createEvent({kind:'repayment',date:'2026-10-01',amount:4,note:'Repay',accountId:'bank',person:'Alex'}),
    createEvent({kind:'card_purchase',date:'2026-10-01',amount:60,note:'Card'}),
    createEvent({kind:'card_payment',date:'2026-10-01',amount:25,note:'Card payment',fromAccountId:'bank'}),
    createEvent({kind:'reconciliation',date:'2026-10-01',amount:100,note:'Correction',accountId:'bank',actualBalance:900,currentBalance:1000}),
    createEvent({
      kind:'split',date:'2026-10-01',amount:15,note:'Split',accountId:'bank',
      parts:[
        {id:'p1',label:'A',category:'Άλλο',amount:5,kind:'expense'},
        {id:'p2',label:'B',category:'Άλλο',amount:10,kind:'expense'},
      ],
    }),
  ];
}

describe('finance persistence semantic invariants',()=>{
  it('accepts the canonical domain event shapes',()=>{
    const data=baseData();
    data.state.events=canonicalEvents();
    expect(()=>validateFinanceStateSemantics(data.state)).not.toThrow();
    expect(()=>validateCompleteFinanceSemantics(data)).not.toThrow();
    expect(()=>validateCompleteFinanceData(data)).not.toThrow();
  });

  it('rejects tampered transfer legs in mutable-state validation',()=>{
    const data=baseData();
    const event=createEvent({kind:'transfer',date:'2026-10-01',amount:30,note:'Transfer',fromAccountId:'bank',toAccountId:'savings'});
    event.legs=[{accountId:'bank',amount:-20},{accountId:'savings',amount:20}];
    data.state.events=[event];
    expect(()=>validateFinanceStateSemantics(data.state)).toThrowError(/ledger legs/i);
  });

  it('rejects duplicate ledger accounts instead of allowing offsetting duplicate legs',()=>{
    const data=baseData();
    const event=createEvent({kind:'expense',date:'2026-10-01',amount:10,note:'Expense',accountId:'bank'});
    event.legs=[{accountId:'bank',amount:-5},{accountId:'bank',amount:-5}];
    data.state.events=[event];
    expect(()=>validateFinanceStateSemantics(data.state)).toThrowError(/ledger legs|duplicate ledger/i);
  });

  it('rejects split events that no longer have at least two balanced positive parts',()=>{
    const data=baseData();
    const event=createEvent({
      kind:'split',date:'2026-10-01',amount:10,note:'Split',accountId:'bank',
      parts:[
        {id:'p1',label:'A',category:'Άλλο',amount:4,kind:'expense'},
        {id:'p2',label:'B',category:'Άλλο',amount:6,kind:'expense'},
      ],
    });
    event.parts=[{id:'only',label:'Only',category:'Άλλο',amount:10,kind:'expense'}];
    data.state.events=[event];
    expect(()=>validateFinanceStateSemantics(data.state)).toThrowError(/split parts/i);
  });

  it('rejects semantic delta tampering for savings, receivables and credit',()=>{
    for(const event of [
      createEvent({kind:'saving_cash_offset',date:'2026-10-01',amount:20,note:'Save',fromAccountId:'bank',toAccountId:'savings'}),
      createEvent({kind:'lending',date:'2026-10-01',amount:20,note:'Lend',accountId:'bank',person:'Alex'}),
      createEvent({kind:'card_purchase',date:'2026-10-01',amount:20,note:'Card'}),
    ]){
      const data=baseData();
      if(event.kind==='saving_cash_offset')event.savingAmount=19;
      if(event.kind==='lending')event.receivableDelta=19;
      if(event.kind==='card_purchase')event.creditDelta=-19;
      data.state.events=[event];
      expect(()=>validateFinanceStateSemantics(data.state)).toThrow();
    }
  });

  it('keeps reference checks at the full-document boundary',()=>{
    const data=baseData();
    const event=createEvent({kind:'expense',date:'2026-10-01',amount:10,note:'Unknown account',accountId:'missing'});
    data.state.events=[event];
    expect(()=>validateFinanceStateSemantics(data.state)).not.toThrow();
    expect(()=>validateCompleteFinanceSemantics(data)).toThrowError(/account reference/i);
  });

  it.each([
    ['scheduled', (data:FinanceData)=>{data.state.scheduled=[{id:'s1',dueDate:'2026-10-02',kind:'expense',amount:10,note:'Due',accountId:'missing',status:'pending',createdAt:data.updatedAt,updatedAt:data.updatedAt}]}],
    ['recurring', (data:FinanceData)=>{data.state.recurringCustom=[{id:'r1',name:'Recurring',amount:10,day:2,accountId:'missing',category:'Άλλο',active:true}]}],
    ['loan', (data:FinanceData)=>{data.state.customLoans=[{id:'l1',name:'Loan',total:100,installment:10,installments:10,defaultAccountId:'missing'}]}],
    ['rule', (data:FinanceData)=>{data.state.transactionRules=[{id:'rule1',name:'Rule',enabled:true,priority:1,scopes:['manual'],match:{accountId:'missing'},action:{category:'Άλλο'},createdAt:data.updatedAt,updatedAt:data.updatedAt}]}],
  ])('rejects dangling %s account references on full documents',(_label,mutate)=>{
    const data=baseData();
    mutate(data);
    expect(()=>validateCompleteFinanceSemantics(data)).toThrowError(/account reference/i);
  });

  it('accepts the synthetic credit-card ledger account only inside ledger legs',()=>{
    const data=baseData();
    data.state.events=[createEvent({kind:'card_purchase',date:'2026-10-01',amount:10,note:'Card'})];
    expect(()=>validateCompleteFinanceSemantics(data)).not.toThrow();
    data.state.settings.defaultExpenseAccount='credit-card';
    expect(()=>validateCompleteFinanceSemantics(data)).toThrowError(/account reference/i);
  });
});
