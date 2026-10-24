import {describe,expect,it} from 'vitest';
import {migrateData,accountBalances,monthlyFlow} from '../src/lib/domain.js';
import {savingsGoalProjection} from '../src/lib/goalProjections.js';
import type {FinanceData,SavingsGoal} from '../src/types.js';

const fixture=():FinanceData=>migrateData({
 app:'RheomIQ',schemaVersion:3,updatedAt:'2026-10-21T00:00:00.000Z',
 seed:{accounts:[{id:'bank',kind:'bank',name:'Current'},{id:'savings',kind:'savings',name:'Savings'}],
  months:[],transactions:[],snapshots:[{date:'2026-10-21',balances:{bank:200,savings:100}}],
  recurring:[],subscriptions:[],loans:[],lending:[],stats:{}},
 state:{customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},
   loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],events:[],
   settings:{excludedFromAvailable:[],accountNames:{},expenseCategories:['Άλλο'],incomeCategories:['Μισθός'],
    customPresets:[],pinnedPresets:[],defaultExpenseAccount:'bank',defaultIncomeAccount:'bank',defaultLoanAccount:'bank'},
   scheduled:[{id:'due',kind:'expense',status:'pending',dueDate:'2026-11-15',amount:150,note:'Actual confirmed due',accountId:'bank',
      createdAt:'2026-10-21T00:00:00Z',updatedAt:'2026-10-21T00:00:00Z'}],reviewDecisions:{}}
} as FinanceData);
const goal=(target:number,date:string|null='2027-01-21'):SavingsGoal=>({
 id:'home',name:'Home',targetAmount:target,targetDate:date,
 createdAt:'2026-10-21T00:00:00Z',updatedAt:'2026-10-21T00:00:00Z'
});
describe('advisory target-date savings goal projection (#588 #13 E1)',()=>{
 it('suggests exact monthly cents from shared actual savings and flags known near-term obligations without booking money',()=>{
  const d=fixture(),before=JSON.stringify(d);
  const projected=savingsGoalProjection(d,goal(400),'2026-10-21',110);
  expect(projected).toMatchObject({
    status:'active',target:400,sharedSavingsBalance:100,remaining:300,
    contributionMonths:3,suggestedMonthly:100,operatingLiquidityMinimum90d:50,
    knownObligationCount90d:1,forecastCompleteness:'known_movements',suggestedContributionRisk:'liquidity_warning'
  });
  expect(projected.scenarios).toEqual([
    {label:'none',monthly:0,totalAtDeadline:100,gapAtDeadline:300},
    {label:'suggested',monthly:100,totalAtDeadline:400,gapAtDeadline:0},
    {label:'custom',monthly:110,totalAtDeadline:430,gapAtDeadline:0}
  ]);
  expect(JSON.stringify(d)).toBe(before);
  expect(accountBalances(d,'2026-10-21')).toMatchObject({bank:200,savings:100});
  expect(monthlyFlow(d,'2026-11').income).toBe(0);
 });
 it('rounds small remaining goal to cents without fractional-cent contribution or future posted event',()=>{
  const d=fixture();
  const p=savingsGoalProjection(d,goal(100.01),'2026-10-21');
  expect(p.remaining).toBeCloseTo(.01,2);
  expect(p.suggestedMonthly).toBeCloseTo(.01,2);
  expect(p.scenarios.find(x=>x.label==='suggested')).toEqual({label:'suggested',monthly:.01,totalAtDeadline:100.03,gapAtDeadline:0});
  expect(d.state.events).toHaveLength(0);
 });
 it('avoids inventing due dates or contributions for undated, overdue and due-today goals',()=>{
  const d=fixture();
  for(const [date,status] of [[null,'undated'],['2026-10-20','overdue'],['2026-10-21','due_today']] as const){
    const result=savingsGoalProjection(d,goal(400,date),'2026-10-21');
    expect(result.status).toBe(status);
    expect(result.suggestedMonthly).toBeNull();
    expect(result.contributionMonths).toBeNull();
    expect(result.scenarios).toHaveLength(0);
  }
  expect(savingsGoalProjection(d,goal(50,'2026-10-01'),'2026-10-21')).toMatchObject({status:'reached',remaining:0,suggestedMonthly:0});
 });
 it('rejects an unsafe accumulated scenario instead of silently capping valid monthly euros',()=>{
  const d=fixture(),before=JSON.stringify(d);
  // 40 trillion EUR per month is individually safe in cents, but 3 months
  // exceed JavaScript's safe exact-cent integer range.
  expect(()=>savingsGoalProjection(d,goal(400),'2026-10-21',40_000_000_000_000)).toThrow(/ορίου/);
  expect(savingsGoalProjection(d,goal(400),'2026-10-21',110).scenarios.find(x=>x.label==='custom'))
    .toMatchObject({monthly:110,totalAtDeadline:430,gapAtDeadline:0});
  expect(JSON.stringify(d)).toBe(before);
 });
 it('rejects unsafe or sub-cent target/scenario amounts and invalid dates',()=>{
  const d=fixture();
  expect(()=>savingsGoalProjection(d,goal(100.001),'2026-10-21')).toThrow(/λεπτά/);
  expect(()=>savingsGoalProjection(d,goal(0),'2026-10-21')).toThrow(/λεπτά/);
  expect(()=>savingsGoalProjection(d,goal(400),'2026-10-21',1.001)).toThrow(/λεπτά/);
  expect(()=>savingsGoalProjection(d,goal(400,'2026-02-30'),'2026-10-21')).toThrow(/προθεσμία/);
  expect(()=>savingsGoalProjection(d,goal(400),'invalid')).toThrow(/ημερομηνία/);
 });
});
