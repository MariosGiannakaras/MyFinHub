import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {expenseMoneyLabel,monthComparisonLabel,monthComparisonPercent,signedNetMoneyLabel} from '../src/lib/ui.js';

describe('#649 I04.04 Dashboard and Transactions zero-basis month comparison',()=>{
  it.each([
    [100,100,0],[125,100,25],[75,100,-25],
    [-125,-100,-25],[-75,-100,25],[10,0,null],
    [0,0,null],[10,.004,null],[Infinity,10,null],[10,NaN,null],
  ] as const)('respects the historical baseline for %s / %s', (current,previous,expected)=>{
    expect(monthComparisonPercent(current,previous)).toBe(expected);
  });
  it.each([
    [0,'0,00 €','0,00 €'],
    [-0.0,'0,00 €','0,00 €'],
    [.004,'0,00 €','0,00 €'],
    [1.01,'−1,01 €','+1,01 €'],
    [-1.01,'+1,01 €','−1,01 €'],
  ] as const)('keeps EUR cent-zero neutral (%s)',(amount,expense,net)=>{
    const clean=(value:string)=>value.replace(/\s/g,' ');
    expect(clean(expenseMoneyLabel(amount))).toBe(expense);
    expect(clean(signedNetMoneyLabel(amount))).toBe(net);
  });
  it('pins both real-browser zero-state guards',()=>{
    const transactions=readFileSync(new URL('../scripts/transactions-scanability-qa.mjs',import.meta.url),'utf8');
    const dashboard=readFileSync(new URL('../scripts/shell-dashboard-hierarchy-qa.mjs',import.meta.url),'utf8');
    expect(transactions).toContain("empty.expense.startsWith('0,00')");
    expect(transactions).toContain("empty.net.startsWith('0,00')");
    expect(transactions).toContain('empty.expenseNeutral&&empty.netNeutral');
    expect(dashboard).toContain('Dashboard empty EUR expense cannot render negative zero');
  });
  it('shows a truthful, compact Greek no-baseline explanation instead of a fabricated percent',()=>{
    expect(monthComparisonLabel(null,'προηγ. μήνα')).toBe('— χωρίς βάση σύγκρισης');
    expect(monthComparisonLabel(0,'προηγ. μήνα')).toBe('→ 0% από προηγ. μήνα');
    expect(monthComparisonLabel(-25,'Οκτώβριο')).toBe('↓ 25% από Οκτώβριο');
  });
  it('reuses one comparison owner in both finance surfaces and preserves EOD account labels',()=>{
    const dashboard=readFileSync(new URL('../src/pages/DashboardPage.tsx',import.meta.url),'utf8');
    const transactions=readFileSync(new URL('../src/pages/TransactionsPage.tsx',import.meta.url),'utf8');
    for(const consumer of [dashboard,transactions]){
      expect(consumer).toContain('monthComparisonPercent(flow.income,previousFlow.income)');
      expect(consumer).toContain('monthComparisonLabel(');
      expect(consumer).not.toContain('function percentChange(');
    }
    expect(dashboard).toContain('Τελικό υπόλοιπο');
    expect(transactions).toContain('Υπόλ. ημέρας');
    expect(transactions).toContain('Υπόλοιπο τέλους ημέρας');
    expect(transactions).toContain('selectAccountBalances(data,row.date)');
    const focused=readFileSync(new URL('../.github/workflows/fb-focused-rendered-qa.yml',import.meta.url),'utf8');
    expect(focused).toContain('<!-- run-649-month-comparison-qa -->');
    expect(focused).toContain('shell-dashboard-hierarchy transactions-scanability');
  });
});
