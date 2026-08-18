import { describe, expect, it } from 'vitest';
import { categoryPath, categoryTree, genericCategoryTree, parseCategoryTree } from '../src/lib/categories';
import type { FinanceSettings } from '../src/types';

const settings:FinanceSettings={excludedFromAvailable:[],accountNames:{},expenseCategories:['Όχημα','Συνδρομές','Φαγητό'],incomeCategories:['Μισθός'],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'cash',defaultIncomeAccount:'cash',defaultLoanAccount:'cash'};

describe('category taxonomy',()=>{
  it('seeds a restrained vehicle taxonomy without exploding flat categories',()=>{
    const vehicle=categoryTree(settings,'expense').find(item=>item.name==='Όχημα');
    expect(vehicle?.subcategories).toEqual(['Βενζίνη','Service','Συνεργείο','Ανταλλακτικά']);
  });

  it('keeps domain-specific subscription categories out of generic expense entry',()=>{
    expect(genericCategoryTree(settings,'expense').map(item=>item.name)).toEqual(['Όχημα','Φαγητό']);
  });

  it('parses editable parent and child categories',()=>{
    expect(parseCategoryTree('Όχημα > Βενζίνη, Service\nΦαγητό')).toEqual([{name:'Όχημα',subcategories:['Βενζίνη','Service']},{name:'Φαγητό',subcategories:[]}]);
    expect(categoryPath('Όχημα','Βενζίνη')).toBe('Όχημα › Βενζίνη');
  });
});
