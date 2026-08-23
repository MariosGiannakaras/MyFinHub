import { describe, expect, it } from 'vitest';
import { explicitSubcategoryIcon, removeCategoryIconPreferences, renameCategoryIconPreferences, resolvedCategoryIcon, withCategoryIcon, withSubcategoryIconOverride } from '../src/lib/categoryIconPreferences.js';
import type { FinanceSettings } from '../src/types.js';

const settings=():FinanceSettings=>({excludedFromAvailable:[],accountNames:{},expenseCategories:['Φαγητό'],incomeCategories:['Μισθός'],expenseCategoryTree:[{name:'Φαγητό',subcategories:['Καφές']}],incomeCategoryTree:[{name:'Μισθός',subcategories:[]}],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'cash',defaultIncomeAccount:'cash',defaultLoanAccount:'cash'});

describe('category icon preferences',()=>{
  it('inherits the parent category icon when a subcategory has no override',()=>{
    const next=withCategoryIcon(settings(),'expense','Φαγητό','dining');
    expect(resolvedCategoryIcon(next,'expense','Φαγητό','Καφές')).toBe('dining');
    expect(explicitSubcategoryIcon(next,'expense','Φαγητό','Καφές')).toBeNull();
  });

  it('allows an optional subcategory override and restores inheritance when cleared',()=>{
    const parent=withCategoryIcon(settings(),'expense','Φαγητό','dining');
    const overridden=withSubcategoryIconOverride(parent,'expense','Φαγητό','Καφές','coffee');
    expect(resolvedCategoryIcon(overridden,'expense','Φαγητό','Καφές')).toBe('coffee');
    const inherited=withSubcategoryIconOverride(overridden,'expense','Φαγητό','Καφές',null);
    expect(resolvedCategoryIcon(inherited,'expense','Φαγητό','Καφές')).toBe('dining');
  });

  it('moves icon metadata when a category is renamed and removes it when the category is removed',()=>{
    let next=withCategoryIcon(settings(),'expense','Φαγητό','dining');
    next=withSubcategoryIconOverride(next,'expense','Φαγητό','Καφές','coffee');
    next=renameCategoryIconPreferences(next,'expense','Φαγητό','Εστίαση');
    expect(resolvedCategoryIcon(next,'expense','Εστίαση','Καφές')).toBe('coffee');
    next=removeCategoryIconPreferences(next,'expense','Εστίαση');
    expect(resolvedCategoryIcon(next,'expense','Εστίαση','Καφές')).toBeNull();
  });

  it('fails safely for retired or unknown explicit icon keys',()=>{
    const next={...settings(),categoryIcons:{'expense:Φαγητό':'missing-icon'}};
    expect(resolvedCategoryIcon(next,'expense','Φαγητό')).toBeNull();
  });
});
