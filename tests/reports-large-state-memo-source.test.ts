import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('large-state Reports calculation contract (#588 performance regression)',()=>{
  it('memoizes revision-scoped expensive finance derivations without hiding private charts or loosening QA timing',()=>{
    const source=readFileSync('src/pages/ReportsPage.tsx','utf8');
    const qa=readFileSync('scripts/large-data-boundaries-qa.mjs','utf8');
    for(const fn of [
      'operationalReportSnapshot(data,month,asOf)',
      'reportInsightModel(data,month,asOf)',
      'reportFlowSeries(data,month,6,asOf)',
      'categoryMomentum(data,month,100,asOf)',
      'reportExpenseCounterparties(data,month,5,asOf)',
      'reportLoanBurden(data,reportingPeriodEndDate(month,asOf))',
    ]){
      expect(source).toContain(`useMemo(()=>${fn},[data,month,asOf])`);
    }
    expect(source).toContain('privacyVisible&&accountIds.length?primaryAccountSeries');
    expect(source).toContain('useMemo(()=>budgetProgress(data,month,asOf),[data,month,asOf])');
    expect(qa).toContain('results.maxLoadMs<5000');
    expect(qa).toContain('Large-data readiness by route');
  });
});