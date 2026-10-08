import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard=readFileSync(new URL('../src/pages/DashboardPage.tsx',import.meta.url),'utf8');

describe('Dashboard selected reporting-period contract',()=>{
  it('scopes account balances, history, deltas and comparisons to the selected period end',()=>{
    expect(dashboard).toContain('const range=monthRange(month);const periodEndDate=reportingPeriodEndDate(month,asOf);');
    expect(dashboard).toContain('const balances=selectAccountBalances(data,periodEndDate)');
    expect(dashboard).toContain('dashboardAccountHistory(data,primary.map(account=>account.id),accountHistoryStart,periodEndDate)');
    expect(dashboard).toContain('dashboardBalanceChange(data,account.id,periodEndDate)');
    expect(dashboard).toContain('dashboardPreviousMonthValues(data,savingsAccount.id,balanceMonth,periodEndDate)');
    expect(dashboard).toContain('const balanceMonth=month;');
    expect(dashboard).toContain('date:periodEndDate,value:balances[account.id]??0');
    expect(dashboard).not.toContain('const balances=selectAccountBalances(data,asOf)');
    expect(dashboard).not.toContain('const balanceMonth=asOf.slice(0,7)');
  });
});
