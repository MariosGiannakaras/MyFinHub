import { describe, expect, it } from 'vitest';
import {
  ensureCategoryIdentities,
  moveSubcategoryIdentity,
  renameCategoryIdentity,
  renameSubcategoryIdentity,
  resolveCategoryIdentity,
  resolveSubcategoryIdentity,
} from '../src/lib/categoryIdentity.js';
import { categoryIconPreferenceKey, subcategoryIconPreferenceKey } from '../src/lib/categoryIconPreferences.js';
import { migrateProductData } from '../src/lib/productMigration.js';
import type { FinanceData, FinanceSettings } from '../src/types.js';

const settings=():FinanceSettings=>({
  excludedFromAvailable:[],
  accountNames:{},
  expenseCategories:['Φαγητό','Μετακινήσεις'],
  incomeCategories:['Μισθός'],
  expenseCategoryTree:[
    {name:'Φαγητό',subcategories:['Supermarket','Εστιατόριο']},
    {name:'Μετακινήσεις',subcategories:['Καύσιμα']},
  ],
  incomeCategoryTree:[{name:'Μισθός',subcategories:[]}],
  categoryIcons:{[categoryIconPreferenceKey('expense','Φαγητό')]:'utensils'},
  subcategoryIcons:{[subcategoryIconPreferenceKey('expense','Φαγητό','Supermarket')]:'shopping-cart'},
  customPresets:[],
  pinnedPresets:[],
  defaultExpenseAccount:'cash',
  defaultIncomeAccount:'cash',
  defaultLoanAccount:'cash',
});

function financeData():FinanceData{
  return {
    app:'RheomIQ',schemaVersion:3,updatedAt:'2026-08-23T00:00:00.000Z',
    seed:{
      accounts:[],months:[],
      transactions:[{id:'legacy-1',date:'2026-01-01',type:'expense',accountId:'cash',amount:12,note:'παλιά εγγραφή',category:'Φαγητό',subcategory:'Supermarket'}],
      snapshots:[],recurring:[],subscriptions:[],loans:[],lending:[],stats:{},
    },
    state:{
      customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],settings:settings(),events:[],
    },
  };
}

describe('stable category identities',()=>{
  it('assigns deterministic category and subcategory ids and remains idempotent',()=>{
    const first=ensureCategoryIdentities(settings());
    const food=resolveCategoryIdentity(first,'expense','Φαγητό');
    const market=resolveSubcategoryIdentity(first,'expense','Φαγητό','Supermarket');
    expect(food?.id).toMatch(/^cat-expense-/);
    expect(market?.id).toMatch(/^sub-expense-/);
    expect(market?.parentId).toBe(food?.id);

    const second=ensureCategoryIdentities(JSON.parse(JSON.stringify(first)) as FinanceSettings);
    expect(resolveCategoryIdentity(second,'expense','Φαγητό')?.id).toBe(food?.id);
    expect(resolveSubcategoryIdentity(second,'expense','Φαγητό','Supermarket')?.id).toBe(market?.id);
  });

  it('renames a category as a label change while preserving identity and reserving its historical alias',()=>{
    const initial=ensureCategoryIdentities(settings());
    const food=resolveCategoryIdentity(initial,'expense','Φαγητό');
    const transport=resolveCategoryIdentity(initial,'expense','Μετακινήσεις');
    if(!food||!transport)throw new Error('missing category identity');
    const renamed=renameCategoryIdentity(initial,'expense',food.id,'Τρόφιμα & φαγητό');

    expect(resolveCategoryIdentity(renamed,'expense','Τρόφιμα & φαγητό')?.id).toBe(food.id);
    expect(resolveCategoryIdentity(renamed,'expense','Φαγητό')?.id).toBe(food.id);
    expect(renamed.expenseCategoryTree?.[0].name).toBe('Τρόφιμα & φαγητό');
    expect(renamed.categoryIcons?.[categoryIconPreferenceKey('expense','Τρόφιμα & φαγητό')]).toBe('utensils');
    expect(renamed.categoryIcons?.[categoryIconPreferenceKey('expense','Φαγητό')]).toBeUndefined();
    expect(()=>renameCategoryIdentity(renamed,'expense',transport.id,'Φαγητό')).toThrow(/παλιό όνομα/);
  });

  it('renames and moves a subcategory without changing its identity or breaking historical paths',()=>{
    const initial=ensureCategoryIdentities(settings());
    const market=resolveSubcategoryIdentity(initial,'expense','Φαγητό','Supermarket');
    const restaurant=resolveSubcategoryIdentity(initial,'expense','Φαγητό','Εστιατόριο');
    const food=resolveCategoryIdentity(initial,'expense','Φαγητό');
    const transport=resolveCategoryIdentity(initial,'expense','Μετακινήσεις');
    if(!market||!restaurant||!food||!transport)throw new Error('missing taxonomy identity');

    const renamed=renameSubcategoryIdentity(initial,'expense',market.id,'Σούπερ μάρκετ');
    expect(resolveSubcategoryIdentity(renamed,'expense','Φαγητό','Supermarket')?.id).toBe(market.id);
    expect(resolveSubcategoryIdentity(renamed,'expense','Φαγητό','Σούπερ μάρκετ')?.id).toBe(market.id);
    expect(renamed.subcategoryIcons?.[subcategoryIconPreferenceKey('expense','Φαγητό','Σούπερ μάρκετ')]).toBe('shopping-cart');

    const moved=moveSubcategoryIdentity(renamed,'expense',market.id,transport.id);
    expect(resolveSubcategoryIdentity(moved,'expense','Μετακινήσεις','Σούπερ μάρκετ')?.id).toBe(market.id);
    expect(resolveSubcategoryIdentity(moved,'expense','Φαγητό','Supermarket')?.id).toBe(market.id);
    expect(moved.categoryIdentities?.[market.id].parentId).toBe(transport.id);
    expect(moved.categoryIdentities?.[market.id].parentAliases).toContain(food.id);
    expect(moved.subcategoryIcons?.[subcategoryIconPreferenceKey('expense','Μετακινήσεις','Σούπερ μάρκετ')]).toBe('shopping-cart');
    expect(()=>renameSubcategoryIdentity(moved,'expense',restaurant.id,'Supermarket')).toThrow(/παλιό όνομα/);
  });

  it('adds identity metadata during product migration without rewriting historical category strings',()=>{
    const input=financeData();
    const first=migrateProductData(input);
    const food=resolveCategoryIdentity(first.state.settings,'expense','Φαγητό');
    const market=resolveSubcategoryIdentity(first.state.settings,'expense','Φαγητό','Supermarket');
    expect(food).not.toBeNull();
    expect(market).not.toBeNull();
    expect(first.seed.transactions[0].category).toBe('Φαγητό');
    expect(first.seed.transactions[0].subcategory).toBe('Supermarket');

    const second=migrateProductData(JSON.parse(JSON.stringify(first)) as FinanceData);
    expect(resolveCategoryIdentity(second.state.settings,'expense','Φαγητό')?.id).toBe(food?.id);
    expect(resolveSubcategoryIdentity(second.state.settings,'expense','Φαγητό','Supermarket')?.id).toBe(market?.id);
  });
});
