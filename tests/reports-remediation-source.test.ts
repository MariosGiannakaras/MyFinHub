import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page=readFileSync(new URL('../src/pages/ReportsPage.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/pages/ReportsPage.css',import.meta.url),'utf8');

describe('Reports post-v1.4 remediation contracts',()=>{
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

  it('does not introduce unsupported export or download decoration',()=>{
    expect(page).not.toMatch(/Εξαγωγή|PDF|CSV|Λήψη|Download/i);
  });
});
