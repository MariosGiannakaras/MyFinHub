import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { categoryKey, categoryTree, parseCategoryTree, subcategoriesFor } from '../src/lib/categories.js';
import type { FinanceSettings } from '../src/types.js';

const shell=readFileSync(new URL('../src/components/AppShell.tsx',import.meta.url),'utf8');
const settingsSource=readFileSync(new URL('../src/pages/SettingsPage.tsx',import.meta.url),'utf8');
const workspaceSource=readFileSync(new URL('../src/components/CategoryIconsWorkspace.tsx',import.meta.url),'utf8');

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

  it('uses one direct Categories & Icons workspace instead of textarea tree editors',()=>{
    expect(settingsSource).not.toContain('CategoryTreeEditor');
    expect(settingsSource).toContain('<CategoryIconsWorkspace');
    expect(settingsSource).toContain('onTaxonomyOperation={runTaxonomyOperation}');
    expect(workspaceSource).toContain("type:'add-category'");
    expect(workspaceSource).toContain("type:'add-subcategory'");
    expect(workspaceSource).toContain("type:'rename-category'");
    expect(workspaceSource).toContain("type:'rename-subcategory'");
    expect(workspaceSource).toContain("type:'reorder-category'");
    expect(workspaceSource).toContain("type:'reorder-subcategory'");
    expect(workspaceSource).toContain("type:'move-subcategory'");
    expect(workspaceSource).not.toMatch(/type:'delete-|Διαγραφή κατηγορίας|Διαγραφή υποκατηγορίας/);
  });

  it('provides keyboard-accessible reorder and edit controls without drag-only semantics',()=>{
    expect(workspaceSource).toContain('Μετακίνηση ${category.name} προς τα πάνω');
    expect(workspaceSource).toContain('Μετακίνηση ${subcategory} προς τα κάτω');
    expect(workspaceSource).toContain("event.key==='Enter'");
    expect(workspaceSource).toContain("event.key==='Escape'");
    expect(workspaceSource).not.toContain('draggable=');
  });
});
