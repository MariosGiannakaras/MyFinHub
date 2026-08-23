import { Landmark, ReceiptText } from 'lucide-react';
import { activeLongTermLoanObligations } from '../lib/loans';
import { shortDate } from '../lib/format';
import type { FinanceData } from '../types';
import { AnimatedAmount } from './AnimatedAmount';

export function LongTermLoanSummary({data,onPayLoan,onOpenLoans}:{data:FinanceData;onPayLoan:(loanId:string)=>void;onOpenLoans:()=>void}){
  const obligations=activeLongTermLoanObligations(data);
  if(!obligations.length)return null;
  return <section className="panel neo-raised long-term-recurring" aria-labelledby="linked-loan-obligations-title">
    <div className="panel-head"><div><span id="linked-loan-obligations-title">Δανειακές μηνιαίες υποχρεώσεις</span><small>Εμφανίζονται εδώ μαζί με τα τακτικά έξοδα, αλλά παραμένουν δάνεια. Η πληρωμή ενημερώνει το ίδιο δάνειο που βλέπεις στις Δόσεις & Δάνεια.</small></div><Landmark/></div>
    <div className="long-term-recurring-list" role="list" aria-label="Ενεργές δανειακές υποχρεώσεις">
      {obligations.map(({loan,remainingInstallments,nextAmount,typicalDay,lastPayment})=><article className="long-term-loan-obligation" role="listitem" aria-label={`Δανειακή υποχρέωση ${loan.name}`} data-linked-loan={loan.id} key={loan.id}>
        <div className="long-term-loan-copy"><b>{loan.name}</b><small>Δάνειο · {remainingInstallments} {remainingInstallments===1?'δόση απομένει':'δόσεις απομένουν'} · {typicalDay?`συνήθης ημέρα ${typicalDay}`:'χωρίς ακόμη συνήθη ημέρα'}{lastPayment?` · τελευταία ${shortDate(lastPayment.date)}`:''}</small></div>
        <strong><AnimatedAmount value={nextAmount}/></strong>
        <button type="button" className="pay-action linked-loan-pay" aria-label={`Πληρωμή δανειακής υποχρέωσης ${loan.name}`} onClick={()=>onPayLoan(loan.id)}><ReceiptText size={16}/><span>Πληρωμή</span></button>
      </article>)}
    </div>
    <button type="button" className="text-button" onClick={onOpenLoans}>Προβολή όλων στις Δόσεις & Δάνεια</button>
  </section>;
}
