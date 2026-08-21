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

function clean(){const data=clone();data.seed.transactions=[];data.state.customTransactions=[];data.state.overrides={};data.state.deleted=[];data.state.events=[];data.state.budgets=[];data.state.transactionRules=[];return data}

describe('monthly category budgets',()=>{
  it('counts split portions exactly once, excludes transfers and nets refunds deterministically',()=>{
    const data=clean();
    const expense=createEvent({kind:'expense',date:'2026-08-05',amount:100,note:'Food',category:'Τρόφιμα',accountId:'piraeus-payroll'});
    const refund=createEvent({kind:'refund',date:'2026-08-06',amount:20,note:'Food refund',category:'Τρόφιμα',accountId:'piraeus-payroll'});
    const transfer=createTransferEvent(data,{date:'2026-08-07',amount:500,note:'Internal',fromAccountId:'piraeus-payroll',toAccountId:'piraeus-savings'});
    const split=createExpenseSplitEvent(data,{date:'2026-08-08',amount:60,note:'Mixed',accountId:'piraeus-payroll',parts:[{id:'a',label:'Food',category:'Τρόφιμα',amount:40},{id:'b',label:'Travel',category:'Μετακινήσεις',amount:20}]});
    data.state.events=[expense,refund,transfer,split];
    const spending=categoryBudgetSpending(data,'2026-08');
    expect(spending.get('Τρόφιμα')).toBe(120);
    expect(spending.get('Μετακινήσεις')).toBe(20);
    expect([...spending.values()].reduce((sum,value)=>sum+value,0)).toBe(140);
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

  it('adds near/exceeded budgets to Needs Attention without leaking euro values in the reason',()=>{
    const data=clean();data.state.events=[createEvent({kind:'expense',date:'2026-08-05',amount:120,note:'Food',category:'Τρόφιμα',accountId:'piraeus-payroll'})];data.state.budgets=[budget('food','category',100,'Τρόφιμα')];
    const alert=allAttentionItems(data,'2026-08-17').find(item=>item.id==='budget-alert:food');
    expect(alert).toMatchObject({kind:'budget',severity:'danger',action:'open_budgets',amount:120,budgetId:'food'});
    expect(alert?.reason).not.toMatch(/€|100\.00|120\.00/);
  });
});

describe('deterministic transaction rules',()=>{
  it('uses priority then stable id and applies only the first matching rule',()=>{
    const data=clean();data.state.transactionRules=[rule('later',20,'market','Άλλο'),rule('winner',10,'market','Τρόφιμα'),rule('winner-b',10,'market','Μετακινήσεις')];
    const event=createEvent({kind:'expense',date:'2026-08-05',amount:20,note:'Corner Market',category:data.state.settings.expenseCategories[0],accountId:'piraeus-payroll'});
    const preview=previewTransactionRules(data,event);
    expect(preview.matches.map(item=>item.id)).toEqual(['winner','winner-b','later']);
    expect(applyTransactionRules(data,event).category).toBe('Τρόφιμα');
  });

  it('preserves a non-default user category and never rewrites existing history',()=>{
    const data=clean();data.state.transactionRules=[rule('food',1,'market','Τρόφιμα')];
    const event=createEvent({kind:'expense',date:'2026-08-05',amount:20,note:'Corner Market',category:'Υγεία',accountId:'piraeus-payroll'});data.state.events=[event];
    const before=structuredClone(data.state.events);
    expect(applyTransactionRules(data,event).category).toBe('Υγεία');
    expect(data.state.events).toEqual(before);
    expect(transactionRuleMatchCount(data,data.state.transactionRules[0])).toBe(1);
  });

  it('honors explicit manual/imported/review scope in both apply and preview',()=>{
    const data=clean();const imported=rule('imported',1,'market','Τρόφιμα');imported.scopes=['imported'];data.state.transactionRules=[imported];
    const manual=createEvent({kind:'expense',date:'2026-08-05',amount:20,note:'Market',category:data.state.settings.expenseCategories[0],accountId:'piraeus-payroll'});
    const migration={...manual,id:'migration',source:'migration' as const};data.state.events=[manual,migration];
    expect(previewTransactionRules(data,manual).winner).toBeNull();
    expect(previewTransactionRules(data,migration).winner?.id).toBe('imported');
    expect(transactionRuleMatchingEvents(data,imported).map(event=>event.id)).toEqual(['migration']);
  });

  it('supports default category/subcategory metadata without replacing explicit user metadata',()=>{
    const data=clean();const metadata=rule('meta',1,'market','Τρόφιμα');metadata.action.subcategory='Supermarket';metadata.action.note='Default note';data.state.transactionRules=[metadata];
    const defaultEvent=createEvent({kind:'expense',date:'2026-08-05',amount:20,note:'Market',category:data.state.settings.expenseCategories[0],accountId:'piraeus-payroll'});
    const applied=applyTransactionRules(data,defaultEvent);
    expect(applied.category).toBe('Τρόφιμα');expect(applied.subcategory).toBe('Supermarket');expect(applied.note).toBe('Market');
    const explicit={...defaultEvent,category:'Υγεία',subcategory:'Φαρμακείο'};
    expect(applyTransactionRules(data,explicit)).toMatchObject({category:'Υγεία',subcategory:'Φαρμακείο'});
  });

  it('preserves budgets and rules through migration and defaults legacy state safely',()=>{
    const data=clean();data.state.budgets=[budget('food','category',100,'Τρόφιμα')];data.state.transactionRules=[rule('food',1,'market','Τρόφιμα')];
    expect(migrateProductData(data).state.budgets).toEqual(data.state.budgets);
    expect(migrateProductData(data).state.transactionRules).toEqual(data.state.transactionRules);
    const legacy=clean();delete legacy.state.budgets;delete legacy.state.transactionRules;
    expect(migrateProductData(legacy).state.budgets).toEqual([]);
    expect(migrateProductData(legacy).state.transactionRules).toEqual([]);
  });
});