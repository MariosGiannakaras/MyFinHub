import type { FinanceData, Loan } from '../types.js';

/** Preserve legacy paid cents at the canonical edit boundary (including seeded overrides). */
export function preserveLoanLegacyBaseline(data:FinanceData,loan:Loan):Loan{
  const previous=data.state.loanOverrides?.[loan.id]??data.state.customLoans?.find(item=>item.id===loan.id)??data.seed.loans.find(item=>item.id===loan.id);
  if(!previous)return loan;
  const count=Math.min(previous.installments,Number(previous.paidCount||0)+Number(data.state.loanExtra?.[loan.id]||0));
  return {...loan,legacyPaidAmount:previous.legacyPaidAmount??Math.round(count*Number(previous.installment||0)*100)/100};
}

