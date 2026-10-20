import {describe,expect,it} from 'vitest';
import {lendingSettlementProjection} from '../src/lib/lendingPlans.js';
import {lendingOutstandingFor} from '../src/lib/lending.js';
import {migrateData,monthlyFlow,netWorth} from '../src/lib/domain.js';
import type {FinanceData} from '../src/types.js';

const data=():FinanceData=>migrateData({
 app:'MyFinHub',schemaVersion:3,updatedAt:'2026-08-17T00:00:00Z',
 seed:{accounts:[{id:'cash',name:'Cash',kind:'cash'}],months:[],transactions:[],snapshots:[],
  recurring:[],subscriptions:[],loans:[],
  lending:[{person:'Alex',outstanding:100,entries:[{date:'2026-01-01',lent:100,repaid:0}]}],stats:{}},
 state:{customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},
  loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],settings:{
   excludedFromAvailable:[],accountNames:{},expenseCategories:['Άλλο'],incomeCategories:['Μισθός'],
   customPresets:[],pinnedPresets:[],defaultExpenseAccount:'cash',defaultIncomeAccount:'cash',defaultLoanAccount:'cash'},
  events:[],reviewDecisions:{}}
} as FinanceData);

describe('dated lending settlement proposal without phantom money (#588 B3)',()=>{
 it('distributes 100 EUR in 3 exact-cent future installments with month-end clamping',()=>{
  const d=data();
  const beforeWorth=netWorth(d,'2026-08-17'),beforeOutstanding=lendingOutstandingFor(d,'Alex','2026-08-17');
  const result=lendingSettlementProjection(d,{person:'Alex',asOf:'2026-08-17',firstDueDate:'2026-10-31',amount:100,installments:3});
  expect(result.schedule.map(x=>x.dueDate)).toEqual(['2026-10-31','2026-11-30','2026-12-31']);
  expect(result.schedule.map(x=>x.amount)).toEqual([33.33,33.33,33.34]);
  expect(Math.round(result.schedule.reduce((sum,x)=>sum+x.amount,0)*100)).toBe(10000);
  expect(result.note).toMatch(/καμία οικονομική κίνηση/);
  expect(d.state.events).toHaveLength(0);
  expect(netWorth(d,'2026-08-17')).toBe(beforeWorth);
  expect(lendingOutstandingFor(d,'Alex','2026-08-17')).toBe(beforeOutstanding);
  expect(monthlyFlow(d,'2026-10').income).toBe(0);
 });
 it('rejects plans larger than actual receivable and invalid dates or subcent amounts',()=>{
  const d=data(),base={person:'Alex',asOf:'2026-08-17',firstDueDate:'2026-09-01',amount:50,installments:5};
  expect(()=>lendingSettlementProjection(d,{...base,amount:100.01})).toThrow(/ξεπερνά/);
  expect(()=>lendingSettlementProjection(d,{...base,amount:50.001})).toThrow(/λεπτά/);
  expect(()=>lendingSettlementProjection(d,{...base,firstDueDate:'2026-08-16'})).toThrow(/ημερομηνία/);
  expect(()=>lendingSettlementProjection(d,{...base,installments:61})).toThrow(/δόσεων/);
  expect(()=>lendingSettlementProjection(d,{...base,person:'Unknown'})).toThrow(/απαίτηση/);
  expect(()=>lendingSettlementProjection(d,{...base,amount:0.03,installments:5})).toThrow(/τουλάχιστον/);
 });
});
