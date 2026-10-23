import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { categoryTree } from '../src/lib/categories.js';
import { ensureCategoryIdentities, resolveCategoryIdentity } from '../src/lib/categoryIdentity.js';
import { applyTaxonomyOperationToSettings } from '../src/lib/taxonomyManagement.js';
import type { FinanceSettings } from '../src/types.js';

const read=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const settings=():FinanceSettings=>ensureCategoryIdentities({
  excludedFromAvailable:[],accountNames:{},
  expenseCategories:['Τρόφιμα','Συνδρομές'],incomeCategories:['Μισθός'],
  expenseCategoryTree:[{name:'Τρόφιμα',subcategories:['Καφές']},{name:'Συνδρομές',subcategories:['Internet']}],
  incomeCategoryTree:[{name:'Μισθός',subcategories:['Bonus']}],
  customPresets:[],pinnedPresets:[],defaultExpenseAccount:'cash',defaultIncomeAccount:'cash',defaultLoanAccount:'cash'
});
describe('all category/subcategory options follow revisioned finance settings',()=>{
  it('rebuilds the canonical tree after synthetic add, rename, subcategory update and persisted JSON reload',()=>{
    let configured=settings();
    const before=categoryTree(configured,'expense');
    expect(before.map(c=>c.name)).toEqual(['Τρόφιμα','Συνδρομές']);
    const updated=applyTaxonomyOperationToSettings(configured,{type:'add-category',kind:'expense',label:'QA Νέα κατηγορία'});
    const identity=resolveCategoryIdentity(updated,'expense','QA Νέα κατηγορία');
    expect(identity).toBeDefined();
    configured=applyTaxonomyOperationToSettings(updated,{type:'add-subcategory',kind:'expense',parentId:identity!.id,label:'QA Νέα υποκατηγορία'});
    configured=applyTaxonomyOperationToSettings(configured,{type:'rename-category',kind:'expense',identityId:identity!.id,label:'QA Ενημερωμένη'});
    const hydrated=JSON.parse(JSON.stringify(configured)) as FinanceSettings;
    expect(categoryTree(hydrated,'expense').find(c=>c.name==='QA Ενημερωμένη')?.subcategories).toContain('QA Νέα υποκατηγορία');
    expect(categoryTree(hydrated,'expense').map(c=>c.name)).toContain('Συνδρομές');
    expect(categoryTree(hydrated,'income')).toEqual([{name:'Μισθός',subcategories:['Bonus']}]);
    expect(categoryTree(settings(),'expense')).not.toEqual(categoryTree(hydrated,'expense'));
  });
  it('uses full canonical trees on all editable transaction, card, receipt and filter surfaces',()=>{
    const quick=read('src/components/QuickAdd.tsx');
    const credit=read('src/pages/CreditCardPage.tsx');
    const inbox=read('src/components/ReceiptInbox.tsx');
    const legacy=read('src/components/LegacyTransactionEditor.tsx');
    const planning=read('src/pages/PlanningPage.tsx');
    const recurring=read('src/pages/RecurringPage.tsx');
    const rules=read('src/components/TransactionRulesWorkspace.tsx');
    const ledger=read('src/pages/TransactionsPage.tsx');
    for(const [name,source] of Object.entries({quick,credit,inbox,legacy,planning,recurring,rules})){
      expect(source,`${name}: canonical owner settings`).toContain('data.state.settings');
      expect(source,`${name}: shared taxonomy choice`).toContain('CategorySelectInput');
    }
    expect(quick).not.toContain('genericOnly');
    expect(credit).not.toContain('genericOnly');
    expect(quick).not.toContain('genericCategoryTree(');
    expect(credit).not.toContain('genericCategoryTree(');
    expect(quick).toContain("categoryTree(data.state.settings,'expense')");
    // Credit purchases adopted the shared taxonomy owner; requiring a second
    // page-local categoryTree() scan would reintroduce duplicated picker logic.
    expect(credit).toContain('<CategorySelectInput settings={data.state.settings} kind="expense"');
    expect(credit).toContain('subcategory={subcategory}');
    expect(inbox).toContain("subcategory={reviewed.subcategory??''}");
    expect(ledger).toContain("categoryTree(data.state.settings,kind as 'expense'|'income')");
    expect(ledger).toContain('...sourceRows.map(row=>categoryLabel(row))');
    const selector=read('src/components/CategorySelectInput.tsx');
    expect(selector).toContain('categoryTree(settings,kind)');
    expect(selector).toContain('item.subcategories.map');
    expect(selector).toContain('data-option-level="invalid"');
    const budget=read('src/components/BudgetRuleSettings.tsx');
    expect(budget).toContain("includeSubcategories={budgetScope==='subcategory'}"); // child budgets use the complete canonical taxonomy
    expect(budget).toContain('<option value="subcategory">Υποκατηγορία</option>');
    expect(budget).toContain('scope:');
  });
  it('keeps authoritative revisioned save and reload rather than a stale local category cache',()=>{
    const finance=read('src/hooks/useFinance.ts');
    const picker=read('src/components/CategorySelectInput.tsx');
    const browser=read('scripts/taxonomy-management-qa.mjs');
    expect(finance).toContain('applyDataEnvelope(nextData)');
    expect(finance).toContain('const next = recipe(current)');
    expect(finance).toContain('coordinator.enqueue');
    expect(finance).toContain("message.type !== 'revision'");
    expect(picker).toContain('[settings,kind,genericOnly]');
    expect(browser).toContain('just-added renamed category appears in Quick Entry');
    expect(browser).toContain('moved and renamed subcategory appears in Quick Entry');
  });
});
