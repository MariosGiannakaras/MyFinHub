import {describe,expect,it} from 'vitest';
import {accountBalances,categoryTotals,migrateData,monthlyFlow,netWorth} from '../src/lib/domain.js';
import {createMultiSourcePurchaseEvent} from '../src/lib/multiFunding.js';
import {creditDebtForCard} from '../src/lib/cards.js';
import {creditStatementViews,prepareCreditStatementEvent} from '../src/lib/creditStatements.js';
import {validateCompleteFinanceSemantics,validateFinanceStateSemantics} from '../server/financeSemanticValidation.js';
import {validateCardStateExtensions} from '../server/cardStateValidation.js';
import {validateCompleteFinanceData} from '../server/financeDataValidation.js';
import type {FinanceData} from '../src/types.js';

const fixture=():FinanceData=>migrateData({
 app:'MyFinHub',schemaVersion:3,updatedAt:'2026-08-01T00:00:00.000Z',
 seed:{accounts:[{id:'bank',name:'Bank',kind:'bank'},{id:'cash',name:'Cash',kind:'cash'}],months:[],transactions:[],
  snapshots:[{date:'2026-08-01',balances:{bank:1000,cash:100}}],recurring:[],subscriptions:[],loans:[],lending:[],stats:{}},
 state:{customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},loanExtra:{},loanOverrides:{},
  customLoans:[],lendingCustom:[],
  settings:{excludedFromAvailable:[],accountNames:{},expenseCategories:['Άλλο','Αγορές'],incomeCategories:['Μισθός'],
   customPresets:[],pinnedPresets:[],defaultExpenseAccount:'bank',defaultIncomeAccount:'bank',defaultLoanAccount:'bank'},
  cards:[{id:'credit1',kind:'credit',bankId:'bank',nickname:'Card',network:'visa',active:true,
   statementClosingDay:25,statementDueDay:10,statementBoundaryRule:'next-cycle',
   createdAt:'2026-08-01T00:00:00.000Z',updatedAt:'2026-08-01T00:00:00.000Z'}],
  events:[],creditStatements:[],reviewDecisions:{}}
} as FinanceData);

describe('single canonical multi-funded expense, credit share and as-of statements (#588 B1)',()=>{
 it('books one 100 EUR expense with 60 EUR real card liability across three sources',()=>{
  const d=fixture(),priorWorth=netWorth(d,'2026-08-17');
  const event=createMultiSourcePurchaseEvent(d,{date:'2026-08-17',amount:100,note:'Shared buy',category:'Αγορές',
   sources:[{kind:'account',accountId:'bank',amount:20.01},{kind:'account',accountId:'cash',amount:19.99},
    {kind:'credit',cardId:'credit1',amount:60}]});
  const prepared=prepareCreditStatementEvent(d,event);
  d.state.events=[prepared.event];d.state.creditStatements=prepared.statements;
  expect(event).toMatchObject({kind:'expense',amount:100,creditDelta:-60,cardId:'credit1'});
  expect(event.legs).toEqual([{accountId:'bank',amount:-20.01},{accountId:'cash',amount:-19.99},{accountId:'credit-card',amount:-60}]);
  expect(monthlyFlow(d,'2026-08')).toMatchObject({expense:100,income:0,net:-100});
  expect(categoryTotals(d,'2026-08')).toContainEqual({name:'Αγορές',value:100});
  expect(accountBalances(d,'2026-08-17')).toMatchObject({bank:979.99,cash:80.01,'credit-card':-60});
  expect(creditDebtForCard(d,'credit1','2026-08-16')).toBe(0);
  expect(creditDebtForCard(d,'credit1','2026-08-17')).toBe(60);
  expect(netWorth(d,'2026-08-17')).toBeCloseTo(priorWorth-100,2);
  const statements=creditStatementViews(d,'credit1','2026-08-17');
  expect(statements).toHaveLength(1);
  expect(statements[0]).toMatchObject({purchaseTotal:60,remaining:60,purchaseIds:[event.id]});
  expect(()=>validateFinanceStateSemantics(d.state)).not.toThrow();
  expect(()=>validateCompleteFinanceSemantics(d)).not.toThrow();
  expect(()=>validateCardStateExtensions(d.state)).not.toThrow();
  expect(()=>validateCompleteFinanceData(d)).not.toThrow();
 });
 it('accepts account-only mixed funding without card reference or phantom liability',()=>{
  const d=fixture();
  const e=createMultiSourcePurchaseEvent(d,{date:'2026-08-17',amount:.3,note:'small',category:'Αγορές',
   sources:[{kind:'account',accountId:'cash',amount:.1},{kind:'account',accountId:'bank',amount:.2}]});
  d.state.events=[e];
  expect(e.cardId).toBeUndefined();expect(e.creditDelta).toBe(0);
  expect(creditDebtForCard(d,'credit1','2026-08-17')).toBe(0);
  expect(monthlyFlow(d,'2026-08').expense).toBe(.3);
  expect(()=>validateCompleteFinanceSemantics(d)).not.toThrow();
 });
 it('rejects credit share tampering, duplicate funding, different ledger legs and orphan card metadata',()=>{
  const d=fixture();
  const good=createMultiSourcePurchaseEvent(d,{date:'2026-08-17',amount:100,note:'Buy',category:'Αγορές',
    sources:[{kind:'account',accountId:'bank',amount:40},{kind:'credit',cardId:'credit1',amount:60}]});
  const reject=(event:typeof good)=>expect(()=>validateFinanceStateSemantics({...d.state,events:[event]})).toThrow();
  reject({...good,creditDelta:-100});
  reject({...good,amount:120});
  reject({...good,legs:[{accountId:'bank',amount:-100},{accountId:'credit-card',amount:-60}]});
  reject({...good,funding:[...good.funding!,good.funding![0]!]});
  reject({...good,cardId:undefined});
  expect(()=>validateCardStateExtensions({...d.state,events:[{...good,cardId:'absent'}]})).toThrow();
  d.state.cards![0]!.kind='debit';
  expect(()=>validateCardStateExtensions({...d.state,events:[good]})).toThrow();
 });
});
