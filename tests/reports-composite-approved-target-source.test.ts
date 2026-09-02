import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

describe('approved composite Reports source contract',()=>{
  it('keeps one long scrollable surface with in-page report navigation',()=>{
    const source=read('src/pages/ReportsPage.tsx');
    const styles=read('src/styles/part34.css');
    expect(source).toContain('report-section-nav');
    for(const anchor of ['#report-overview','#report-flow','#report-obligations','#report-expenses','#report-comparisons','#report-accounts'])expect(source).toContain(anchor);
    expect(styles).toContain('.report-section-nav{position:sticky');
    expect(styles).toContain('.reports-composite .report-category-list{max-height:none;overflow:visible');
  });

  it('consolidates duplicate analytics while retaining the unique coverage from both references',()=>{
    const source=read('src/pages/ReportsPage.tsx');
    expect(source).toContain('6μηνη οικονομική ροή');
    expect(source).toContain('Κατανομή & μεταβολή εξόδων');
    expect(source).toContain('Top 5 έμποροι / περιγραφές');
    expect(source).toContain('Σύγκριση μηνών');
    expect(source).toContain('Πάγια & δόσεις / μήνα');
    expect(source).toContain('Εξέλιξη βασικών λογαριασμών');
    expect(source).toContain('Πηγές αποταμίευσης');
    expect(source).not.toContain('Κατέβασμα');
    expect(source).not.toContain('Εκτύπωση');
  });

  it('uses canonical report/domain functions and shared finance icons',()=>{
    const source=read('src/pages/ReportsPage.tsx');
    const reports=read('src/lib/reports.ts');
    expect(source).toContain('operationalReportSnapshot(data,month)');
    expect(source).toContain('reportInsightModel(data,month)');
    expect(source).toContain('reportExpenseCounterparties(data,month,5)');
    expect(source).toContain('reportLoanBurden(data)');
    expect(source).toContain('<FinanceIcon settings={data.state.settings}');
    expect(source).toContain('accountsVisible');
    expect(reports).toContain('flowImpactLegacy(data,tx)');
    expect(reports).toContain('flowImpactEvent(event)');
    expect(reports).toContain('activeLongTermLoanObligations(data)');
  });
});
