import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const panel=read('src/components/TransactionRulesWorkspace.tsx');
const budget=read('src/components/BudgetRuleSettings.tsx');
const reports=read('src/pages/ReportsPage.tsx');
const settings=read('src/pages/SettingsPage.tsx');
const categorySelect=read('src/components/CategorySelectInput.tsx');
const engine=read('src/lib/transactionRules.ts');
const order=read('src/lib/transactionRuleEditor.ts');

describe('canonical transaction automation source contracts',()=>{
  it('only mounts the Settings Rules workspace, not a second Reports editor',()=>{
    expect(settings).toContain('<TransactionRulesWorkspace data={data}');
    expect(panel).toContain('data-advanced-automations data-rules-workspace');
    expect(panel).toContain('Κανόνες νέων κινήσεων');
    expect(reports).toContain('<BudgetRuleSettings');
    expect(budget).toContain('budgetProgress(data,month,asOf)');
    expect(budget).not.toContain('data-advanced-automations');
    expect(budget).not.toContain('onUpsertRule');
    expect(reports).not.toContain('onUpsertRule');
    expect(panel).not.toContain('<span>Προτεραιότητα</span>');
    expect(panel).not.toContain('First match wins');
  });
  it('retains human when-then categories, every valid scope, and read-only previews',()=>{
    for(const label of ['Όταν η περιγραφή','Κείμενο περιγραφής','Κατηγορία / υποκατηγορία','Όταν την καταχωρίζω εγώ','Όταν έρχεται από εισαγωγή','Όταν επιβεβαιώνεται από έλεγχο','Σε κάθε νέα υποστηριζόμενη κίνηση','Δεν αλλάζει καμία από αυτές']){
      expect(panel).toContain(label);
    }
    expect(panel).toContain('ruleScopeChoice(rule.scopes)');
    expect(panel).toContain('scopesForRuleChoice(ruleScope)');
    expect(order).toContain("['manual','imported','review']");
  });
  it('enforces one atomic integer-safe reorder through finance history',()=>{
    expect(panel).toContain('Μετακίνηση αυτοματισμού ${rule.name} προς τα πάνω');
    expect(panel).toContain('Μετακίνηση αυτοματισμού ${rule.name} προς τα κάτω');
    expect(panel).toContain('onReorderRule(rules[index].id,direction)');
    expect(settings).toContain('onFinanceDurably(current=>');
    expect(settings).toContain('reorderTransactionRules(rules,id,direction,new Date().toISOString())');
    expect(order).toContain('Number.isInteger(priority)');
    expect(order).toContain('ordered.map((rule,position)');
    expect(engine).toContain('.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))');
  });
  it('warns on unavailable references and uses shared taxonomy selection',()=>{
    expect(panel).toContain('Ο λογαριασμός της συνθήκης δεν είναι πλέον διαθέσιμος.');
    expect(panel).toContain('Η κατηγορία της ενέργειας δεν είναι πλέον διαθέσιμη.');
    expect(panel).toContain('Μη διαθέσιμος · {ruleAccount}');
    expect(panel).toContain('<CategorySelectInput');
    expect(categorySelect).toContain('!validCurrent&&category');
    expect(categorySelect).toContain('data-option-level="invalid"');
  });
  it('keeps the first-match-only new-event engine and preserves history',()=>{
    expect(engine).toContain('First matching enabled rule wins.');
    expect(engine).toContain('Existing history is never walked or');
    expect(engine).toContain('const { winner } = previewTransactionRules(data, event)');
    expect(engine).toContain('if (!winner) return event;');
    expect(engine).toContain('normalizeTransactionRule');
  });
});
