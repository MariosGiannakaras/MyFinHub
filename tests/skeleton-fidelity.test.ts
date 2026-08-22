import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const skeleton=fs.readFileSync(path.join(root,'src/components/AppSkeleton.tsx'),'utf8');
const css=fs.readFileSync(path.join(root,'src/styles/part42.css'),'utf8');
const audit=fs.readFileSync(path.join(root,'scripts/loading-shift-audit.mjs'),'utf8');

const routes=['dashboard','transactions','review','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings'];

describe('route-shaped skeleton fidelity',()=>{
  it('defines a dedicated representative layout for every finance route',()=>{
    for(const route of routes)expect(skeleton).toContain(`page==='${route}'`);
    for(const component of ['DashboardSkeletonContent','TransactionsSkeleton','ReviewSkeleton','SavingsSkeleton','CardsSkeleton','CreditSkeleton','LoansSkeleton','LendingSkeleton','RecurringSkeleton','PlanningSkeleton','AttentionSkeleton','ReportsSkeleton','SettingsSkeleton'])expect(skeleton).toContain(component);
  });

  it('uses representative cards, rows, controls, charts and forms instead of generic panel blocks',()=>{
    for(const token of ['skeleton-primary-account','skeleton-list-row','skeleton-control','skeleton-chart','skeleton-form-field','skeleton-payment-card','skeleton-forecast-layout'])expect(skeleton).toContain(token);
    expect(skeleton).not.toContain('className="skeleton panel"');
  });

  it('keeps initial app loading on the active route rather than forcing Dashboard',()=>{
    expect(skeleton).toContain('const page=activePage()');
    expect(skeleton).toContain('data-skeleton-page={page}');
    expect(skeleton).toContain('<RouteSkeletonContent page={page}/>');
  });

  it('keeps responsive layout and reduced-motion contracts in the skeleton stylesheet',()=>{
    expect(css).toContain('@media(max-width:680px)');
    expect(css).toContain('@media(prefers-reduced-motion:reduce)');
    expect(css).toContain('.skeleton-forecast-layout');
    expect(css).toContain('.skeleton-form-grid');
  });

  it('audits every route at desktop and narrow-mobile widths for CLS/overflow',()=>{
    expect(audit).toContain('const pages=');
    expect(audit).toContain('desktop');
    expect(audit).toContain('mobile');
    expect(audit).toContain("dataset.skeletonPage");
    expect(audit).toContain('<=0.10');
  });
});
