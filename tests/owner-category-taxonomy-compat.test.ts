import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { installmentExpensePurpose, recurringExpensePurpose } from '../src/lib/linkedPaymentPurpose.js';
import { defaultCategory } from '../src/lib/categories.js';
import { qaFinanceData } from '../src/qaFixture.js';

describe('owner-approved taxonomy linked payment compatibility',()=>{
  it('does not let the first frequency-sorted category silently categorize unrelated entries',()=>{
    const settings={...qaFinanceData().state.settings,expenseCategories:['JobFood','Καφές','Άλλο'],incomeCategories:['Μισθοδοσία & Εργασία','Άλλο πραγματικό έσοδο'],expenseCategoryTree:undefined,incomeCategoryTree:undefined};
    expect(defaultCategory(settings,'expense')).toBe('Άλλο');
    expect(defaultCategory(settings,'income')).toBe('Άλλο πραγματικό έσοδο');
  });
  it('uses the recurring configuration category and subcategory as the expense purpose',()=>{
    expect(recurringExpensePurpose({category:'Ψηφιακή υπηρεσία',subcategory:'Streaming'})).toEqual({category:'Ψηφιακή υπηρεσία',subcategory:'Streaming'});
    expect(recurringExpensePurpose({category:'Τηλεπικοινωνίες'})).toEqual({category:'Τηλεπικοινωνίες'});
  });
  it('keeps installment payments out of retired Δόσεις / δάνεια and preserves explicit purpose',()=>{
    expect(installmentExpensePurpose({expenseCategory:'Όχημα',expenseSubcategory:'Service'})).toEqual({category:'Όχημα',subcategory:'Service'});
    expect(installmentExpensePurpose({})).toEqual({category:'Άλλο'});
  });
  it('keeps purpose only on actual expense payments, not on liability repayment or self-loan transfers',()=>{
    const source=readFileSync('src/components/ContextualQuickAdd.tsx','utf8');
    expect(source).toContain("if(isSelfLoan(loan))");
    expect(source).toContain("kind:'transfer'");
    expect(source).toContain("==='liability-repayment'");
    expect(source).toContain("kind:'card_payment'");
    expect(source).toContain("installmentExpensePurpose(loan)");
    expect(source).toContain("recurringExpensePurpose(recurring)");
    expect(source).toContain("if(purpose.subcategory)event.subcategory=purpose.subcategory;");
    expect(source).not.toContain("category:'Δόσεις / δάνεια'");
  });
  it('requires a confirmed owner finance save instead of direct SQL or silent automatic migration',()=>{
    const settings=readFileSync('src/pages/SettingsPage.tsx','utf8');
    expect(settings).toContain('open={pendingOwnerTaxonomy}');
    expect(settings).toContain('await onFinanceDurably(current=>prepareApprovedOwnerTaxonomy(current,asOf))');
    expect(settings).toContain('disabled={busy}');
    expect(settings).toContain('setPendingOwnerTaxonomy(false)');
  });
  it('offers editable subcategory selection in recurring and expense-installment editors',()=>{
    const recurring=readFileSync('src/pages/RecurringPage.tsx','utf8');
    const loans=readFileSync('src/pages/LoansPage.tsx','utf8');
    const validation=readFileSync('server/validation.ts','utf8');
    expect(recurring).toContain("subcategory={edit.subcategory}");
    expect(recurring).toContain("subcategory:selection.subcategory||undefined");
    expect(loans).toContain("expenseCategory:selection.category");
    expect(loans).toContain("expenseSubcategory:selection.subcategory||undefined");
    expect(validation).toContain("optionalText(value.subcategory, `${name}.subcategory`, 1_000)");
    expect(validation).toContain("optionalText(value.expenseCategory, `${name}.expenseCategory`, 1_000)");
  });
});
