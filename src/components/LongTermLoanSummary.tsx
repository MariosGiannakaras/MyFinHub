import { Landmark, ReceiptText } from 'lucide-react';
import { activeLongTermLoanObligations } from '../lib/loans';
import { shortDate } from '../lib/format';
import { accountDisplayName } from '../lib/ui';
import type { FinanceData } from '../types';
import { AnimatedAmount } from './AnimatedAmount';

export function LongTermLoanSummary({data,onPayLoan,onOpenLoans}:{data:FinanceData;onPayLoan:(loanId:string)=>void;onOpenLoans:()=>void}){
  const obligations=activeLongTermLoanObligations(data);
  if(!obligations.length)return null;
  return <section className="panel neo-flat long-term-recurring" aria-labelledby="linked-loan-obligations-title">
    <div className="recurring-group-heading recurring-loan-group-heading"><Landmark size={16}/><div><span id="linked-loan-obligations-title">Δόσεις / Δάνεια</span><small>Συνδεδεμένες δανειακές υποχρεώσεις με την κανονική ροή πληρωμής δανείου.</small></div></div>
    <div className="long-term-recurring-list" role="list" aria-label="Ενεργές δανειακές υποχρεώσεις">
      {obligations.map(({loan,remainingInstallments,nextAmount,typicalDay,lastPayment})=><article className="long-term-loan-obligation" role="listitem" aria-label={`Δανειακή υποχρέωση ${loan.name}`} data-linked-loan={loan.id} key={loan.id}>
        <div className="long-term-loan-copy"><span className="long-term-loan-icon"><Landmark size={18}/></span><div><b>{loan.name}</b><small>{loan.provider||'Δάνειο'} · {remainingInstallments} {remainingInstallments===1?'δόση απομένει':'δόσεις απομένουν'}</small></div></div>
        <div className="long-term-loan-next"><b>{typicalDay?`Ημέρα ${typicalDay}`:'—'}</b><small>{lastPayment?`Τελευταία ${shortDate(lastPayment.date)}`:'Χωρίς ακόμη καταγεγραμμένη πληρωμή'}</small></div>
        <div className="long-term-loan-account"><b>{loan.defaultAccountId?accountDisplayName(data,loan.defaultAccountId):'—'}</b><small>{loan.defaultAccountId?'Προεπιλεγμένος':'Χωρίς προεπιλογή'}</small></div>
        <strong><AnimatedAmount value={nextAmount}/></strong>
        <div className="long-term-loan-actions"><button type="button" className="pay-action save-button linked-loan-pay" aria-label={`Πληρωμή δανειακής υποχρέωσης ${loan.name}`} onClick={()=>onPayLoan(loan.id)}><ReceiptText size={16}/><span>Πληρωμή</span></button><button type="button" className="text-button linked-loan-open" onClick={onOpenLoans}>Προβολή</button></div>
      </article>)}
    </div>
    <button type="button" className="text-button long-term-loans-open" data-open-loans="true" onClick={onOpenLoans}>Άνοιγμα Δόσεων & Δανείων για πλήρη προβολή</button>
  </section>;
}
