import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const component=readFileSync(new URL('../src/components/PlanningApprovedDesktop.tsx',import.meta.url),'utf8');
const target=readFileSync(new URL('../src/styles/planning-approved-target.css',import.meta.url),'utf8');
const refinement=readFileSync(new URL('../src/styles/planning-approved-refinement.css',import.meta.url),'utf8');

describe('Planning post-v1.4 remediation contracts',()=>{
  it('restores one canonical aggregate portfolio trend while retaining 30/60/90 KPIs',()=>{
    expect(component).toContain("const portfolioTrend=forecasts[90].points.map");
    expect(component).toContain('<AreaChart data={portfolioTrend} accessibilityLayer={false}');
    expect(component).toContain('type="stepAfter"');
    expect(component).toContain('dataKey="portfolio"');
    expect(component).toContain("([30,60,90] as const).map");
    expect(component).toContain('isAnimationActive={false}');
  });

  it('uses forecast-state semantics instead of arbitrary list-index tones',()=>{
    expect(component).toContain("type AccountForecastState='negative'|'low'|'declining'|'growing'|'stable'");
    expect(component).toContain('data-forecast-state={state}');
    expect(component).toContain("data-forecast-priority={state==='stable'?'quiet':'material'}");
    expect(component).not.toContain('data-tone={index%4}');
    expect(target).toContain('[data-forecast-state="negative"]');
    expect(target).toContain('[data-forecast-state="growing"]');
    expect(target).toContain('[data-forecast-priority="quiet"]');
  });

  it('removes the false account-card chevron and keeps state communication non-interactive',()=>{
    expect(component).not.toContain('ChevronRight');
    expect(component).toContain('<span className="planning-account-state">{accountStateLabel[state]}</span>');
  });

  it('places forecast assumptions next to the top control and scrolls them into view when opened',()=>{
    const forecast=component.indexOf('planning-approved-forecast');
    const details=component.indexOf('planning-approved-details planning-approved-details-nearby');
    const scheduled=component.indexOf('planning-approved-scheduled');
    expect(forecast).toBeGreaterThanOrEqual(0);
    expect(details).toBeGreaterThan(forecast);
    expect(scheduled).toBeGreaterThan(details);
    expect(component).toContain("scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})");
  });

  it('keeps a bounded four-column desktop account rhythm and readable horizon typography',()=>{
    expect(target).toContain('grid-template-columns:repeat(4,minmax(0,1fr))');
    expect(target).toContain('width:min(100%,1320px)');
    expect(target).not.toContain('repeat(auto-fit,minmax(190px,1fr))');
    expect(refinement).toContain('.planning-account-horizons small{font-size:var(--ux-dense-label-size)}');
    expect(refinement).toContain('.planning-account-horizons b{font-size:var(--ux-dense-data-size)}');
    expect(refinement).not.toContain('.planning-account-horizons small{font-size:7px}');
    expect(target).toContain('color:var(--text-secondary)');
  });
});
