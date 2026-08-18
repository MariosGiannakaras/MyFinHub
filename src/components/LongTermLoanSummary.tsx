import { Landmark } from 'lucide-react';
import { money } from '../lib/format';
import { isLongTermLoan, loanOutstanding, loanRemainingInstallments, typicalLoanPaymentDay } from '../lib/loans';
import type { FinanceData } from '../types';

export function LongTermLoanSummary({data,onOpenLoans}:{data:FinanceData;onOpenLoans:()=>void}){
  const loans=[...(data.seed.loans??[]).map(loan=>data.state.loanOverrides?.[loan.id]??loan),...(data.state.customLoans??[])].filter(loan=>isLongTermLoan(loan)&&loanOutstanding(data,loan)>.005);
  if(!loans.length)return null;
  return <section className="panel neo-raised long-term-recurring"><div className="panel-head"><div><span>Μακροχρόνιες μηνιαίες υποχρεώσεις</span><small>Δάνεια πολλών μηνών που λειτουργούν σαν μηνιαίο πάγιο, χωρίς να δημιουργείται αυτόματο έξοδο.</small></div><Landmark/></div><div className="long-term-recurring-list">{loans.map(loan=><div key={loan.id}><div><b>{loan.name}</b><small>{loanRemainingInstallments(data,loan)} δόσεις απομένουν · συνήθης ημέρα {typicalLoanPaymentDay(data,loan)??'—'}</small></div><strong>{money.format(loan.installment)}</strong></div>)}</div><button type="button" className="text-button" onClick={onOpenLoans}>Άνοιγμα Δόσεων & Δανείων για πληρωμή</button></section>;
}
