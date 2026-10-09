import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

describe('Dashboard hierarchy and painted-chart contracts',()=>{
  it('uses shared readable dense typography and reduces nested Dashboard surface weight on desktop',()=>{
    const css=read('src/styles/dashboard-approved-target.css');
    expect(css).toContain('--dashboard-caption-size:var(--ux-dense-data-size)');
    expect(css).toContain('.dashboard-approved .approved-secondary-panel{background:transparent;border:0;box-shadow:none');
    expect(css).toContain('.dashboard-approved .approved-kpi-strip{gap:0;border:1px solid #e4edf6');
    expect(css).toContain('.dashboard-approved .approved-kpi-strip article{height:64px;border:0;border-radius:0;background:transparent;box-shadow:none');
    expect(css).toContain('.dashboard-approved .approved-kpi-strip article+article{border-left:1px solid #edf2f7}');
  });

  it('keeps primary account ghost actions subordinate in Dark while preserving secondary-account controls',()=>{
    const dark=read('src/styles/dark-theme-surfaces.css');
    expect(dark).toContain('html[data-theme="dark"] .approved-account-actions button{');
    expect(dark).toContain('background:transparent!important');
    expect(dark).toContain('box-shadow:none!important');
    expect(dark).toContain('html[data-theme="dark"] .approved-secondary-account button{');
    expect(dark).toContain('background:var(--control-bg)!important');
  });

  it('keeps historical-month Dashboard flow-axis values readable and protects visible thousands labels in rendered QA',()=>{
    const chart=read('src/components/DashboardRecharts.tsx');
    const focused=read('scripts/shell-dashboard-hierarchy-qa.mjs');
    expect(chart).toContain('margin={{top:4,right:6,bottom:0,left:12}}');
    expect(chart).toContain('width={80} tickMargin={4}');
    expect(chart).toContain('tickFormatter={flowAxisLabel}');
    expect(chart).toContain('fontSize:10');
    expect(chart).toContain("notation:'compact'");
    expect(focused).toContain('historicalFlowAxis.minLeftInset>=-0.5');
    expect(focused).toContain('historicalFlowAxis.maxValue>=3000');
    expect(focused).toContain('historical-month Dashboard axis tick labels are fully visible');
    expect(focused).toContain('Historical Dashboard flow axis geometry:');
  });

  it('requires actual painted Dashboard chart shapes before focused visual evidence is accepted',()=>{
    const visual=read('scripts/ui-ux-visual-evidence-qa.mjs');
    const focused=read('scripts/shell-dashboard-hierarchy-qa.mjs');
    for(const source of [visual,focused]){
      expect(source).toContain("visibleShape('.approved-bar-wrap .recharts-rectangle')");
      expect(source).toContain("visibleShape('.summary-donut .recharts-sector')");
      expect(source).toContain("visibleShape('.approved-category-donut .recharts-sector')");
    }
    expect(focused).toContain('dark Dashboard paints the flow bars and both donut visualizations before evidence capture');
  });
});
