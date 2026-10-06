import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const normalize=(value:string)=>value.replaceAll('\\','/');
const walk=(dir:string,pattern:RegExp):string[]=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(entry=>{
  const relative=normalize(path.posix.join(dir,entry.name));
  return entry.isDirectory()?walk(relative,pattern):pattern.test(entry.name)?[relative]:[];
});
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');

function resolveRelative(from:string,specifier:string,extensions:string[]){
  if(!specifier.startsWith('.'))return null;
  const base=normalize(path.posix.normalize(path.posix.join(path.posix.dirname(from),specifier)));
  for(const candidate of [base,...extensions.map(ext=>base.endsWith(ext)?base:`${base}${ext}`)]){
    if(fs.existsSync(path.join(root,candidate))&&fs.statSync(path.join(root,candidate)).isFile())return candidate;
  }
  return null;
}

describe('final UI reuse and orphan audit',()=>{
  const productTsx=[...walk('src/components',/\.tsx$/),...walk('src/pages',/\.tsx$/)];

  it('keeps production JSX off legacy surface hooks and raw generic chrome',()=>{
    const rawGeneric=/<button\b[^>]*className="[^"]*\b(?:save-button|secondary|text-button|icon-button|ghost-button|inline-icon-action)\b[^"]*"/;
    for(const file of productTsx){
      const source=read(file);
      expect(source,`${file} should not use legacy neo surface hooks`).not.toMatch(/\bneo-(?:raised|flat|inset)\b/);
      expect(source,`${file} should not recreate shared generic button chrome`).not.toMatch(rawGeneric);
    }
  });

  it('routes the remaining generic action families through shared primitives',()=>{
    const shell=read('src/components/AppShell.tsx');
    const login=read('src/components/LoginScreen.tsx');
    const mfa=read('src/components/MfaScreen.tsx');
    const iban=read('src/components/AccountIban.tsx');
    const period=read('src/components/PeriodControl.tsx');
    const loans=read('src/components/LongTermLoanSummary.tsx');
    const icons=read('src/components/CategoryIconAssignmentWorkspace.tsx');
    const providers=read('src/components/FinancialProviderManagementSettings.tsx');

    expect(shell).toContain('<IconButton type="button" aria-label="Αναζήτηση και εντολές"');
    expect(shell).toContain('<IconButton type="button" aria-label="Ανανέωση δεδομένων"');
    expect(shell).toContain('<Button type="button" variant="secondary" disabled={!canUndo} onClick={onUndo}>Αναίρεση</Button>');
    expect(login).toContain('<IconButton type="button" className="login-password-toggle"');
    expect(mfa).toContain('<Button variant="ghost" className="ghost-button login-logout"');
    expect(iban).toContain('<IconButton type="button" className="inline-icon-action account-iban-copy"');
    expect(period.match(/<IconButton\b/g)).toHaveLength(2);
    expect(loans).toContain('<Button type="button" variant="primary" className="pay-action linked-loan-pay"');
    expect(icons).toContain('<IconButton type="button" className="category-icon-selection-close"');
    expect(providers).toContain('className="provider-management panel surface-raised"');
    expect(providers).toContain('<Button type="button" variant="secondary" className="provider-edit-action"');
  });

  it('keeps the shared transaction split disclosure above generic mobile text-button geometry',()=>{
    const split=read('src/components/TransactionSplitDetails.tsx');
    const splitStyles=read('src/styles/transaction-split-editor.css');
    const rootCompat=read('src/styles/root-compat.css');
    expect(split).toContain('<Button type="button" variant="ghost" className="transaction-split-toggle"');
    expect(split).not.toContain("style={{display:'inline-flex'");
    expect(splitStyles).toContain('.transaction-split-disclosure .transaction-split-toggle {');
    expect(splitStyles).toContain('min-height: 44px;');
    expect(rootCompat.indexOf("@import './transaction-split-editor.css';")).toBeGreaterThan(rootCompat.indexOf("@import './visual-polish-overrides.css';"));
  });

  it('keeps audited static presentation geometry out of JSX while allowing runtime-driven inline values',()=>{
    const shell=read('src/components/AppShell.tsx');
    const sort=read('src/components/SortDirectionControl.tsx');
    const loans=read('src/pages/LoansPage.tsx');
    const dashboard=read('src/pages/DashboardPage.tsx');
    const transactions=read('src/pages/TransactionsPage.tsx');
    const historyCss=read('src/styles/durable-history-controls.css');
    const sharedCss=read('src/styles/ui-hardening-foundations.css');
    const loanCss=read('src/styles/loans-approved-target.css');
    const dashboardCss=read('src/styles/dashboard-approved-target.css');
    const transactionCss=read('src/styles/transactions-approved.css');

    expect(shell).toContain('change-history-dialog');
    expect(shell).not.toContain("style={{gridTemplateRows:'auto auto minmax(0,1fr) auto'}}");
    expect(shell).not.toContain("style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto'");
    expect(historyCss).toContain('.change-history-dialog{grid-template-rows:auto auto minmax(0,1fr) auto}');
    expect(historyCss).toContain('.change-history-dialog .history-row{display:grid;');

    expect(sort).not.toContain('style={{ minHeight: 42 }}');
    expect(sharedCss).toContain('.sort-direction-control button{');
    expect(sharedCss).toContain('min-height:42px');

    expect(loans).toContain('className="loan-completed-status"');
    expect(loans).toContain('className="loan-list loan-history-list"');
    expect(loans).not.toContain("style={{marginTop:10}}");
    expect(loanCss).toContain('.loan-history-list,.loan-history-empty{margin-top:10px}');

    expect(dashboard).toContain('className="comparison-line"');
    expect(dashboard).toContain('className="dashboard-budget-kpi" data-budget-panel');
    expect(dashboard).toContain('className="dashboard-budget-kpi-hitarea"');
    expect(dashboard).not.toContain("style={{position:'relative'}}");
    expect(dashboardCss).toContain('.dashboard-approved .dashboard-budget-kpi-hitarea{position:absolute;');

    expect(transactions).toContain('className="transaction-mobile-action"');
    expect(transactions).toContain('transaction-filter-pass-through');
    expect(transactions).not.toContain("style={{minHeight:44}}");
    expect(transactions).not.toContain("style={{display:'contents'}}");
    const recurring=read('src/pages/RecurringPage.tsx');
    expect(recurring).not.toContain("style={{gridTemplateColumns:'repeat(2,minmax(0,1fr))'}}");
    expect(recurring).not.toContain('style={{marginTop:8}}');
    expect(transactionCss).toContain('.transactions-approved-filters .transaction-filter-pass-through{display:contents}');
    expect(transactionCss).toContain('.transactions-approved .mobile-row-actions .transaction-mobile-action{min-height:44px}');
  });
  it('keeps the audit remediation on shared dense tokens and existing primitives instead of page-local microtype systems',()=>{
    const shared=read('src/styles/ui-hardening-foundations.css');
    expect(shared).toContain('--ux-dense-data-size:12px');
    expect(shared).toContain('--ux-dense-label-size:11px');
    for(const file of [
      'src/styles/dashboard-desktop-fidelity.css',
      'src/styles/transactions-approved.css',
      'src/styles/savings-desktop-composition.css',
      'src/styles/loans-approved-target.css',
      'src/styles/recurring-approved-target.css',
      'src/pages/ReportsPage.css',
      'src/styles/planning-approved-target.css',
      'src/styles/attention-approved-target.css',
      'src/styles/lending-approved-target.css',
    ]){
      const source=read(file);
      expect(source,`${file} should consume the shared dense type roles`).toMatch(/var\(--ux-dense-(?:data|label)-size\)/);
    }
  });

  it('keeps audited operational typography at or above the 11px dense floor',()=>{
    const audited=[
      'src/styles/dashboard-approved-target.css','src/styles/dashboard-desktop-fidelity.css',
      'src/styles/transactions-approved.css','src/styles/savings-desktop-composition.css',
      'src/styles/cards-v15-presentation.css','src/styles/loans-approved-target.css',
      'src/styles/recurring-approved-target.css','src/pages/ReportsPage.css',
      'src/styles/planning-approved-target.css','src/styles/attention-approved-target.css',
      'src/styles/lending-approved-target.css','src/styles/mobile-finance-domain-layouts.css',
      'src/styles/mobile-reports-settings-editors.css',
    ];
    for(const file of audited){
      const source=read(file);
      for(const match of source.matchAll(/font-size:\s*(\d*\.?\d+)(px|rem)/g)){
        const px=match[2]==='rem'?Number(match[1])*16:Number(match[1]);
        expect(px,`${file} must not restore sub-11px operational text: ${match[0]}`).toBeGreaterThanOrEqual(11);
      }
    }
  });

  it('has no orphaned production component modules',()=>{
    const allSource=walk('src',/\.(?:ts|tsx)$/);
    const referenced=new Set<string>();
    for(const file of allSource){
      const source=read(file);
      for(const match of source.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g)){
        const resolved=resolveRelative(file,match[1],['.tsx','.ts']);
        if(resolved)referenced.add(resolved);
      }
    }
    const components=walk('src/components',/\.tsx$/);
    const orphaned=components.filter(file=>!referenced.has(file));
    expect(orphaned).toEqual([]);
  });

  it('has no orphaned CSS files outside the explicit root/import graph',()=>{
    const allCss=walk('src',/\.css$/);
    const reached=new Set<string>();
    const queue=['src/styles.css'];
    for(const file of walk('src',/\.(?:ts|tsx)$/)){
      const source=read(file);
      for(const match of source.matchAll(/(?:from\s+|import\s+|import\s*\(\s*)['"]([^'"]+\.css)['"]/g)){
        const resolved=resolveRelative(file,match[1],['']);
        if(resolved)queue.push(resolved);
      }
    }
    while(queue.length){
      const file=queue.shift()!;
      if(reached.has(file))continue;
      reached.add(file);
      const source=read(file);
      for(const match of source.matchAll(/@import\s+['"]([^'"]+)['"]\s*;/g)){
        const resolved=resolveRelative(file,match[1],['','.css']);
        if(resolved)queue.push(resolved);
      }
    }
    expect(allCss.filter(file=>!reached.has(file))).toEqual([]);
  });
});
