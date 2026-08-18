import { describe, expect, it } from 'vitest';
import { createEvent } from '../src/lib/domain.js';
import { isLongTermLoan, isSelfLoan, loanOutstanding, loanPaymentEvents, loanRemainingInstallments, typicalLoanPaymentDay } from '../src/lib/loans.js';
import type { FinanceData, Loan } from '../src/types.js';

function dataWith(events: FinanceData['state']['events'] = []): FinanceData {
  return { state: { events, loanExtra: {} } } as unknown as FinanceData;
}

describe('installments and self-loans', () => {
  it('derives outstanding, remaining installments and typical day from real payments', () => {
    const loan:Loan={id:'loan-variable',name:'Laptop',total:600,installment:100,installments:6,paidCount:1,kind:'installment'};
    const first=createEvent({kind:'expense',date:'2026-08-10',amount:80,note:'Δόση: Laptop',category:'Δόσεις / δάνεια',accountId:'cash'});first.loanId=loan.id;
    const second=createEvent({kind:'expense',date:'2026-09-14',amount:120,note:'Δόση: Laptop',category:'Δόσεις / δάνεια',accountId:'cash'});second.loanId=loan.id;
    const data=dataWith([first,second]);

    expect(loanOutstanding(data,loan)).toBe(300);
    expect(loanRemainingInstallments(data,loan)).toBe(3);
    expect(typicalLoanPaymentDay(data,loan)).toBe(12);
  });

  it('does not count the HELP creation transfer as a repayment', () => {
    const loan:Loan={id:'self-help',name:'ΒΟΗΘΕΙΑ',total:200,installment:200,installments:1,paidCount:0,kind:'self-loan',source:'self-loan',forgivenAmount:50};
    const help=createEvent({kind:'transfer',date:'2026-08-01',amount:200,note:'ΒΟΗΘΕΙΑ: ΒΟΗΘΕΙΑ',fromAccountId:'savings',toAccountId:'bank'});help.loanId=loan.id;
    const returned=createEvent({kind:'transfer',date:'2026-08-18',amount:60,note:'ΕΠΙΣΤΡΟΦΗ: ΒΟΗΘΕΙΑ',fromAccountId:'bank',toAccountId:'savings'});returned.loanId=loan.id;
    const data=dataWith([help,returned]);

    expect(isSelfLoan(loan)).toBe(true);
    expect(loanPaymentEvents(data,loan)).toEqual([returned]);
    expect(loanOutstanding(data,loan)).toBe(90);
    expect(typicalLoanPaymentDay(data,loan)).toBe(18);
  });

  it('classifies explicit and inferred long-term obligations without treating HELP as recurring', () => {
    expect(isLongTermLoan({id:'long',name:'Long',total:1200,installment:100,installments:12,kind:'loan'})).toBe(true);
    expect(isLongTermLoan({id:'short',name:'Short',total:300,installment:100,installments:3,kind:'loan',longTermRecurring:true})).toBe(true);
    expect(isLongTermLoan({id:'help',name:'ΒΟΗΘΕΙΑ',total:300,installment:300,installments:12,kind:'self-loan',source:'self-loan'})).toBe(false);
  });
});
