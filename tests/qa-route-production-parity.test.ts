import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('rendered QA matches production page-level code splitting',()=>{
  it('keeps the initial Dashboard and real fixture while loading noncurrent routes on demand',()=>{
    const qa=readFileSync('src/qa.tsx','utf8');
    const production=readFileSync('src/App.tsx','utf8');
    expect(qa).toContain("import { DashboardPage } from './pages/DashboardPage';");
    expect(qa).toContain("import { qaFinanceData } from './qaFixture';");
    for(const page of ["TransactionsPage","SavingsPage","CardsPage","CreditCardPage","LoansPage","LendingPage","RecurringPage","PlanningPage","AttentionPage","ReportsPage","SettingsPage"]){
      expect(production).toContain(`import('./pages/${page}')`);
      expect(qa).toContain(`const ${page}=lazy(()=>import('./pages/${page}')`);
      expect(qa).not.toContain(`import { ${page} } from './pages/${page}';`);
      expect(qa).toContain(`<${page} `);
    }
    // Real pages still mount when navigated to; loading and failures remain visible.
    expect(qa).toContain('<Suspense fallback={<PageSkeleton/>}>');
    expect(qa).toContain('<PageErrorBoundary resetKey={page}');
    expect(qa).toContain('lazyFailure?<LazyResourceFailure/>:crash?<Crash/>:content');
    expect(qa).toContain('const content=page');
    expect(qa).toContain('saveState===\'loading\'');
    // Lighthouse must build the exact same QA routing and not silently
    // rewrite imports only for its separate performance-dist fixture.
    const performanceConfig=readFileSync('vite.performance.config.ts','utf8');
    expect(performanceConfig).toContain('if (!code.includes(dynamicImport))');
    expect(performanceConfig).toContain("return null;");
    expect(performanceConfig).not.toContain('next.replace(source');
    expect(performanceConfig).toContain("!code.includes('<Suspense fallback={<PageSkeleton/>}>')");

  });
});
