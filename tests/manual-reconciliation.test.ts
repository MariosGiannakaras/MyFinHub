import {describe,expect,it} from 'vitest';
import {createEvent,accountBalances,monthlyFlow,netWorth,migrateData} from '../src/lib/domain.js';
import {manualReconciliationPreview,manualReconciliationDraftError} from '../src/lib/manualReconciliation.js';
import type {FinanceData} from '../src/types.js';

const fixture=():FinanceData=>migrateData({
 app:'MyFinHub',schemaVersion:3,updatedAt:'2026-09-01T00:00:00Z',
 seed:{accounts:[{id:'bank',kind:'bank',name:'Bank'},{id:'cash',kind:'cash',name:'Cash'}],months:[],transactions:[],snapshots:[{date:'2026-08-01',balances:{bank:1000,cash:200}}],recurring:[],subscriptions:[],loans:[],lending:[],stats:{}},
 state:{customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],settings:{excludedFromAvailable:[],accountNames:{},expenseCategories:['Άλλο'],incomeCategories:['Μισθός'],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'bank',defaultIncomeAccount:'bank',defaultLoanAccount:'bank'},events:[],reviewDecisions:{}}
} as FinanceData);

describe('manual verified as-of reconciliation (#588 B4)',()=>{
 it('compares against date-selected canonical movements, excluding future transfers',()=>{
  const d=fixture();
  d.state.events=[
   createEvent({kind:'expense',date:'2026-08-10',amount:10.25,note:'Older expense',accountId:'bank'}),
   createEvent({kind:'transfer',date:'2026-08-22',amount:100,note:'Future transfer',fromAccountId:'bank',toAccountId:'cash'}),
  ];
  const atDate=manualReconciliationPreview(d,'bank','2026-08-12',{verifiedBalance:985.75,statementMovement:10.25});
  expect(atDate.expectedBalance).toBe(989.75);
  expect(atDate.differenceCents).toBe(-400);
  expect(atDate.candidates).toHaveLength(1);
  expect(atDate.candidates[0]).toMatchObject({sameAmount:true,amount:-10.25});
  expect(manualReconciliationDraftError(atDate,false)).toMatch(/Επιβεβαίωσε/);
  expect(manualReconciliationDraftError(atDate,true)).toBeNull();
  const now=manualReconciliationPreview(d,'bank','2026-08-23',{verifiedBalance:885.75});
  expect(now.expectedBalance).toBe(889.75);
 });
 it('creates non-spending cent-exact adjustment once, preserving income and expenses',()=>{
  const d=fixture();const before=netWorth(d,'2026-08-17');
  const preview=manualReconciliationPreview(d,'bank','2026-08-17',{verifiedBalance:997.99});
  const e=createEvent({kind:'reconciliation',date:'2026-08-17',amount:Math.abs(preview.differenceCents!)/100,note:'Checked statement',accountId:'bank',actualBalance:997.99,currentBalance:preview.expectedBalance});
  d.state.events=[e];
  expect(e.legs).toHaveLength(1);
  expect(e.legs[0]?.accountId).toBe('bank');
  expect(e.legs[0]?.amount).toBeCloseTo(-2.01,2);
  expect(accountBalances(d,'2026-08-17').bank).toBeCloseTo(997.99,2);
  expect(monthlyFlow(d,'2026-08')).toMatchObject({income:0,expense:0,net:0});
  expect(netWorth(d,'2026-08-17')).toBeCloseTo(before-2.01,2);
 });
 it('computes an edited reconciliation against its excluded old event (even with a new date)',()=>{
  const d=fixture();
  const old=createEvent({kind:'reconciliation',date:'2026-08-10',amount:4,note:'Old',accountId:'bank',actualBalance:1004,currentBalance:1000});
  d.state.events=[old];
  expect(manualReconciliationPreview(d,'bank','2026-08-11',{verifiedBalance:1007,editingEventId:old.id}).differenceCents).toBe(700);
  expect(manualReconciliationPreview(d,'bank','2026-08-09',{verifiedBalance:1007,editingEventId:old.id}).differenceCents).toBe(700);
 });
 it('prevents same-date duplicate and zero-delta phantom adjustments',()=>{
  const d=fixture();const once=createEvent({kind:'reconciliation',date:'2026-08-10',amount:1,note:'One',accountId:'bank',actualBalance:999,currentBalance:1000});d.state.events=[once];
  const again=manualReconciliationPreview(d,'bank','2026-08-10',{verifiedBalance:995});
  expect(again.duplicateOnDate).toBe(true);
  expect(manualReconciliationDraftError(again,true)).toMatch(/ήδη/);
  const edited=manualReconciliationPreview(d,'bank','2026-08-10',{verifiedBalance:1000,editingEventId:once.id});
  expect(edited.duplicateOnDate).toBe(false);
  expect(manualReconciliationDraftError(edited,true)).toMatch(/Δεν υπάρχει διαφορά/);
  expect(()=>createEvent({kind:'reconciliation',date:'2026-08-11',amount:0,note:'Zero',accountId:'bank',actualBalance:1000,currentBalance:1000})).toThrow(/Δεν υπάρχει διαφορά/);
 });
 it('ignores future candidates and rejects invalid/stale accounts or invalid verification amount',()=>{
  const d=fixture();
  expect(()=>manualReconciliationPreview(d,'missing','2026-08-14',{verifiedBalance:1000})).toThrow(/λογαριασμό/);
  expect(()=>manualReconciliationPreview(d,'bank','not a date',{verifiedBalance:1000})).toThrow(/ημερομηνία/);
  expect(()=>manualReconciliationPreview(d,'bank','2026-08-14',{verifiedBalance:Number.NaN})).toThrow(/υπόλοιπο/);
  expect(()=>manualReconciliationPreview(d,'bank','2026-08-14',{statementMovement:-2})).toThrow(/θετικό/);
 });
});
