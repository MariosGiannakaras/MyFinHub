import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

describe('completion UX contracts',()=>{
  it('keeps mobile Quick Entry compact and reserves scroll clearance above fixed chrome',()=>{
    const quick=read('src/styles/command-palette-contextual-entry.css');
    const shell=read('src/styles/mobile-app-shell.css');
    expect(quick).toContain('.mobile-quick-action{display:grid;place-items:center');
    expect(quick).toContain('width:48px;height:48px');
    expect(quick).toContain('.mobile-quick-action>span{position:absolute;width:1px');
    expect(shell).toContain('padding-bottom:calc(146px + env(safe-area-inset-bottom,0px))');
    expect(shell).toContain('scroll-padding-bottom:calc(146px + env(safe-area-inset-bottom,0px))');
    const appShell=read('src/components/AppShell.tsx');
    expect(appShell).toContain("{page!=='settings'?<button type=\"button\" className=\"mobile-quick-action\"");
    const authShell=read('src/styles/auth-session-shell.css');
    expect(authShell).toContain('bottom:calc(88px + env(safe-area-inset-bottom,0px))');
  });

  it('keeps Dashboard tablet cards compatible with their internal content minimums',()=>{
    const fidelity=read('src/styles/dashboard-desktop-fidelity.css');
    expect(fidelity).toContain('@media(min-width:681px) and (max-width:980px)');
    expect(fidelity).toContain('grid-template-columns:repeat(2,minmax(0,1fr))!important');
    expect(fidelity).toContain('grid-auto-rows:max-content');
    expect(fidelity).toContain('height:auto!important');
    expect(fidelity).toContain('min-height:180px!important');
    expect(fidelity).toContain('grid-template-columns:minmax(100px,.82fr) minmax(120px,1.18fr)!important');
    expect(fidelity).toContain('.dashboard-approved .approved-account-body>*');
    expect(fidelity).toContain('.dashboard-approved .approved-account-chart{min-width:0}');
  });

  it('uses the existing bounded transaction page slice on mobile',()=>{
    const source=read('src/pages/TransactionsPage.tsx');
    expect(source).toContain('className="mobile-transaction-list"');
    expect(source).toContain('{pageRows.map(r=>');
    expect(source).toMatch(/transaction-semantic-table[\s\S]*?<tbody>\{pageRows\.map\(r=>/);
    expect(source).not.toContain('aria-label={`Κινήσεις για ${month}`}>{rows.map');
    expect(source).toContain('className="mobile-transaction-pagination"');
    expect(source).toContain('setQuery(e.target.value);setPage(1)');
    expect(source).toContain('setSortDirection(value);setPage(1)');
  });

  it('renders lending history as semantic cards on phones instead of a squeezed table',()=>{
    const source=read('src/pages/LendingPage.tsx');
    const mobileStart=source.indexOf('className="mobile-lending-history"');
    expect(mobileStart).toBeGreaterThan(-1);
    const mobileTail=source.slice(mobileStart);
    expect(mobileTail).toContain('role="list"');
    expect(mobileTail).toContain('className="mobile-lending-history-row"');
    expect(mobileTail).not.toContain('className="semantic-table receivables-table"');
    expect(mobileTail).toContain('hidden={!privacyVisible}');
    expect(source).toContain('const [mobileHistoryLimit,setMobileHistoryLimit]=useState(20)');
    expect(source).toContain('const mobileHistory=useMemo(()=>history.slice(0,mobileHistoryLimit)');
    expect(source).toContain('setMobileHistoryLimit(limit=>limit+20)');
  });

  it('makes Cards an explicit phone snap carousel and keeps the active Settings tab visible',()=>{
    const cards=read('src/styles/cards-prototype-presentation.css');
    const settings=read('src/pages/SettingsPage.tsx');
    const settingsCss=read('src/pages/SettingsPage.css');
    expect(cards).toContain('scroll-snap-type:x mandatory');
    expect(cards).toContain('scroll-snap-stop:always');
    expect(settings).toContain("selected?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' })");
    expect(settings).toContain('aria-labelledby={`settings-tab-${activeTab}`}');
    expect(settingsCss).toContain('scroll-snap-type:x proximity');
    expect(settingsCss).toContain('mask-image:linear-gradient');
  });

  it('keeps secondary mobile analysis behind explicit disclosure controls',()=>{
    const dashboard=read('src/pages/DashboardPage.tsx');
    const dashboardCss=read('src/pages/DashboardCompletion.css');
    const planning=read('src/pages/PlanningPage.tsx');
    const planningCss=read('src/pages/PlanningCompletion.css');
    const reports=read('src/pages/ReportsPage.tsx');
    const reportsCss=read('src/pages/ReportsPage.css');
    const attention=read('src/pages/AttentionPage.tsx');
    expect(dashboard).toContain("import './DashboardCompletion.css';");
    expect(dashboard).toContain('dashboard-mobile-disclosure');
    expect(dashboard).toContain("mobileAnalyticsExpanded?'':'mobile-collapsed'");
    expect(dashboardCss).toContain('.approved-chart-grid.mobile-collapsed');
    expect(planning).toContain("import './PlanningCompletion.css';");
    expect(planning).toContain('planning-mobile-disclosure');
    expect(planningCss).toContain('.planning-lower-grid.mobile-collapsed');
    expect(reports).toContain('report-mobile-disclosure');
    expect(reportsCss).toContain('.report-support-grid.mobile-collapsed>article:not(#report-obligations)');
    expect(attention).toContain("import './AttentionCompletion.css';");
    expect(attention).toContain('const mobileItems=mobileExpanded?items:items.slice(0,6)');
    expect(attention).toContain('className="attention-mobile-more"');
  });

  it('keeps Savings action copy usable at narrow phone widths',()=>{
    const css=read('src/pages/SavingsCompletion.css');
    expect(css).toContain('@media(max-width:380px)');
    expect(css).toContain('.savings-action strong{width:30px;font-size:0');
    expect(css).toContain('.savings-action small{-webkit-line-clamp:3}');
  });

  it('routes revoked-session failures from finance-adjacent clients through the global auth expiry event',()=>{
    const helper=read('src/lib/authExpiry.ts');
    const api=read('src/lib/api.ts');
    const cardVault=read('src/lib/cardVaultClient.ts');
    const metadata=read('src/lib/accountMetadataClient.ts');
    expect(helper).toContain("code==='AUTH_REQUIRED'||code==='DEVICE_ACCESS_REVOKED'");
    expect(helper).toContain("window.dispatchEvent(new Event('rheomiq:auth-expired'))");
    expect(api).toContain('notifyAuthExpired(response.status, details.code)');
    expect(cardVault).toContain('notifyAuthExpired(response.status,code)');
    expect(metadata).toContain('notifyAuthExpired(response.status,code)');
  });

  it('keeps actionable Planning and budget status ahead of secondary analysis',()=>{
    const planning=read('src/pages/PlanningPage.tsx');
    expect(planning.indexOf('className="panel surface-raised scheduled-panel"')).toBeLessThan(planning.indexOf('className="panel surface-raised forecast-panel"'));
    const reports=read('src/pages/ReportsPage.tsx');
    expect(reports.indexOf('report-budget-overview')).toBeLessThan(reports.indexOf('report-analytics-grid'));
  });

  it('bounds recurring and planning obligation lists outside the desktop-only approved table',()=>{
    const recurring=read('src/pages/RecurringPage.tsx');
    const recurringCss=read('src/pages/RecurringCompletion.css');
    const planning=read('src/pages/PlanningPage.tsx');
    const planningCss=read('src/pages/PlanningCompletion.css');
    expect(recurring).toContain('const [mobileActiveLimit,setMobileActiveLimit]=useState(12)');
    expect(recurring).toContain('const mobileUpcoming=upcoming.slice(0,mobileActiveLimit)');
    expect(recurring).toContain('mobileUpcoming.map');
    expect(recurring).toContain('setMobileActiveLimit(limit=>limit+12)');
    expect(recurringCss).toContain('.mobile-recurring-more');
    expect(planning).toContain('const [scheduledListLimit,setScheduledListLimit]=useState(12)');
    expect(planning).toContain('const visiblePending=pending.slice(0,scheduledListLimit)');
    expect(planning).toContain('visiblePending.map');
    expect(planning).toContain('setScheduledListLimit(limit=>limit+12)');
    expect(planningCss).toContain('@media(max-width:1099px)');
    expect(planningCss).toContain('.planning-scheduled-more');
  });


  it('applies persisted category icon families to every Dashboard semantic icon',()=>{
    const dashboard=read('src/pages/DashboardPage.tsx');
    const categoryIcons=[...dashboard.matchAll(/<FinanceIcon\\b[^>]*category=\\{[^>]+>/g)].map(match=>match[0]);
    expect(categoryIcons.length).toBeGreaterThan(0);
    for(const icon of categoryIcons)expect(icon).toContain('settings={data.state.settings}');
  });

  it('does not describe every card profile as an encrypted vault secret',()=>{
    const cards=read('src/pages/CardsPage.tsx');
    expect(cards).toContain('αποθηκευμένες στο προφίλ καρτών');
    expect(cards).not.toContain('<small>Ενεργές κάρτες</small><strong>{activeCards.length}</strong><span>στο ασφαλές card vault</span>');
  });

});
