import { describe, expect, it } from 'vitest';
import { qaFinanceData } from '../src/qaFixture.js';
import { ensureCategoryIdentities, resolveCategoryIdentity } from '../src/lib/categoryIdentity.js';
import { OWNER_EXPENSE_TREE, OWNER_INCOME_TREE, prepareApprovedOwnerTaxonomy } from '../src/lib/ownerApprovedTaxonomy.js';
import type { CategoryDefinition } from '../src/types.js';

const oldExpense=['Φαγητό','Καφές','Σούπερ μάρκετ','Τσιγάρα','Ψιλικά','Μετακίνηση','Όχημα','Λογαριασμοί','Τηλεπικοινωνίες','Συνδρομές','Αγορές','Σπίτι','Υγεία','Ταξίδια','Ψυχαγωγία','Δώρα / οικογένεια','Δόσεις / δάνεια','Άλλο'];
const oldIncome=['Μισθός','Επιστροφή χρημάτων','Δώρο / οικογένεια','Πώληση','Κατάθεση','Άλλο έσοδο'];
function fixture(){
  const data=structuredClone(qaFinanceData());
  data.seed.transactions=[];
  data.seed.recurring=[];
  data.state.recurringCustom=[{id:'fixture-recurring',name:'Streaming fixture',amount:10,accountId:'cash',category:'Συνδρομές',active:true}];
  data.state.recurringOverrides={};
  data.state.budgets=[{id:'fixture-budget',month:'2026-10',scope:'category',category:'Λογαριασμοί',amount:200,alertThreshold:0.8,createdAt:'2026-10-01T00:00:00.000Z',updatedAt:'2026-10-01T00:00:00.000Z'}];
  data.state.scheduled=[];
  data.state.transactionRules=[];
  data.state.events=[];
  data.state.settings.expenseCategories=[...oldExpense];
  data.state.settings.incomeCategories=[...oldIncome];
  data.state.settings.expenseCategoryTree=oldExpense.map(name=>({name,subcategories:name==='Όχημα'?['Καύσιμα','Συντήρηση & Service','Ασφάλεια','Parking & Διόδια']:[]}));
  data.state.settings.incomeCategoryTree=oldIncome.map(name=>({name,subcategories:[]}));
  data.state.settings.categoryIdentities={};
  data.state.settings=ensureCategoryIdentities(data.state.settings);
  return data;
}

describe('owner-approved taxonomy staging (pure and history-preserving)',()=>{
  it('stages all 20/6 names and exact subcategory ordering',()=>{
    const input=fixture();
    const before=structuredClone(input);
    const oldDigitalId=resolveCategoryIdentity(input.state.settings,'expense','Συνδρομές')!.id;
    const next=prepareApprovedOwnerTaxonomy(input,'2026-10-23');
    expect(next.state.settings.expenseCategoryTree).toEqual(OWNER_EXPENSE_TREE);
    expect(next.state.settings.incomeCategoryTree).toEqual(OWNER_INCOME_TREE);
    expect(next.state.settings.expenseCategories).toEqual(OWNER_EXPENSE_TREE.map(item=>item.name));
    expect(next.state.settings.incomeCategories).toEqual(OWNER_INCOME_TREE.map(item=>item.name));
    expect(next.state.settings.expenseCategoryTree).toHaveLength(20);
    expect(next.state.settings.incomeCategoryTree).toHaveLength(6);
    expect(resolveCategoryIdentity(next.state.settings,'expense','Ψηφιακή υπηρεσία')?.id).toBe(oldDigitalId);
    expect(resolveCategoryIdentity(next.state.settings,'expense','Συνδρομές')?.id).toBe(oldDigitalId);
    expect(next.state.recurringCustom[0].category).toBe('Ψηφιακή υπηρεσία');
    expect(next.state.budgets?.[0].category).toBe('Λογαριασμός κατοικίας');
    expect(next.state.events).toEqual(before.state.events);
    expect(input).toEqual(before);
    expect(prepareApprovedOwnerTaxonomy(next,'2026-10-23').state.settings).toEqual(next.state.settings);
  });
  it('rejects unknown existing categories rather than silently dropping custom owner data',()=>{
    const input=fixture();
    input.state.settings.expenseCategoryTree!.push({name:'Προσωπική ειδική',subcategories:[]} as CategoryDefinition);
    input.state.settings.expenseCategories.push('Προσωπική ειδική');
    expect(()=>prepareApprovedOwnerTaxonomy(input,'2026-10-23')).toThrow(/Unexpected active categories/);
  });
  it('retains retired category identities for historic names',()=>{
    const input=fixture();
    const oldId=resolveCategoryIdentity(input.state.settings,'income','Κατάθεση')!.id;
    const next=prepareApprovedOwnerTaxonomy(input,'2026-10-23');
    expect(next.state.settings.incomeCategories).not.toContain('Κατάθεση');
    expect(resolveCategoryIdentity(next.state.settings,'income','Κατάθεση')?.id).toBe(oldId);
  });
});
