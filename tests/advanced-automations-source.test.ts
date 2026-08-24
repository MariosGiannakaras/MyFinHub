import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const panel=readFileSync(new URL('../src/components/BudgetRuleSettings.tsx',import.meta.url),'utf8');
const engine=readFileSync(new URL('../src/lib/transactionRules.ts',import.meta.url),'utf8');

describe('Advanced transaction automations source contracts',()=>{
  it('moves rules behind Advanced / Automations and removes low-level priority terminology from the UI',()=>{
    expect(panel).toContain('data-advanced-automations');
    expect(panel).toContain('Προχωρημένα · Αυτοματισμοί');
    expect(panel).not.toContain('<span>Προτεραιότητα</span>');
    expect(panel).not.toContain('First match wins');
    expect(panel).not.toContain('#{rule.priority}');
  });

  it('uses human condition to action language and user-facing source scope choices',()=>{
    expect(panel).toContain('Όταν η περιγραφή');
    expect(panel).toContain('Κείμενο περιγραφής');
    expect(panel).toContain('Τότε βάλε κατηγορία');
    expect(panel).toContain('Όταν την καταχωρίζω εγώ');
    expect(panel).toContain('Όταν έρχεται από εισαγωγή');
    expect(panel).toContain('Όταν επιβεβαιώνεται από έλεγχο');
    expect(panel).toContain('Σε κάθε νέα υποστηριζόμενη κίνηση');
  });

  it('keeps numeric priority as internal storage while exposing accessible direct order controls',()=>{
    expect(panel).toContain('priority:editingRule?.priority??nextPriority');
    expect(panel).toContain('Μετακίνηση αυτοματισμού ${rule.name} προς τα πάνω');
    expect(panel).toContain('Μετακίνηση αυτοματισμού ${rule.name} προς τα κάτω');
    expect(panel).toContain('onUpsertRule({...rules[index],priority,updatedAt:now()})');
    expect(panel).toContain('onUpsertRule({...rules[target],priority,updatedAt:now()})');
    expect(engine).toContain('.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))');
  });

  it('keeps preview read-only and flags unavailable saved references instead of silently replacing them',()=>{
    expect(panel).toContain('Μόνο προεπισκόπηση:');
    expect(panel).toContain('Δεν αλλάζει καμία από αυτές.');
    expect(panel).toContain('data-rule-invalid={invalid?\'true\':\'false\'}');
    expect(panel).toContain('Ο λογαριασμός της συνθήκης δεν είναι πλέον διαθέσιμος.');
    expect(panel).toContain('Η κατηγορία της ενέργειας δεν είναι πλέον διαθέσιμη.');
    expect(panel).toContain('Μη διαθέσιμος · {ruleAccount}');
    expect(panel).toContain('Μη διαθέσιμη · {ruleCategory}');
  });

  it('preserves the existing new-event-only first-match engine and validation boundary',()=>{
    expect(engine).toContain('First matching enabled rule wins.');
    expect(engine).toContain('Existing history is never walked or');
    expect(engine).toContain('const { winner } = previewTransactionRules(data, event)');
    expect(engine).toContain('if (!winner) return event;');
    expect(engine).toContain('normalizeTransactionRule');
  });
});
