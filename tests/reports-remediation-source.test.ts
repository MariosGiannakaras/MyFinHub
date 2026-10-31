import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page=readFileSync(new URL('../src/pages/ReportsPage.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/pages/ReportsPage.css',import.meta.url),'utf8');

describe('Reports post-v1.4 remediation contracts',()=>{
  it('defers private six-month account-history scans until reveal without losing chart data',()=>{
    expect(page).toContain("const accounts=useMemo(()=>allAccounts(data).filter(account=>account.kind!=='credit'),[data])");
    expect(page).toContain("const accountIds=useMemo(()=>accounts.slice(0,4).map(account=>account.id),[accounts])");
    expect(page).toContain("()=>privacyVisible&&accountIds.length?primaryAccountSeries(data,month,accountIds,6,asOf):[]");
    expect(page).toContain('[data,month,asOf,privacyVisible,accountIds]');
    expect(page).toContain('data={accountSeries}');
    expect(page).toContain('onPrivacyVisibleChange(!privacyVisible)');
  });


  it('restores one executive financial picture while preserving all five canonical KPI values',()=>{
    expect(page).toContain('report-kpi-strip report-financial-picture');
    expect(page).toContain('className={`report-headline-card report-executive-main');
    expect(page).toContain('className="report-headline-card report-executive-rate positive"');
    expect(page.match(/report-headline-card/g)?.length).toBeGreaterThanOrEqual(5);
    expect(page).toContain('<span>Καθαρή ροή</span>');
    expect(page).toContain('<span>Αποταμίευση</span>');
    expect(page).toContain('<span>Συνολικά έσοδα</span>');
    expect(page).toContain('<span>Συνολικά έξοδα</span>');
    expect(page).toContain('<span>Συνολικό budget</span>');
    expect(css).toContain('.report-financial-picture{grid-template-columns:minmax(260px,1.35fr) minmax(210px,.75fr) minmax(360px,1.25fr)!important');
  });

  it('keeps the no-budget state compact with a truthful management path',()=>{
    expect(page).toContain("report-budget-overview ${budgetRows.length?'':'is-empty'}");
    expect(page).toContain("budgetRows.length?'Διαχείριση προϋπολογισμών':'Ορισμός προϋπολογισμού'");
    expect(css).toContain('.report-budget-overview.is-empty{grid-template-columns:minmax(0,1fr) auto');
    expect(css).toContain('.report-budget-overview.is-empty .report-budget-management>summary{min-height:44px');
  });

  it('subordinates secondary analysis without removing existing analytical sections',()=>{
    for(const marker of [
      'report-analytics-grid','report-support-grid-four','report-lower-grid-dense','report-accounts-grid',
      'report-category-panel','report-comparison-panel','report-insights-rail','report-savings-sources',
      'report-counterparties','report-upcoming-card','report-account-distribution'
    ])expect(page).toContain(marker);
    expect(css).toContain('.report-support-grid>.panel,.report-support-grid>aside{');
    expect(css).toContain('background:var(--surface-2);border-color:var(--border-subtle);box-shadow:none');
  });

  it('collapses privacy-hidden account history and restores full revealed chart composition',()=>{
    expect(page).toContain("report-account-history ${privacyVisible?'is-revealed':'is-private'}");
    expect(css).toContain('.report-account-history.is-private .private-report-placeholder{min-height:64px');
    expect(css).toContain('.report-account-history.is-revealed{min-height:310px}');
    expect(page).toContain('<ResponsiveContainer width="100%" height={230}>');
  });

  it('bounds wide desktop measure and removes duplicate period chrome',()=>{
    expect(css).toContain('width:min(100%,1680px);margin-inline:auto');
    expect(page).toContain('className="report-selected-period"');
    expect(page).toContain('eyebrow="ΑΝΑΦΟΡΕΣ"');
    expect(page).not.toContain('report-period-chip');
    expect(page).not.toContain('ΑΝΑΦΟΡΕΣ ·');
    expect(css).not.toContain('.report-period-chip');
  });

  it('uses shared readable secondary text and semantic chart axis tokens',()=>{
    expect(page).toContain('tick={{fontSize:11,fill:\'var(--text-secondary)\'}}');
    expect(page).toContain('stroke="var(--chart-grid)"');
    expect(css).toContain('color:var(--text-secondary)');
    expect(css).toContain('font-size:var(--ux-dense-label-size)');
  });

  it('guards existing single-card credit summary width using actual Reports geometry',()=>{
    const shared=readFileSync(new URL('../src/styles/expanded-report-layouts.css',import.meta.url),'utf8');
    const rendered=readFileSync(new URL('../scripts/reports-visual-qa.mjs',import.meta.url),'utf8');
    expect(shared).toContain('.report-upcoming-card .report-operations-grid.report-credit-portfolio{grid-template-columns:minmax(0,1fr)}');
    expect(rendered).toContain('Reports nested single-credit summary must span its own upcoming panel');
    expect(rendered).toContain('reports-credit-portfolio-fullwidth-desktop.png');
    expect(rendered).toContain('creditPortfolio.cardWidth>=creditPortfolio.outerWidth-2');
    const workflow=readFileSync(new URL('../.github/workflows/fb-focused-rendered-qa.yml',import.meta.url),'utf8');
    expect(workflow).toContain("contains(github.event.pull_request.body, '<!-- run-reports-focused-qa -->')");
    expect(workflow).toContain("'reports-visual'");
    expect(rendered).toContain('reports-credit-portfolio-fullwidth-mobile.png');
    expect(rendered).toContain('375px mobile nested credit summary stays full-width');
    expect(rendered).toContain("darkPrivacy.theme==='dark'");
    expect(rendered).toContain("darkPrivacy.surfaceInset==='#0f1828'");

  });

  it('keeps report section links inside the hash router and expands mobile hidden panels before focusing',()=>{
    const rendered=readFileSync(new URL('../scripts/reports-visual-qa.mjs',import.meta.url),'utf8');
    expect(page).toContain('href="#/reports" data-report-section={id}');
    expect(page).toContain("if(sectionId==='report-comparisons')setMobileSupportExpanded(true)");
    expect(page).toContain("target.scrollIntoView({block:'start',behavior:'auto'})");
    expect(page).toContain("target.focus({preventScroll:true})");
    expect(page).not.toContain('href="#report-comparisons"');
    expect(rendered).toContain('reports-mobile-section-nav-comparisons.png');
    expect(rendered).toContain("mobileSectionNav.beforeHash===mobileSectionNav.afterHash");
    expect(rendered).toContain("mobileSectionNav.expanded==='true'");
    expect(rendered).toContain('mobileSectionNav.focused');
  });

  it('requires real hit-testing of sticky Reports section navigation after deep mobile scroll',()=>{
    const rendered=readFileSync(new URL('../scripts/reports-visual-qa.mjs',import.meta.url),'utf8');
    expect(rendered).toContain("[[375,812,'375'],[320,720,'320'],[375,4259,'375-long']]");
    expect(rendered).toContain('document.elementFromPoint(x,y)');
    expect(rendered).toContain('nav.contains(hit)');
    expect(rendered).toContain("sticky.withinViewport&&sticky.navHit&&!sticky.documentOverflow");
    expect(rendered).toContain('reports-sticky-section-nav-');
  });

  it('does not introduce unsupported export or download decoration',()=>{
    expect(page).not.toMatch(/Εξαγωγή|PDF|CSV|Λήψη|Download/i);
  });
});
