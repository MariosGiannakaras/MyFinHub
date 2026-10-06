import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const routedPages=[
  'src/pages/DashboardPage.tsx',
  'src/pages/TransactionsPage.tsx',
  'src/pages/SavingsPage.tsx',
  'src/pages/CardsPage.tsx',
  'src/pages/CreditCardPage.tsx',
  'src/pages/LoansPage.tsx',
  'src/pages/LendingPage.tsx',
  'src/pages/RecurringPage.tsx',
  'src/pages/PlanningPage.tsx',
  'src/pages/AttentionPage.tsx',
  'src/pages/ReportsPage.tsx',
  'src/pages/SettingsPage.tsx',
];

describe('cross-page UI consistency contracts',()=>{
  it('keeps the application chrome single-sourced in AppShell',()=>{
    const shell=read('src/components/AppShell.tsx');
    expect(shell).toContain('<Surface as="aside" variant="raised" className="sidebar">');
    expect(shell).toContain('<Surface as="header" variant="flat" className="topbar">');
    expect(shell).toContain('className="workspace"');
    for(const file of routedPages){
      const source=read(file);
      expect(source,`${file} should not own a sidebar`).not.toContain('className="sidebar');
      expect(source,`${file} should not own a topbar`).not.toContain('className="topbar');
    }
  });

  it('uses the shared page frame and PageHeader across all routed finance/settings surfaces',()=>{
    const pageHeader=read('src/components/PageHeader.tsx');
    expect(pageHeader).toContain("['page-heading',className]");
    expect(pageHeader).toContain('<h1>{title}</h1>');
    expect(pageHeader).toContain('className="heading-actions"');
    for(const file of routedPages){
      const source=read(file);
      expect(source,`${file} should use page-stack`).toContain('page-stack');
      expect(source,`${file} should use PageHeader`).toContain('<PageHeader');
      expect(source,`${file} should import PageHeader`).toContain("components/PageHeader");
    }
    const base=read('src/styles/workspace-heading-metrics.css');
    const responsive=read('src/styles/root-responsive-coordination.css');
    const hardening=read('src/styles/ui-hardening-foundations.css');
    expect(base).toContain('.page-stack{display:grid');
    expect(base).toContain('.page-heading{display:flex');
    expect(responsive).toContain('.page-heading{align-items:flex-start}');
    expect(hardening).toContain('.page-heading h1{font-size:var(--ux-heading-size)}');
  });

  it('uses shared theme and one common focus state across control families',()=>{
    const theme=read('src/lib/theme.ts');
    const hardening=read('src/styles/ui-hardening-foundations.css');
    const sharedControls=read('src/styles/app-controls.css');
    expect(theme).toContain('.sidebar nav button.active,.mobile-nav button.active,.save-button');
    expect(theme).toContain('.top-actions button,.icon-button,.settings-actions button,.secondary');
    expect(theme).toContain('input,select,textarea{background-color:var(--control-bg)!important');
    expect(theme).toContain("'--focus'");
    expect(sharedControls).toContain(':where(button,a[href],input,select,textarea,summary,[tabindex]):focus-visible{outline:0;box-shadow:var(--focus)!important}');
    expect(hardening).not.toContain('button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible');
    expect(hardening).toContain('min-height:44px');
  });

  it('keeps AppShell navigation and branding route-invariant',()=>{
    const routeContinuity=read('src/styles/dashboard-route-shell-continuity.css');
    const desktopAlignment=read('src/styles/dashboard-desktop-alignment.css');
    const desktopFidelity=read('src/styles/dashboard-desktop-fidelity.css');
    const dashboardTarget=read('src/styles/dashboard-approved-target.css');
    const transactionsTarget=read('src/styles/transactions-desktop-shell.css');
    const dashboardLayers=routeContinuity+desktopAlignment+desktopFidelity+dashboardTarget+transactionsTarget;
    expect(dashboardLayers).not.toContain('.app-shell:has(');
    expect(dashboardLayers).not.toContain('.app-shell:is(:has(');
    expect(dashboardLayers).not.toContain('html:has(.dashboard-approved)');
    expect(dashboardLayers).not.toContain('body:has(.dashboard-approved)');
    expect(desktopAlignment).not.toContain('.brand-block .brand-mark-icon');
    expect(desktopFidelity).not.toContain('.sidebar nav button');
    expect(routeContinuity).toContain('Global navigation, branding, topbar, search, period controls and quick-entry chrome');
    expect(routeContinuity).not.toMatch(/\.app-shell(?:\b|>)/);
    const shell=read('src/components/AppShell.tsx');
    expect(shell).not.toContain('genericEntry');
    expect(shell).toContain('data-global-quick-entry="desktop"');
    expect(shell).toContain('data-global-quick-entry="mobile"');
    expect(shell).toContain('className="topbar-primary"');
    expect(shell).not.toContain('className="command-search-action"');
    expect(shell).toContain("label:'ΕΠΙΣΚΟΠΗΣΗ'");
    expect(shell).toContain("label:'ΛΟΓΑΡΙΑΣΜΟΙ & ΠΛΗΡΩΜΕΣ'");
    expect(shell).toContain("label:'ΟΡΓΑΝΩΣΗ & ΠΡΟΓΡΑΜΜΑΤΙΣΜΟΣ'");
    expect(shell).toContain("label:'ΡΥΘΜΙΣΕΙΣ'");
    expect(shell).toContain('className="nav-group-label"');
    const mobileShell=read('src/styles/mobile-app-shell.css');
    expect(mobileShell).toContain('.page-heading:has(+.primary-balance-grid){display:grid;grid-template-columns:minmax(0,1fr);');
    expect(mobileShell).toContain('.page-heading:has(+.primary-balance-grid) .heading-actions{width:100%;');
    expect(dashboardTarget).not.toContain('.dashboard-approved-heading p{display:block!important}');
    expect(mobileShell).toContain('.page-heading:has(+.primary-balance-grid) p{display:none}');

  });

  it('keeps routed pages off legacy neumorphic JSX hooks',()=>{
    for(const file of routedPages){
      const source=read(file);
      expect(source,`${file} should use semantic surface classes`).not.toMatch(/\bneo-(?:raised|flat|inset)\b/);
    }
  });

  it('keeps Dashboard semantic savings actions independent of the physical account kind',()=>{
    const dashboard=read('src/pages/DashboardPage.tsx');
    expect(dashboard).toContain("onAccountQuickAdd(account.id,savings?'savings':account.kind)");
  });

  it('keeps the Dashboard upcoming-payments zero state intentional and actionable',()=>{
    const dashboard=read('src/pages/DashboardPage.tsx');
    expect(dashboard).toContain('upcoming.length?');
    expect(dashboard).toContain('dashboard-upcoming-empty');
    expect(dashboard).toContain('Δεν υπάρχουν επερχόμενες πληρωμές');
    expect(dashboard).toContain('Άνοιγμα προγραμματισμού');
  });

  it('routes repeated KPI families through the shared Surface primitive',()=>{
    const transactions=read('src/pages/TransactionsPage.tsx');
    const recurring=read('src/pages/RecurringPage.tsx');
    const reports=read('src/pages/ReportsPage.tsx');
    const cards=read('src/pages/CardsPage.tsx');
    expect(transactions.match(/<Surface as="article" variant="flat" className="transactions-summary-card/g)).toHaveLength(4);
    expect(recurring.match(/<Surface as="article" variant="flat" className="recurring-summary-card/g)).toHaveLength(2);
    expect(reports.match(/<Surface as="article" variant="flat" className=/g)).toHaveLength(5);
    expect(cards.match(/<Surface as="article" variant="flat" className="cards-surrounding-kpi"/g)).toHaveLength(4);
  });

  it('prevents raw generic action chrome from bypassing shared Button primitives',()=>{
    const genericRaw=/<button\b[^>]*className=(?:"[^"]*"|'[^']*'|\{`[^`]*`\})[^>]*\b(?:save-button|secondary|text-button|icon-button)\b/;
    for(const file of routedPages){
      const source=read(file);
      expect(source,`${file} should not recreate generic button chrome`).not.toMatch(genericRaw);
    }
  });
  it('reuses existing shared controls in card creation without adding eager global CSS',()=>{
    const main=read('src/main.tsx');
    const cardDialog=read('src/components/CardCreateDialog.tsx');
    const cards=read('src/pages/CardsPage.tsx');
    const credit=read('src/pages/CreditCardPage.tsx');
    expect(main).not.toContain('cross-page-consistency.css');
    expect(cardDialog).toContain("from './Button'");
    expect(cardDialog).toContain("from './IconButton'");
    expect(cardDialog).toContain('<IconButton className="close-picker" aria-label="Κλείσιμο"');
    expect(cardDialog).toContain('<Button variant="secondary" className="modal-secondary"');
    expect(cardDialog).toContain('<Button variant="primary" className="modal-primary"');
    expect(cardDialog).toContain('FormError');
    expect(cards).toContain("from '../components/Button'");
    expect(cards).toContain("from '../components/IconButton'");
    expect(cards).toContain('<IconButton type="button" className="close-picker" aria-label="Κλείσιμο"');
    expect(cards).toContain('<Button type="button" variant="secondary" className="modal-secondary"');
    expect(cards).toContain('<Button type="button" variant="primary" className="modal-primary"');
    expect(cards).toContain('FormError');
    // The credit-card archive keeps its legacy close-picker hook isolated; it does not own global chrome or action styling.
    expect(credit).toContain('className="close-picker" aria-label="Κλείσιμο αρχείου καρτών"');
  });
});
