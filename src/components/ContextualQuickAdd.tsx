import { useMemo, useState } from 'react';
import { CalendarClock, CreditCard, HandCoins, Landmark, PiggyBank, ReceiptText, X } from 'lucide-react';
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
import { pendingScheduled, scheduledToEvent, transitionScheduled } from '../lib/scheduled';
import { accountDisplayName } from '../lib/ui';
import { money } from '../lib/format';
import type { EventKind, FinanceData, FinanceEvent, SavingSource, ScheduledTransaction } from '../types';

export type QuickActionContext =
  | {token:string;mode:'generic';kind?:EventKind;prefill?:QuickPrefill|null}
  | {token:string;mode:'credit';action:'purchase'|'payment';cardId:string;amount?:number;note?:string;category?:string;fromAccountId?:string}
  | {token:string;mode:'lending';action:'lend'|'repay';person?:string;amount?:number;accountId?:string;expectedReturnDate?:string}
  | {token:string;mode:'loan';loanId:string;amount?:number;accountId?:string}
  | {token:string;mode:'recurring';recurringId:string;amount?:number;accountId?:string}
  | {token:string;mode:'scheduled';scheduledId:string}
  | {token:string;mode:'savings';amount?:number;fromAccountId?:string;toAccountId?:string;note?:string;savingSource?:SavingSource};

type SpecialContext=Exclude<QuickActionContext,{mode:'generic'}>;

function ContextModal({data,asOf,context,onClose,onCreate,onCompleteScheduled}:{data:FinanceData;asOf:string;context:SpecialContext;onClose:()=>void;onCreate:(event:FinanceEvent)=>void;onCompleteScheduled?:(item:ScheduledTransaction,event:FinanceEvent)=>void}){
  const accounts=useMemo(()=>allAccounts(data).filter(account=>account.kind!=='credit'),[data]);
  const defaultExpense=accounts.some(account=>account.id===data.state.settings.defaultExpenseAccount)?data.state.settings.defaultExpenseAccount:accounts[0]?.id||'';
  const defaultIncome=accounts.some(account=>account.id===data.state.settings.defaultIncomeAccount)?data.state.settings.defaultIncomeAccount:accounts[0]?.id||'';
  const card=context.mode==='credit'?creditCards(data).find(item=>item.id===context.cardId):undefined;
  const recurring=context.mode==='recurring'?allRecurringItems(data).find(item=>item.id===context.recurringId):undefined;
  const loans=useMemo(()=>[...(data.seed.loans??[]).map(item=>data.state.loanOverrides?.[item.id]??item),...(data.state.customLoans??[])],[data]);
  const loan=context.mode==='loan'?loans.find(item=>item.id===context.loanId):undefined;
  const scheduled=context.mode==='scheduled'?pendingScheduled(data).find(item=>item.id===context.scheduledId):undefined;
  const sameBankAccounts=context.mode==='credit'&&card?accounts.filter(account=>account.id.startsWith(`${card.bankId}-`)):accounts;
  const savingsTargets=accounts.filter(account=>account.kind==='savings');
  const savingsSources=accounts.filter(account=>account.kind!=='savings');
  const initialAccount=context.mode==='credit'
    ?(sameBankAccounts.some(account=>account.id===context.fromAccountId)?context.fromAccountId!:sameBankAccounts[0]?.id||'')
    :context.mode==='lending'
      ?(context.accountId||(context.action==='repay'?defaultIncome:defaultExpense))
      :context.mode==='recurring'
        ?(context.accountId||recurring?.accountId||defaultExpense)
        :context.mode==='loan'
          ?(context.accountId||loan?.defaultAccountId||data.state.settings.defaultLoanAccount||defaultExpense)
          :context.mode==='scheduled'
            ?(scheduled?.accountId||(scheduled?.kind==='income'?defaultIncome:defaultExpense))
            :defaultExpense;
  const loanOutstandingAmount=loan?loanOutstanding(data,loan):0;
  const initialAmount=context.mode==='credit'
    ?(context.amount??(context.action==='payment'&&card?creditDebtForCard(data,card.id,asOf):0))
    :context.mode==='lending'
      ?(context.amount??(context.action==='repay'&&context.person?lendingOutstandingFor(data,context.person):0))
      :context.mode==='recurring'
        ?(context.amount??recurring?.amount??0)
        :context.mode==='loan'
          ?(context.amount??Math.min(Number(loan?.installment||loanOutstandingAmount),loanOutstandingAmount))
          :context.mode==='scheduled'
            ?(scheduled?.amount??0)
            :(context.amount??0);
  const initialFrom=context.mode==='savings'
    ?(savingsSources.some(account=>account.id===context.fromAccountId)?context.fromAccountId!:savingsSources.some(account=>account.id===data.state.settings.defaultExpenseAccount)?data.state.settings.defaultExpenseAccount:savingsSources[0]?.id||'')
    :context.mode==='scheduled'
      ?(scheduled?.fromAccountId||accounts[0]?.id||'')
      :'';
  const initialTo=context.mode==='savings'
    ?(savingsTargets.some(account=>account.id===context.toAccountId)?context.toAccountId!:savingsTargets[0]?.id||'')
    :context.mode==='scheduled'
      ?(scheduled?.toAccountId||accounts.find(account=>account.id!==initialFrom)?.id||'')
      :'';
  const [amount,setAmount]=useState(initialAmount>0?String(initialAmount):'');
  const [date,setDate]=useState(asOf);
  const [accountId,setAccountId]=useState(initialAccount);
  const [fromAccountId,setFromAccountId]=useState(initialFrom);
  const [toAccountId,setToAccountId]=useState(initialTo);
  const [note,setNote]=useState(context.mode==='credit'?(context.note??''):context.mode==='recurring'?(recurring?`Πληρωμή: ${recurring.name}`:''):context.mode==='loan'?(loan?`${isSelfLoan(loan)?'ΕΠΙΣΤΡΟΦΗ':'Δόση'}: ${loan.name}`:''):context.mode==='scheduled'?(scheduled?.note??''):context.mode==='savings'?(context.note??'Μεταφορά στην άκρη'):'');
  const [person,setPerson]=useState(context.mode==='lending'?(context.person??''):'');
  const [expectedReturnDate,setExpectedReturnDate]=useState(context.mode==='lending'&&context.action==='lend'?(context.expectedReturnDate??''):'');
  const [error,setError]=useState('');
  const modalRef=useModalFocus<HTMLElement>(true,'[data-autofocus="true"]',onClose);

  const submit=()=>{
    try{
      const numeric=Number(amount.replace(',','.'));if(!Number.isFinite(numeric)||numeric<=0)throw new Error('Συμπλήρωσε ποσό μεγαλύτερο από μηδέν.');
      let event:FinanceEvent;
      if(context.mode==='credit'){
        if(!card||card.active===false)throw new Error('Η επιλεγμένη πιστωτική δεν είναι πλέον διαθέσιμη.');
        if(context.action==='payment'){
          const debt=creditDebtForCard(data,card.id,asOf);if(debt<=0)throw new Error('Η συγκεκριμένη κάρτα δεν έχει τρέχουσα οφειλή.');if(numeric>debt+.01)throw new Error(`Η πληρωμή δεν μπορεί να ξεπερνά την οφειλή των ${money.format(debt)}.`);
          if(!sameBankAccounts.some(account=>account.id===accountId))throw new Error(`Η αποπληρωμή πρέπει να γίνει από διαθέσιμο λογαριασμό της ίδιας τράπεζας με την ${cardLabel(card)}.`);
          event=createEvent({kind:'card_payment',date,amount:numeric,note:note.trim()||`Αποπληρωμή ${cardLabel(card)}`,fromAccountId:accountId,cardId:card.id});
        }else{
          event=createEvent({kind:'card_purchase',date,amount:numeric,note:note.trim()||`Αγορά με ${cardLabel(card)}`,category:context.category||data.state.settings.expenseCategories[0]||'Άλλο',cardId:card.id});
        }
      }else if(context.mode==='lending'){
        if(!accounts.some(account=>account.id===accountId))throw new Error('Ο επιλεγμένος λογαριασμός δεν είναι πλέον διαθέσιμος. Διάλεξε έναν ενεργό λογαριασμό.');
        const clean=person.trim();if(!clean)throw new Error('Γράψε το όνομα του προσώπου.');
        if(context.action==='repay'){
          const outstanding=lendingOutstandingFor(data,clean);if(outstanding<=0)throw new Error('Δεν υπάρχει καταγεγραμμένη οφειλή για αυτό το πρόσωπο.');if(numeric>outstanding+.01)throw new Error(`Η επιστροφή δεν μπορεί να ξεπερνά την οφειλή των ${money.format(outstanding)}.`);
          event=createEvent({kind:'repayment',date,amount:numeric,note:note.trim()||'Επιστροφή δανεικών',accountId,person:clean});
        }else{
          if(expectedReturnDate&&expectedReturnDate<date)throw new Error('Η αναμενόμενη επιστροφή δεν μπορεί να είναι πριν από την ημερομηνία της κίνησης.');
          event=createEvent({kind:'lending',date,amount:numeric,note:note.trim()||'Πλήρωσα για άλλον',accountId,person:clean,expectedReturnDate:expectedReturnDate||undefined});
        }
      }else if(context.mode==='loan'){
        if(!loan)throw new Error('Η επιλεγμένη δόση ή το δάνειο δεν είναι πλέον διαθέσιμο.');
        const outstanding=loanOutstanding(data,loan);if(outstanding<=0)throw new Error('Η συγκεκριμένη υποχρέωση δεν έχει υπόλοιπο προς πληρωμή.');if(numeric>outstanding+.005)throw new Error(`Η πληρωμή δεν μπορεί να ξεπερνά το υπόλοιπο των ${money.format(outstanding)}.`);
        if(!accounts.some(account=>account.id===accountId))throw new Error('Ο λογαριασμός πληρωμής δεν είναι πλέον διαθέσιμος. Διάλεξε έναν ενεργό λογαριασμό.');
        if(isSelfLoan(loan)){
          const savings=savingsTargets[0]?.id;if(!savings)throw new Error('Δεν υπάρχει αποταμιευτικός λογαριασμός για την επιστροφή της ΒΟΗΘΕΙΑΣ.');
          event=createEvent({kind:'transfer',date,amount:numeric,note:note.trim()||`ΕΠΙΣΤΡΟΦΗ: ${loan.name}`,fromAccountId:accountId,toAccountId:savings});
        }else if((loan.accountingMode??'expense-per-installment')==='liability-repayment'){
          event=createEvent({kind:'card_payment',date,amount:numeric,note:note.trim()||`Δόση: ${loan.name}`,fromAccountId:accountId});
        }else{
          event=createEvent({kind:'expense',date,amount:numeric,note:note.trim()||`Δόση: ${loan.name}`,category:'Δόσεις / δάνεια',accountId});
        }
        event.loanId=loan.id;
      }else if(context.mode==='scheduled'){
        if(!scheduled)throw new Error('Η προγραμματισμένη κίνηση δεν είναι πλέον εκκρεμής ή διαθέσιμη.');
        if(!onCompleteScheduled)throw new Error('Η ολοκλήρωση προγραμματισμένης κίνησης δεν είναι διαθέσιμη από αυτή την οθόνη.');
        event=scheduledToEvent(data,scheduled,{date,amount:numeric,accountId,fromAccountId,toAccountId});
        onCompleteScheduled(transitionScheduled(scheduled,'completed',event.id),event);onClose();return;
      }else if(context.mode==='recurring'){
        if(!recurring)throw new Error('Το πάγιο δεν είναι πλέον διαθέσιμο.');const accountError=recurringAccountError(accounts.map(account=>account.id),accountId);if(accountError)throw new Error(accountError);
        event=createEvent({kind:'expense',date,amount:numeric,note:note.trim()||`Πληρωμή: ${recurring.name}`,category:recurring.category,accountId,recurringId:recurring.id});
      }else{
        if(!savingsSources.some(account=>account.id===fromAccountId))throw new Error('Ο λογαριασμός προέλευσης δεν είναι πλέον διαθέσιμος.');
        if(!savingsTargets.some(account=>account.id===toAccountId))throw new Error('Ο αποταμιευτικός λογαριασμός δεν είναι πλέον διαθέσιμος.');
        if(fromAccountId===toAccountId)throw new Error('Η μεταφορά χρειάζεται διαφορετικό λογαριασμό προέλευσης και αποταμίευσης.');
        event=createEvent({kind:'saving_cash_offset',date,amount:numeric,note:note.trim()||'Μεταφορά στην άκρη',fromAccountId,toAccountId});
        event.savingSource=context.savingSource??'manual_transfer';
      }
      onCreate(event);onClose();
    }catch(reason){setError(reason instanceof Error?reason.message:'Δεν μπορέσαμε να ολοκληρώσουμε την κίνηση. Έλεγξε τα στοιχεία και δοκίμασε ξανά.')}
  };

  const title=context.mode==='credit'?(context.action==='payment'?'Πληρωμή πιστωτικής':'Αγορά με πιστωτική'):context.mode==='lending'?(context.action==='repay'?'Επιστροφή δανεικών':'Νέα οφειλή προς εσένα'):context.mode==='loan'?(loan&&isSelfLoan(loan)?'Επιστροφή ΒΟΗΘΕΙΑΣ':'Πληρωμή δόσης'):context.mode==='scheduled'?'Ολοκλήρωση προγραμματισμένης':context.mode==='recurring'?'Πληρωμή παγίου':'Μεταφορά στην αποταμίευση';
  const Icon=context.mode==='credit'?CreditCard:context.mode==='lending'?HandCoins:context.mode==='loan'?Landmark:context.mode==='scheduled'?CalendarClock:context.mode==='recurring'?ReceiptText:PiggyBank;
  const selectableAccounts=context.mode==='credit'&&context.action==='payment'?sameBankAccounts:accounts;
  const amountError=Boolean(error&&(error.includes('ποσό')||error.startsWith('Η πληρωμή δεν μπορεί')||error.startsWith('Η επιστροφή δεν μπορεί')));
  const targetLabel=context.mode==='credit'?(card?cardLabel(card):'Μη διαθέσιμη κάρτα'):context.mode==='loan'?(loan?.name??'Μη διαθέσιμη υποχρέωση'):context.mode==='recurring'?(recurring?.name??'Μη διαθέσιμο πάγιο'):context.mode==='lending'&&context.person?context.person:context.mode==='scheduled'?(scheduled?.note??'Μη διαθέσιμη προγραμματισμένη κίνηση'):'';

  return <div className="modal-backdrop" onMouseDown={onClose}><section ref={modalRef} className="quick-modal contextual-quick-modal neo-raised" role="dialog" aria-modal="true" aria-labelledby="context-quick-title" aria-describedby={error?'context-quick-error':'context-quick-description'} tabIndex={-1} onMouseDown={event=>event.stopPropagation()}><header><div><small>ΓΡΗΓΟΡΗ ΚΙΝΗΣΗ ΜΕ ΠΛΑΙΣΙΟ</small><h2 id="context-quick-title"><Icon size={20}/> {title}</h2><p id="context-quick-description">Οι προεπιλογές εφαρμόζονται μόνο όταν ανοίγει αυτή η ενέργεια. Ό,τι αλλάξεις μέσα στη φόρμα παραμένει δική σου επιλογή μέχρι να κλείσεις ή να καταχωρίσεις.</p></div><button type="button" className="icon-button" aria-label="Κλείσιμο contextual καταχώρισης" onClick={onClose}><X/></button></header><div className="entry-body">{targetLabel?<div className="context-target" aria-label="Στόχος ενέργειας"><span>Στόχος</span><b>{targetLabel}</b></div>:null}<div className="form-grid"><label><span>Ποσό</span><div className="money-input"><b>€</b><input data-autofocus="true" inputMode="decimal" value={amount} aria-invalid={amountError} aria-describedby={amountError?'context-quick-error':undefined} onChange={event=>setAmount(event.target.value.replace(',','.'))}/></div></label><label><span>Ημερομηνία</span><AppDateInput value={date} onChange={event=>setDate(event.target.value)}/></label>
  {context.mode==='lending'?<label><span>Πρόσωπο</span><input value={person} onChange={event=>setPerson(event.target.value)}/></label>:null}
  {context.mode==='savings'?<><label><span>Από</span><AppSelectInput value={fromAccountId} onChange={event=>setFromAccountId(event.target.value)}>{savingsSources.map(account=><option value={account.id} key={account.id}>{accountDisplayName(data,account.id)}</option>)}</AppSelectInput></label><label><span>Προς αποταμίευση</span><AppSelectInput value={toAccountId} onChange={event=>setToAccountId(event.target.value)}>{savingsTargets.map(account=><option value={account.id} key={account.id}>{accountDisplayName(data,account.id)}</option>)}</AppSelectInput></label></>:context.mode==='scheduled'&&scheduled?.kind==='transfer'?<><label><span>Από</span><AppSelectInput value={fromAccountId} onChange={event=>setFromAccountId(event.target.value)}>{accounts.map(account=><option value={account.id} key={account.id}>{accountDisplayName(data,account.id)}</option>)}</AppSelectInput></label><label><span>Προς</span><AppSelectInput value={toAccountId} onChange={event=>setToAccountId(event.target.value)}>{accounts.map(account=><option value={account.id} key={account.id}>{accountDisplayName(data,account.id)}</option>)}</AppSelectInput></label></>:context.mode==='credit'&&context.action==='purchase'?null:<label><span>{context.mode==='credit'?'Πληρωμή από':context.mode==='lending'&&context.action==='repay'?'Επιστροφή σε':context.mode==='lending'?'Πληρωμή από':context.mode==='loan'?'Πληρωμή από':'Λογαριασμός'}</span><AppSelectInput value={accountId} onChange={event=>setAccountId(event.target.value)}>{selectableAccounts.map(account=><option value={account.id} key={account.id}>{accountDisplayName(data,account.id)}</option>)}</AppSelectInput></label>}
  {context.mode==='lending'&&context.action==='lend'?<label><span>Αναμενόμενη επιστροφή <em>προαιρετικό</em></span><AppDateInput value={expectedReturnDate} min={date} onChange={event=>setExpectedReturnDate(event.target.value)}/></label>:null}{context.mode!=='scheduled'?<label className="wide"><span>Σχόλιο <em>προαιρετικό</em></span><input value={note} onChange={event=>setNote(event.target.value)}/></label>:<div className="wide"><span>Προγραμματισμένη κίνηση</span><b>{scheduled?.note??'Μη διαθέσιμη'}</b></div>}</div>{context.mode==='credit'&&context.action==='payment'&&!sameBankAccounts.length?<FormError id="context-quick-account-warning">Δεν υπάρχει διαθέσιμος λογαριασμός της ίδιας τράπεζας για την αποπληρωμή.</FormError>:null}{context.mode==='loan'&&loan&&isSelfLoan(loan)&&!savingsTargets.length?<FormError id="context-quick-loan-warning">Δεν υπάρχει αποταμιευτικός λογαριασμός για την επιστροφή της ΒΟΗΘΕΙΑΣ.</FormError>:null}{context.mode==='savings'&&!savingsTargets.length?<FormError id="context-quick-saving-warning">Δεν υπάρχει διαθέσιμος αποταμιευτικός λογαριασμός.</FormError>:null}{error?<FormError id="context-quick-error">{error}</FormError>:null}<div className="editor-actions"><button type="button" className="secondary" onClick={onClose}>Ακύρωση</button><button type="button" className="save-button" onClick={submit}>{context.mode==='scheduled'?'Ολοκλήρωση':'Καταχώριση'}</button></div></div></section></div>;
}

export function ContextualQuickAdd({open,data,asOf,context,initial,motionMode='system',onClose,onCreate,onCompleteScheduled,currentBalance}:{open:boolean;data:FinanceData;asOf:string;context:QuickActionContext|null;initial?:FinanceEvent|null;motionMode?:'system'|'reduced'|'full';onClose:()=>void;onCreate:(event:FinanceEvent)=>void;onCompleteScheduled?:(item:ScheduledTransaction,event:FinanceEvent)=>void;currentBalance:(accountId:string)=>number}){
  if(!open||!context)return null;
  if(context.mode==='generic')return <QuickAdd key={context.token} open={open} data={data} asOf={asOf} initial={initial} initialKind={context.kind||'expense'} prefill={context.prefill||null} motionMode={motionMode} onClose={onClose} onCreate={onCreate} currentBalance={currentBalance}/>;
  return <ContextModal key={context.token} data={data} asOf={asOf} context={context} onClose={onClose} onCreate={onCreate} onCompleteScheduled={onCompleteScheduled}/>;
}
