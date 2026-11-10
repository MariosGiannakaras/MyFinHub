import { describe, expect, it } from 'vitest';
import { categoryTree } from '../src/lib/categories.js';
import { resolvedCategoryIcon, withCategoryIcon, withCategoryIconPack } from '../src/lib/categoryIconPreferences.js';
import { inferredCategoryIcon } from '../src/lib/categoryIconInference.js';
import { CATEGORY_SEMANTIC_CATALOG_DEFAULTS } from '../src/lib/categoryIconSemanticDefaults.js';
import { OWNER_EXPENSE_TREE, OWNER_INCOME_TREE } from '../src/lib/ownerApprovedTaxonomy.js';
import { qaFinanceData } from '../src/qaFixture.js';

describe('category icon semantic coverage',()=>{
  it('resolves 97 owner-approved taxonomy paths through real catalog symbols in all five packs (#649 I17.03)',()=>{
    const paths=[
      ...OWNER_EXPENSE_TREE.flatMap(category=>[{kind:'expense' as const,category:category.name,subcategory:null},...category.subcategories.map(subcategory=>({kind:'expense' as const,category:category.name,subcategory}))]),
      ...OWNER_INCOME_TREE.flatMap(category=>[{kind:'income' as const,category:category.name,subcategory:null},...category.subcategories.map(subcategory=>({kind:'income' as const,category:category.name,subcategory}))]),
    ];
    expect(paths).toHaveLength(97);
    const resolved=paths.map(path=>{
      const direct=inferredCategoryIcon(path.kind,path.subcategory??path.category);
      const inherited=direct?null:path.subcategory?inferredCategoryIcon(path.kind,path.category):null;
      return {...path,semantic:direct??inherited,coverage:direct?'direct':inherited?'inherited':'unresolved'};
    });
    expect(resolved.filter(item=>item.coverage==='direct')).toHaveLength(83);
    expect(resolved.filter(item=>item.coverage==='inherited')).toHaveLength(14);
    expect(resolved.filter(item=>item.coverage==='unresolved')).toHaveLength(0);
    for(const pack of ['lucide','tabler','phosphor','heroicons','bootstrap'] as const){
      const settings=withCategoryIconPack({...qaFinanceData().state.settings,categoryIcons:{},subcategoryIcons:{},categoryIconPackSelections:{},subcategoryIconPackSelections:{}},pack);
      for(const item of resolved){
        expect(item.semantic,item.kind+' '+item.category+' / '+(item.subcategory??'')).not.toBeNull();
        const symbol=CATEGORY_SEMANTIC_CATALOG_DEFAULTS[pack][item.semantic!];
        expect(symbol,pack+' missing semantic catalog key '+item.semantic).toBeTruthy();
        expect(resolvedCategoryIcon(settings,item.kind,item.category,item.subcategory??undefined)).toBe(pack+':icon/'+symbol);
      }
    }
    const defaults=withCategoryIconPack({...qaFinanceData().state.settings,categoryIcons:{},categoryIconPackSelections:{}},'phosphor');
    const customized=withCategoryIcon(defaults,'expense','Ταξίδι','phosphor:icon/airplane');
    expect(resolvedCategoryIcon(customized,'expense','Ταξίδι')).toBe('phosphor:icon/airplane');
    expect(resolvedCategoryIcon(defaults,'expense','Ταξίδι')).toBe('phosphor:icon/suitcase');
  });
  it('distinguishes travel/taxi, yields/installments and approved owner financial roles (#649 I17.03)',()=>{
    expect(inferredCategoryIcon('expense','Ταξί')).toBe('taxi');
    expect(inferredCategoryIcon('expense','Ταξίδι')).toBe('travel');
    expect(inferredCategoryIcon('income','Τόκος & Απόδοση')).toBe('investment');
    expect(inferredCategoryIcon('income','Πιστωτικός τόκος')).toBe('investment');
    expect(inferredCategoryIcon('expense','Χρεωστικός τόκος & Επιβάρυνση')).toBe('bank-fee');
    expect(inferredCategoryIcon('expense','Δόση')).toBe('installment');
    expect(inferredCategoryIcon('income','Κρατική / Ασφαλιστική παροχή')).toBe('government');
    expect(inferredCategoryIcon('expense','Ψηφιακή υπηρεσία')).toBe('subscription');
    expect(inferredCategoryIcon('expense','Αεροπορικό εισιτήριο')).toBe('flight');
    expect(inferredCategoryIcon('expense','Ακτοπλοϊκό εισιτήριο')).toBe('ferry');
  });

  it('gives the current expense taxonomy broad visual differentiation',()=>{
    const settings=qaFinanceData().state.settings;
    const categories=categoryTree(settings,'expense');
    const resolved=categories.map(category=>resolvedCategoryIcon(settings,'expense',category.name));
    const nonNull=resolved.filter((value):value is string=>Boolean(value));
    expect(nonNull.length).toBe(categories.length);
    expect(new Set(nonNull).size).toBeGreaterThanOrEqual(13);
  });

  it('does not collapse vehicle subcategories onto the parent car glyph',()=>{
    const settings=qaFinanceData().state.settings;
    const expected=new Map([
      ['Καύσιμα','fuel'],
      ['Συντήρηση & Service','service'],
      ['Ασφάλεια','insurance'],
      ['Parking & Διόδια','parking'],
    ]);
    for(const [subcategory,icon] of expected){
      expect(resolvedCategoryIcon(settings,'expense','Όχημα',subcategory)).toBe(icon);
    }
    expect(new Set([...expected.values()]).size).toBe(expected.size);
  });

  it('uses income semantics instead of the generic expense fallback',()=>{
    const settings=qaFinanceData().state.settings;
    expect(resolvedCategoryIcon(settings,'income','Μισθοδοσία')).toBe('salary');
    expect(resolvedCategoryIcon(settings,'income','Μισθός')).toBe('salary');
    expect(resolvedCategoryIcon(settings,'income','Άλλο')).toBe('income');
  });
});
