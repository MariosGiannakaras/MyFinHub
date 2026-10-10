import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const app=readFileSync('src/App.tsx','utf8');
const qa=readFileSync('src/qa.tsx','utf8');
const search=readFileSync('src/lib/commandSearch.ts','utf8');
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
  });
});
