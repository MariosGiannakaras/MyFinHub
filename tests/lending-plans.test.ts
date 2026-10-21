import {describe,expect,it} from 'vitest';
import {lendingSettlementProjection,withConfirmedLendingPlan} from '../src/lib/lendingPlans.js';
import {validateFinanceData} from '../server/validation.js';
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
 it('saves one confirmed mutable plan, revises its stable ID, and never posts money',()=>{
  const initial=data();
  const before=netWorth(initial,'2026-08-17');
  const draft={person:'Alex',asOf:'2026-08-17',firstDueDate:'2026-09-30',amount:33.33,installments:3,everyMonths:1};
  expect(()=>withConfirmedLendingPlan(initial,draft,false)).toThrow(/επιβεβαίωση/);
  const created=withConfirmedLendingPlan(initial,draft,true);
  expect(created.state.lendingPlans).toHaveLength(1);
  expect(created.state.lendingPlans![0]).toMatchObject({person:'Alex',total:33.33,installments:3,firstDueDate:'2026-09-30'});
  expect(created.state.events).toHaveLength(0);
  expect(netWorth(created,'2026-08-17')).toBe(before);
  expect(monthlyFlow(created,'2026-09').income).toBe(0);
  expect(()=>validateFinanceData(created)).not.toThrow();
  const changed=withConfirmedLendingPlan(created,{...draft,amount:50},true);
  expect(changed.state.lendingPlans).toHaveLength(1);
  expect(changed.state.lendingPlans![0]?.id).toBe(created.state.lendingPlans![0]?.id);
  expect(changed.state.lendingPlans![0]?.total).toBe(50);
  expect(created.state.lendingPlans![0]?.total).toBe(33.33);
  expect(initial.state.lendingPlans).toEqual([]);
 });
 it('rejects malformed or duplicated current plan documents at the server boundary',()=>{
  const initial=data();
  const draft={person:'Alex',asOf:'2026-08-17',firstDueDate:'2026-09-01',amount:40,installments:2,everyMonths:1};
  const saved=withConfirmedLendingPlan(initial,draft,true);
  for(const changes of [{total:40.001},{firstDueDate:'2026-07-01'},{everyMonths:0},{confirmedAt:'invalid'}]){
    const row={...saved.state.lendingPlans![0]!,...changes};
    expect(()=>validateFinanceData({...saved,state:{...saved.state,lendingPlans:[row]}})).toThrow();
  }
  const duplicate={...saved.state.lendingPlans![0]!,id:'another-plan'};
  expect(()=>validateFinanceData({...saved,state:{...saved.state,lendingPlans:[saved.state.lendingPlans![0]!,duplicate]}})).toThrow(/Multiple active/);
 });

});
