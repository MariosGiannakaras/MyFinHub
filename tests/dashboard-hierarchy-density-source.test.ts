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
