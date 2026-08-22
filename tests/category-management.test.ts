import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { categoryKey, categoryTree, parseCategoryTree, subcategoriesFor } from '../src/lib/categories.js';
import type { FinanceSettings } from '../src/types.js';

const shell=readFileSync(new URL('../src/components/AppShell.tsx',import.meta.url),'utf8');
const settingsSource=readFileSync(new URL('../src/pages/SettingsPage.tsx',import.meta.url),'utf8');
const editorSource=readFileSync(new URL('../src/components/CategoryTreeEditor.tsx',import.meta.url),'utf8');

const baseSettings={
  expenseCategories:['Όχημα'],
  incomeCategories:['Μισθός'],
  expenseCategoryTree:undefined,
  incomeCategoryTree:undefined,
} as unknown as FinanceSettings;

describe('category management',()=>{
  it('normalizes whitespace, case and Greek diacritics for duplicate detection',()=>{
    expect(categoryKey('  ΌΧΗΜΑ   ')).toBe(categoryKey('οχημα'));
    expect(categoryKey('Φαρμακείο')).toBe(categoryKey('φαρμακειο'));
    const tree=parseCategoryTree('Όχημα > Service, Βενζίνη\n οχημα > service, Καύσιμα\nΥγεία > Φαρμακείο, φαρμακειο');
    expect(tree).toEqual([
      {name:'Όχημα',subcategories:['Service','Βενζίνη','Καύσιμα']},
      {name:'Υγεία',subcategories:['Φαρμακείο']},
    ]);
  });

  it('keeps vehicle fallback concise and removes overlapping workshop/service choices',()=>{
    const tree=categoryTree(baseSettings,'expense');
    expect(tree).toEqual([{name:'Όχημα',subcategories:['Καύσιμα','Συντήρηση & Service','Ασφάλεια','Parking & Διόδια']}]);
    expect(tree[0]?.subcategories).not.toContain('Συνεργείο');
  });

  it('resolves subcategories through normalized category names',()=>{
    expect(subcategoriesFor(baseSettings,'expense',' οχημα ')).toEqual(['Καύσιμα','Συντήρηση & Service','Ασφάλεια','Parking & Διόδια']);
  });

  it('makes both desktop and mobile MyFinHub branding explicit Dashboard controls',()=>{
    expect(shell.match(/className="brand-home-button"/g)).toHaveLength(2);
    expect(shell.match(/onClick=\{\(\)=>selectPage\('dashboard'\)\}/g)).toHaveLength(2);
    expect(shell.match(/aria-label="Μετάβαση στην Αρχική \/ Dashboard"/g)).toHaveLength(2);
  });

  it('uses explicit dirty/save category editors instead of timer or blur autosave',()=>{
    expect(settingsSource).toContain('<CategoryTreeEditor kind="expense"');
    expect(settingsSource).toContain('<CategoryTreeEditor kind="income"');
    expect(settingsSource).not.toContain('scheduleCategories');
    expect(editorSource).toContain('disabled={!dirty}');
    expect(editorSource).toContain('onClick={save}');
    expect(editorSource).toContain("dirty?'Μη αποθηκευμένες αλλαγές':'Αποθηκευμένο'");
    expect(editorSource).toContain('είναι ήδη διαθέσιμες σε όλη την εφαρμογή');
    expect(editorSource).not.toContain('setTimeout');
    expect(editorSource).not.toContain('onBlur');
  });
});
