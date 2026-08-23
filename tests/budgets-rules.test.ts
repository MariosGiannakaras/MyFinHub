import { describe, expect, it } from 'vitest';
import { qaFinanceData } from '../src/qaFixture.js';
import { allAttentionItems } from '../src/lib/attention.js';
import { budgetProgress, categoryBudgetSpending } from '../src/lib/budgets.js';
import { createEvent } from '../src/lib/domain.js';
import { createExpenseSplitEvent, createTransferEvent } from '../src/lib/ledgerFoundations.js';
import { migrateProductData } from '../src/lib/productMigration.js';
import { applyTransactionRules, previewTransactionRules, transactionRuleMatchingEvents, transactionRuleMatchCount } from '../src/lib/transactionRules.js';
import type { MonthlyBudget, TransactionRule } from '../src/types.js';

const clone=()=>structuredClone(qaFinanceData());
const stamp='2026-08-17T12:00:00.000Z';
const budget=(id:string,scope:'category'|'overall',amount:number,category?:string):MonthlyBudget=>({id,month:'2026-08',scope,category,amount,alertThreshold:.8,createdAt:stamp,updatedAt:stamp});
const rule=(id:string,priority:number,description:string,category:string):TransactionRule=>({id,name:id,enabled:true,priority,scopes:['manual'],match:{description,mode:'contains'},action:{category},createdAt:stamp,updatedAt:stamp});

function clean(){const data=clone();data.seed.transactions=[];data.state.customTransactions=[];data.state.overrides={};data.state.deleted=[];data.state.events=[];data.state.budgets=[];data.state.transactionRules=[];data.state.reviewDecisions={};return data}

describe('monthly category budgets',()=>{
  it('counts split portions exactly once, excludes transfers and nets refunds deterministically',()=>{
    const data=clean();
    const expense=createEvent({kind:'expense',date:'2026-08-05',amount:100,note:'Food',category:'Τρόφιμα',accountId:'piraeus-payroll'});
    const refund=createEvent({kind:'refund',date:'2026-08-06',amount:20,note:'Food refund',category:'Τρόφιμα',accountId:'piraeus-payroll'});
    const transfer=createTransferEvent(data,{date:'2026-08-07',amount:500,note:'Internal',fromAccountId:'piraeus-payroll',toAccountId:'piraeus-savings'});
    const split=createExpenseSplitEvent(data,{date:'2026-08-08',note:'Mixed',accountId:'piraeus-payroll',parts:[{id:'a',label:'Food',category:'Τρόφιμα',amount:40},{id:'b',label:'Travel',category:'Μετακινήσεις',amount:20}]});
    data.state.events=[expense,refund,transfer,split];
    const spending=categoryBudgetSpending(data,'2026-08');
    expect(spending.get('Τρόφιμα')).toBe(120);
    expect(spending.get('Μετακινήσεις')).toBe(20);
    expect([...spending.values()].reduce((sum,value)=>sum+value,0)).toBe(140);
  });

  it('uses reviewed legacy split portions instead of the legacy row category total',()=>{
    const data=clean();data.seed.transactions=[{id:'legacy-split',date:'2026-08-09',type:'expense',accountId:'piraeus-payroll',amount:60,note:'Legacy mixed',category:'Άλλο'}];data.state.reviewDecisions={'legacy-split':{status:'confirmed',semanticKind:'split',decidedAt:stamp,parts:[{id:'p1',label:'Food',category:'Τρόφιμα',amount:45,kind:'expense'},{id:'p2',label:'Refund',category:'Τρόφιμα',amount:5,kind:'refund'},{id:'p3',label:'Travel',category:'Μετακινήσεις',amount:10,kind:'expense'}]}};
    const spending=categoryBudgetSpending(data,'2026-08');
    expect(spending.get('Τρόφιμα')).toBe(40);expect(spending.get('Μετακινήσεις')).toBe(10);expect(spending.has('Άλλο')).toBe(false);
  });

  it('reports used, remaining, near and exceeded states for category and overall limits',()=>{
    const data=clean();data.state.events=[createEvent({kind:'expense',date:'2026-08-05',amount:90,note:'Food',category:'Τρόφιμα',accountId:'piraeus-payroll'})];
    data.state.budgets=[budget('food','category',100,'Τρόφιμα'),budget('all','overall',200)];
    const rows=budgetProgress(data,'2026-08');
    expect(rows.find(row=>row.id==='food')).toMatchObject({used:90,remaining:10,status:'near'});
    expect(rows.find(row=>row.id==='all')).toMatchObject({used:90,remaining:110,status:'ok'});
    data.state.events.push(createEvent({kind:'expense',date:'2026-08-06',amount:30,note:'More food',category:'Τρόφιμα',accountId:'piraeus-payroll'}));
    expect(budgetProgress(data,'2026-08').find(row=>row.id==='food')?.status).toBe('exceeded');
  });

  it('floors refund-heavy usage at zero instead of producing negative consumption',()=>{
    const data=clean();data.state.events=[createEvent({kind:'refund',date:'2026-08-05',amount:50,note:'Refund',category:'Τρόφιμα',accountId:'piraeus-payroll'})];data.state.budgets=[budget('food','category',100,'Τρόφιμα')];
    expect(budgetProgress(data,'2026-08')[0]).toMatchObject({rawUsed:-50,used:0,remaining:100,status:'ok'});
  });

  it('keeps legacy adjustments and reconciliation events budget-neutral balance corrections',()=>{
    const data=clean();
    data.seed.transactions=[{id:'legacy-adjustment',date:'2026-08-05',type:'adjustment',accountId:'piraeus-payroll',amount:-25,note:'Legacy balance correction',category:'Τρόφιμα'}];
    data.state.events=[createEvent({kind:'reconciliation',date:'2026-08-06',amount:100,note:'Balance correction',category:'Τρόφιμα',accountId:'piraeus-payroll',actualBalance:900,currentBalance:1000})];
    expect(categoryBudgetSpending(data,'2026-08').size).toBe(0);
  });

  it('adds near/exceeded budgets to Needs Attention without leaking euro values in the reason',()=>{
    const data=clean();
    data.state.events=[createEvent({kind:'expense',date:'2026-08-05',amount:90,note:'Food',category:'Τρόφιμα',accountId:'piraeus-payroll'})];
    data.state.budgets=[budget('food','category',100,'Τρόφιμα')];
    const item=allAttentionItems(data,'2026-08-17').find(entry=>entry.id==='budget:food');
    expect(item?.reason).toContain('90%');
    expect(item?.reason).not.toContain('€');
  });
});

describe('transaction rules',()=>{
  it('matches case-insensitively, respects priority and records the applied category',()=>{
    const data=clean();
    data.state.transactionRules=[rule('later',20,'market','Σπίτι'),rule('first',10,'market','Τρόφιμα')];
    const event=createEvent({kind:'expense',date:'2026-08-05',amount:30,note:'MY MARKET',category:'Άλλο',accountId:'piraeus-payroll'});
    const preview=previewTransactionRules(data,event,'manual');
    expect(preview[0]?.rule.id).toBe('first');
    expect(applyTransactionRules(data,event,'manual').category).toBe('Τρόφιμα');
  });

  it('filters rule preview and counts to the requested scope',()=>{
    const data=clean();
    data.state.transactionRules=[rule('manual',1,'rent','Σπίτι'),{...rule('import',2,'rent','Άλλο'),scopes:['imported']}];
    data.state.events=[createEvent({kind:'expense',date:'2026-08-01',amount:10,note:'Rent',category:'Άλλο',accountId:'piraeus-payroll'})];
    expect(transactionRuleMatchingEvents(data,data.state.transactionRules[0],'manual')).toHaveLength(1);
    expect(transactionRuleMatchCount(data,data.state.transactionRules[1],'manual')).toBe(0);
  });

  it('preserves rules and budgets through the product migration wrapper',()=>{
    const data=clean();
    data.state.budgets=[budget('food','category',100,'Τρόφιμα')];
    data.state.transactionRules=[rule('rule',1,'market','Τρόφιμα')];
    const migrated=migrateProductData(data);
    expect(migrated.state.budgets).toEqual(data.state.budgets);
    expect(migrated.state.transactionRules).toEqual(data.state.transactionRules);
  });
});
