import {describe,expect,it} from 'vitest';
import {budgetProgress,budgetProjectedCommitments,budgetStableId,categoryBudgetSpending,normalizeBudget,subcategoryBudgetSpending} from '../src/lib/budgets.js';
import {createEvent,migrateData} from '../src/lib/domain.js';
import {validateFinanceData} from '../server/validation.js';
import type {FinanceData,MonthlyBudget} from '../src/types.js';

const stamp='2026-08-01T00:00:00Z';
// The canonical event factory owns money movement metadata. Subcategory is an
// optional persisted classification assigned after creation by the editor.
const classifiedEvent=(args:Parameters<typeof createEvent>[0]&{subcategory?:string})=>{
  const {subcategory,...draft}=args;
  return {...createEvent(draft),...(subcategory?{subcategory}:{})};
};
function fixture():FinanceData{
  return migrateData({
    app:'MyFinHub',schemaVersion:3,updatedAt:stamp,
    seed:{accounts:[{id:'bank',kind:'bank',name:'Bank'}],months:[],transactions:[],
      snapshots:[{date:'2026-07-01',balances:{bank:1000}}],recurring:[],subscriptions:[],loans:[],lending:[],stats:{}},
    state:{customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},
      loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],events:[],scheduled:[],budgets:[],
      settings:{excludedFromAvailable:[],accountNames:{},expenseCategories:['Τρόφιμα','Άλλο'],incomeCategories:['Μισθός'],
        expenseCategoryTree:[{name:'Τρόφιμα',subcategories:['Σούπερ μάρκετ','Λαϊκή']}],
        customPresets:[],pinnedPresets:[],defaultExpenseAccount:'bank',
        defaultIncomeAccount:'bank',defaultLoanAccount:'bank'},
      reviewDecisions:{}}
  } as FinanceData);
}
const budget=(month:string,scope:MonthlyBudget['scope'],amount:number,category?:string,subcategory?:string,carryover=false):MonthlyBudget=>({
  id:budgetStableId(month,scope,category,subcategory),month,scope,category,subcategory,carryover,amount,
  alertThreshold:.8,createdAt:stamp,updatedAt:stamp
});
describe('#588 enhanced budgets: subcategory, rollover, nonposting commitments',()=>{
 it('keeps subcategory limits separate while parent and overall count expense only once',()=>{
  const d=fixture();
  d.state.events=[
    classifiedEvent({kind:'expense',date:'2026-08-04',amount:50,accountId:'bank',note:'Market',category:'Τρόφιμα',subcategory:'Σούπερ μάρκετ'}),
    classifiedEvent({kind:'refund',date:'2026-08-05',amount:10,accountId:'bank',note:'Return',category:'Τρόφιμα',subcategory:'Σούπερ μάρκετ'}),
    classifiedEvent({kind:'expense',date:'2026-08-06',amount:15,accountId:'bank',note:'Street',category:'Τρόφιμα',subcategory:'Λαϊκή'}),
    classifiedEvent({kind:'transfer',date:'2026-08-06',amount:30,fromAccountId:'bank',toAccountId:'bank2',note:'internal'})
  ];
  d.state.budgets=[
    budget('2026-08','subcategory',100,'Τρόφιμα','Σούπερ μάρκετ'),
    budget('2026-08','category',100,'Τρόφιμα'),
    budget('2026-08','overall',200)
  ];
  const rows=budgetProgress(d,'2026-08','2026-08-17');
  expect(rows.find(x=>x.scope==='subcategory')).toMatchObject({used:40,limit:100,remaining:60});
  expect(rows.find(x=>x.scope==='category')).toMatchObject({used:55});
  expect(rows.find(x=>x.scope==='overall')).toMatchObject({used:55});
  expect(categoryBudgetSpending(d,'2026-08').get('Τρόφιμα')).toBe(55);
  expect(subcategoryBudgetSpending(d,'2026-08').get('Τρόφιμα › Σούπερ μάρκετ')).toBe(40);
 });
 it('rolls forward only unused previous allowance, bounded to the intended scope, not income',()=>{
  const d=fixture();
  d.state.events=[
    classifiedEvent({kind:'expense',date:'2026-07-05',amount:70,accountId:'bank',category:'Τρόφιμα',subcategory:'Σούπερ μάρκετ',note:'July'}),
    classifiedEvent({kind:'expense',date:'2026-08-05',amount:60,accountId:'bank',category:'Τρόφιμα',subcategory:'Σούπερ μάρκετ',note:'August'})
  ];
  d.state.budgets=[
    budget('2026-07','subcategory',100,'Τρόφιμα','Σούπερ μάρκετ'),
    budget('2026-08','subcategory',80,'Τρόφιμα','Σούπερ μάρκετ',true),
    budget('2026-08','category',80,'Τρόφιμα')
  ];
  const sub=budgetProgress(d,'2026-08','2026-08-17').find(row=>row.scope==='subcategory');
  expect(sub).toMatchObject({baseLimit:80,carried:30,limit:110,used:60,remaining:50,carryover:true});
  expect(budgetProgress(d,'2026-08').find(row=>row.scope==='category')).toMatchObject({limit:80,carried:0,used:60});
  d.state.events.push(classifiedEvent({kind:'expense',date:'2026-07-09',amount:100,accountId:'bank',category:'Τρόφιμα',subcategory:'Σούπερ μάρκετ',note:'More spent'}));
  expect(budgetProgress(d,'2026-08').find(row=>row.scope==='subcategory')).toMatchObject({carried:0,limit:80});
 });
 it('resolves historical category aliases through durable identity IDs',()=>{
  const d=fixture();
  d.state.settings.categoryIdentities={
    'cat-food':{id:'cat-food',kind:'expense',label:'Τρόφιμα',aliases:['Φαγητό']},
    'sub-store':{id:'sub-store',kind:'expense',label:'Σούπερ μάρκετ',aliases:['Μάρκετ'],parentId:'cat-food'}
  };
  d.state.budgets=[{...budget('2026-08','subcategory',50,'Τρόφιμα','Σούπερ μάρκετ'),
    categoryIdentityId:'cat-food',subcategoryIdentityId:'sub-store'}];
  d.state.events=[classifiedEvent({kind:'expense',date:'2026-08-05',amount:12.5,
    accountId:'bank',category:'Φαγητό',subcategory:'Μάρκετ',note:'Before rename'})];
  expect(budgetProgress(d,'2026-08')[0]).toMatchObject({used:12.5});
 });
 it('projects known due scheduled expense once without booking it or counting future cash as actual',()=>{
  const d=fixture();
  d.state.events=[classifiedEvent({kind:'expense',date:'2026-08-05',amount:20,accountId:'bank',
    category:'Τρόφιμα',subcategory:'Σούπερ μάρκετ',note:'Paid'})];
  d.state.scheduled=[{id:'sch-1',dueDate:'2026-08-20',status:'pending',kind:'expense',amount:30,
    note:'Grocery bill',category:'Τρόφιμα',subcategory:'Σούπερ μάρκετ',accountId:'bank',
    createdAt:stamp,updatedAt:stamp}];
  d.state.budgets=[budget('2026-08','subcategory',60,'Τρόφιμα','Σούπερ μάρκετ')];
  const row=budgetProgress(d,'2026-08','2026-08-17')[0];
  expect(row).toMatchObject({used:20,projectedDue:30,projectedUsed:50,remaining:40,projectedRemaining:10});
  const statusOnly=budgetProgress(d,'2026-08','2026-08-17',false)[0];
  // Same actual expense, limit, status and carryover; skip due obligations
  // that neither Dashboard nor Attention display on their first paint.
  expect(statusOnly).toMatchObject({used:20,limit:60,remaining:40,status:row.status,
    projectedDue:0,projectedUsed:20,projectedRemaining:40});
  expect(row.projectedDue).toBe(30);
  expect(d.state.events).toHaveLength(1);
  expect(budgetProjectedCommitments(d,'2026-08','2026-08-24')).toHaveLength(0);
  d.state.scheduled[0]!.status='completed';
  expect(budgetProgress(d,'2026-08','2026-08-17')[0].projectedDue).toBe(0);
 });
 it('does not duplicate scheduled and recurring obligation with identical owner-confirmed payment',()=>{
  const d=fixture();
  d.state.scheduled=[{id:'sch-1',dueDate:'2026-08-20',status:'pending',kind:'expense',amount:30,
    note:'Grocery',category:'Τρόφιμα',accountId:'bank',createdAt:stamp,updatedAt:stamp}];
  d.state.recurringCustom=[{id:'rec-1',name:'Grocery',category:'Τρόφιμα',accountId:'bank',
    day:20,amount:30,active:true}];
  d.state.budgets=[budget('2026-08','category',40,'Τρόφιμα')];
  expect(budgetProjectedCommitments(d,'2026-08','2026-08-17')).toHaveLength(1);
  expect(budgetProgress(d,'2026-08','2026-08-17')[0].projectedDue).toBe(30);
 });
 it('projects recurring child-category charges and only deduplicates an identical scheduled purpose',()=>{
  const d=fixture();
  d.state.recurringCustom=[{id:'rec-child',name:'Grocery',category:'Τρόφιμα',subcategory:'Σούπερ μάρκετ',
    accountId:'bank',day:20,amount:30,active:true}];
  d.state.budgets=[
    budget('2026-08','subcategory',70,'Τρόφιμα','Σούπερ μάρκετ'),
    budget('2026-08','category',120,'Τρόφιμα')
  ];
  const due=()=>budgetProjectedCommitments(d,'2026-08','2026-08-17');
  const sub=()=>budgetProgress(d,'2026-08','2026-08-17').find(row=>row.scope==='subcategory');
  expect(due()).toMatchObject([{id:'rec-child',subcategory:'Σούπερ μάρκετ',source:'recurring',amount:30}]);
  expect(sub()).toMatchObject({used:0,projectedDue:30,projectedUsed:30});
  expect(d.state.events).toHaveLength(0);

  d.state.scheduled=[{id:'scheduled-child',dueDate:'2026-08-20',status:'pending',kind:'expense',
    amount:30,note:'Grocery',category:'Τρόφιμα',subcategory:'Σούπερ μάρκετ',
    accountId:'bank',createdAt:stamp,updatedAt:stamp}];
  expect(due()).toHaveLength(1);
  expect(sub()?.projectedDue).toBe(30);

  d.state.scheduled[0]!.subcategory='Λαϊκή';
  expect(due()).toHaveLength(2);
  expect(due().find(item=>item.id==='rec-child')?.subcategory).toBe('Σούπερ μάρκετ');
  expect(sub()?.projectedDue).toBe(30);
  expect(budgetProgress(d,'2026-08','2026-08-17').find(row=>row.scope==='category')?.projectedDue).toBe(60);
  expect(d.state.events).toHaveLength(0);
 });
 it('rejects subcategory-free and sub-cent budgets without changing existing typed categories',()=>{
  expect(()=>normalizeBudget(budget('2026-08','subcategory',40,'Τρόφιμα'))).toThrow(/υποκατηγορία/);
  expect(()=>normalizeBudget(budget('2026-08','category',40.001,'Τρόφιμα'))).toThrow(/λεπτά/);
  expect(()=>normalizeBudget(budget('2026-13','overall',40))).toThrow(/μήνα/);
  expect(normalizeBudget(budget('2026-08','overall',40))).toMatchObject({scope:'overall',carryover:false});
 });
 it('enforces budget-only identity and carryover types at the canonical server boundary',()=>{
  const d=fixture();
  d.state.budgets=[budget('2026-08','subcategory',100,'Τρόφιμα','Σούπερ μάρκετ',true)];
  expect(()=>validateFinanceData(d)).not.toThrow();
  d.state.budgets=[{...d.state.budgets[0],carryover:'yes'} as unknown as MonthlyBudget];
  expect(()=>validateFinanceData(d)).toThrow(/carryover/);
  d.state.budgets=[{...d.state.budgets[0],carryover:true,categoryIdentityId:22} as unknown as MonthlyBudget];
  expect(()=>validateFinanceData(d)).toThrow(/categoryIdentityId/);
  d.state.budgets=[{...budget('2026-08','overall',100),categoryIdentityId:'cat-food'}];
  expect(()=>validateFinanceData(d)).toThrow(/categoryIdentityId/);
  d.state.budgets=[{...budget('2026-08','category',100,'Τρόφιμα'),subcategory:'Σούπερ μάρκετ'}];
  expect(()=>validateFinanceData(d)).toThrow(/subcategory/);
  d.state.budgets=[budget('2026-08','category',100,'Τρόφιμα')];
  expect(()=>validateFinanceData(d)).not.toThrow();
 });
  it('preserves two legitimate separate commitments with equal cents when their names differ',()=>{
  const d=fixture();
  d.state.scheduled=[{id:'s1',dueDate:'2026-08-20',status:'pending',kind:'expense',amount:30,
    note:'Grocery',category:'Τρόφιμα',accountId:'bank',createdAt:stamp,updatedAt:stamp}];
  d.state.recurringCustom=[{id:'r1',name:'Another bill',category:'Τρόφιμα',accountId:'bank',
    day:20,amount:30,active:true}];
  const due=budgetProjectedCommitments(d,'2026-08','2026-08-17');
  expect(due).toHaveLength(2);
  expect(due.reduce((sum,item)=>sum+item.amount,0)).toBe(60);
 });
 it('recognizes a confirmed legacy split with a subcategory absent from current taxonomy',()=>{
  const d=fixture();
  d.seed.transactions=[{id:'legacy',date:'2026-08-11',type:'expense',amount:16,
    accountId:'bank',note:'Old split',category:'Άλλο'}];
  d.state.reviewDecisions={'legacy':{status:'confirmed',semanticKind:'split',decidedAt:stamp,
    parts:[{id:'a',label:'Food',category:'Ιστορικά τρόφιμα',subcategory:'Παλιά αγορά',amount:16}]}};
  expect(categoryBudgetSpending(d,'2026-08').get('Ιστορικά τρόφιμα')).toBe(16);
  expect(subcategoryBudgetSpending(d,'2026-08').get('Ιστορικά τρόφιμα › Παλιά αγορά')).toBe(16);
 });

});
