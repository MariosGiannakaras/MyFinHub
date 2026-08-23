import { describe, expect, it } from 'vitest';
import { accountBalances, categoryTotals, migrateData, monthlyFlow, netWorth } from '../src/lib/domain.js';
import {
  createExpenseSplitEvent,
  createTransferEvent,
  defaultTransferPair,
  splitAllocation,
  splitDraftError,
  transferDraftError,
} from '../src/lib/ledgerFoundations.js';
import type { FinanceData, SplitPart } from '../src/types.js';

const minimal = (): FinanceData => migrateData({
  app:'MyFinHub',schemaVersion:3,updatedAt:'2026-08-21T00:00:00Z',
  seed:{
    accounts:[
      {id:'cash',name:'Μετρητά',kind:'cash'},
      {id:'bank',name:'Κύριος',kind:'bank'},
      {id:'savings',name:'Ταμιευτήριο',kind:'savings',excludeFromAvailable:true},
    ],
    months:['2026-08'],transactions:[],snapshots:[{date:'2026-08-01',balances:{cash:100,bank:1000,savings:500}}],
    recurring:[],subscriptions:[],loans:[],lending:[],stats:{},
  },
  state:{
    customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],
    settings:{excludedFromAvailable:['savings'],accountNames:{},expenseCategories:['Σπίτι','Φαγητό','Άλλο'],incomeCategories:['Μισθός'],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'bank',defaultIncomeAccount:'bank',defaultLoanAccount:'bank'},
    events:[],reviewDecisions:{},
  },
} as FinanceData);

const splitParts = (): SplitPart[] => [
  {id:'a',label:'Σούπερ μάρκετ',category:'Φαγητό',amount:70},
  {id:'b',label:'Καθαριστικά',category:'Σπίτι',amount:30},
];

describe('ledger foundations', () => {
  it('chooses a valid transfer pair from current accounts', () => {
    const data = minimal();
    expect(defaultTransferPair(data)).toEqual({ from: 'bank', to: 'savings' });
  });

  it('rejects same, stale and credit transfer endpoints', () => {
    const data = minimal();
    expect(transferDraftError(data,{fromAccountId:'bank',toAccountId:'bank',amount:10})).toMatch(/διαφορετικοί/);
    expect(transferDraftError(data,{fromAccountId:'missing',toAccountId:'savings',amount:10})).toMatch(/υπαρκτό λογαριασμό προέλευσης/);
    expect(transferDraftError(data,{fromAccountId:'bank',toAccountId:'credit-card',amount:10})).toMatch(/υπαρκτό λογαριασμό προορισμού/);
  });

  it('creates one atomic zero-sum transfer without changing cash-flow or net worth', () => {
    const data = minimal();
    const beforeWorth = netWorth(data,'2026-08-21');
    const event = createTransferEvent(data,{date:'2026-08-21',amount:125.55,note:'Μεταφορά',fromAccountId:'bank',toAccountId:'savings'});
    expect(event.kind).toBe('transfer');
    expect(event.legs).toEqual([{accountId:'bank',amount:-125.55},{accountId:'savings',amount:125.55}]);
    data.state.events=[event];
    expect(monthlyFlow(data,'2026-08')).toMatchObject({income:0,expense:0,net:0});
    expect(accountBalances(data,'2026-08-21')).toMatchObject({bank:874.45,savings:625.55});
    expect(netWorth(data,'2026-08-21')).toBeCloseTo(beforeWorth,2);
  });

  it('derives split totals in cents without floating-point drift', () => {
    const allocation=splitAllocation([
      {id:'a',label:'A',category:'Άλλο',amount:0.1},
      {id:'b',label:'B',category:'Άλλο',amount:0.2},
    ]);
    expect(allocation.totalCents).toBe(30);
    expect(allocation.total).toBe(0.3);
  });

  it('creates one split parent whose amount and analytics come only from its parts', () => {
    const data=minimal();
    const event=createExpenseSplitEvent(data,{date:'2026-08-21',note:'Μικτή αγορά',accountId:'bank',parts:splitParts()});
    data.state.events=[event];
    expect(event.amount).toBe(100);
    expect(event.category).toBeUndefined();
    expect(event.subcategory).toBeUndefined();
    expect(event.legs).toEqual([{accountId:'bank',amount:-100}]);
    expect(event.parts?.every(part=>part.kind==='expense')).toBe(true);
    expect(monthlyFlow(data,'2026-08').expense).toBe(100);
    expect(categoryTotals(data,'2026-08')).toEqual([
      {name:'Φαγητό',value:70},
      {name:'Σπίτι',value:30},
    ]);
    expect(accountBalances(data,'2026-08-21').bank).toBe(900);
  });

  it('requires at least two positive split parts and a current account', () => {
    const data=minimal();
    expect(splitDraftError(data,{accountId:'bank',parts:[{id:'a',label:'A',category:'Άλλο',amount:10}]})).toMatch(/τουλάχιστον δύο/);
    expect(splitDraftError(data,{accountId:'bank',parts:[splitParts()[0],{...splitParts()[1],amount:0}]})).toMatch(/μέρος 2.*θετικό/);
    expect(splitDraftError(data,{accountId:'missing',parts:splitParts()})).toMatch(/υπαρκτό λογαριασμό πληρωμής/);
  });
});