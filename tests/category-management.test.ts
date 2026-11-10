import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { categoryKey, categoryTree, parseCategoryTree, subcategoriesFor } from '../src/lib/categories.js';
import type { FinanceSettings } from '../src/types.js';

const shell=readFileSync(new URL('../src/components/AppShell.tsx',import.meta.url),'utf8');
const settingsSource=readFileSync(new URL('../src/pages/SettingsPage.tsx',import.meta.url),'utf8');
const workspaceSource=readFileSync(new URL('../src/components/CategoryIconsWorkspace.tsx',import.meta.url),'utf8');
const appSource=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const qaSource=readFileSync(new URL('../src/qa.tsx',import.meta.url),'utf8');
const taxonomyQa=readFileSync(new URL('../scripts/taxonomy-management-qa.mjs',import.meta.url),'utf8');
const iconQa=readFileSync(new URL('../scripts/icon-packs-qa.mjs',import.meta.url),'utf8');

const baseSettings={
  expenseCategories:['Όχημα'],
  incomeCategories:['Μισθός'],
  expenseCategoryTree:undefined,
  incomeCategoryTree:undefined,
} as unknown as FinanceSettings;

describe('category management',()=>{
  it('awaits the revisioned receipt and locks overlapping taxonomy mutations (#649 I17.04)',()=>{
    expect(appSource).toContain('await finance.updateDurably(current=>applyTaxonomyOperation(current,operation,today))');
    expect(settingsSource).toContain('await onTaxonomyOperation(operation);');
    expect(settingsSource).not.toContain('taxonomyOperationPreview(draftRef.current, operation)');
    expect(settingsSource).toContain('The data.state.settings effect owns draft sync.');
    expect(settingsSource).not.toContain('Η απόσυρση ολοκληρώθηκε.');
    expect(workspaceSource).toContain('const operationRef=useRef(false);');
    expect(workspaceSource).toContain('if(operationRef.current)return false;');
    expect(workspaceSource).toContain('await onTaxonomyOperation(operation);');
    expect(workspaceSource).toContain('finally{operationRef.current=false;setOperationBusy(false)}');
    expect(workspaceSource).toContain('aria-busy={operationBusy}');
    expect(workspaceSource).toContain('inert={operationBusy}');
    expect(workspaceSource).toContain('busy={operationBusy}');
    expect(qaSource).toContain("params.get('taxonomy-save-pending')==='1'");
    expect(qaSource).toContain("params.get('taxonomy-save-failure')==='1'");
    expect(taxonomyQa).toContain('taxonomy-receipt-pending-mobile-375');
    expect(taxonomyQa).toContain('taxonomy-receipt-acknowledged-mobile-375');
    expect(taxonomyQa).toContain('taxonomy-receipt-rejected-desktop');
    expect(taxonomyQa).toContain('pending taxonomy two same-tick clicks invoked');
  });
  it('renders owner-approved icon semantics with real local glyphs, not generic placeholders (#649 I17.03)',()=>{
    expect(qaSource).toContain("params.get('state')==='approved-icon-taxonomy'");
    expect(iconQa).toContain('approved-taxonomy-icons-desktop');
    expect(iconQa).toContain('approved-taxonomy-icons-mobile-375');
    expect(iconQa).toContain("'Ταξίδι':'lucide:icon/luggage'");
    expect(iconQa).toContain("'Τόκος & Απόδοση':'lucide:icon/chart-line'");
  });

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

  it('uses one direct Categories & Icons workspace with safe retirement instead of destructive delete',()=>{
    expect(settingsSource).not.toContain('CategoryTreeEditor');
    expect(settingsSource).toContain('<CategoryIconsWorkspace');
    expect(settingsSource).toContain('data={data} asOf={asOf}');
    expect(settingsSource).toContain('onTaxonomyOperation={runTaxonomyOperation}');
    expect(workspaceSource).toContain("type:'add-category'");
    expect(workspaceSource).toContain("type:'add-subcategory'");
    // Progressive disclosure groups the existing editor without removing
    // native keyboard access or weakening any taxonomy mutation contract.
    expect(workspaceSource).toContain('<details className="taxonomy-subcategory-section taxonomy-subcategory-disclosure">');
    expect(workspaceSource).toContain('Υποκατηγορίες · {category.subcategories.length}');
    expect(workspaceSource).toContain('className="taxonomy-subcategory-content"');
    expect(taxonomyQa).toContain('taxonomy-subcategory-disclosure-expanded-mobile-375');

    expect(workspaceSource).toContain("type:'rename-category'");
    expect(workspaceSource).toContain("type:'rename-subcategory'");
    expect(workspaceSource).toContain("type:'reorder-category'");
    expect(workspaceSource).toContain("type:'reorder-subcategory'");
    expect(workspaceSource).toContain("type:'move-subcategory'");
    expect(workspaceSource).toContain("type:'retire-category'");
    expect(workspaceSource).toContain("type:'retire-subcategory'");
    expect(workspaceSource).toContain('taxonomyRetirementDependencies');
    expect(workspaceSource).toContain('data-taxonomy-retirement-blockers');
    expect(workspaceSource).toContain('Δεν θα γίνει αυτόματη μεταφορά');
    expect(workspaceSource).not.toMatch(/type:'delete-|Διαγραφή κατηγορίας|Διαγραφή υποκατηγορίας/);
  });

  it('provides keyboard-accessible reorder and edit controls without drag-only semantics',()=>{
    expect(workspaceSource).toContain('Μετακίνηση ${category.name} προς τα πάνω');
    expect(workspaceSource).toContain('Μετακίνηση ${subcategory} προς τα κάτω');
    expect(workspaceSource).toContain('Απόσυρση κατηγορίας ${category.name}');
    expect(workspaceSource).toContain('Απόσυρση υποκατηγορίας ${subcategory}');
    expect(workspaceSource).toContain("event.key==='Enter'");
    expect(workspaceSource).toContain("event.key==='Escape'");
    expect(workspaceSource).not.toContain('draggable=');
  });
});
