import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard=readFileSync(new URL('../src/pages/DashboardPage.tsx',import.meta.url),'utf8');
const skeleton=readFileSync(new URL('../src/components/AppSkeleton.tsx',import.meta.url),'utf8');
const finance=readFileSync(new URL('../src/hooks/useFinance.ts',import.meta.url),'utf8');
const shell=readFileSync(new URL('../src/components/AppShell.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/styles/part41.css',import.meta.url),'utf8');
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')) as {scripts:Record<string,string>};

describe('final UX reconciliation source contracts',()=>{
  it('keeps the agreed Dashboard semantic priority order',()=>{
    expect(dashboard).toContain("const PRIMARY_ACCOUNTS=['cash','piraeus-payroll','piraeus-savings']");
    expect(dashboard).toContain("kind==='cash'?'Μετρητά'");
    const primary=dashboard.indexOf('data-dashboard-section="primary-accounts"');
    const other=dashboard.indexOf('data-dashboard-section="other-balances"');
    const pending=dashboard.indexOf('data-dashboard-section="pending"');
    const quick=dashboard.indexOf('data-dashboard-section="quick-entry"');
    const rest=dashboard.indexOf('data-dashboard-section="rest"');
    expect(primary).toBeGreaterThan(-1);
    expect(other).toBeGreaterThan(primary);
    expect(pending).toBeGreaterThan(other);
    expect(quick).toBeGreaterThan(pending);
    expect(rest).toBeGreaterThan(quick);
    expect(styles).toContain('.dashboard-pending-grid>.panel{order:initial!important}');
  });

  it('exposes privacy-safe session history for changes, undo and redo',()=>{
    expect(finance).toContain("export const SESSION_HISTORY_EVENT = 'myfinhub-session-change-history'");
    expect(finance).toContain("recordHistory('change',describeChange(current,next))");
    expect(finance).toContain("recordHistory('undo','Αναίρεση τελευταίας αλλαγής')");
    expect(finance).toContain("recordHistory('redo','Επαναφορά τελευταίας αναιρεμένης αλλαγής')");
    expect(finance).toContain('slice(0,MAX_HISTORY_ITEMS)');
    expect(finance).toContain('const changeHistoryRef=useRef<ChangeHistoryEntry[]>([])');
    expect(finance).toContain('changeHistoryRef.current=next');
    expect(finance).toContain('setChangeHistory(next)');
    expect(finance).toContain('publishHistory(next)');
    expect(finance).not.toContain('setChangeHistory(current=>');
    expect(shell).toContain('aria-label="Ιστορικό αλλαγών"');
    expect(shell).toContain('id="change-history-title"');
    expect(shell).toContain('window.addEventListener(SESSION_HISTORY_EVENT,onHistory)');
    expect(shell).toContain('className="history-actions"');
    expect(styles).toContain('min-height:44px');
  });

  it('keeps skeletons route-shaped and Dashboard-shaped in the same priority order',()=>{
    expect(skeleton).toContain("data-skeleton-section=\"primary-accounts\"");
    const primary=skeleton.indexOf('data-skeleton-section="primary-accounts"');
    const other=skeleton.indexOf('data-skeleton-section="other-balances"');
    const pending=skeleton.indexOf('data-skeleton-section="pending"');
    const quick=skeleton.indexOf('data-skeleton-section="quick-entry"');
    const rest=skeleton.indexOf('data-skeleton-section="rest"');
    expect(primary).toBeGreaterThan(-1);
    expect(other).toBeGreaterThan(primary);
    expect(pending).toBeGreaterThan(other);
    expect(quick).toBeGreaterThan(pending);
    expect(rest).toBeGreaterThan(quick);
    expect(skeleton).toContain("if(page==='reports')");
    expect(skeleton).toContain("if(page==='transactions'||page==='review')");
    expect(skeleton).toContain("location.hash.replace(/^#\\/?/,'').trim()");
    expect(skeleton).toContain("new URLSearchParams(location.search).get('page')");
  });

  it('runs the focused rendered reconciliation before ledger QA',()=>{
    expect(pkg.scripts['qa:frontend']).toContain('scripts/final-ux-reconciliation-qa.mjs');
    expect(pkg.scripts['qa:frontend'].indexOf('scripts/final-ux-reconciliation-qa.mjs')).toBeLessThan(pkg.scripts['qa:frontend'].indexOf('scripts/ledger-foundations-qa.mjs'));
  });
});
