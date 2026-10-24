import {describe,expect,it} from 'vitest';
import {qaFinanceData} from '../src/qaFixture.js';
import {ensureCategoryIdentities,resolveCategoryIdentity,resolveSubcategoryIdentity} from '../src/lib/categoryIdentity.js';
import {applyTaxonomyOperation,taxonomyRetirementDependencies} from '../src/lib/taxonomyManagement.js';
import {validateFinanceData} from '../server/validation.js';

function fixture(){
  const data=structuredClone(qaFinanceData());
  data.state.settings=ensureCategoryIdentities({...data.state.settings,
    expenseCategories:['Τρόφιμα','Μετακίνηση'],
    expenseCategoryTree:[{name:'Τρόφιμα',subcategories:['Σούπερ μάρκετ']},{name:'Μετακίνηση',subcategories:['Καύσιμα']}],
    categoryIdentities:{},
  });
  data.seed.recurring=[];
  data.state.recurringCustom=[];
  data.state.recurringOverrides={};
  data.state.scheduled=[];
  data.state.transactionRules=[];
  const parent=resolveCategoryIdentity(data.state.settings,'expense','Τρόφιμα')!;
  const child=resolveSubcategoryIdentity(data.state.settings,'expense','Τρόφιμα','Σούπερ μάρκετ')!;
  const target=resolveCategoryIdentity(data.state.settings,'expense','Μετακίνηση')!;
  const base={month:'2026-09',scope:'subcategory' as const,category:'Τρόφιμα',subcategory:'Σούπερ μάρκετ',
    amount:50,carryover:true,createdAt:'2026-08-17T12:00:00.000Z',updatedAt:'2026-08-17T12:00:00.000Z'};
  data.state.budgets=[
    {...base,id:'historic-budget',month:'2026-07'},
    {...base,id:'future-stable',categoryIdentityId:parent.id,subcategoryIdentityId:child.id},
    {...base,id:'future-name-only'},
  ];
  return {data,parent,child,target};
}

describe('owner taxonomy + enhanced budgets #596/#600 integration',()=>{
  it('blocks retiring future budget subcategories/parents, but not historic allowances',()=>{
    const {data,parent,child}=fixture();
    const asOf='2026-08-23';
    const sub=taxonomyRetirementDependencies(data,{type:'retire-subcategory',kind:'expense',identityId:child.id},asOf);
    expect(sub.filter(item=>item.kind==='budget').map(item=>item.id)).toEqual(['future-name-only','future-stable']);
    expect(()=>applyTaxonomyOperation(data,{type:'retire-subcategory',kind:'expense',identityId:child.id},asOf)).toThrow(/μπλοκάρεται/);
    const category=taxonomyRetirementDependencies(data,{type:'retire-category',kind:'expense',identityId:parent.id},asOf);
    expect(category.filter(item=>item.kind==='budget').map(item=>item.id)).toEqual(['future-name-only','future-stable']);
    expect(category.map(item=>item.id)).not.toContain('historic-budget');
    data.state.budgets=data.state.budgets!.filter(b=>b.id==='historic-budget');
    expect(taxonomyRetirementDependencies(data,{type:'retire-subcategory',kind:'expense',identityId:child.id},asOf)).toEqual([]);
  });

  it('updates only future stable/name-only labels and moved parent IDs without rewriting history',()=>{
    const {data,parent,child,target}=fixture();
    const asOf='2026-08-23';
    const renamed=applyTaxonomyOperation(data,{type:'rename-subcategory',kind:'expense',identityId:child.id,label:'Αγορές τροφίμων'},asOf);
    expect(renamed.state.budgets!.find(b=>b.id==='historic-budget')).toMatchObject({category:'Τρόφιμα',subcategory:'Σούπερ μάρκετ'});
    expect(renamed.state.budgets!.filter(b=>b.month==='2026-09').map(b=>b.subcategory)).toEqual(['Αγορές τροφίμων','Αγορές τροφίμων']);
    const moved=applyTaxonomyOperation(renamed,{type:'move-subcategory',kind:'expense',identityId:child.id,targetCategoryId:target.id},asOf);
    const stable=moved.state.budgets!.find(b=>b.id==='future-stable')!;
    const legacy=moved.state.budgets!.find(b=>b.id==='future-name-only')!;
    expect(stable).toMatchObject({category:'Μετακίνηση',subcategory:'Αγορές τροφίμων',categoryIdentityId:target.id,subcategoryIdentityId:child.id,carryover:true});
    expect(legacy).toMatchObject({category:'Μετακίνηση',subcategory:'Αγορές τροφίμων'});
    expect(stable.categoryIdentityId).not.toBe(parent.id);
    expect(resolveSubcategoryIdentity(moved.state.settings,'expense','Μετακίνηση','Αγορές τροφίμων')?.id).toBe(child.id);
    expect(moved.state.budgets!.find(b=>b.id==='historic-budget')).toMatchObject({category:'Τρόφιμα',subcategory:'Σούπερ μάρκετ'});
    expect(data.state.budgets!.find(b=>b.id==='future-stable')!.category).toBe('Τρόφιμα');
    validateFinanceData(moved);
  });
  it('also retargets future child budgets on a parent-category rename, preserving stable identities',()=>{
    const {data,parent,child}=fixture();
    const renamed=applyTaxonomyOperation(data,{type:'rename-category',kind:'expense',identityId:parent.id,label:'Νέα τρόφιμα'},'2026-08-23');
    expect(renamed.state.budgets!.filter(b=>b.month==='2026-09').map(b=>b.category)).toEqual(['Νέα τρόφιμα','Νέα τρόφιμα']);
    expect(renamed.state.budgets!.find(b=>b.id==='future-stable')).toMatchObject({categoryIdentityId:parent.id,subcategoryIdentityId:child.id});
    expect(renamed.state.budgets!.find(b=>b.id==='historic-budget')?.category).toBe('Τρόφιμα');
  });
});
