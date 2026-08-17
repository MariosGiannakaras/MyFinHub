import type { FinanceData, FinanceEvent, Loan } from '../types.js';

export function loanPaidCount(data: FinanceData, loan: Loan) {
  const baseline = Number(loan.paidCount || 0);
  const legacyExtra = Number(data.state.loanExtra?.[loan.id] || 0);
  const linkedEvents = (data.state.events ?? []).filter((event) => event.loanId === loan.id).length;
  return Math.min(loan.installments, baseline + legacyExtra + linkedEvents);
}

export function preserveLoanPaymentLink(next: FinanceEvent, previous?: FinanceEvent | null) {
  if (previous?.loanId) next.loanId = previous.loanId;
  return next;
}
