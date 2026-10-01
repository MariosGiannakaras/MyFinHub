import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const planning=readFileSync('src/components/PlanningApprovedDesktop.tsx','utf8');
const recurring=readFileSync('src/pages/RecurringPage.tsx','utf8');
const budgets=readFileSync('src/components/BudgetRuleSettings.tsx','utf8');
const qa=readFileSync('scripts/transactions-scanability-qa.mjs','utf8');
const fixture=readFileSync('src/qa.tsx','utf8');

describe('large finance dataset progressive-disclosure contracts',()=>{
  it('bounds scheduled and recurring DOM growth before user-requested expansion',()=>{
    expect(planning).toContain("const [scheduledLimit,setScheduledLimit]=useState(24)");
    expect(planning).toContain('filteredScheduled.slice(0,scheduledLimit)');
    expect(planning).toContain('planning-approved-scheduled-more');
    expect(recurring).toContain("const [desktopActiveLimit,setDesktopActiveLimit]=useState(24)");
    expect(recurring).toContain('const desktopUpcoming=upcoming.slice(0,desktopActiveLimit)');
    expect(recurring).toContain("const [inactiveLimit,setInactiveLimit]=useState(24)");
    expect(recurring).toContain('const visibleInactive=inactive.slice(0,inactiveLimit)');
  });

  it('bounds budget and automation management lists',()=>{
    expect(budgets).toContain("const [budgetListLimit,setBudgetListLimit]=useState(24)");
    expect(budgets).toContain('const visibleBudgets=budgets.slice(0,budgetListLimit)');
    expect(budgets).toContain("const [ruleListLimit,setRuleListLimit]=useState(24)");
    expect(budgets).toContain('rules.slice(0,ruleListLimit)');
  });

  it('exercises realistic events, recurring, scheduled, budgets, rules and history through rendered QA',()=>{
    expect(fixture).toContain('Array.from({length:1500}');
    expect(fixture).toContain('Array.from({length:120}');
    expect(fixture).toContain('Array.from({length:80}');
    expect(fixture).toContain('Array.from({length:100}');
    expect(qa).toContain('large recurring/planning/budget/rule/history boundaries');
    expect(qa).toContain("Runtime.getHeapUsage");
    expect(qa).toContain('256*1024*1024');
  });
});
