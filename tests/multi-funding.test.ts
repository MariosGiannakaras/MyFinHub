import {describe,expect,it} from 'vitest';
import {buildMultiSourceFundingPlan} from '../src/lib/multiFunding.js';
import {migrateData} from '../src/lib/domain.js';
import type {FinanceData} from '../src/types.js';

const data=():FinanceData=>migrateData({
 app:'MyFinHub',schemaVersion:3,updatedAt:'2026-08-17T00:00:00Z',
 seed:{accounts:[{id:'cash',name:'Cash',kind:'cash'},{id:'bank',name:'Bank',kind:'bank'}],
  months:[],transactions:[],snapshots:[],recurring:[],subscriptions:[],loans:[],lending:[],stats:{}},
 state:{customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],
  cards:[{id:'credit1',bankId:'bank',nickname:'Credit',kind:'credit',network:'visa',active:true,createdAt:'2026-08-01T00:00:00Z',updatedAt:'2026-08-01T00:00:00Z'}],
  settings:{excludedFromAvailable:[],accountNames:{},expenseCategories:['Άλλο'],incomeCategories:['Μισθός'],
   customPresets:[],pinnedPresets:[],defaultExpenseAccount:'bank',defaultIncomeAccount:'bank',defaultLoanAccount:'bank'},
  events:[],reviewDecisions:{}}
} as FinanceData);

describe('one economic purchase funded from multiple sources (#588 B1 preflight)',()=>{
 it('conserves 100 EUR in exact cents and charges credit only the actual portion',()=>{
  const result=buildMultiSourceFundingPlan(data(),{total:100,sources:[
   {kind:'account',accountId:'cash',amount:19.99},
   {kind:'account',accountId:'bank',amount:20.01},
   {kind:'credit',cardId:'credit1',amount:60}
  ]});
  expect(result.total).toBe(100);
  expect(result.creditAmount).toBe(60);
  expect(result.creditDelta).toBe(-60);
  expect(result.cardId).toBe('credit1');
  expect(result.legs).toEqual([{accountId:'cash',amount:-19.99},{accountId:'bank',amount:-20.01},{accountId:'credit-card',amount:-60}]);
  expect(Math.round(result.legs.reduce((sum,leg)=>sum+leg.amount,0)*100)).toBe(-10000);
 });
 it('supports cash plus bank without inventing credit liability',()=>{
  const result=buildMultiSourceFundingPlan(data(),{total:.3,sources:[
   {kind:'account',accountId:'cash',amount:.1},
   {kind:'account',accountId:'bank',amount:.2}
  ]});
  expect(result.creditAmount).toBe(0);
  expect(result.creditDelta).toBe(0);
  expect(result.cardId).toBeUndefined();
  expect(result.legs).toEqual([{accountId:'cash',amount:-.1},{accountId:'bank',amount:-.2}]);
 });
 it('rejects duplicate accounts, stale cards, missing sources and subcent fractions',()=>{
  const d=data();
  const valid=[{kind:'account' as const,accountId:'cash',amount:10},{kind:'account' as const,accountId:'bank',amount:10}];
  expect(()=>buildMultiSourceFundingPlan(d,{total:20,sources:[valid[0],valid[0]]})).toThrow(/ίδια πηγή/);
  expect(()=>buildMultiSourceFundingPlan(d,{total:19.99,sources:valid})).toThrow(/ακριβώς/);
  expect(()=>buildMultiSourceFundingPlan(d,{total:20,sources:[valid[0],{kind:'credit',cardId:'old',amount:10}]})).toThrow(/ενεργή/);
  expect(()=>buildMultiSourceFundingPlan(d,{total:20,sources:[{...valid[0],accountId:'ghost'},valid[1]]})).toThrow(/υπαρκτό/);
  expect(()=>buildMultiSourceFundingPlan(d,{total:20.001,sources:valid})).toThrow(/λεπτά/);
  expect(()=>buildMultiSourceFundingPlan(d,{total:20,sources:[{...valid[0],amount:10.001},valid[1]]})).toThrow(/λεπτά/);
  d.state.cards![0]!.active=false;
  expect(()=>buildMultiSourceFundingPlan(d,{total:20,sources:[valid[0],{kind:'credit',cardId:'credit1',amount:10}]})).toThrow(/ενεργή/);
 });
});
