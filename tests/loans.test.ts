import { describe, expect, it } from 'vitest';
import { createEvent } from '../src/lib/domain.js';
import { loanPaidCount, preserveLoanPaymentLink } from '../src/lib/loans.js';
import type { FinanceData, Loan } from '../src/types.js';

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
    data.state.events = [original];

    const edited = createEvent({ kind: 'expense', date: '2026-08-17', amount: 30, note: 'edited installment', accountId: 'cash' });
    edited.id = original.id;
    edited.createdAt = original.createdAt;
    preserveLoanPaymentLink(edited, original);
    data.state.events = (data.state.events ?? []).map((event) => event.id === edited.id ? edited : event);

    expect(edited.loanId).toBe(loan.id);
    expect(data.state.events).toHaveLength(1);
    expect(loanPaidCount(data, loan)).toBe(4);
  });

  it('caps derived progress at the configured installment count', () => {
    const data = financeState();
    data.state.loanExtra = { 'loan-1': 20 };
    expect(loanPaidCount(data, loan)).toBe(loan.installments);
  });
});
