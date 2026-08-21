import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const qa=readFileSync(new URL('../src/qa.tsx',import.meta.url),'utf8');
const contextual=readFileSync(new URL('../src/components/ContextualQuickAdd.tsx',import.meta.url),'utf8');
const credit=readFileSync(new URL('../src/pages/CreditCardPage.tsx',import.meta.url),'utf8');
const loans=readFileSync(new URL('../src/pages/LoansPage.tsx',import.meta.url),'utf8');
const recurring=readFileSync(new URL('../src/pages/RecurringPage.tsx',import.meta.url),'utf8');
const compact=(source:string)=>source.replace(/\s+/g,'');

describe('payment flow normalization source contracts',()=>{
  it('routes page payment entry points through exact shared contexts in production and QA',()=>{
    for(const source of [compact(app),compact(qa)]){
      expect(source).toMatch(/onPayCard=\{\(?cardId\)?=>openSpecial\(\{mode:'credit',action:'payment',cardId\}\)\}/);
      expect(source).toMatch(/onPayLoan=\{\(?loanId\)?=>openSpecial\(\{mode:'loan',loanId\}\)\}/);
      expect(source).toMatch(/onPayRecurring=\{\(?recurringId\)?=>openSpecial\(\{mode:'recurring',recurringId\}\)\}/);
    }
  });

  it('does not keep duplicate page-local payment engines',()=>{
    expect(credit).toContain('onPayCard:(cardId:string)=>void');
    expect(credit).not.toContain('repayOpen');
    expect(credit).not.toContain('submitRepay');
    expect(credit).not.toContain('credit-repay-title');

    expect(loans).toContain('onPayLoan:(loanId:string)=>void');
    expect(loans).not.toContain('payAmount');
    expect(loans).not.toContain('submitPay');
    expect(loans).not.toContain('loan-pay-dialog');

    expect(recurring).toContain('onPayRecurring:(recurringId:string)=>void');
    expect(recurring).not.toContain('payAmount');
    expect(recurring).not.toContain('submitPay');
    expect(recurring).not.toContain('recurring-pay-dialog');
  });

  it('presents one shared source-target-effect confirmation model',()=>{
    expect(contextual).toContain('aria-label="Στόχος ενέργειας"');
    expect(contextual).toContain("context.mode==='loan'||context.mode==='recurring'?'Πληρωμή από'");
    expect(contextual).toContain('className="payment-effect-summary"');
    expect(contextual).toContain('aria-label="Οικονομικό αποτέλεσμα πληρωμής"');
    expect(contextual).toContain("paymentMode?'Επιβεβαίωση πληρωμής':'Καταχώριση'");
    expect(contextual).toContain('χωρίς δεύτερη χειροκίνητη εγγραφή');
  });
});