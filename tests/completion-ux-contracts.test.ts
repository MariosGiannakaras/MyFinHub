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
    const categoryIcons=[...dashboard.matchAll(/<FinanceIcon\b[^>]*category=\{[^>]+>/g)].map(match=>match[0]);
    expect(categoryIcons.length).toBeGreaterThan(0);
    for(const icon of categoryIcons)expect(icon).toContain('settings={data.state.settings}');
  });

  it('does not describe every card profile as an encrypted vault secret',()=>{
    const cards=read('src/pages/CardsPage.tsx');
    expect(cards).toContain('αποθηκευμένες στο προφίλ καρτών');
    expect(cards).not.toContain('<small>Ενεργές κάρτες</small><strong>{activeCards.length}</strong><span>στο ασφαλές card vault</span>');
  });


  it('keeps the mobile More dialog above all persistent bottom chrome',()=>{
    const more=read('src/styles/mobile-more-navigation.css');
    const shell=read('src/styles/root-responsive-coordination.css');
    expect(more).toContain('.mobile-more-backdrop{display:block;position:fixed;inset:0;z-index:80');
    expect(shell).toContain('.mobile-nav{display:grid;position:fixed;z-index:70');
    const appShell=read('src/components/AppShell.tsx');
    expect(appShell).toContain('className="mobile-more-menu surface-raised" role="dialog" aria-modal="true"');
    expect(appShell).toContain('aria-label="Κλείσιμο μενού"');
  });


  it('keeps Quick Entry and OCR review within the dynamic mobile viewport',()=>{
    const quick=read('src/styles/quick-entry-modal-base.css');
    const coordination=read('src/styles/root-responsive-coordination.css');
    const receipts=read('src/styles/receipt-inbox.css');
    expect(quick).toContain('max-height:94dvh');
    expect(coordination).toContain('.quick-modal{max-height:96dvh}');
    expect(receipts).toContain('height:min(820px,94dvh)');
    expect(receipts).toContain('.receipt-inbox{height:96dvh;width:98vw');
  });


  it('keeps the Receipt launch inside the Quick Entry footer on phone and small tablet widths',()=>{
    const receipts=read('src/styles/receipt-inbox.css');
    expect(receipts).toContain('@media(max-width:820px)');
    expect(receipts).toContain('.quick-modal>footer .receipt-quick-launch{position:static');
    expect(receipts).not.toContain('@media(max-width:820px){.receipt-inbox{height:96dvh;width:98vw;border-radius:20px}.receipt-inbox-layout{grid-template-columns:1fr;overflow:auto}.receipt-draft-list{max-height:220px;border-right:0;border-bottom:1px solid #dce5f0}.receipt-review-pane{overflow:visible}.receipt-capture-actions{flex-wrap:wrap}.receipt-capture-actions>small{width:100%;margin-left:0}.receipt-preview{grid-template-columns:140px 1fr}.receipt-proposal dl{grid-template-columns:1fr}.receipt-quick-launch{right:16px;bottom:18px}');
  });


  it('persists icon-family and color changes immediately across Settings tab switches',()=>{
    const settings=read('src/pages/SettingsPage.tsx');
    expect(settings).toContain('draftRef.current = normalized');
    expect(settings).toContain('setDraft(normalized)');
    expect(settings).toContain('onSettings(normalized)');
    expect(settings).toContain("<CategoryIconAssignmentWorkspace settings={draft} onChange={(next) => commit(next, '')} />");
    expect(settings).not.toContain('Αποθήκευση εικονιδίων');
  });


  it('bounds long-term Loans and personal Savings goal lists with explicit expansion',()=>{
    const loans=read('src/pages/LoansPage.tsx');
    expect(loans).toContain('const [activeLimit,setActiveLimit]=useState(20)');
    expect(loans).toContain('const [historyLimit,setHistoryLimit]=useState(20)');
    expect(loans).toContain('const visibleActiveLoans=activeLoans.slice(0,activeLimit)');
    expect(loans).toContain('const visibleCompletedLoans=completedLoans.slice(0,historyLimit)');
    expect(loans).toContain('setActiveLimit(limit=>limit+20)');
    expect(loans).toContain('setHistoryLimit(limit=>limit+20)');
    const savings=read('src/pages/SavingsPage.tsx');
    expect(savings).toContain('const [goalLimit,setGoalLimit]=useState(12)');
    expect(savings).toContain('const visibleGoalRows=goalRows.slice(0,goalLimit)');
    expect(savings).toContain('setGoalLimit(limit=>limit+12)');
  });


  it('prevents shared PageHeader actions from overflowing tablets and phones',()=>{
    const headings=read('src/styles/workspace-heading-metrics.css');
    expect(headings).toContain('@media(max-width:980px)');
    expect(headings).toContain('.page-heading{flex-wrap:wrap;align-items:flex-start}');
    expect(headings).toContain('@media(max-width:680px)');
    expect(headings).toContain('.page-heading{display:grid;grid-template-columns:minmax(0,1fr)');
    expect(headings).toContain('.heading-actions{width:100%;display:flex;flex-wrap:wrap');
    expect(headings).toContain('@media(max-width:420px)');
  });

});
