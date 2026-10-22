import {describe,expect,it} from 'vitest';
import {createEvent,accountBalances,monthlyFlow,netWorth,migrateData} from '../src/lib/domain.js';
import {lendingHistory,lendingOutstandingFor} from '../src/lib/lending.js';
import {validateCompleteFinanceSemantics,validateFinanceStateSemantics} from '../server/financeSemanticValidation.js';
import type {FinanceData} from '../src/types.js';

const fixture=():FinanceData=>migrateData({
 app:'MyFinHub',schemaVersion:3,updatedAt:'2026-08-17T00:00:00Z',
 seed:{accounts:[{id:'cash',kind:'cash',name:'Cash'}],months:[],transactions:[],snapshots:[{date:'2026-08-01',balances:{cash:500}}],recurring:[],subscriptions:[],loans:[],lending:[{person:'Alex',outstanding:100,entries:[]}],stats:{}},
 state:{customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],events:[],settings:{excludedFromAvailable:[],accountNames:{},expenseCategories:['Άλλο'],incomeCategories:['Μισθός'],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'cash',defaultIncomeAccount:'cash',defaultLoanAccount:'cash'},reviewDecisions:{}}
} as FinanceData);

describe('noncash receivable writeoffs preserve accounting (#588 B3)',()=>{
 it('reduces only the receivable/net worth, not cash, personal expense or income',()=>{
  const d=fixture(),before=netWorth(d,'2026-08-17');
  const event=createEvent({kind:'lending_writeoff',date:'2026-08-12',person:'Alex',amount:30.25,note:'Owner confirmed'});
  expect(event).toMatchObject({receivableDelta:-30.25,legs:[]});
  d.state.events=[event];
  expect(lendingOutstandingFor(d,'Alex','2026-08-11')).toBe(100);
  expect(lendingOutstandingFor(d,'Alex','2026-08-12')).toBeCloseTo(69.75,2);
  expect(lendingHistory(d,'2026-08-12')).toContainEqual(expect.objectContaining({action:'forgiven',amount:30.25,origin:'event'}));
  expect(accountBalances(d,'2026-08-17').cash).toBe(500);
  expect(monthlyFlow(d,'2026-08')).toMatchObject({income:0,expense:0,net:0});
  expect(netWorth(d,'2026-08-17')).toBeCloseTo(before-30.25,2);
  expect(()=>validateCompleteFinanceSemantics(d)).not.toThrow();
 });
 it('rejects over-writeoff and malformed cash/delta tampering',()=>{
  const d=fixture(),item=createEvent({kind:'lending_writeoff',date:'2026-08-12',person:'Alex',amount:95,note:'Partial'});
  d.state.events=[item,createEvent({kind:'repayment',date:'2026-08-12',person:'Alex',amount:10,note:'repayment',accountId:'cash'})];
  expect(()=>validateCompleteFinanceSemantics(d)).toThrow(/exceeds as-of/);
  const later=fixture();
  later.state.events=[
    createEvent({kind:'lending_writeoff',date:'2026-08-12',person:'Alex',amount:80,note:'Writeoff'}),
    createEvent({kind:'repayment',date:'2026-08-19',person:'Alex',amount:30,note:'Future repayment',accountId:'cash'})
  ];
  expect(()=>validateCompleteFinanceSemantics(later)).toThrow(/exceeds outstanding/);
  expect(()=>validateFinanceStateSemantics({...d.state,events:[{...item,legs:[{accountId:'cash',amount:-95}]}]})).toThrow();
  expect(()=>validateFinanceStateSemantics({...d.state,events:[{...item,receivableDelta:undefined}]})).toThrow();
  expect(()=>createEvent({kind:'lending_writeoff',date:'2026-08-12',person:'',amount:2,note:'Bad'})).toThrow();
  expect(()=>createEvent({kind:'lending_writeoff',date:'2026-08-12',person:'Alex',amount:2,note:'Bad',accountId:'cash'})).toThrow();
  expect(()=>createEvent({kind:'lending_writeoff',date:'2026-08-12',person:'Alex',amount:2.001,note:'Sub-cent'})).toThrow(/λεπτά ευρώ/);
  for(const forged of [
    {...item,amount:95.001},
    {...item,receivableDelta:-95.001},
    {...item,loanId:'loan-from-other-contract'},
    {...item,cardId:'card-from-other-contract'},
    {...item,feeForEventId:'transfer-from-other-contract'},
    {...item,parts:[{id:'part-1',label:'Forged split',category:'Άλλο',amount:95}]},
    {...item,parts:[]},
    {...item,funding:[]},
  ]){
    expect(()=>validateFinanceStateSemantics({...d.state,events:[forged]})).toThrow();
  }
 });
 it('undo restores historic receivable without changing seeded legacy history',()=>{
  const d=fixture(),seed=JSON.stringify(d.seed.lending);
  const action=createEvent({kind:'lending_writeoff',date:'2026-08-17',person:'Alex',amount:25,note:'Owner signed'});
  const next={...d,state:{...d.state,events:[action]}};
  expect(lendingOutstandingFor(next,'Alex','2026-08-17')).toBe(75);
  const undone={...next,state:{...next.state,events:next.state.events.filter(e=>e.id!==action.id)}};
  expect(lendingOutstandingFor(undone,'Alex','2026-08-17')).toBe(100);
  expect(JSON.stringify(undone.seed.lending)).toBe(seed);
 });
});
