import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const workspace=read('src/components/TransactionRulesWorkspace.tsx');
const categorySelect=read('src/components/CategorySelectInput.tsx');
const settings=read('src/pages/SettingsPage.tsx');
const css=read('src/components/TransactionRulesWorkspace.css');
const mobileDomainCss=read('src/styles/mobile-finance-domain-layouts.css');

describe('Settings Rules workspace source contract',()=>{
  it('uses the canonical transaction-rule engine without changing history',()=>{
    expect(workspace).toContain('normalizeTransactionRule');
    expect(workspace).toContain('transactionRuleMatchingEvents');
    expect(workspace).toContain('onUpsertRule(next)');
    expect(workspace).toContain('setDeleteRuleTarget(rule)');
    expect(workspace).toContain('<ConfirmDialog');
    expect(workspace).toContain('onDeleteRule(deleteRuleTarget.id)');
    expect(workspace).toContain('Δεν αλλάζει καμία από αυτές');
  });

  it('presents a human when-then builder and one shared taxonomy-backed category control',()=>{
    expect(workspace).toContain('Κανόνες νέων κινήσεων');
    expect(workspace).toContain('Όταν η περιγραφή');
    expect(workspace).toContain('<span>Κατηγορία / υποκατηγορία</span>');
    expect(workspace).toContain('<CategorySelectInput');
    expect(workspace).toContain('subcategory={ruleSubcategory}');
    expect(workspace).toContain('Πότε να λειτουργεί');
    expect(workspace).toContain("categoryTree(data.state.settings,'expense')");
    expect(categorySelect).toContain('data-option-level="category"');
    expect(categorySelect).toContain('data-option-level="subcategory"');
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
    expect(workspace).toContain('Διαγραφή κανόνα;');
  });

  it('is the dedicated Settings Rules surface while budgets remain elsewhere',()=>{
    expect(settings).toContain("import { TransactionRulesWorkspace } from '../components/TransactionRulesWorkspace';");
    expect(settings).toContain('<TransactionRulesWorkspace data={data}');
    expect(settings).not.toContain('view="rules"');
  });

  it('uses the shared modal and app-owned form primitives instead of page-local control styling',()=>{
    expect(workspace).toContain("import { useModalFocus } from '../hooks/useModalFocus';");
    expect(workspace).toContain("const[editorOpen,setEditorOpen]=useState(false)");
    expect(workspace).toContain('className="editor-backdrop rules-editor-backdrop"');
    expect(workspace).toContain('className="panel surface-raised editor-dialog rules-editor"');
    expect(workspace).toContain('<AppSelectInput');
    expect(workspace).toContain('<AppTextInput');
    expect(workspace).toContain('<CategorySelectInput');
    expect(workspace).not.toContain('<select');
    expect(workspace).not.toContain('rules-list-section rule-editor-grid');
    expect(css).not.toContain('.owned-input{');
    expect(css).not.toContain('.owned-input-shell>.owned-input');
    expect(css).not.toMatch(/\.rules-(?:name-field|builder-fields)[^{]*input\s*\{[^}]*border:/);
  });

  it('keeps compact desktop order controls and 44px touch targets on mobile',()=>{
    expect(css).toContain('height:24px;min-height:24px');
    expect(css).toContain('width:44px;height:44px;min-height:44px');
  });

  it('bounds large rule collections with progressive disclosure',()=>{
    expect(workspace).toContain('const RULE_PAGE_SIZE=24');
    expect(workspace).toContain('const visibleRules=rules.slice(0,visibleRuleCount)');
    expect(workspace).toContain('className="rule-settings-more"');
    expect(workspace).toContain('setVisibleRuleCount(count=>Math.min(count+RULE_PAGE_SIZE,rules.length))');
  });


  it('keeps shared mobile editor chrome theme-semantic in dark mode',()=>{
    expect(mobileDomainCss).toContain('background:var(--surface-elevated)!important');
    expect(mobileDomainCss).toContain('.editor-dialog .panel-head{position:sticky;top:0;z-index:2;background:var(--surface-elevated)');
    expect(mobileDomainCss).toContain('background:linear-gradient(180deg,transparent,var(--surface-elevated) 28%)');
    expect(mobileDomainCss).not.toContain('.editor-dialog{border-radius:22px 22px 0 0!important;padding:14px 13px calc(14px + env(safe-area-inset-bottom,0px))!important;background:rgba(248,251,255,.99)!important}');
  });

});
