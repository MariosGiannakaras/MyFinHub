import { describe, expect, it } from 'vitest';
import { categoryIconPreferenceKey, subcategoryIconPreferenceKey } from '../src/lib/categoryIconPreferences.js';
import { ensureCategoryIdentities, resolveCategoryIdentity, resolveSubcategoryIdentity } from '../src/lib/categoryIdentity.js';
import { applyTaxonomyOperation, applyTaxonomyOperationToSettings, taxonomyRetirementDependencies } from '../src/lib/taxonomyManagement.js';
import type { FinanceData, FinanceSettings } from '../src/types.js';

function settings():FinanceSettings{return ensureCategoryIdentities({
  excludedFromAvailable:[],accountNames:{},
  expenseCategories:['Φαγητό','Μετακινήσεις'],incomeCategories:['Μισθός'],
  expenseCategoryTree:[{name:'Φαγητό',subcategories:['Supermarket','Εστιατόριο']},{name:'Μετακινήσεις',subcategories:['Καύσιμα']}],
  incomeCategoryTree:[{name:'Μισθός',subcategories:[]}],
  categoryIcons:{[categoryIconPreferenceKey('expense','Φαγητό')]:'utensils'},
  subcategoryIcons:{[subcategoryIconPreferenceKey('expense','Φαγητό','Supermarket')]:'shopping-cart'},
  customPresets:[],pinnedPresets:[],defaultExpenseAccount:'bank',defaultIncomeAccount:'bank',defaultLoanAccount:'bank',
})}

function fixture():FinanceData{
  const s=settings();
  return {
    app:'RheomIQ',schemaVersion:3,updatedAt:'2026-08-23T00:00:00.000Z',
    seed:{
      accounts:[{id:'bank',name:'Bank',kind:'bank'}],months:['2026-07','2026-08','2026-09'],
      transactions:[{id:'legacy-food',date:'2026-01-01',type:'expense',accountId:'bank',amount:10,note:'Ιστορικό',category:'Φαγητό',subcategory:'Supermarket'}],
      snapshots:[],recurring:[{id:'seed-rec',name:'Delivery',amount:20,day:5,accountId:'bank',category:'Φαγητό',active:true,status:'active'}],subscriptions:[],loans:[],lending:[],stats:{},
    },
    state:{
      customTransactions:[],overrides:{},deleted:[],recurringCustom:[{id:'custom-rec',name:'Lunch',amount:30,day:8,accountId:'bank',category:'Φαγητό',active:true,status:'active'}],recurringOverrides:{},
      loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],settings:s,
      events:[{id:'historic-event',date:'2026-01-02',kind:'expense',amount:5,note:'Παλιό',category:'Φαγητό',subcategory:'Supermarket',accountId:'bank',legs:[{accountId:'bank',amount:-5}],createdAt:'2026-01-02T00:00:00.000Z',updatedAt:'2026-01-02T00:00:00.000Z'}],
      scheduled:[
        {id:'pending',dueDate:'2026-09-01',kind:'expense',amount:15,note:'Future',category:'Φαγητό',subcategory:'Supermarket',accountId:'bank',status:'pending',createdAt:'2026-08-01T00:00:00.000Z',updatedAt:'2026-08-01T00:00:00.000Z'},
        {id:'done',dueDate:'2026-07-01',kind:'expense',amount:15,note:'Done',category:'Φαγητό',subcategory:'Supermarket',accountId:'bank',status:'completed',completedEventId:'historic-event',completedAt:'2026-07-01T00:00:00.000Z',createdAt:'2026-06-01T00:00:00.000Z',updatedAt:'2026-07-01T00:00:00.000Z'},
      ],
      budgets:[
        {id:'past-budget',month:'2026-07',scope:'category',category:'Φαγητό',amount:100,createdAt:'2026-07-01',updatedAt:'2026-07-01'},
        {id:'current-budget',month:'2026-08',scope:'category',category:'Φαγητό',amount:120,createdAt:'2026-08-01',updatedAt:'2026-08-01'},
        {id:'future-budget',month:'2026-09',scope:'category',category:'Φαγητό',amount:130,createdAt:'2026-08-01',updatedAt:'2026-08-01'},
      ],
      transactionRules:[{id:'rule-food',name:'Market',enabled:true,priority:1,scopes:['manual'],match:{description:'market'},action:{category:'Φαγητό',subcategory:'Supermarket'},createdAt:'2026-08-01',updatedAt:'2026-08-01'}],
    },
  };
}

describe('direct taxonomy management',()=>{
  it('adds and reorders categories/subcategories while keeping stable identities',()=>{
    const initial=settings();
    const food=resolveCategoryIdentity(initial,'expense','Φαγητό');
    if(!food)throw new Error('missing food identity');
    let next=applyTaxonomyOperationToSettings(initial,{type:'add-category',kind:'expense',label:'Υγεία'});
    const health=resolveCategoryIdentity(next,'expense','Υγεία');
    expect(health?.id).toMatch(/^cat-expense-/);
    next=applyTaxonomyOperationToSettings(next,{type:'add-subcategory',kind:'expense',parentId:food.id,label:'Καφές'});
    const coffee=resolveSubcategoryIdentity(next,'expense','Φαγητό','Καφές');
    expect(coffee?.parentId).toBe(food.id);
    next=applyTaxonomyOperationToSettings(next,{type:'reorder-category',kind:'expense',identityId:health!.id,direction:'up'});
    expect(next.expenseCategoryTree?.map(item=>item.name)).toEqual(['Φαγητό','Υγεία','Μετακινήσεις']);
    next=applyTaxonomyOperationToSettings(next,{type:'reorder-subcategory',kind:'expense',identityId:coffee!.id,direction:'up'});
    expect(next.expenseCategoryTree?.[0].subcategories).toEqual(['Supermarket','Καφές','Εστιατόριο']);
    expect(resolveCategoryIdentity(next,'expense','Φαγητό')?.id).toBe(food.id);
  });

  it('renames a category atomically across active/future configuration without rewriting history',()=>{
    const data=fixture();
    const food=resolveCategoryIdentity(data.state.settings,'expense','Φαγητό');
    if(!food)throw new Error('missing food identity');
    const next=applyTaxonomyOperation(data,{type:'rename-category',kind:'expense',identityId:food.id,label:'Τρόφιμα & φαγητό'},'2026-08-23');

    expect(resolveCategoryIdentity(next.state.settings,'expense','Τρόφιμα & φαγητό')?.id).toBe(food.id);
    expect(resolveCategoryIdentity(next.state.settings,'expense','Φαγητό')?.id).toBe(food.id);
    expect(next.state.settings.categoryIcons?.[categoryIconPreferenceKey('expense','Τρόφιμα & φαγητό')]).toBe('utensils');
    expect(next.state.recurringOverrides?.['seed-rec']?.category).toBe('Τρόφιμα & φαγητό');
    expect(next.state.recurringCustom[0].category).toBe('Τρόφιμα & φαγητό');
    expect(next.state.scheduled?.find(item=>item.id==='pending')?.category).toBe('Τρόφιμα & φαγητό');
    expect(next.state.scheduled?.find(item=>item.id==='done')?.category).toBe('Φαγητό');
    expect(next.state.transactionRules?.[0].action.category).toBe('Τρόφιμα & φαγητό');
    expect(next.state.budgets?.find(item=>item.id==='past-budget')?.category).toBe('Φαγητό');
    expect(next.state.budgets?.find(item=>item.id==='current-budget')?.category).toBe('Τρόφιμα & φαγητό');
    expect(next.state.budgets?.find(item=>item.id==='future-budget')?.category).toBe('Τρόφιμα & φαγητό');
    expect(next.seed.transactions[0].category).toBe('Φαγητό');
    expect(next.state.events?.[0].category).toBe('Φαγητό');
  });

  it('renames and moves a subcategory while only retargeting pending/rule paths',()=>{
    const data=fixture();
    const market=resolveSubcategoryIdentity(data.state.settings,'expense','Φαγητό','Supermarket');
    const transport=resolveCategoryIdentity(data.state.settings,'expense','Μετακινήσεις');
    if(!market||!transport)throw new Error('missing taxonomy identity');

    const renamed=applyTaxonomyOperation(data,{type:'rename-subcategory',kind:'expense',identityId:market.id,label:'Σούπερ μάρκετ'},'2026-08-23');
    expect(renamed.state.scheduled?.find(item=>item.id==='pending')?.subcategory).toBe('Σούπερ μάρκετ');
    expect(renamed.state.scheduled?.find(item=>item.id==='done')?.subcategory).toBe('Supermarket');
    expect(renamed.state.transactionRules?.[0].action.subcategory).toBe('Σούπερ μάρκετ');
    expect(renamed.seed.transactions[0].subcategory).toBe('Supermarket');

    const moved=applyTaxonomyOperation(renamed,{type:'move-subcategory',kind:'expense',identityId:market.id,targetCategoryId:transport.id},'2026-08-23');
    expect(resolveSubcategoryIdentity(moved.state.settings,'expense','Μετακινήσεις','Σούπερ μάρκετ')?.id).toBe(market.id);
    expect(resolveSubcategoryIdentity(moved.state.settings,'expense','Φαγητό','Supermarket')?.id).toBe(market.id);
    expect(moved.state.scheduled?.find(item=>item.id==='pending')).toMatchObject({category:'Μετακινήσεις',subcategory:'Σούπερ μάρκετ'});
    expect(moved.state.transactionRules?.[0].action).toMatchObject({category:'Μετακινήσεις',subcategory:'Σούπερ μάρκετ'});
    expect(moved.state.events?.[0]).toMatchObject({category:'Φαγητό',subcategory:'Supermarket'});
  });

  it('rejects add operations that reuse reserved historical aliases',()=>{
    const initial=settings();
    const food=resolveCategoryIdentity(initial,'expense','Φαγητό');
    if(!food)throw new Error('missing food identity');
    const renamed=applyTaxonomyOperationToSettings(initial,{type:'rename-category',kind:'expense',identityId:food.id,label:'Τρόφιμα'});
    expect(()=>applyTaxonomyOperationToSettings(renamed,{type:'add-category',kind:'expense',label:'Φαγητό'})).toThrow(/παλιό όνομα/i);
  });

  it('enumerates category retirement blockers without treating historical rows as live dependencies',()=>{
    const data=fixture();
    const food=resolveCategoryIdentity(data.state.settings,'expense','Φαγητό');
    if(!food)throw new Error('missing food identity');
    const dependencies=taxonomyRetirementDependencies(data,{type:'retire-category',kind:'expense',identityId:food.id},'2026-08-23');
    expect(dependencies.map(item=>item.kind)).toEqual(['budget','budget','recurring','recurring','rule','scheduled','subcategory','subcategory']);
    expect(dependencies.map(item=>item.id)).not.toContain('past-budget');
    expect(dependencies.map(item=>item.id)).not.toContain('done');
    expect(()=>applyTaxonomyOperation(data,{type:'retire-category',kind:'expense',identityId:food.id},'2026-08-23')).toThrow(/μπλοκάρεται/i);
    expect(data.seed.transactions[0].category).toBe('Φαγητό');
    expect(data.state.events?.[0].category).toBe('Φαγητό');
  });

  it('retires a dependency-free subcategory from active pickers while preserving its historical identity',()=>{
    const data=fixture();
    const market=resolveSubcategoryIdentity(data.state.settings,'expense','Φαγητό','Supermarket');
    if(!market)throw new Error('missing market identity');
    data.state.scheduled=(data.state.scheduled??[]).map(item=>item.id==='pending'?{...item,status:'cancelled' as const}:item);
    data.state.transactionRules=(data.state.transactionRules??[]).map(rule=>rule.id==='rule-food'?{...rule,enabled:false}:rule);
    expect(taxonomyRetirementDependencies(data,{type:'retire-subcategory',kind:'expense',identityId:market.id},'2026-08-23')).toEqual([]);
    const next=applyTaxonomyOperation(data,{type:'retire-subcategory',kind:'expense',identityId:market.id},'2026-08-23');
    expect(next.state.settings.expenseCategoryTree?.find(item=>item.name==='Φαγητό')?.subcategories).toEqual(['Εστιατόριο']);
    expect(resolveSubcategoryIdentity(next.state.settings,'expense','Φαγητό','Supermarket')?.id).toBe(market.id);
    expect(next.seed.transactions[0]).toMatchObject({category:'Φαγητό',subcategory:'Supermarket'});
    expect(next.state.events?.[0]).toMatchObject({category:'Φαγητό',subcategory:'Supermarket'});
    expect(()=>applyTaxonomyOperationToSettings(next.state.settings,{type:'add-subcategory',kind:'expense',parentId:market.parentId!,label:'Supermarket'})).toThrow(/παλιό όνομα/i);
  });

  it('requires child cleanup before category retirement and retains the stable category identity afterward',()=>{
    let data=fixture();
    const transport=resolveCategoryIdentity(data.state.settings,'expense','Μετακινήσεις');
    const fuel=resolveSubcategoryIdentity(data.state.settings,'expense','Μετακινήσεις','Καύσιμα');
    if(!transport||!fuel)throw new Error('missing transport taxonomy');
    expect(taxonomyRetirementDependencies(data,{type:'retire-category',kind:'expense',identityId:transport.id},'2026-08-23').map(item=>item.kind)).toEqual(['subcategory']);
    data=applyTaxonomyOperation(data,{type:'retire-subcategory',kind:'expense',identityId:fuel.id},'2026-08-23');
    expect(taxonomyRetirementDependencies(data,{type:'retire-category',kind:'expense',identityId:transport.id},'2026-08-23')).toEqual([]);
    data=applyTaxonomyOperation(data,{type:'retire-category',kind:'expense',identityId:transport.id},'2026-08-23');
    expect(data.state.settings.expenseCategoryTree?.some(item=>item.name==='Μετακινήσεις')).toBe(false);
    expect(resolveCategoryIdentity(data.state.settings,'expense','Μετακινήσεις')?.id).toBe(transport.id);
    expect(()=>applyTaxonomyOperationToSettings(data.state.settings,{type:'add-category',kind:'expense',label:'Μετακινήσεις'})).toThrow(/παλιό όνομα/i);
  });
});
