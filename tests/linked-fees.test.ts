import {describe,expect,it} from 'vitest';
import {accountBalances,createEvent,migrateData,monthlyFlow,netWorth} from '../src/lib/domain.js';
import {buildLinkedTransferFee,linkedFeeFor,replaceLinkedTransferWithFee} from '../src/lib/linkedFees.js';
import {validateCompleteFinanceSemantics,validateFinanceStateSemantics} from '../server/financeSemanticValidation.js';
import type {FinanceData} from '../src/types.js';

const fixture=():FinanceData=>migrateData({
  app:'MyFinHub',schemaVersion:3,updatedAt:'2026-08-17T00:00:00Z',
  seed:{accounts:[{id:'bank',name:'Bank',kind:'bank'},{id:'cash',name:'Cash',kind:'cash'}],
    months:[],transactions:[],snapshots:[{date:'2026-08-01',balances:{bank:1000,cash:100}}],
    recurring:[],subscriptions:[],loans:[],lending:[],stats:{}},
  state:{customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},
    loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],
    settings:{excludedFromAvailable:[],accountNames:{},expenseCategories:['Άλλο','Τραπεζικά έξοδα'],incomeCategories:['Μισθός'],
    customPresets:[],pinnedPresets:[],defaultExpenseAccount:'bank',defaultIncomeAccount:'bank',defaultLoanAccount:'bank'},
    events:[],reviewDecisions:{}}
} as FinanceData);

describe('single-revision linked fees on internal movements (#588 B2)',()=>{
  it('accounts only the fee as spending and keeps transfer internal',()=>{
    const d=fixture();
    const transfer=createEvent({kind:'transfer',date:'2026-08-12',amount:100,note:'Transfer',fromAccountId:'bank',toAccountId:'cash'});
    const fee=buildLinkedTransferFee(d,transfer,{amount:1.25,category:'Τραπεζικά έξοδα'});
    expect(fee).toMatchObject({kind:'expense',amount:1.25,accountId:'bank',feeForEventId:transfer.id});
    const next=replaceLinkedTransferWithFee(d,transfer,fee);
    expect(next.state.events).toHaveLength(2);
    expect(linkedFeeFor(next,transfer.id)?.id).toBe(fee?.id);
    expect(accountBalances(next,'2026-08-12')).toMatchObject({bank:898.75,cash:200});
    expect(monthlyFlow(next,'2026-08')).toMatchObject({income:0,expense:1.25,net:-1.25});
    expect(netWorth(next,'2026-08-12')).toBeCloseTo(netWorth(d,'2026-08-12')-1.25,2);
    expect(()=>validateCompleteFinanceSemantics(next)).not.toThrow();
  });
  it('edits principal and fee with stable IDs, then removes fee in the same reducer',()=>{
    const d=fixture(),t=createEvent({kind:'transfer',date:'2026-08-12',amount:.3,note:'T',fromAccountId:'bank',toAccountId:'cash'});
    let state=replaceLinkedTransferWithFee(d,t,buildLinkedTransferFee(d,t,{amount:.1,category:'Άλλο'}));
    const existingFeeId=linkedFeeFor(state,t.id)?.id;
    const t2={...t,amount:.4,legs:[{accountId:'bank',amount:-.4},{accountId:'cash',amount:.4}]};
    const fee2=buildLinkedTransferFee(state,t2,{amount:.2,category:'Άλλο'});
    expect(fee2?.id).toBe(existingFeeId);
    state=replaceLinkedTransferWithFee(state,t2,fee2);
    expect(state.state.events).toHaveLength(2);
    expect(accountBalances(state,'2026-08-12').bank).toBeCloseTo(999.4,2);
    expect(monthlyFlow(state,'2026-08').expense).toBeCloseTo(.2,2);
    expect(()=>validateFinanceStateSemantics(state.state)).not.toThrow();
    state=replaceLinkedTransferWithFee(state,t2,null);
    expect(state.state.events).toHaveLength(1);
    expect(monthlyFlow(state,'2026-08').expense).toBe(0);
  });
  it('rejects orphan, duplicate, fake-account and mismatched-date linked fees',()=>{
    const d=fixture(),t=createEvent({kind:'transfer',date:'2026-08-12',amount:25,note:'T',fromAccountId:'bank',toAccountId:'cash'});
    const fee=buildLinkedTransferFee(d,t,{amount:1,category:'Άλλο'})!;
    for(const damaged of [
      {...fee,feeForEventId:'missing'},
      {...fee,date:'2026-08-13'},
      {...fee,accountId:'cash',legs:[{accountId:'cash',amount:-1}]},
    ]){
      const state={...d.state,events:[t,damaged]};
      expect(()=>validateFinanceStateSemantics(state)).toThrow();
    }
    expect(()=>validateFinanceStateSemantics({...d.state,events:[t,fee,{...fee,id:'duplicate'}]})).toThrow(/Duplicate linked fee/);
    expect(()=>replaceLinkedTransferWithFee(d,t,{...fee,accountId:'cash'})).toThrow();
    expect(()=>buildLinkedTransferFee(d,t,{amount:-.01,category:'Άλλο'})).toThrow();
    expect(()=>buildLinkedTransferFee(d,t,{amount:1,category:'missing'})).toThrow();
  });
 it('links optional card-payment fee to the same payer account without double-card expense',()=>{
  const d=fixture();
  const payment=createEvent({kind:'card_payment',date:'2026-08-14',amount:80,
    note:'Payment',cardId:'credit1',fromAccountId:'bank'});
  const fee=buildLinkedTransferFee(d,payment,{amount:1.01,category:'Άλλο'});
  const state=replaceLinkedTransferWithFee(d,payment,fee);
  expect(state.state.events).toHaveLength(2);
  expect(fee).toMatchObject({feeForEventId:payment.id,accountId:'bank',kind:'expense',amount:1.01});
  expect(monthlyFlow(state,'2026-08')).toMatchObject({income:0,expense:1.01,net:-1.01});
  expect(()=>validateFinanceStateSemantics(state.state)).not.toThrow();
  expect(()=>validateCompleteFinanceSemantics(state)).not.toThrow();
 });

});
