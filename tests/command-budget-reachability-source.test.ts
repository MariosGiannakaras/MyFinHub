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
    expect(app).toContain("account?.bankAccountCategory==='savings'");
    expect(qa).toContain("account?.bankAccountCategory==='savings'");
    expect(rendered).toContain('command-budget-editor-current-page');
    expect(rendered).toContain('command-budget-editor-from-dashboard');
    expect(rendered).toContain('budget command retains keyboard focus after palette dismissal');
    expect(modalFocus).toContain('const hasDestination=');
    expect(modalFocus).toContain('focused!==opener.current&&!root.contains(focused)');
  });
});
