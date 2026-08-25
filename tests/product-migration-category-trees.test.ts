import { describe, expect, it } from 'vitest';
import { migrateProductData } from '../src/lib/productMigration.js';
import { qaFinanceData } from '../src/qaFixture.js';

const expenseTree=[
  {name:'Καθημερινά',subcategories:['Καφές','Ψώνια']},
  {name:'Μετακίνηση',subcategories:['Καύσιμα']},
];
const incomeTree=[
  {name:'Εργασία',subcategories:['Μισθός','Bonus']},
];

describe('product migration category trees',()=>{
  it('preserves expense and income category trees across read-time migration',()=>{
    const data=qaFinanceData();
    data.state.settings.expenseCategoryTree=expenseTree;
    data.state.settings.incomeCategoryTree=incomeTree;

    const migrated=migrateProductData(data);

    expect(migrated.state.settings.expenseCategoryTree).toEqual(expenseTree);
    expect(migrated.state.settings.incomeCategoryTree).toEqual(incomeTree);
  });

  it('keeps older data without category trees backwards compatible',()=>{
    const data=qaFinanceData();
    delete data.state.settings.expenseCategoryTree;
    delete data.state.settings.incomeCategoryTree;

    const migrated=migrateProductData(data);

    expect(migrated.state.settings.expenseCategoryTree).toBeUndefined();
    expect(migrated.state.settings.incomeCategoryTree).toBeUndefined();
    expect(migrated.state.settings.expenseCategories).toEqual(data.state.settings.expenseCategories);
    expect(migrated.state.settings.incomeCategories).toEqual(data.state.settings.incomeCategories);
  });
});
