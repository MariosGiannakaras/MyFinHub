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
  data.state.recurringCustom=[{id:'fixture-recurring',name:'Spotify + cloud storage',amount:10,accountId:'cash',category:'Συνδρομές',active:true}];
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
    const oldSubscriptionId=resolveCategoryIdentity(input.state.settings,'expense','Συνδρομές')!.id;
    const next=prepareApprovedOwnerTaxonomy(input,'2026-10-23');
    expect(next.state.settings.expenseCategoryTree).toEqual(OWNER_EXPENSE_TREE);
    expect(next.state.settings.incomeCategoryTree).toEqual(OWNER_INCOME_TREE);
    expect(next.state.settings.expenseCategories).toEqual(OWNER_EXPENSE_TREE.map(item=>item.name));
    expect(next.state.settings.incomeCategories).toEqual(OWNER_INCOME_TREE.map(item=>item.name));
    expect(next.state.settings.expenseCategoryTree).toHaveLength(20);
    expect(next.state.settings.incomeCategoryTree).toHaveLength(6);
    expect(resolveCategoryIdentity(next.state.settings,'expense','Ψηφιακή υπηρεσία')?.id).not.toBe(oldSubscriptionId);
    expect(resolveCategoryIdentity(next.state.settings,'expense','Συνδρομές')?.id).toBe(oldSubscriptionId);
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
  it('rejects ambiguous subscription purposes rather than silently making them digital',()=>{
    const data=fixture();
    data.state.recurringCustom[0].name='Unclassified service';
    expect(()=>prepareApprovedOwnerTaxonomy(data,'2026-10-23')).toThrow(/Επίλεξε πρώτα τον πραγματικό σκοπό/);
  });
  it('reclassifies known legacy demo providers and their Spotify-specific rule without rewriting history',()=>{
    const data=fixture();
    const original=data.state.recurringCustom[0];
    data.state.recurringCustom=[{...original,name:'Netflix'},{...original,id:'demo-icloud',name:'iCloud'}];
    data.state.transactionRules=[{
      id:'rule-subscriptions',name:'Συνδρομές',enabled:true,priority:20,
      scopes:['manual'],match:{description:'SPOTIFY',mode:'contains'},action:{category:'Συνδρομές'},
      createdAt:'2026-10-01T00:00:00.000Z',updatedAt:'2026-10-01T00:00:00.000Z'
    }];
    const next=prepareApprovedOwnerTaxonomy(data,'2026-10-23');
    expect(next.state.recurringCustom.map(item=>item.category)).toEqual(['Ψηφιακή υπηρεσία','Ψηφιακή υπηρεσία']);
    expect(next.state.transactionRules[0].action.category).toBe('Ψηφιακή υπηρεσία');
    expect(next.state.transactionRules[0].id).toBe('rule-subscriptions');
    expect(next.state.settings.expenseCategories).not.toContain('Συνδρομές');
    expect(prepareApprovedOwnerTaxonomy(next,'2026-10-23').state).toEqual(next.state);
  });
  it('refuses to retire a generic subscription rule without a recognized provider',()=>{
    const data=fixture();
    data.state.transactionRules=[{
      id:'generic-rule',name:'Οποιαδήποτε συνδρομή',enabled:true,priority:20,
      scopes:['manual'],match:{description:'SUBSCRIPTION',mode:'contains'},action:{category:'Συνδρομές'},
      createdAt:'2026-10-01T00:00:00.000Z',updatedAt:'2026-10-01T00:00:00.000Z'
    }];
    expect(()=>prepareApprovedOwnerTaxonomy(data,'2026-10-23')).toThrow(/Επίλεξε πρώτα τον πραγματικό σκοπό του στον επεξεργαστή κανόνων/);
  });
  it('does not reactivate retired categories just to rewrite stopped subscriptions',()=>{
    const data=fixture();
    data.state.recurringCustom[0].name='Historical unspecified subscription';
    data.state.recurringCustom[0].active=false;
    data.state.recurringCustom[0].status='stopped';
    const migrated=prepareApprovedOwnerTaxonomy(data,'2026-10-23');
    expect(migrated.state.recurringCustom[0].category).toBe('Συνδρομές');
    expect(migrated.state.settings.expenseCategories).not.toContain('Συνδρομές');
  });
  it('blocks retirement with an active rule referencing the old installment category',()=>{
    const data=fixture();
    data.state.transactionRules=[{id:'legacy-rule',name:'old loan default',enabled:true,priority:10,scopes:['manual'],match:{description:'loan',mode:'contains'},action:{category:'Δόσεις / δάνεια'},createdAt:'2026-10-01T00:00:00.000Z',updatedAt:'2026-10-01T00:00:00.000Z'}];
    expect(()=>prepareApprovedOwnerTaxonomy(data,'2026-10-23')).toThrow(/απόσυρση μπλοκάρεται/);
  });
  it('retains retired category identities for historic names',()=>{
    const input=fixture();
    const oldId=resolveCategoryIdentity(input.state.settings,'income','Κατάθεση')!.id;
    const next=prepareApprovedOwnerTaxonomy(input,'2026-10-23');
    expect(next.state.settings.incomeCategories).not.toContain('Κατάθεση');
    expect(resolveCategoryIdentity(next.state.settings,'income','Κατάθεση')?.id).toBe(oldId);
  });
});
