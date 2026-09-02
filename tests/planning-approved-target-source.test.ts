import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page=readFileSync(new URL('../src/pages/PlanningPage.tsx',import.meta.url),'utf8');
const approved=readFileSync(new URL('../src/components/PlanningApprovedDesktop.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/styles/planning-approved-target.css',import.meta.url),'utf8');
const chain=readFileSync(new URL('../src/styles/part47.css',import.meta.url),'utf8');

describe('approved Planning desktop target boundary',()=>{
  it('preserves canonical scheduled creation, completion and lifecycle semantics',()=>{
    expect(page).toContain('createScheduledTransaction(data');
    expect(page).toContain('scheduledToEvent(data, complete');
    expect(page).toContain("transitionScheduled(complete, 'completed', event.id)");
    expect(page).toContain('onCompleteScheduled(completed, event)');
    expect(page).toContain("transitionScheduled(item,status)");
    expect(page).toContain("requestLifecycle(item, 'skipped')");
    expect(page).toContain("requestLifecycle(item, 'cancelled')");
  });

  it('builds simultaneous 30/60/90 projections from the canonical forecast engine',()=>{
    expect(approved).toContain('cashFlowForecast(data,asOf,30)');
    expect(approved).toContain('cashFlowForecast(data,asOf,60)');
    expect(approved).toContain('cashFlowForecast(data,asOf,90)');
    expect(approved).toContain('forecasts[90].accounts');
    expect(approved).toContain('forecasts[90].points');
    expect(approved).toContain('LOW_BALANCE_THRESHOLD');
  });

  it('uses canonical scheduled records and account branding instead of target fixtures',()=>{
    expect(page).toContain('<PlanningApprovedDesktop data={data} asOf={asOf} pending={pending} history={history}');
    expect(approved).toContain('const allScheduled=useMemo(()=>[...pending,...history]');
    expect(approved).toContain('scheduledLifecycle(item,asOf)');
    expect(approved).toContain('<BankBrandMark');
    expect(approved).toContain('accountDisplayName(data');
    expect(approved).not.toMatch(/8\.420|7\.980|7\.540|Εθνική Τράπεζα|Eurobank/);
  });

  it('keeps the approved target desktop-only while retaining the established mobile implementation',()=>{
    expect(styles).toContain('@media (min-width:1100px)');
    expect(styles).toContain('.planning-page>.planning-summary-grid');
    expect(styles).toContain('.planning-approved-desktop');
    expect(styles).toContain('@media (max-width:1099px)');
    expect(page).toContain('className="planning-summary-grid"');
    expect(page).toContain('className="horizon-control"');
    expect(page).toContain('className={`scheduled-row ${lifecycle}`}');
    expect(chain).toContain("@import './planning-approved-target.css';");
  });
});
