import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const files=['src/pages/SavingsPage.tsx','src/pages/CreditCardPage.tsx','src/pages/LoansPage.tsx','src/pages/RecurringPage.tsx','src/pages/ReportsPage.tsx'];

describe('live summary amount transitions',()=>{
  it.each(files)('%s renders AnimatedAmount for live summaries',(path)=>{
    const source=read(path);
    expect(source).toContain("AnimatedAmount");
    expect(source).toContain("../components/AnimatedAmount");
  });

  it('keeps historical transaction/payment rows static',()=>{
    expect(read('src/pages/CreditCardPage.tsx')).toContain('money.format(event.amount)');
    expect(read('src/pages/RecurringPage.tsx')).toContain('money.format(lastPayment.amount)');
    expect(read('src/pages/ReportsPage.tsx')).toContain('money.format(row.income)');
  });

  it('animates long-term recurring loan installments',()=>{
    const source=read('src/components/LongTermLoanSummary.tsx');
    expect(source).toContain('AnimatedAmount');
    expect(source).toContain('value={loan.installment}');
  });
});
