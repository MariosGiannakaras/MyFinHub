import { describe, expect, it } from 'vitest';
import { explicitSubcategoryIcon, removeCategoryIconPreferences, renameCategoryIconPreferences, resolvedCategoryIcon, withCategoryIcon, withSubcategoryIconOverride } from '../src/lib/categoryIconPreferences.js';
import type { FinanceSettings } from '../src/types.js';

const settings=():FinanceSettings=>({excludedFromAvailable:[],accountNames:{},expenseCategories:['Φαγητό'],incomeCategories:['Μισθός'],expenseCategoryTree:[{name:'Φαγητό',subcategories:['Καφές']}],incomeCategoryTree:[{name:'Μισθός',subcategories:[]}],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'cash',defaultIncomeAccount:'cash',defaultLoanAccount:'cash'});

describe('category icon preferences',()=>{
  it('uses a specific semantic icon for a recognizable subcategory before parent inheritance',()=>{
    const next=withCategoryIcon(settings(),'expense','Φαγητό','dining');
    expect(resolvedCategoryIcon(next,'expense','Φαγητό','Καφές')).toBe('coffee');
    expect(explicitSubcategoryIcon(next,'expense','Φαγητό','Καφές')).toBeNull();
  });

  it('allows an optional subcategory override and restores semantic resolution when cleared',()=>{
    const parent=withCategoryIcon(settings(),'expense','Φαγητό','dining');
    const overridden=withSubcategoryIconOverride(parent,'expense','Φαγητό','Καφές','gift');
    expect(resolvedCategoryIcon(overridden,'expense','Φαγητό','Καφές')).toBe('gift');
    const automatic=withSubcategoryIconOverride(overridden,'expense','Φαγητό','Καφές',null);
    expect(resolvedCategoryIcon(automatic,'expense','Φαγητό','Καφές')).toBe('coffee');
  });

  it('moves icon metadata when a category is renamed and falls back to semantic defaults when removed',()=>{
    let next=withCategoryIcon(settings(),'expense','Φαγητό','gift');
    next=withSubcategoryIconOverride(next,'expense','Φαγητό','Καφές','coffee');
    next=renameCategoryIconPreferences(next,'expense','Φαγητό','Εστίαση');
    expect(resolvedCategoryIcon(next,'expense','Εστίαση','Καφές')).toBe('coffee');
    next=removeCategoryIconPreferences(next,'expense','Εστίαση');
    expect(resolvedCategoryIcon(next,'expense','Εστίαση','Καφές')).toBe('coffee');
    expect(resolvedCategoryIcon(next,'expense','Εστίαση')).toBe('dining');
  });

  it('maps common finance taxonomy labels to distinct semantic defaults',()=>{
    const source=settings();
    expect(resolvedCategoryIcon(source,'expense','Όχημα','Καύσιμα')).toBe('fuel');
    expect(resolvedCategoryIcon(source,'expense','Όχημα','Parking & Διόδια')).toBe('parking');
    expect(resolvedCategoryIcon(source,'expense','Υγεία','Φαρμακείο')).toBe('pharmacy');
    expect(resolvedCategoryIcon(source,'expense','Στέγαση','Ρεύμα')).toBe('electricity');
    expect(resolvedCategoryIcon(source,'income','Μισθός')).toBe('salary');
  });

  it('fails safely for retired or unknown explicit icon keys and unknown taxonomy labels',()=>{
    const next={...settings(),categoryIcons:{'expense:Αδιαμόρφωτη':'missing-icon'}};
    expect(resolvedCategoryIcon(next,'expense','Αδιαμόρφωτη')).toBeNull();
  });
});
