import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';

const page=readFileSync(new URL('../src/pages/DashboardPage.tsx',import.meta.url),'utf8');
const curve=readFileSync(new URL('../src/lib/monotoneChartPath.ts',import.meta.url),'utf8');
const component=page.slice(page.indexOf('function AccountBalanceChart('),page.indexOf('function movementFromLegacy('));

describe('Dashboard primary-account chart presentation',()=>{
  it('uses the fixed safe curve and small movement markers while preserving historical layers and end cap',()=>{
    expect(component).toContain('monotoneChartPath(points');
    expect(component).toContain('account-history-movement');
    // Previous-month context remains visible but never gets movement dots.
    expect(component).toContain('entry.date>=monthStart&&Math.abs(entry.value-safeSeries[index]!.value)>.005');
    expect(component).toContain('r="1.35"');
    expect(component).toContain('account-history-comparison');
    expect(component).toContain('account-history-target');
    expect(component).toContain('account-history-previous');
    expect(component).toContain('account-history-current');
    expect(component).toContain('account-history-connector');
    expect(component).toContain('account-history-end');
    expect(component).toContain('preserveAspectRatio="none"');
    expect(component).not.toContain('slider');
    expect(curve).toContain('const CURVE_STRENGTH=0.8');
  });
});
