import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const qa=readFileSync(new URL('../src/qa.tsx',import.meta.url),'utf8');
const large=readFileSync(new URL('../scripts/large-data-boundaries-qa.mjs',import.meta.url),'utf8');
const rendered=readFileSync(new URL('../scripts/run-rendered-qa.mjs',import.meta.url),'utf8');
const perf=readFileSync(new URL('../scripts/performance-audit.mjs',import.meta.url),'utf8');
const planning=readFileSync(new URL('../src/pages/PlanningPage.tsx',import.meta.url),'utf8');
const recurring=readFileSync(new URL('../src/pages/RecurringPage.tsx',import.meta.url),'utf8');
const budgets=readFileSync(new URL('../src/components/BudgetRuleSettings.tsx',import.meta.url),'utf8');
const shell=readFileSync(new URL('../src/components/AppShell.tsx',import.meta.url),'utf8');

describe('large-data verification contract',()=>{
  it('keeps the synthetic large state broad enough to cover finance-heavy domains',()=>{
    expect(qa).toContain('length:1500');
    expect(qa).toContain('length:120');
    expect(qa).toContain('large-budget-');
    expect(qa).toContain('large-rule-');
    expect(qa).toContain('qa-large-history-');
  });

  it('bounds the high-cardinality UI surfaces instead of rendering every row eagerly',()=>{
    expect(large).toContain("document.querySelectorAll('.budget-setting-row').length");
    expect(large).toContain("document.querySelectorAll('.recurring-workspace-table tbody tr[data-recurring-status=active]').length");
    expect(large).toContain("document.querySelectorAll('.scheduled-row').length");
    expect(large).toContain("document.querySelectorAll('.history-row').length");
    expect(large).toContain("planning-approved-forecast");
    expect(large).toContain("planning-forecast-kpi");
    expect(large).toContain("document.querySelectorAll('.rule-settings-list>article').length");
    expect(large).toContain('budgetDeleteLatencyMs<1500');
    expect(large).toContain('results.reportsHeapMb<256');
    expect(large).toContain('results.historyHeapMb<256');
  });

  it('keeps high-cardinality component lists explicitly bounded in product source',()=>{
    expect(planning).toContain('const [scheduledListLimit,setScheduledListLimit]=useState(12)');
    expect(planning).toContain('const visiblePending=pending.slice(0,scheduledListLimit)');
    expect(planning).toContain('className="planning-scheduled-more"');
    expect(recurring).toContain('setDesktopActiveLimit');
    expect(recurring).toContain('setMobileActiveLimit');
    expect(recurring).toContain('className="desktop-recurring-more"');
    expect(recurring).toContain('className="mobile-recurring-more"');
    expect(budgets).toContain('budgetListLimit');
    expect(budgets).toContain('ruleListLimit');
    expect(shell).toContain('const boundedHistory=effectiveHistory.slice(0,100)');
  });

  it('runs the large-data audit in rendered QA and keeps dedicated Lighthouse cases',()=>{
    expect(rendered).toContain("scripts/large-data-boundaries-qa.mjs");
    expect(perf).toContain("desktop-large-transactions");
    expect(perf).toContain("desktop-large-reports");
    expect(perf).toContain("desktop-large-planning");
  });
});
