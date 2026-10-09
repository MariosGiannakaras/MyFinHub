import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

describe('completion UX contracts',()=>{

  it('proves provider artwork replacement refreshes a real consumer surface',()=>{
    const harness=read('scripts/provider-brand-management-qa.mjs');
    expect(harness).toContain("clickText('.provider-editor-footer button','Αποθήκευση')");
    expect(harness).toContain('saved provider editor closes for dark provider-list evidence');
    expect(harness).toContain('uploaded provider asset replaces the prior base-logo binding');
    expect(harness).toContain('Dashboard after provider artwork replacement');
    expect(harness).toContain('Dashboard refreshes the replaced provider artwork binding');
    expect(harness).toContain('provider-replaced-artwork-dashboard-dark-desktop');
    expect(harness).toContain("image.src===expected");
  });


  it('keeps mobile Quick Entry inside bottom navigation instead of overlaying page content',()=>{
    const quick=read('src/styles/command-palette-contextual-entry.css');
    const shell=read('src/styles/mobile-app-shell.css');
    const coordination=read('src/styles/root-responsive-coordination.css');
    const appShell=read('src/components/AppShell.tsx');
    expect(appShell).toContain('className="mobile-nav-quick"');
    expect(appShell).toContain('data-global-quick-entry="mobile"');
    expect(appShell).toContain('<span>Νέα</span>');
    expect(appShell).toContain("dashboard:'Αρχική'");
    expect(appShell).toContain("transactions:'Κινήσεις'");
    expect(appShell).toContain("savings:'Στόχοι'");
    expect(appShell).toContain('<span>Άλλα</span>');
    expect(appShell).toContain('aria-label={item.label}');
    expect(appShell).not.toContain('className="mobile-quick-action"');
    expect(quick).not.toContain('.mobile-quick-action{');
    expect(coordination).toContain('grid-template-columns:repeat(6,minmax(0,1fr))');
    expect(shell).toContain('.mobile-nav .mobile-nav-quick');
    expect(shell).toContain('padding-bottom:calc(94px + env(safe-area-inset-bottom,0px))');
    expect(shell).toContain('scroll-padding-bottom:calc(94px + env(safe-area-inset-bottom,0px))');
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
    expect(more).toContain('.mobile-more-menu>header button{width:40px;height:40px;min-width:40px;min-height:40px');
    expect(shell).toContain('.mobile-nav{display:grid;position:fixed;z-index:70');
    const appShell=read('src/components/AppShell.tsx');
    expect(appShell).toContain('className="mobile-more-menu surface-raised" role="dialog" aria-modal="true"');
    expect(appShell).toContain('aria-label="Κλείσιμο μενού"');
  });


  it('keeps authentication password reveal touch-safe',()=>{
    const motion=read('src/styles/interaction-motion-states.css');
    expect(motion).toContain('.login-password-toggle{width:40px;height:40px;min-width:40px;min-height:40px');
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
    const mobilePresentations=read('src/styles/mobile-finance-presentations.css');
    expect(mobilePresentations).toContain('@media(max-width:420px)');
    expect(mobilePresentations).toContain('.heading-actions>.secondary,');
    expect(mobilePresentations).toContain('flex:1 1 min(140px,100%)');
    expect(mobilePresentations).toContain('min-width:min(140px,100%)');
  });


  it('keeps heavy Dashboard charts off the initial collapsed phone view',()=>{
    const dashboard=read('src/pages/DashboardPage.tsx');
    const css=read('src/pages/DashboardCompletion.css');
    expect(dashboard).toContain("window.matchMedia('(max-width:680px)')");
    expect(dashboard).toContain('const [mobileAnalyticsChartsReady,setMobileAnalyticsChartsReady]=useState(false)');
    expect(dashboard).toContain('const fallback=window.setTimeout(reveal,250)');
    expect(dashboard).toContain('secondFrame=requestAnimationFrame(reveal)');
    expect(dashboard).toContain('setMobileAnalyticsChartsReady(true)');
    expect(dashboard).toContain('window.clearTimeout(fallback)');
    expect(dashboard).toContain('const heavyChartsReady=renderDeferredCharts&&(!mobileViewport||mobileAnalyticsChartsReady)');
    expect(dashboard).toContain('heavyChartsReady?<Suspense fallback={null}><DashboardSummaryChart');
    expect(dashboard).toContain('dashboard-mobile-summary-donut');
    expect(dashboard).toContain('heavyChartsReady?<Suspense fallback={null}><DashboardFlowChart');
    expect(dashboard).toContain('heavyChartsReady?<Suspense fallback={null}><DashboardCategoryChart');
    expect(css).toContain('.dashboard-mobile-summary-donut');
    expect(css).toContain('.dashboard-approved .approved-bar-wrap{height:153px;min-height:153px}');
  });

  it('covers the self-loan money lifecycle and non-cash forgiveness semantics',()=>{
    const harness=read('scripts/completion-functional-crud-qa.mjs');
    expect(harness).toContain('self-loan create, partial return and forgiveness');
    expect(harness).toContain('self-loan creation produces exactly one neutral savings-to-current transfer');
    expect(harness).toContain("const selfCreateTransfer=await c.call(\`function(){const visible=\${visible};");
    expect(harness).toContain("const selfTransfers=await c.call(\`function(){const visible=\${visible};");
    expect(harness).toContain('self-loan partial return updates outstanding');
    expect(harness).toContain('forgiven self-loan moves to completed history');
    expect(harness).toContain('forgiveness creates none');
  });


  it('verifies Savings transfer, target progress, history and report neutrality in rendered CRUD QA',()=>{
    const harness=read('scripts/completion-functional-crud-qa.mjs');
    expect(harness).toContain('Savings manual transfer, target progress and report effects');
    expect(harness).toContain("includes('Μεταφορά στην άκρη')");
    expect(harness).toContain('manual savings transfer resolves distinct source/destination accounts');
    expect(harness).toContain('savings history records manual transfer source/note/amount');
    expect(harness).toContain('savings transfer updates monthly target progress');
    expect(harness).toContain('savings transfer does not alter income/expense report KPIs');
    expect(harness).toContain('savings transfer updates savings report KPI');
  });


  it('exercises Reports period navigation and KPI recalculation in rendered QA',()=>{
    const harness=read('scripts/reports-visual-qa.mjs');
    expect(harness).toContain('period navigation recalculates the active report');
    expect(harness).toContain("Προηγούμενος μήνας");
    expect(harness).toContain("Ιούλιος 2026");
    expect(harness).toContain('Reports KPIs recalculate after period change');
    expect(harness).toContain("Επόμενος μήνας");
    expect(harness).toContain('c.call(`function(){const button=document.querySelector(');
    expect(harness).toContain('[aria-label="Προηγούμενος μήνας"]');
    expect(harness).toContain('[aria-label^="Επόμενος μήνας"]');
    expect(harness).toContain('const july=await c.call(`function(){return {period:');
    expect(harness).toContain('nextDisabled:Boolean(document.querySelector');
  });

  it('syntax-checks every rendered QA module before launching browsers',()=>{
    const runner=read('scripts/run-rendered-qa.mjs');
    expect(runner).toContain("execFileSync(process.execPath,['--check',item.path]");
    expect(runner).toContain('Rendered QA module syntax check failed');
    expect(runner).toContain('Rendered QA module syntax preflight passed');
    expect(runner.indexOf('validateRenderedQaModules();')).toBeLessThan(runner.indexOf('async function preflightBrowser'));
  });


  it('covers the remaining generic Quick Entry intent paths and inline validation in rendered CRUD QA',()=>{
    const harness=read('scripts/completion-functional-crud-qa.mjs');
    expect(harness).toContain('Generic Quick Entry intents and validation');
    expect(harness).toContain('generic expense validation error');
    expect(harness).toContain('QA Generic Income');
    expect(harness).toContain('QA Generic Withdrawal');
    expect(harness).toContain('QA Generic Refund');
    expect(harness).toContain('QA Generic Reconciliation');
  });


  it('exercises legacy review keep semantics without implicit report mutation',()=>{
    const harness=read('scripts/action-center-context-qa.mjs');
    expect(harness).toContain('legacy review keep semantics never mutate reports implicitly');
    expect(harness).toContain('Κράτα ως είναι');
    expect(harness).toContain('reportAfterKeep===reportBeforeKeep');
    expect(harness).toContain('Keep as-is preserves report KPIs');
  });


  it('covers full Lending settlement/privacy and Recurring stop lifecycle in rendered CRUD QA',()=>{
    const harness=read('scripts/completion-functional-crud-qa.mjs');
    expect(harness).toContain('Lending full repayment, aggregation and privacy');
    expect(harness).toContain('QA Audit Final Repayment');
    expect(harness).toContain('full repayment settles while initial privacy remains masked');
    expect(harness).toContain("privacyPressed==='false'");
    expect(harness).toContain('Lending privacy reveals settled zero balance');
    expect(harness).toContain("getAttribute('aria-pressed')==='true'");
    expect(harness).toContain('Lending privacy masks selected identity');
    expect(harness).toContain('reactivated recurring item can be stopped');
    expect(harness).toContain('stopped recurring item retained without payment action');
  });


  it('closes the remaining budget and rule CRUD proof gaps in rendered QA',()=>{
    const harness=read('scripts/budget-rules-qa.mjs');
    expect(harness).toContain("selectOwnedOption('Κατηγορία / υποκατηγορία','Τρόφιμα')");
    expect(harness).toContain('automation edit persists');
    expect(harness).toContain("node.getAttribute('aria-label')===label");
    expect(harness).toContain("document.querySelectorAll('input,textarea')");
    expect(harness).toContain('const input=direct??row?.querySelector');
    expect(harness).toContain('existing matching transaction remains unchanged');
    expect(harness).toContain('new matching transaction receives rule category');
    expect(harness).toContain('overall budget create with warning threshold');
    expect(harness).toContain('overall budget edit updates stable row');
    expect(harness).toContain('overall budget delete');
  });


  it('executes app-wide Quick Entry, undo and redo shortcuts in rendered QA',()=>{
    const command=read('scripts/command-palette-qa.mjs');
    const functional=read('scripts/completion-functional-crud-qa.mjs');
    expect(command).toContain("key:' ',ctrlKey:true,shiftKey:true");
    expect(command).toContain('Quick Entry from global shortcut');
    expect(command).toContain("document.querySelectorAll('button[aria-label]')");
    expect(command).toContain("item.getAttribute('aria-label')===label&&item.getClientRects().length>0");
    expect(command).toContain('.quick-modal input[data-autofocus="true"]');
    expect(command).toContain('.quick-modal input:not([type="hidden"])');
    expect(command).toContain("clickAria('Γρήγορη προσθήκη')");
    expect(command).not.toContain("clickAria('Άνοιγμα γρήγορης καταχώρισης');await waitFor");
    expect(functional).toContain("key:'y',ctrlKey:true");
    expect(functional).toContain('Ctrl+Y redo reapplies modern delete');
    expect(functional).toContain("key:'z',ctrlKey:true");
    expect(functional).toContain('Ctrl+Z undo restores modern event again');
  });


  it('keeps the final functional closeout inside the required rendered CRUD suite',()=>{
    const harness=read('scripts/completion-functional-crud-qa.mjs');
    expect(harness).toContain('Completion functional QA: Lending repayment round-trip');
    expect(harness).toContain('lending repayment records exactly one semantic repayment row');
    expect(harness).toContain('partial 12/42 repayment leaves a remaining receivable');
    expect(harness).toContain('Completion functional QA: Settings custom cash account create and delete');
    expect(harness).toContain('QA Audit Temp Cash');
    expect(harness).toContain('temporary cash account deleted');
  });

  it('keeps final screenshot browser bootstrap retryable and diagnosable',()=>{
    const harness=read('scripts/final-screenshots-qa.mjs');
    expect(harness).toContain('async function launchBrowser()');
    expect(harness).toContain('for(let attempt=0;attempt<2;attempt+=1)');
    expect(harness).toContain('Browser exited before CDP became ready');
    expect(harness).toContain('Browser did not expose CDP port');
    expect(harness).toContain("stdio:['ignore','pipe','pipe']");
    expect(harness).toContain('await stopBrowser(browserSession.child)');
    expect(harness).toContain('const settingsNestedStateCount=8');
    expect(harness).toContain('const expectedScreenshots=themes.length*viewports.length');
    expect(harness).toContain('if(screenshots.length!==expectedScreenshots)');
  });


  it('keeps the Dashboard attention shortcut in normal flow instead of hard-coded over topbar controls',()=>{
    const css=read('src/styles/dashboard-bankmark-chart-attention.css');
    expect(css).toContain('body:has(.dashboard-approved) .period-attention-shortcut');
    expect(css).toContain('position:static');
    expect(css).toContain('flex:0 0 36px');
    expect(css).not.toContain('right:307px');
  });

  it('keeps mobile card copy actions at the app-wide touch target size without enlarging their visible glyph surface',()=>{
    const css=read('src/components/InteractivePaymentCard.css');
    expect(css).toContain('position:relative;width:40px;height:40px;min-width:40px;min-height:40px');
    expect(css).toContain('width:23px;height:23px');
    expect(css).toContain('.prototype-payment-card .copy-mini:hover::before');
  });


  it('keeps the secure card-details editor on an opaque elevated surface',()=>{
    const css=read('src/styles/card-details-dialog.css');
    expect(css).toContain('background:var(--surface-elevated-gradient,var(--surface,#fff))!important');
    expect(css).toContain('isolation:isolate');
    expect(css).toContain('box-shadow:0 24px 64px');
  });


  it('captures final screenshots only after route and tab motion settles',()=>{
    const harness=read('scripts/final-screenshots-qa.mjs');
    expect(harness).toContain('await sleep(260)');
    expect(harness).toContain('await sleep(220)');
    expect(harness).toContain('await sleep(180)');
    expect(harness).toContain("const captureNested=async state=>{await sleep(240)");
    const shell=read('src/components/AppShell.tsx');
    expect(shell).toContain("transition={{duration:reduce?0:.18}}");
  });


  it('distinguishes real Dashboard chrome overlays from normal content scrolling under the sticky topbar',()=>{
    const harness=read('scripts/completion-geometry-qa.mjs');
    expect(harness).toContain('document.elementFromPoint');
    expect(harness).toContain('const shortcutIsTopmost');
    expect(harness).toContain('if(shortcutIsTopmost)desktopChromeOverlaps.push');
  });


  it('covers every primary route at a 200%-equivalent desktop viewport with large text and reduced motion',()=>{
    const harness=read('scripts/completion-geometry-qa.mjs');
    expect(harness).toContain("Completion geometry/overflow QA: 200%-equivalent desktop reflow across every primary route");
    expect(harness).toContain('const zoomWidth=720');
    expect(harness).toContain('const zoomHeight=500');
    expect(harness).toContain("url.searchParams.set('text','large')");
    expect(harness).toContain("url.searchParams.set('motion','reduced')");
    expect(harness).toContain('for(const page of pages)');
    expect(harness).toContain('zoom-200pct/');
  });


  it('treats mobile fixed-chrome occlusion as a defect when final actions cannot scroll clear',()=>{
    const harness=read('scripts/completion-geometry-qa.mjs');
    expect(harness).toContain('const maxScroll=Math.max(0,result.scrollHeight-viewport.height)');
    expect(harness).toContain('const atBottom=result.scrollY>=maxScroll-2');
    expect(harness).toContain('if(viewport.mobile&&atBottom)assert(result.overlaps.length===0');
    expect(harness).toContain('prevents final actions from scrolling clear');
    expect(harness).toContain("document.querySelectorAll('.mobile-nav button>span')");
    expect(harness).toContain("kind:'label-overlap'");
    expect(harness).toContain('bottom-nav label collision');
  });


  it('uses native label associations and actionable CDP errors in dialog geometry QA',()=>{
    const harness=read('scripts/completion-dialog-geometry-qa.mjs');
    expect(harness).toContain("const labels=('labels' in node&&node.labels)?node.labels.length:0");
    expect(harness).toContain('return Boolean(ariaLabel||labelledBy||wrapped||labels)');
    expect(harness).not.toContain('CSS.escape(node.id)');
    expect(harness).toContain("r.exceptionDetails.exception?.description");
    expect(harness).toContain("r.exceptionDetails.stackTrace?.callFrames");
  });


  it('hard-bounds mobile DialogShell surfaces and inspects their settled geometry',()=>{
    const css=read('src/styles/mobile-reports-settings-editors.css');
    const harness=read('scripts/completion-dialog-geometry-qa.mjs');
    expect(css).toContain('.modal-backdrop{box-sizing:border-box;padding-left:10px;padding-right:10px}');
    expect(css).toContain('.quick-modal{width:100%;max-width:100%;box-sizing:border-box}');
    expect(harness).toContain('await sleep(220)');
    expect(harness).toContain("style.overflowX==='auto'||style.overflowX==='scroll'");
    expect(harness).toContain('parent.scrollWidth>parent.clientWidth+1');
    expect(harness).toContain('hostRect.left<-1||hostRect.right>innerWidth+1');
    expect(harness).toContain('result.left>=-1&&result.right<=result.viewportWidth+1');
  });

});
