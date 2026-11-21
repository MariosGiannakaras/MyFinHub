import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const app=readFileSync('src/App.tsx','utf8');
const qa=readFileSync('src/qa.tsx','utf8');
const search=readFileSync('src/lib/commandSearch.ts','utf8');
const rendered=readFileSync('scripts/command-palette-qa.mjs','utf8');
const modalFocus=readFileSync('src/hooks/useModalFocus.ts','utf8');
describe('budget command frontend action reachability (DV-FB02/03)',()=>{
  it('routes the dated budget result to the already-existing Reports editor',()=>{
    expect(search).toContain("type:'budget_management',month:budget.month");
    expect(app).toContain("if(action.type==='budget_management')");
    expect(app).toContain("setMonth(action.month);setMonthIsManual(true)");
    expect(qa).toContain("if(action.type==='budget_management')");
    expect(qa).toContain("setMonth(action.month)");
    expect(app).toContain("section.querySelector<HTMLElement>('summary')?.focus");
    expect(qa).toContain("section.querySelector<HTMLElement>('summary')?.focus");
    expect(app).toContain("url.searchParams.set('reportSection','budgets')");
    expect(qa).toContain("url.searchParams.set('reportSection','budgets')");
    // Bank Savings routing must use the same classifier as Command Search;
    // a mis-tagged cash wallet must not open the Savings contribution flow.
    expect(app).toContain("import { isSavingsAccount } from './lib/accountSemantics'");
    expect(qa).toContain("import { isSavingsAccount } from './lib/accountSemantics'");
    expect(app).toContain('if(account&&isSavingsAccount(account)){');
    expect(qa).toContain('if(account&&isSavingsAccount(account)){');
    expect(rendered).toContain('command-budget-editor-current-page');
    expect(rendered).toContain('command-budget-editor-from-dashboard');
    expect(rendered).toContain('budget command retains keyboard focus after palette dismissal');
    expect(modalFocus).toContain('const hasDestination=');
    expect(modalFocus).toContain('focused!==opener.current&&!root.contains(focused)');
  });
  it('deep-links existing transaction rules through Commands and Reports without an implicit write (#649 I17.05)',()=>{
    const ruleManager=readFileSync('src/components/TransactionRulesWorkspace.tsx','utf8');
    const reports=readFileSync('src/pages/ReportsPage.tsx','utf8');
    const settings=readFileSync('src/pages/SettingsPage.tsx','utf8');
    expect(search).toContain("type:'rule_focus';ruleId:string");
    expect(search).toContain("action:{type:'rule_focus',ruleId:rule.id}");
    for(const entry of [app,qa]){
      expect(entry).toContain("if(action.type==='rule_focus')");
      expect(entry).toContain("ruleFocusId={commandRuleId}");
      expect(entry).toContain("ruleFocusKey={commandRuleKey}");
      expect(entry).toContain("onOpenRules=");
    }
    expect(settings).toContain('focusRuleId={ruleFocusId} focusRuleKey={ruleFocusKey}');
    expect(ruleManager).toContain('if(!focusRuleId||!focusRuleKey)return;');
    expect(ruleManager).toContain('editRule(target);');
    expect(reports).toContain('className="report-rules-link" onClick={onOpenRules}');
    expect(reports).not.toContain('<TransactionRulesWorkspace');
    expect(rendered).toContain('command-rule-editor-from-reports');
    expect(rendered).toContain('command-rule-editor-same-route');
    expect(rendered).toContain('reports-to-settings-rules-mobile-375');
    expect(rendered).toContain('rule navigation never creates a finance write');
  });
});
