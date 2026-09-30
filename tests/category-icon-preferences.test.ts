import { describe, expect, it } from 'vitest';
import { activeCategoryIconPack, explicitCategoryIconColor, explicitSubcategoryIcon, removeCategoryIconPreferences, renameCategoryIconPreferences, resolvedCategoryIcon, resolvedCategoryIconColor, withCategoryIcon, withCategoryIconColor, withCategoryIconPack, withSubcategoryIconOverride } from '../src/lib/categoryIconPreferences.js';
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


  it('remembers a different icon choice for each family and restores it when the family changes',()=>{
    let next=withCategoryIconPack(settings(),'lucide');
    next=withCategoryIcon(next,'expense','Φαγητό','dining');
    next=withCategoryIconPack(next,'tabler');
    next=withCategoryIcon(next,'expense','Φαγητό','tabler:shopping');
    expect(activeCategoryIconPack(next)).toBe('tabler');
    expect(resolvedCategoryIcon(next,'expense','Φαγητό')).toBe('tabler:shopping');
    next=withCategoryIconPack(next,'lucide');
    expect(resolvedCategoryIcon(next,'expense','Φαγητό')).toBe('dining');
    next=withCategoryIconPack(next,'tabler');
    expect(resolvedCategoryIcon(next,'expense','Φαγητό')).toBe('tabler:shopping');
  });

  it('changes automatic category previews to the selected family even before a custom icon is chosen',()=>{
    let next=withCategoryIconPack(settings(),'phosphor');
    expect(resolvedCategoryIcon(next,'expense','Φαγητό','Καφές')).toBe('phosphor:coffee');
    next=withCategoryIconPack(next,'heroicons');
    expect(resolvedCategoryIcon(next,'expense','Φαγητό','Καφές')).toBe('heroicons:shopping');
  });

  it('never renders an unsupported automatic semantic key for a selected icon family',()=>{
    let next=withCategoryIconPack(settings(),'phosphor');
    expect(resolvedCategoryIcon(next,'income','Μισθός')).toBe('phosphor:government');
    next=withCategoryIconPack(next,'heroicons');
    expect(resolvedCategoryIcon(next,'income','Μισθός')).toBe('heroicons:government');
  });

  it('persists category color independently from the icon family and restores automatic color when cleared',()=>{
    let next=withCategoryIconPack(settings(),'tabler');
    next=withCategoryIconColor(next,'expense','Φαγητό','#d14c5a');
    expect(explicitCategoryIconColor(next,'expense','Φαγητό')).toBe('#D14C5A');
    expect(resolvedCategoryIconColor(next,'expense','Φαγητό','Καφές')).toBe('#D14C5A');
    next=withCategoryIconPack(next,'lucide');
    expect(resolvedCategoryIconColor(next,'expense','Φαγητό')).toBe('#D14C5A');
    next=withCategoryIconColor(next,'expense','Φαγητό',null);
    expect(resolvedCategoryIconColor(next,'expense','Φαγητό')).toBeNull();
  });

  it('fails safely for retired or unknown explicit icon keys and unknown taxonomy labels',()=>{
    const next={...settings(),categoryIcons:{'expense:Αδιαμόρφωτη':'missing-icon'}};
    expect(resolvedCategoryIcon(next,'expense','Αδιαμόρφωτη')).toBeNull();
  });

  it('ignores remembered or legacy icon keys that the selected curated pack cannot render distinctly',()=>{
    const stale=settings();
    stale.categoryIconPack='heroicons';
    stale.categoryIconPackSelections={'expense:Φαγητό':{heroicons:'dining'}};
    stale.categoryIcons={'expense:Φαγητό':'heroicons:dining'};
    expect(resolvedCategoryIcon(stale,'expense','Φαγητό')).not.toBe('heroicons:dining');
    expect(resolvedCategoryIcon(stale,'expense','Φαγητό')).toMatch(/^heroicons:/);

    const next=withCategoryIcon(stale,'expense','Φαγητό','heroicons:dining');
    expect(next.categoryIconPackSelections?.['expense:Φαγητό']?.heroicons).toBeUndefined();
  });

});
