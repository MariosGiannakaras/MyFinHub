import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const loans=readFileSync(new URL('../src/pages/LoansPage.tsx',import.meta.url),'utf8');
const recurring=readFileSync(new URL('../src/pages/RecurringPage.tsx',import.meta.url),'utf8');
const linked=readFileSync(new URL('../src/components/LongTermLoanSummary.tsx',import.meta.url),'utf8');
const rendered=readFileSync(new URL('../scripts/obligation-lifecycle-qa.mjs',import.meta.url),'utf8');
const coordinator=readFileSync(new URL('../scripts/run-rendered-qa.mjs',import.meta.url),'utf8');

describe('obligation lifecycle hierarchy source contracts',()=>{
  it('separates active and completed loans using existing accounting-derived completion signals',()=>{
    expect(loans).toContain("const isComplete=(loan:Loan)=>loanOutstanding(data,loan)<=.005||(!isSelfLoan(loan)&&loanRemainingInstallments(data,loan)<=0)");
    expect(loans).toContain('const activeLoans=sorted.filter(loan=>!isComplete(loan))');
    expect(loans).toContain('const completedLoans=sorted.filter(isComplete)');
    expect(loans).toContain('data-loan-lifecycle={historical?\'completed\':\'active\'}');
  });
  it('removes payment actions from completed loan history while retaining editability and semantic progress',()=>{
    expect(loans).toContain("!historical?<button type=\"button\" className=\"pay\"");
    expect(loans).toContain('<button type="button" onClick={()=>startEdit(loan)}><Pencil');
    expect(loans).toContain('role="progressbar"');
    expect(loans).toContain('aria-valuenow={paid}');
    expect(loans).toContain('data-loan-history');
  });
  it('keeps active recurring obligations first and collapses inactive history by default',()=>{
    const activeIndex=recurring.indexOf('data-active-recurring');
    const linkedIndex=recurring.indexOf('<LongTermLoanSummary');
    const inactiveIndex=recurring.indexOf('data-inactive-recurring-history');
    expect(activeIndex).toBeGreaterThan(-1);
    expect(linkedIndex).toBeGreaterThan(activeIndex);
    expect(inactiveIndex).toBeGreaterThan(linkedIndex);
    expect(recurring).toContain('<details className="panel neo-flat inactive-recurring"');
    expect(recurring).toContain('Ενεργοποίηση ${item.name}');
    expect(recurring).toContain('Επεξεργασία ${item.name}');
  });
  it('keeps linked long-term loans on the canonical loan payment path without duplicating records',()=>{
    expect(linked).toContain('activeLongTermLoanObligations(data)');
    expect(linked).toContain('onPayLoan(loan.id)');
    expect(linked).toContain('data-linked-loan={loan.id}');
    expect(linked).toContain('neo-flat long-term-recurring');
  });
  it('runs dedicated rendered desktop/mobile completed, inactive and extreme lifecycle coverage',()=>{
    expect(coordinator).toContain("path:'scripts/obligation-lifecycle-qa.mjs'");
    expect(rendered).toContain('active loans dominate baseline');
    expect(rendered).toContain('completing a loan moves it into history without payment CTA');
    expect(rendered).toContain('paused recurring items move into collapsed restorable history');
    expect(rendered).toContain('extreme recurring list remains usable');
    expect(rendered).toContain('loans-completed-history-mobile');
    expect(rendered).toContain('recurring-inactive-history-mobile');
  });
});
