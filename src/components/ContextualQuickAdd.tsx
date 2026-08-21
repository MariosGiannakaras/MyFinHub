import { useMemo, useState } from 'react';
import { CreditCard, HandCoins, Landmark, ReceiptText, X } from 'lucide-react';
import { QuickAdd, type QuickPrefill } from './QuickAdd';
import { AppDateInput } from './AppDateInput';
import { AppSelectInput } from './AppSelectInput';
import { FormError } from './FormError';
import { useModalFocus } from '../hooks/useModalFocus';
import { allAccounts, createEvent } from '../lib/domain';
import { cardLabel, creditCards, creditDebtForCard } from '../lib/cards';
import { lendingOutstandingFor } from '../lib/lending';
import { isSelfLoan, loanOutstanding } from '../lib/loans';
import { allRecurringItems, recurringAccountError } from '../lib/recurring';
import { accountDisplayName } from '../lib/ui';
import { money } from '../lib/format';
import type { EventKind, FinanceData, FinanceEvent } from '../types';

export type QuickActionContext =
  | {token:string;mode:'generic';kind?:EventKind;prefill?:QuickPrefill|null}
  | {token:string;mode:'credit';action:'purchase'|'payment';cardId:string;amount?:number;note?:string;category?:string;fromAccountId?:string}
  | {token:string;mode:'lending';action:'lend'|'repay';person?:string;amount?:number;accountId?:string;expectedReturnDate?:string}
  | {token:string;mode:'recurring';recurringId:string;amount?:number;accountId?:string}
  | {token:string;mode:'loan';loanId:string;amount?:number;accountId?:string};

function ContextModal({data,asOf,context,onClose,onCreate}:{data:FinanceData;asOf:string;context:Exclude<QuickActionContext,{mode:'generic'}>;onClose:()=>void;onCreate:(event:FinanceEvent)=>void}){
  const accounts=useMemo(()=>allAccounts(data).filter(account=>account.kind!=='credit'),[data]);
  const defaultExpense=accounts.some(account=>account.id===data.state.settings.defaultExpenseAccount)?data.state.settings.defaultExpenseAccount:accounts[0]?.id||'';
  const defaultIncome=accounts.some(account=>account.id===data.state.settings.defaultIncomeAccount)?data.state.settings.defaultIncomeAccount:accounts[0]?.id||'';
  const card=context.mode==='credit'?creditCards(data).find(item=>item.id===context.cardId):undefined;
  const recurring=context.mode==='recurring'?allRecurringItems(data).find(item=>item.id===context.recurringId):undefined;
  const loans=useMemo(()=>[...(data.seed.loans??[]).map(item=>data.state.loanOverrides?.[item.id]??item),...(data.state.customLoans??[])],[data]);
  const loan=context.mode==='loan'?loans.find(item=>item.id===context.loanId):undefined;
  const initialAccount=context.mode==='credit'?(context.fromAccountId||defaultExpense):context.mode==='lending'?(context.accountId||(context.action==='repay'?defaultIncome:defaultExpense)):context.mode==='loan'?(context.accountId||loan?.defaultAccountId||data.state.settings.defaultLoanAccount||defaultExpense):(context.accountId||recurring?.accountId||defaultExpense);
  const initialAmount=context.mode==='credit'?(context.amount??(context.action==='payment'&&card?creditDebtForCard(data,card.id,asOf):0)):context.mode==='lending'?(context.amount??(context.action==='repay'&&context.person?lendingOutstandingFor(data,context.person):0)):context.mode==='loan'?(context.amount??(loan?Math.min(Number(loan.installment||0),loanOutstanding(data,loan)):0)):(context.amount??recurring?.amount??0);
  const [amount,setAmount]=useState(initialAmount>0?String(initialAmount):'');
  const [date,setDate]=useState(asOf);
  const [accountId,setAccountId]=useState(initialAccount);
  const [note,setNote]=useState(context.mode==='credit'?(context.note??''):context.mode==='recurring'?(recurring?`Πληρωμή: ${recurring.name}`:''):context.mode==='loan'?(loan?`Δόση: ${loan.name}`:''):'');
  const [person,setPerson]=useState(context.mode==='lending'?(context.person??''):'');
  const [expectedReturnDate,setExpectedReturnDate]=useState(context.mode==='lending'&&context.action==='lend'?(context.expectedReturnDate??''):'');
  const [error,setError]=useState('');
  const modalRef=useModalFocus<HTMLElement>(true,'[data-autofocus="true"]',onClose);
  const submit=()=>{
    try{
      const numeric=Number(amount.replace(',','.'));if(!Number.isFinite(numeric)||numeric<=0)throw new Error('Συμπλήρωσε ποσό μεγαλύτερο από μηδέν.');
      if(!accounts.some(account=>account.id===accountId))throw new Error('Ο επιλεγμένος λογαριασμός δεν είναι πλέον διαθέσιμος. Διάλεξε έναν ενεργό λογαριασμό.');
      let event:FinanceEvent;
      if(context.mode==='credit'){
        if(!card||card.active===false)throw new Error('Η επιλεγμένη πιστωτική δεν είναι πλέον διαθέσιμη.');
        if(context.action==='payment'){
          const debt=creditDebtForCard(data,card.id,asOf);if(debt<=0)throw new Error('Η συγκεκριμένη κάρτα δεν έχει τρέχουσα οφειλή.');if(numeric>debt+.01)throw new Error(`Η πληρωμή δεν μπορεί να ξεπερνά την οφειλή των ${money.format(debt)}.`);
          event=createEvent({kind:'card_payment',date,amount:numeric,note:note.trim()||`Αποπληρωμή ${cardLabel(card)}`,fromAccountId:accountId,cardId:card.id});
        }else event=createEvent({kind:'card_purchase',date,amount:numeric,note:note.trim()||`Αγορά με ${cardLabel(card)}`,category:context.category||data.state.settings.expenseCategories[0]||'Άλλο',cardId:card.id});
      }else if(context.mode==='lending'){
        const clean=person.trim();if(!clean)throw new Error('Γράψε το όνομα του προσώπου.');
        if(context.action==='repay'){
          const outstanding=lendingOutstandingFor(data,clean);if(outstanding<=0)throw new Error('Δεν υπάρχει καταγεγραμμένη οφειλή για αυτό το πρόσωπο.');if(numeric>outstanding+.01)throw new Error(`Η επιστροφή δεν μπορεί να ξεπερνά την οφειλή των ${money.format(outstanding)}.`);
          event=createEvent({kind:'repayment',date,amount:numeric,note:note.trim()||'Επιστροφή δανεικών',accountId,person:clean});
        }else event=createEvent({kind:'lending',date,amount:numeric,note:note.trim()||'Πλήρωσα για άλλον',accountId,person:clean,expectedReturnDate:expectedReturnDate||undefined});
      }else if(context.mode==='loan'){
        if(!loan)throw new Error('Η επιλεγμένη υποχρέωση δεν είναι πλέον διαθέσιμη.');const outstanding=loanOutstanding(data,loan);if(outstanding<=0)throw new Error('Η υποχρέωση έχει ήδη εξοφληθεί.');if(numeric>outstanding+.005)throw new Error(`Η πληρωμή δεν μπορεί να ξεπερνά το υπόλοιπο των ${money.format(outstanding)}.`);
        if(isSelfLoan(loan)){
          const savings=accounts.find(item=>item.kind==='savings')?.id;if(!savings||savings===accountId)throw new Error('Για την επιστροφή ΒΟΗΘΕΙΑΣ χρειάζεται διαφορετικός αποταμιευτικός λογαριασμός.');
          event=createEvent({kind:'transfer',date,amount:numeric,note:`ΕΠΙΣΤΡΟΦΗ: ${loan.name}`,fromAccountId:accountId,toAccountId:savings,loanId:loan.id});
        }else if((loan.accountingMode??'expense-per-installment')==='liability-repayment')event=createEvent({kind:'card_payment',date,amount:numeric,note:note.trim()||`Δόση: ${loan.name}`,fromAccountId:accountId,loanId:loan.id});
        else event=createEvent({kind:'expense',date,amount:numeric,note:note.trim()||`Δόση: ${loan.name}`,category:'Δόσεις / δάνεια',accountId,loanId:loan.id});
      }else{
        if(!recurring)throw new Error('Το πάγιο δεν είναι πλέον διαθέσιμο.');const accountError=recurringAccountError(accounts.map(account=>account.id),accountId);if(accountError)throw new Error(accountError);
        event=createEvent({kind:'expense',date,amount:numeric,note:note.trim()||`Πληρωμή: ${recurring.name}`,category:recurring.category,accountId,recurringId:recurring.id});
      }
      onCreate(event);onClose();
    }catch(reason){setError(reason instanceof Error?reason.message:'Δεν μπορέσαμε να ολοκληρώσουμε την κίνηση. Έλεγξε τα στοιχεία και δοκίμασε ξανά.')}
  };
  const title=context.mode==='credit'?(context.action==='payment'?'Πληρωμή πιστωτικής':'Αγορά με πιστωτική'):context.mode==='lending'?(context.action==='repay'?'Επιστροφή δανεικών':'Νέα οφειλή προς εσένα'):context.mode==='loan'?'Πληρωμή δόσης / δανείου':'Πληρωμή παγίου';
  const Icon=context.mode==='credit'?CreditCard:context.mode==='lending'?HandCoins:context.mode==='loan'?Landmark:ReceiptText;
  return <div className="modal-backdrop" onMouseDown={onClose}><section ref={modalRef} className="quick-modal contextual-quick-modal neo-raised" role="dialog" aria-modal="true" aria-labelledby="context-quick-title" aria-describedby={error?'context-quick-error':'context-quick-description'} tabIndex={-1} onMouseDown={event=>event.stopPropagation()}><header><div><small>ΓΡΗΓΟΡΗ ΚΙΝΗΣΗ ΜΕ ΠΛΑΙΣΙΟ</small><h2 id="context-quick-title"><Icon size={20}/> {title}</h2><p id="context-quick-description">Οι προεπιλογές εφαρμόζονται μία φορά όταν ανοίγει αυτή η ενέργεια. Οι αλλαγές που κάνεις εδώ δεν αντικαθίστανται αυτόματα.</p></div><button type="button" className="icon-button" aria-label="Κλείσιμο contextual καταχώρισης" onClick={onClose}><X/></button></header><div className="entry-body"><div className="form-grid"><label><span>Ποσό</span><div className="money-input"><b>€</b><input data-autofocus="true" inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value.replace(',','.'))}/></div></label><label><span>Ημερομηνία</span><AppDateInput value={date} onChange={event=>setDate(event.target.value)}/></label>{context.mode==='lending'?<label><span>Πρόσωπο</span><input value={person} onChange={event=>setPerson(event.target.value)}/></label>:null}{context.mode==='credit'&&context.action==='purchase'?null:<label><span>{context.mode==='credit'?'Πληρωμή από':context.mode==='lending'&&context.action==='repay'?'Επιστροφή σε':context.mode==='loan'?'Πληρωμή από':'Λογαριασμός'}</span><AppSelectInput value={accountId} onChange={event=>setAccountId(event.target.value)}>{accounts.map(account=><option value={account.id} key={account.id}>{accountDisplayName(data,account.id)}</option>)}</AppSelectInput></label>}{context.mode==='lending'&&context.action==='lend'?<label><span>Αναμενόμενη επιστροφή <em>προαιρετικό</em></span><AppDateInput value={expectedReturnDate} min={date} onChange={event=>setExpectedReturnDate(event.target.value)}/></label>:null}<label className="wide"><span>Σχόλιο <em>προαιρετικό</em></span><input value={note} onChange={event=>setNote(event.target.value)}/></label></div>{error?<FormError id="context-quick-error">{error}</FormError>:null}<div className="editor-actions"><button type="button" className="secondary" onClick={onClose}>Ακύρωση</button><button type="button" className="save-button" onClick={submit}>Καταχώριση</button></div></div></section></div>;
}

export function ContextualQuickAdd({open,data,asOf,context,initial,motionMode='system',onClose,onCreate,currentBalance}:{open:boolean;data:FinanceData;asOf:string;context:QuickActionContext|null;initial?:FinanceEvent|null;motionMode?:'system'|'reduced'|'full';onClose:()=>void;onCreate:(event:FinanceEvent)=>void;currentBalance:(accountId:string)=>number}){
  if(!open||!context)return null;
  if(context.mode==='generic')return <QuickAdd open={open} data={data} asOf={asOf} initial={initial} initialKind={context.kind||'expense'} prefill={context.prefill||null} motionMode={motionMode} onClose={onClose} onCreate={onCreate} currentBalance={currentBalance}/>;
  return <ContextModal key={context.token} data={data} asOf={asOf} context={context} onClose={onClose} onCreate={onCreate}/>;
}
