import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const shell=readFileSync(new URL('../src/components/AppShell.tsx',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../src/pages/DashboardPage.tsx',import.meta.url),'utf8');
const period=readFileSync(new URL('../src/components/PeriodControl.tsx',import.meta.url),'utf8');
const reporting=readFileSync(new URL('../src/lib/reportingPeriod.ts',import.meta.url),'utf8');
const persistence=readFileSync(new URL('../src/components/PersistenceNotice.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/styles/part47.css',import.meta.url),'utf8');
const hardening=readFileSync(new URL('../scripts/ui-ux-hardening-qa.mjs',import.meta.url),'utf8');

describe('shell and Dashboard hierarchy source contracts',()=>{
  it('keeps one visible global generic entry route per form factor while preserving expert access',()=>{
    expect(shell).toContain('data-global-quick-entry="desktop"');
    expect(shell).toContain('data-global-quick-entry="mobile"');
    expect(shell.match(/data-global-quick-entry=/g)?.length).toBe(2);
    expect(shell).not.toContain('className="command-pill"');
    expect(shell).toContain('useAppShortcuts({onCommand,onQuickEntry:onQuickAdd');
    expect(shell).toContain('className="command-search-action"');
    expect(hardening).toContain("clickText('[data-global-quick-entry=\"desktop\"]','Γρήγορη προσθήκη')");
  });

  it('keeps Dashboard account/frequent shortcuts contextual instead of adding generic CTAs',()=>{
    expect(dashboard).not.toContain('className="save-button"');
    expect(dashboard).not.toContain('Άνοιγμα καταχώρισης');
    expect(dashboard).toContain('data-account-quick-entry={account.id}');
    expect(dashboard).toContain('data-prefilled-quick-entry={f.label}');
    expect(dashboard).toContain('Συχνές κινήσεις');
    expect(dashboard).toContain('Συντομεύσεις με προ-συμπληρωμένα στοιχεία');
    expect(dashboard).toContain("account.kind==='savings'?'Μεταφορά':'Νέα κίνηση'");
  });

  it('disables future reporting navigation and refreshes the month boundary while the app stays open',()=>{
    expect(period).toContain('canAdvanceReportingMonth(month,currentMonth)');
    expect(period).toContain('disabled={!canAdvance}');
    expect(period).toContain('window.setInterval(refresh,60_000)');
    expect(period).toContain('δεν υπάρχει μελλοντική περίοδος αναφοράς');
    expect(reporting).toContain('shiftReportingMonth(month,1)<=maxMonth');
  });

  it('keeps healthy persistence chrome quiet while exceptional states stay explicit and accessible',()=>{
    expect(shell).toContain("saveState==='saved'?'is-quiet':'neo-inset is-active'");
    expect(shell).toContain("saveState==='saved'?undefined:'polite'");
    expect(styles).toContain('.file-panel.is-quiet');
    expect(styles).toContain('.file-panel.is-active');
    expect(persistence).toContain("saveState==='error'||saveState==='conflict'");
    expect(persistence).toContain('role="alert" aria-live="assertive"');
    expect(persistence).toContain("saveState==='saving'");
    expect(persistence).toContain('role="status" aria-live="polite"');
  });

  it('uses a lower-weight, denser hierarchy for pending, shortcuts and monthly metrics without reordering semantics',()=>{
    expect(styles).toContain('.dashboard-pending-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}');
    expect(styles).toContain('.dashboard-grid{grid-template-columns:.72fr 1.18fr 1.1fr;gap:11px}');
    expect(styles).toContain('.dashboard-grid>.quick-panel');
    expect(styles).toContain('.flow-metric-grid .metric-card{min-height:110px;padding:14px}');
    const primary=dashboard.indexOf('data-dashboard-section="primary-accounts"');
    const pending=dashboard.indexOf('data-dashboard-section="pending"');
    const quick=dashboard.indexOf('data-dashboard-section="quick-entry"');
    const rest=dashboard.indexOf('data-dashboard-section="rest"');
    expect(primary).toBeGreaterThan(-1);
    expect(pending).toBeGreaterThan(primary);
    expect(quick).toBeGreaterThan(pending);
    expect(rest).toBeGreaterThan(quick);
  });
});
