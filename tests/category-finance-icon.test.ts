import { describe, expect, it } from 'vitest';
import { explicitFinanceCategoryIcon } from '../src/lib/categoryFinanceIcon.js';
import { ensureCategoryIdentities, moveSubcategoryIdentity, renameCategoryIdentity, renameSubcategoryIdentity } from '../src/lib/categoryIdentity.js';
import { withCategoryIcon, withSubcategoryIconOverride } from '../src/lib/categoryIconPreferences.js';
import type { FinanceSettings } from '../src/types.js';

const settings=():FinanceSettings=>({
  excludedFromAvailable:[],accountNames:{},expenseCategories:['Τρόφιμα','Όχημα'],incomeCategories:['Μισθός'],
  expenseCategoryTree:[{name:'Τρόφιμα',subcategories:['Καφές']},{name:'Όχημα',subcategories:[]}],
  incomeCategoryTree:[{name:'Μισθός',subcategories:[]}],customPresets:[],pinnedPresets:[],
  defaultExpenseAccount:'cash',defaultIncomeAccount:'cash',defaultLoanAccount:'cash',
});

describe('explicit finance category icon resolution',()=>{
  it('prefers a subcategory override over the parent icon',()=>{
    let next=withCategoryIcon(settings(),'expense','Τρόφιμα','dining');
    next=withSubcategoryIconOverride(next,'expense','Τρόφιμα','Καφές','coffee');
    expect(explicitFinanceCategoryIcon(next,{kind:'expense',category:'Τρόφιμα',subcategory:'Καφές'})).toBe('coffee');
  });

  it('resolves a historical category alias to the current explicit icon after rename',()=>{
    let next=ensureCategoryIdentities(settings());
    const category=Object.values(next.categoryIdentities??{}).find(item=>item.kind==='expense'&&!item.parentId&&item.label==='Τρόφιμα');
    expect(category).toBeTruthy();
    next=withCategoryIcon(next,'expense','Τρόφιμα','dining');
    next=renameCategoryIdentity(next,'expense',category!.id,'Εστίαση');
    expect(explicitFinanceCategoryIcon(next,{kind:'expense',category:'Τρόφιμα'})).toBe('dining');
    expect(explicitFinanceCategoryIcon(next,{kind:'expense',category:'Εστίαση'})).toBe('dining');
  });

  it('resolves historical subcategory aliases after rename',()=>{
    let next=ensureCategoryIdentities(settings());
    const child=Object.values(next.categoryIdentities??{}).find(item=>item.kind==='expense'&&item.parentId&&item.label==='Καφές');
    expect(child).toBeTruthy();
    next=withSubcategoryIconOverride(next,'expense','Τρόφιμα','Καφές','coffee');
    next=renameSubcategoryIdentity(next,'expense',child!.id,'Καφέδες');
    expect(explicitFinanceCategoryIcon(next,{kind:'expense',category:'Τρόφιμα',subcategory:'Καφές'})).toBe('coffee');
    expect(explicitFinanceCategoryIcon(next,{kind:'expense',category:'Τρόφιμα',subcategory:'Καφέδες'})).toBe('coffee');
  });

  it('follows stable subcategory identity to the current parent after a move',()=>{
    let next=ensureCategoryIdentities(settings());
    const records=next.categoryIdentities??{};
    const child=Object.values(records).find(item=>item.kind==='expense'&&item.parentId&&item.label==='Καφές');
    const target=Object.values(records).find(item=>item.kind==='expense'&&!item.parentId&&item.label==='Όχημα');
    expect(child).toBeTruthy();expect(target).toBeTruthy();
    next=withCategoryIcon(next,'expense','Τρόφιμα','dining');
    next=withCategoryIcon(next,'expense','Όχημα','car');
    next=moveSubcategoryIdentity(next,'expense',child!.id,target!.id);
    expect(explicitFinanceCategoryIcon(next,{kind:'expense',category:'Τρόφιμα',subcategory:'Καφές'})).toBe('car');
    expect(explicitFinanceCategoryIcon(next,{kind:'expense',category:'Όχημα',subcategory:'Καφές'})).toBe('car');
  });

  it('returns null when there is no valid explicit preference so heuristic fallback remains authoritative',()=>{
    expect(explicitFinanceCategoryIcon(settings(),{kind:'expense',category:'Τρόφιμα',subcategory:'Καφές'})).toBeNull();
  });
});
