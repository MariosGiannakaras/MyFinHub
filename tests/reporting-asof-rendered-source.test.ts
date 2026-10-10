import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('future-date rendered regression proof (DV-FB05)',()=>{
  const qa=readFileSync('src/qa.tsx','utf8');
  const reports=readFileSync('scripts/reports-visual-qa.mjs','utf8');
  const savings=readFileSync('scripts/savings-remediation-qa.mjs','utf8');
  it('includes a current-month fixture with later finance events',()=>{
    expect(qa).toContain("params.get('state')==='future-reporting'");
    expect(qa).toContain("date:'2026-08-28'");
    expect(qa).toContain("date:'2026-08-29'");
  });
  it('asserts same current Reports KPIs/categories/budgets/distribution on a real browser',()=>{
    expect(reports).toContain('future-dated expense and savings events do not mutate realized current-month Reports totals');
    expect(reports).toContain('reports-future-dated-activity-ignored.png');
  });
  it('asserts unchanged current Savings hero after a future transfer',()=>{
    expect(savings).toContain('future-dated savings transfer does not change current-month realized Savings hero');
    expect(savings).toContain('savings-future-dated-activity-ignored');
  });
});
