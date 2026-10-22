import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const dashboard=read('../src/pages/DashboardPage.tsx');
const desktop=read('../src/pages/DashboardCompletion.css');
const app=read('../src/App.tsx');
const qa=read('../src/qa.tsx');
const ledger=read('../src/pages/TransactionsPage.tsx');
const card=dashboard.slice(dashboard.indexOf('const series=primaryHistory'),dashboard.indexOf('})}',dashboard.indexOf('const series=primaryHistory')));

describe('Desktop primary account card reconciliation (#597)',()=>{
  it('keeps a common 30-day delta on all cards plus the distinct savings target',()=>{
    expect(card).toContain('approved-account-delta-period');
    expect(card).toContain('30ημ.');
    expect(card).toContain('approved-account-context');
    expect(card).toContain('savings-target');
    expect(card).toContain('savings-legend');
    expect(card).toContain('accountSavingsGoal?.targetAmount');
    expect(dashboard).toContain("privacyMoney(currentBalance)");
    expect(dashboard).toContain("const privacyMoney=(value:number)=>privacyVisible?money.format(value):'•••••• €'");
  });

  it('preserves the visible chart while masking only monetary accessibility text',()=>{
    expect(card).toContain('AccountBalanceChart series={series}');
    expect(card).toContain("privacyVisible?\`Τελικό υπόλοιπο");
    expect(card).toContain("historyFlat?'Σταθερό υπόλοιπο. ':'");
    expect(card).toContain('title={accountLabel}');
    expect(card).toContain('AccountIban accountId={account.id}');
  });

  it('uses existing transaction account filter and permits clearing it',()=>{
    expect(card).toContain('onTransactions(account.id)');
    expect(card).toContain('Συναλλαγές για');
    for(const shell of [app,qa]){
      expect(shell).toContain("setDashboardAccountId(accountId??null)");
      expect(shell).toContain("dashboardAccountFocusKey={dashboardAccountFocusKey}");
      expect(shell).toContain("if(page!=='transactions')setDashboardAccountId(null)");
    }
    expect(ledger).toContain("setAccount(dashboardAccountId)");
    expect(ledger).toContain("dashboardAccountFocusKey");
    expect(ledger).toContain("<option value=\"all\">Όλοι οι λογαριασμοί</option>");
    expect(ledger).toContain("(account==='all'||r.accountIds.includes(account))");
  });

  it('allocates the full card width to two equally sized actions and prevents absolute IBAN overlap',()=>{
    expect(desktop).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
    expect(desktop).toContain('grid-template-columns:minmax(0,1fr) minmax(0,1.08fr)!important');
    expect(desktop).toContain('.approved-account-card .account-iban-dashboard .account-iban-copy');
    expect(desktop).toContain('position:static!important');
    expect(desktop).toContain('.approved-account-card .dashboard-account-history');
  });
});
