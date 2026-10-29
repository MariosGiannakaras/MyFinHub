import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const script=readFileSync(new URL('../scripts/ui-ux-visual-evidence-qa.mjs',import.meta.url),'utf8');
describe('visual evidence QA: privacy and contextual report geometry (#646)',()=>{
  it('verifies privacy on fresh Dashboard load then explicitly reveals before chart readiness checks',()=>{
    expect(script).toContain('const revealDashboardForVisualEvidence=async()=>');
    expect(script).toContain("primary.every(isHidden)&&summary.every(isHidden)&&sectors.every(isHidden)&&charts.length===0");
    expect(script).toContain("toggle.click();return true");
    expect(script).toContain("if(page==='dashboard'){await revealDashboardForVisualEvidence();await waitForDashboardSteadyState()}");
    expect(script).toContain("const selectors=['.summary-donut .recharts-surface'");
  });
  it('checks the actual nested credit portfolio geometry in each report viewport',()=>{
    expect(script).toContain('const assertReportCreditLayout=async()=>');
    expect(script).toContain('geometry.cardWidth<geometry.gridWidth*.9');
    expect(script).toContain("if(page==='reports')await assertReportCreditLayout()");
  });
});
