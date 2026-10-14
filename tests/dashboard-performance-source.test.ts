import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard=readFileSync(new URL('../src/pages/DashboardPage.tsx',import.meta.url),'utf8');
const recharts=readFileSync(new URL('../src/components/DashboardRecharts.tsx',import.meta.url),'utf8');
const visualEvidence=readFileSync(new URL('../scripts/ui-ux-visual-evidence-qa.mjs',import.meta.url),'utf8');
const shellDashboard=readFileSync(new URL('../scripts/shell-dashboard-hierarchy-qa.mjs',import.meta.url),'utf8');

describe('Dashboard first-paint performance contract',()=>{
  it('keeps Recharts out of the initial Dashboard route module',()=>{
    expect(dashboard).not.toContain("from 'recharts'");
    expect(dashboard).toContain("lazy(()=>import('../components/DashboardRecharts')");
    expect(recharts).toContain("from 'recharts'");
    expect(recharts).toContain('ResponsiveContainer');
    expect(recharts.match(/<ResponsiveContainer/g)?.length).toBe(3);
    expect(recharts).not.toContain('<PieChart responsive');
    expect(recharts).not.toContain('<BarChart responsive');
  });

  it('defers below-the-fold analytics until after the first paint without removing their fixed wrappers',()=>{
    expect(dashboard).toContain('requestAnimationFrame(()=>{secondFrame=requestAnimationFrame(reveal)})');
    expect(dashboard).toContain('window.setTimeout(reveal,700)');
    expect(dashboard).toContain('window.clearTimeout(fallback)');
    expect(dashboard).toContain('mobileAnalyticsChartsReady');
    expect(dashboard).toContain('const fallback=window.setTimeout(reveal,250)');
    expect(dashboard).toContain('secondFrame=requestAnimationFrame(reveal)');
    expect(dashboard).toContain('setMobileAnalyticsChartsReady(true)');
    expect(dashboard).toContain("const heavyChartsReady=renderDeferredCharts&&(!mobileViewport||mobileAnalyticsChartsReady)");
    expect(dashboard).toContain('className="approved-bar-wrap"');
    expect(dashboard).toContain('className="approved-category-donut"');
    expect(dashboard).toContain('className="summary-donut"');
    expect(visualEvidence).toContain('waitForDashboardSteadyState');
    expect(visualEvidence).toContain('collapsed mobile Dashboard analytics');
    expect(visualEvidence).toContain("charts?.classList.contains('mobile-collapsed')");
    expect(visualEvidence).toContain("'.summary-donut .recharts-surface'");
    expect(visualEvidence).toContain('painted desktop Dashboard charts');
    expect(shellDashboard).toContain('waitForMobileDashboardAnalytics');
    expect(shellDashboard).toContain('summaryReady');
    expect(shellDashboard).toContain('flowReady');
    expect(shellDashboard).toContain('categoryTableVisible');
    expect(shellDashboard).toContain('Timed out waiting for mobile Dashboard analytics');
  });
});
