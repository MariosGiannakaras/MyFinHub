import { describe, expect, it } from 'vitest';
import { accountBalances, categoryTotals, createEvent, migrateData, monthlyFlow, netWorth } from '../src/lib/domain.js';
import {
  createExpenseSplitEvent,
  createTransferEvent,
  defaultTransferPair,
  defaultSavingContributionPair,
  savingContributionDraftError,
  splitAllocation,
  splitDraftError,
  transferDraftError,
} from '../src/lib/ledgerFoundations.js';
import type { FinanceData, SplitPart } from '../src/types.js';
import { creditDebtForCard } from '../src/lib/cards.js';
import { lendingOutstandingFor } from '../src/lib/lending.js';
import { loanPaidAmount, loanPaymentEvents } from '../src/lib/loans.js';
import { recurringPayments } from '../src/lib/recurring.js';

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

  it('prefers bank-categorized savings over a cash fallback for a transfer destination',()=>{
    const data=minimal();
    data.seed.accounts=data.seed.accounts.map(account=>account.id==='savings'
      ?{...account,kind:'bank',bankAccountCategory:'savings'}
      :account);
    expect(defaultTransferPair(data)).toEqual({from:'bank',to:'savings'});
  });

  it('separates savings contributions from ordinary transfers for bank-classified savings accounts',()=>{
    const data=minimal();
    data.seed.accounts=data.seed.accounts.map(account=>account.id==='savings'
      ?{...account,kind:'bank',bankAccountCategory:'savings'}
      :account);
    data.state.settings.defaultExpenseAccount='savings'; // stale preference must not become a Savings source
    expect(defaultSavingContributionPair(data)).toEqual({from:'bank',to:'savings'});
    expect(savingContributionDraftError(data,{fromAccountId:'bank',toAccountId:'savings',amount:100})).toBeNull();
    expect(savingContributionDraftError(data,{fromAccountId:'savings',toAccountId:'bank',amount:100})).toMatch(/τραπεζικό/);
    expect(savingContributionDraftError(data,{fromAccountId:'cash',toAccountId:'savings',amount:100})).toMatch(/τραπεζικό/);
    expect(savingContributionDraftError(data,{fromAccountId:'bank',toAccountId:'cash',amount:100})).toMatch(/αποταμιευτικό/);
    expect(savingContributionDraftError(data,{fromAccountId:'bank',toAccountId:'bank',amount:100})).toMatch(/διαφορετικοί/);
    // Ordinary transfer remains available even between savings-classified accounts.
    expect(transferDraftError(data,{fromAccountId:'savings',toAccountId:'bank',amount:100})).toBeNull();
  });

  it('uses only current/payroll banks as new Savings sources without removing ordinary cash transfers',()=>{
    const data=minimal();
    data.seed.accounts.push({id:'term-bank',name:'Term account',kind:'bank',bankAccountCategory:'term'});
    data.seed.accounts.push({id:'payment-bank',name:'Payment only',kind:'bank',bankAccountCategory:'payment'});
    data.seed.accounts.push({id:'current-bank',name:'Current',kind:'bank',bankAccountCategory:'current'});
    data.seed.accounts.push({id:'payroll-bank',name:'Payroll',kind:'bank',bankAccountCategory:'payroll'});
    for(const fromAccountId of ['cash','term-bank','payment-bank','savings']){
      // A savings source must use a distinct destination so the source-type
      // guard, rather than the earlier same-account guard, is exercised.
      const toAccountId=fromAccountId==='savings'?'bank':'savings';
      expect(savingContributionDraftError(data,{fromAccountId,toAccountId,amount:10})).toMatch(/τραπεζικό/);
      expect(transferDraftError(data,{fromAccountId,toAccountId:'bank',amount:10})).toBeNull();
    }
    for(const fromAccountId of ['bank','current-bank','payroll-bank']){
      expect(savingContributionDraftError(data,{fromAccountId,toAccountId:'savings',amount:10})).toBeNull();
    }
    data.state.settings.defaultExpenseAccount='cash';
    data.state.settings.defaultIncomeAccount='term-bank';
    expect(defaultSavingContributionPair(data)).toEqual({from:'bank',to:'savings'});
    data.state.settings.defaultIncomeAccount='payroll-bank';
    expect(defaultSavingContributionPair(data)).toEqual({from:'payroll-bank',to:'savings'});
    data.seed.accounts=data.seed.accounts.filter(account=>account.kind!=='bank'||account.bankAccountCategory==='term');
    expect(defaultSavingContributionPair(data).from).toBe('');
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

  it('books a credit purchase once while repayment only moves cash against the liability (#649 I08.05)',()=>{
    const data=minimal(),before=netWorth(data,'2026-08-21');
    const purchase=createEvent({kind:'card_purchase',date:'2026-08-21',amount:120,note:'Credit purchase',cardId:'card-contract'});
    const payment=createEvent({kind:'card_payment',date:'2026-08-21',amount:60,note:'Card settlement',fromAccountId:'bank',cardId:'card-contract'});
    data.state.events=[purchase];
    expect(purchase.legs).toEqual([{accountId:'credit-card',amount:-120}]);
    expect(monthlyFlow(data,'2026-08')).toMatchObject({income:0,expense:120,net:-120});
    expect(netWorth(data,'2026-08-21')).toBeCloseTo(before-120,2);
    data.state.events.push(payment);
    expect(payment.legs).toEqual([{accountId:'bank',amount:-60},{accountId:'credit-card',amount:60}]);
    expect(accountBalances(data,'2026-08-21')).toMatchObject({bank:940,'credit-card':-60});
    expect(monthlyFlow(data,'2026-08')).toMatchObject({income:0,expense:120,net:-120});
    expect(netWorth(data,'2026-08-21')).toBeCloseTo(before-120,2);
    expect(data.state.events).toHaveLength(2);
  });

  it('posts exactly one linked event per actual recurring, loan, lending and card action (#649 I19.02)',()=>{
    const data=minimal();
    const stamp='2026-08-01T00:00:00.000Z';
    data.state.cards=[{id:'card-contract',bankId:'piraeus',nickname:'Test credit',kind:'credit',network:'visa',creditLimit:500,active:true,createdAt:stamp,updatedAt:stamp}];
    data.state.recurringCustom=[{id:'rec-contract',name:'Internet',amount:29.99,day:21,accountId:'bank',category:'Σπίτι',active:true}];
    const loan={id:'loan-contract',name:'Installment',total:200,installment:40,installments:5,paidCount:0,defaultAccountId:'bank'};
    data.state.customLoans=[loan];
    const beforeSeed=JSON.stringify(data.seed);
    const booked=[
      createEvent({kind:'expense',date:'2026-08-21',amount:29.99,note:'Recurring real payment',accountId:'bank',recurringId:'rec-contract',category:'Σπίτι'}),
      createEvent({kind:'expense',date:'2026-08-21',amount:40,note:'Real loan installment',accountId:'bank',loanId:loan.id,category:'Άλλο'}),
      createEvent({kind:'lending',date:'2026-08-21',amount:50,note:'Money lent',accountId:'bank',person:'Alex'}),
      createEvent({kind:'repayment',date:'2026-08-21',amount:20,note:'Money repaid',accountId:'bank',person:'Alex'}),
      createEvent({kind:'card_purchase',date:'2026-08-21',amount:90,note:'Credit purchase',cardId:'card-contract',category:'Άλλο'}),
      createEvent({kind:'card_payment',date:'2026-08-21',amount:30,note:'Credit settlement',fromAccountId:'bank',cardId:'card-contract'}),
    ];
    expect(new Set(booked.map(event=>event.id)).size).toBe(booked.length);
    expect(booked.map(event=>event.legs)).toEqual([
      [{accountId:'bank',amount:-29.99}],
      [{accountId:'bank',amount:-40}],
      [{accountId:'bank',amount:-50}],
      [{accountId:'bank',amount:20}],
      [{accountId:'credit-card',amount:-90}],
      [{accountId:'bank',amount:-30},{accountId:'credit-card',amount:30}],
    ]);
    expect(booked[2].receivableDelta).toBe(50);
    expect(booked[3].receivableDelta).toBe(-20);
    expect(booked[4].creditDelta).toBe(-90);
    expect(booked[5].creditDelta).toBe(30);
    data.state.events=booked;
    expect(data.state.events).toHaveLength(6);
    expect(recurringPayments(data,'rec-contract').map(event=>event.id)).toEqual([booked[0].id]);
    expect(loanPaymentEvents(data,loan).map(event=>event.id)).toEqual([booked[1].id]);
    expect(loanPaidAmount(data,loan)).toBe(40);
    expect(creditDebtForCard(data,'card-contract','2026-08-21')).toBe(60);
    expect(lendingOutstandingFor(data,'Alex','2026-08-21')).toBe(30);
    expect(monthlyFlow(data,'2026-08')).toMatchObject({income:0,expense:159.99,net:-159.99});
    expect(accountBalances(data,'2026-08-21')).toMatchObject({bank:870.01,cash:100,savings:500,'credit-card':-60});
    expect(JSON.stringify(data.seed)).toBe(beforeSeed);
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