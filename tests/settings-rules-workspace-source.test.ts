import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const workspace=read('src/components/TransactionRulesWorkspace.tsx');
const settings=read('src/pages/SettingsPage.tsx');
const css=read('src/components/TransactionRulesWorkspace.css');

describe('Settings Rules workspace source contract',()=>{
  it('uses the canonical transaction-rule engine without changing history',()=>{
    expect(workspace).toContain('normalizeTransactionRule');
    expect(workspace).toContain('transactionRuleMatchingEvents');
    expect(workspace).toContain('onUpsertRule(next)');
    expect(workspace).toContain('onDeleteRule(rule.id)');
    expect(workspace).toContain('Δεν αλλάζει καμία από αυτές');
  });

  it('presents a human when-then builder and taxonomy-backed subcategories',()=>{
    expect(workspace).toContain('Κανόνες νέων κινήσεων');
    expect(workspace).toContain('Όταν η περιγραφή');
    expect(workspace).toContain('<span>Κατηγορία</span>');
    expect(workspace).toContain('Πότε να λειτουργεί');
    expect(workspace).toContain("categoryTree(data.state.settings,'expense')");
    expect(workspace).toContain('availableSubcategories.map');
    expect(workspace).not.toContain('First match wins');
    expect(workspace).not.toContain('Προτεραιότητα');
  });

  it('keeps rule order, pause, edit and invalid-state controls explicit',()=>{
    expect(workspace).toContain('moveRule(index,-1)');
    expect(workspace).toContain('moveRule(index,1)');
    expect(workspace).toContain("rule.enabled?'Παύση':'Ενεργοποίηση'");
    expect(workspace).toContain('Χρειάζεται έλεγχο');
    expect(workspace).toContain('Επεξεργασία αυτοματισμού');
    expect(workspace).toContain('Διαγραφή αυτοματισμού');
  });

  it('is the dedicated Settings Rules surface while budgets remain elsewhere',()=>{
    expect(settings).toContain("import { TransactionRulesWorkspace } from '../components/TransactionRulesWorkspace';");
    expect(settings).toContain('<TransactionRulesWorkspace data={data}');
    expect(settings).not.toContain('view="rules"');
  });

  it('uses the shared modal and app-owned select primitives instead of page-local dropdown styling',()=>{
    expect(workspace).toContain("import { useModalFocus } from '../hooks/useModalFocus';");
    expect(workspace).toContain("const[editorOpen,setEditorOpen]=useState(false)");
    expect(workspace).toContain('className="editor-backdrop rules-editor-backdrop"');
    expect(workspace).toContain('className="panel neo-raised editor-dialog rules-editor"');
    expect(workspace).toContain('<AppSelectInput');
    expect(workspace).not.toContain('<select');
    expect(workspace).not.toContain('rules-list-section rule-editor-grid');
    expect(css).not.toContain('.owned-input{');
    expect(css).not.toContain('.owned-input-shell>.owned-input');
  });

  it('keeps compact desktop order controls and 44px touch targets on mobile',()=>{
    expect(css).toContain('height:24px;min-height:24px');
    expect(css).toContain('width:44px;height:44px;min-height:44px');
  });
});
