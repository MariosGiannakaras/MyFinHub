import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const entry='src/styles/workspace-compat.css';

function collectWorkspaceCss(file:string,seen=new Set<string>()):Array<{file:string;source:string}>{
  const normalized=file.replaceAll('\\','/');
  if(seen.has(normalized))return [];
  seen.add(normalized);
  const absolute=path.join(root,normalized);
  const source=fs.readFileSync(absolute,'utf8');
  const collected=[{file:normalized,source}];
  const dir=path.posix.dirname(normalized);
  for(const match of source.matchAll(/@import\s+['"]([^'"]+)['"]\s*;/g)){
    const imported=match[1];
    if(!imported.startsWith('.'))continue;
    const resolved=path.posix.normalize(path.posix.join(dir,imported));
    collected.push(...collectWorkspaceCss(resolved,seen));
  }
  return collected;
}

describe('lazy workspace CSS boundary',()=>{
  it('never owns global AppShell/navigation chrome',()=>{
    const files=collectWorkspaceCss(entry);
    expect(files.length).toBeGreaterThan(1);
    const forbidden=/\.(?:app-shell|sidebar|topbar|mobile-nav|command-search-action|top-actions|file-panel|sidebar-foot|brand-block|brand-home-button)\b/;
    for(const {file,source} of files){
      expect(source,`${file} must not style global AppShell chrome from the lazy workspace layer`).not.toMatch(forbidden);
    }
  });

  it('keeps the explicitly ordered compatibility entry lists unique and disjoint',()=>{
    const imports=(file:string)=>[...fs.readFileSync(path.join(root,file),'utf8').matchAll(/@import\s+['"]([^'"]+)['"]\s*;/g)].map(match=>match[1]);
    const eager=imports('src/styles/root-compat.css');
    const lazy=imports(entry);
    const targets=imports('src/styles/approved-workspace-targets.css');
    const all=[...eager,...lazy,...targets];
    expect(all.length).toBeGreaterThanOrEqual(80);
    expect(new Set(all).size).toBe(all.length);
    expect(eager.indexOf('./theme-surface-foundations.css')).toBe(0);
    expect(eager.indexOf('./ui-hardening-foundations.css')).toBeLessThan(eager.indexOf('./app-controls.css'));
    expect(lazy[0]).toBe('./approved-workspace-targets.css');
    expect(lazy.at(-1)).toBe('./dark-theme-surfaces.css');
  });

  it('binds semantic width, amount and color rules to actual component roles',()=>{
    const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');
    for(const [page,css,columns] of [
      ['src/components/PlanningApprovedDesktop.tsx','src/styles/planning-approved-target.css',['date','kind','description','account','amount','status','actions']],
      ['src/pages/RecurringPage.tsx','src/styles/recurring-approved-target.css',['item','next','account','amount','actions']],
    ] as const){
      const markup=read(page),style=read(css);
      expect(style).not.toContain('th:nth-child');
      for(const column of columns){expect(markup).toContain('data-column="'+column+'"');expect(style).toContain('th[data-column='+column+']{width:')}
    }
    expect(read('src/pages/LendingPage.tsx')).toContain('data-column="description"');
    expect(read('src/styles/lending-approved-target.css')).toContain('td[data-column=description]');
    expect(read('src/pages/CreditCardPage.tsx')).toContain('data-credit-stat="available"');
    expect(read('src/styles/credit-approved-target.css')).toContain('[data-credit-stat=available]>b');
    expect(read('src/styles/mobile-app-shell.css')).not.toContain('.primary-balance-card:nth-child');
    expect(read('src/styles/mobile-app-shell.css')).not.toContain('.chart-panel:nth-child');
    expect(read('src/pages/DashboardPage.tsx')).not.toMatch(/className=["'](?:dashboard-grid|lower-grid)/);
    expect(read('src/pages/DashboardPage.tsx')).toContain('data-dashboard-section="quick-entry"');
    for(const field of ['expiry','cvv']){
      expect(read('src/components/CanonicalCreditCardStack.tsx')).toContain('data-card-field="'+field+'"');
      expect(read('src/components/InteractivePaymentCard.tsx')).toContain('data-card-field="'+field+'"');
      expect(read('src/styles/canonical-credit-card-stack-1.css')).toContain('[data-card-field='+field+'] .card-field-value');
    }
  });

  it('keeps global shell styling in the eagerly loaded root layer',()=>{
    const rootCompat=fs.readFileSync(path.join(root,'src/styles/root-compat.css'),'utf8');
    expect(rootCompat).toContain("@import './shell-navigation-foundations.css';");
    expect(rootCompat).toContain("@import './root-responsive-coordination.css';");
    expect(rootCompat).toContain("@import './mobile-app-shell.css';");
  });
});
