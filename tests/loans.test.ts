import { describe, expect, it } from 'vitest';
import { createEvent } from '../src/lib/domain.js';
import { loanInstallmentPaymentPlan, loanPaidAmount, loanPaidCount, loanPaymentInstallmentCount, preserveLoanPaymentLink, setLoanPaymentInstallmentCount } from '../src/lib/loans.js';
import type { FinanceData, FinanceEvent, Loan } from '../src/types.js';

const loan: Loan = {
  id: 'loan-1',
  name: 'Test loan',
  total: 150,
  installment: 25,
  installments: 6,
  paidCount: 2,
};

const financeState = () => ({
  state: {
    loanExtra: { 'loan-1': 1 },
    events: [],
  },
}) as unknown as FinanceData;

describe('loan payment linkage', () => {
  it('combines baseline, legacy extra and linked payment events, then reverses on deletion', () => {
    const data = financeState();
    const payment = createEvent({ kind: 'expense', date: '2026-08-17', amount: 25, note: 'installment', accountId: 'cash' });
    payment.loanId = loan.id;
    data.state.events = [payment];

    expect(loanPaidCount(data, loan)).toBe(4);

    data.state.events = [];
    expect(loanPaidCount(data, loan)).toBe(3);
  });

  it('preserves the loan association when a linked payment is edited and replaced', () => {
    const data = financeState();
    const original = createEvent({ kind: 'expense', date: '2026-08-17', amount: 25, note: 'installment', accountId: 'cash' });
    original.loanId = loan.id;
    setLoanPaymentInstallmentCount(original,2);
    data.state.events = [original];

    const edited = createEvent({ kind: 'expense', date: '2026-08-17', amount: 50, note: 'edited installment', accountId: 'cash' });
    edited.id = original.id;
    edited.createdAt = original.createdAt;
    preserveLoanPaymentLink(edited, original);
    data.state.events = (data.state.events ?? []).map((event) => event.id === edited.id ? edited : event);

    expect(edited.loanId).toBe(loan.id);
    expect(data.state.events).toHaveLength(1);
    expect(loanPaidCount(data, loan)).toBe(5);
  });

  it('persists explicit installment coverage and keeps legacy events backward compatible',()=>{
    const payment=createEvent({kind:'expense',date:'2026-08-17',amount:50,note:'2 installments',accountId:'cash'});
    setLoanPaymentInstallmentCount(payment,2);
    const restored=JSON.parse(JSON.stringify(payment)) as FinanceEvent;
    expect(restored.installmentCount).toBe(2);
    expect(loanPaymentInstallmentCount(restored)).toBe(2);
    const legacy={...restored};
    delete legacy.installmentCount;
    expect(loanPaymentInstallmentCount(legacy)).toBe(1);
  });

  it('caps derived progress at the configured installment count', () => {
    const data = financeState();
    data.state.loanExtra = { 'loan-1': 20 };
    expect(loanPaidCount(data, loan)).toBe(loan.installments);
  });

  it('counts one real payment as multiple covered installments when explicitly recorded',()=>{
    const data=financeState();
    const payment=createEvent({kind:'expense',date:'2026-08-17',amount:75,note:'3 installments',accountId:'cash'});
    payment.loanId=loan.id;
    setLoanPaymentInstallmentCount(payment,3);
    data.state.events=[payment];

    expect(loanPaidCount(data,loan)).toBe(6);
    expect(loanPaidAmount(data,loan)).toBe(150);
  });

  it('builds a consecutive multi-installment plan from the next unpaid installment',()=>{
    const data=financeState();
    expect(loanInstallmentPaymentPlan(data,loan,2)).toEqual({count:2,firstInstallment:4,lastInstallment:5,amount:50});
  });

  it('uses exact remaining outstanding for the final multi-installment payment instead of overpaying',()=>{
    const data=financeState();
    data.state.loanExtra={'loan-1':2};
    const roundedLoan={...loan,total:145};
    expect(loanInstallmentPaymentPlan(data,roundedLoan,3)).toEqual({count:2,firstInstallment:5,lastInstallment:6,amount:45});
  });
});
