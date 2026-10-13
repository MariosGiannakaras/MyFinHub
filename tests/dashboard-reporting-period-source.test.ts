import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard=readFileSync(new URL('../src/pages/DashboardPage.tsx',import.meta.url),'utf8');
const theme=readFileSync(new URL('../src/lib/theme.ts',import.meta.url),'utf8');
const renderedQa=readFileSync(new URL('../scripts/shell-dashboard-hierarchy-qa.mjs',import.meta.url),'utf8');

describe('Dashboard selected reporting-period contract',()=>{
  it('scopes account balances, history, deltas and comparisons to the selected period end',()=>{
    expect(dashboard).toContain('const range=monthRange(month);const periodEndDate=reportingPeriodEndDate(month,asOf);');
    expect(dashboard).toContain('const balances=selectAccountBalances(data,periodEndDate)');
    expect(dashboard).toContain('selectMonthlyFlow(data,month,asOf)');
    expect(dashboard).toContain('selectCategoryTotals(data,month,asOf)');
    expect(dashboard).toContain('budgetProgress(data,month,asOf)');
    expect(dashboard).toContain('tx.date<=periodEndDate');
    expect(dashboard).toContain('event.date<=periodEndDate');
    expect(dashboard).toContain('dashboardAccountHistory(data,primary.map(account=>account.id),accountHistoryStart,periodEndDate)');
    expect(dashboard).toContain('dashboardBalanceChange(data,account.id,periodEndDate)');
    expect(dashboard).toContain('dashboardPreviousMonthValues(data,savingsAccount.id,balanceMonth,periodEndDate)');
    expect(dashboard).toContain('const balanceMonth=month;');
    expect(dashboard).toContain('date:periodEndDate,value:balances[account.id]??0');
    expect(dashboard).not.toContain('const balances=selectAccountBalances(data,asOf)');
    expect(dashboard).not.toContain('const balanceMonth=asOf.slice(0,7)');
  });

  it('keeps only the meaningful period control surfaced while the full reporting row stays transparent',()=>{
    expect(theme).toContain('.period-row{background:transparent!important;border-color:transparent!important;box-shadow:none!important');
    expect(theme).toContain('.period-control{background:var(--surface-inset)!important;border-color:var(--border-subtle)!important;box-shadow:var(--shadow-inset)!important');
    expect(theme).not.toContain('.period-row,.period-control{background:var(--surface-inset)!important');
  });

  it('proves historical month navigation changes primary-account balance and graph and restores current as-of state',()=>{
    expect(renderedQa).toContain("selected historical month changes the payroll period-end balance");
    expect(renderedQa).toContain("selected historical month changes the payroll account-history graph");
    expect(renderedQa).toContain("returning to the current reporting month restores the as-of balance and account-history graph");
    expect(renderedQa).toContain("shell-dashboard-hierarchy-historical-july");
    expect(renderedQa).toContain('button[aria-label="Προηγούμενος μήνας"]');
    expect(renderedQa).toContain('button[aria-label^="Επόμενος μήνας"]');
  });
});
