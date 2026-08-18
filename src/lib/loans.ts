import type { FinanceData, FinanceEvent, Loan } from '../types.js';

export function isSelfLoan(loan:Loan){return loan.kind==='self-loan'||loan.source==='self-loan'||/\bHELP\b|ΒΟΗΘΕΙΑ/i.test(`${loan.name} ${loan.provider||''}`)}

export function loanPaymentEvents(data:FinanceData,loan:Loan){
  const linked=(data.state.events??[]).filter(event=>event.loanId===loan.id);
  const payments=isSelfLoan(loan)?linked.filter(event=>event.kind==='transfer'&&/^(?:ΕΠΙΣΤΡΟΦΗ|RETURN)(?:\s|:|$)/i.test(event.note.trim())):linked;
  return payments.sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
}

export function loanPaidCount(data: FinanceData, loan: Loan) {
  const baseline = Number(loan.paidCount || 0);
  const legacyExtra = Number(data.state.loanExtra?.[loan.id] || 0);
  const linkedEvents = loanPaymentEvents(data,loan).length;
  return Math.min(loan.installments, baseline + legacyExtra + linkedEvents);
}

export function loanPaidAmount(data:FinanceData,loan:Loan){
  const baseline=Math.min(loan.installments,Number(loan.paidCount||0)+Number(data.state.loanExtra?.[loan.id]||0))*Number(loan.installment||0);
  return baseline+loanPaymentEvents(data,loan).reduce((sum,event)=>sum+Math.max(0,Number(event.amount||0)),0);
}

export function loanOutstanding(data:FinanceData,loan:Loan){
  return Math.max(0,Number(loan.total||0)-loanPaidAmount(data,loan)-Number(loan.forgivenAmount||0));
}

export function loanRemainingInstallments(data:FinanceData,loan:Loan){
  return Math.max(0,loan.installments-loanPaidCount(data,loan));
}

export function typicalLoanPaymentDay(data:FinanceData,loan:Loan):number|null{
  const events=loanPaymentEvents(data,loan);
  if(events.length){return Math.max(1,Math.min(31,Math.round(events.reduce((sum,event)=>sum+Number(event.date.slice(8,10)),0)/events.length)))}
  if(loan.firstExpectedDate)return Number(loan.firstExpectedDate.slice(8,10))||null;
  const parsed=Number.parseInt(loan.day||'',10);return Number.isInteger(parsed)&&parsed>=1&&parsed<=31?parsed:null;
}

export function isLongTermLoan(loan:Loan){return loan.longTermRecurring??(loan.installments>=12&&!isSelfLoan(loan))}

export function preserveLoanPaymentLink(next: FinanceEvent, previous?: FinanceEvent | null) {
  if (previous?.loanId) next.loanId = previous.loanId;
  return next;
}
