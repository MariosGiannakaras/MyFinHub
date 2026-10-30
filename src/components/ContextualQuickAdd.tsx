import { useMemo, useState } from 'react';
import { CalendarClock, CreditCard, HandCoins, Landmark, PiggyBank, ReceiptText, X } from 'lucide-react';
import { type QuickPrefill } from './QuickAdd';
import { ReceiptAwareQuickAdd } from './ReceiptAwareQuickAdd';
import { AppDateInput } from './AppDateInput';
import { AppSelectInput } from './AppSelectInput';
import { AppTextInput } from './AppTextInput';
import { Button } from './Button';
import { DialogShell } from './DialogShell';
import { ConfirmDialog } from './ConfirmDialog';
import { FormError } from './FormError';
import { IconButton } from './IconButton';
import { MoneyInput } from './MoneyInput';
import { RecurringBrandMark } from './RecurringBrandMark';
import { allAccounts, createEvent } from '../lib/domain';
import { defaultCategory } from '../lib/categories';
import { isSavingsAccount, isSavingContributionSource } from '../lib/accountSelection';
import { savingContributionDraftError } from '../lib/ledgerFoundations';
import { cardLabel, creditCards, creditDebtForCard } from '../lib/cards';
import { creditPurchaseAmount, creditStatementById, creditStatementEvents, recommendedPayableStatement } from '../lib/creditStatements';
import { lendingOutstandingFor } from '../lib/lending';
import { isSelfLoan, loanInstallmentPaymentPlan, loanOutstanding, loanRemainingInstallments, setLoanPaymentInstallmentCount } from '../lib/loans';
import { allRecurringItems, recurringAccountError } from '../lib/recurring';
import { installmentExpensePurpose, recurringExpensePurpose } from '../lib/linkedPaymentPurpose';
import { pendingScheduled, scheduledToEvent, transitionScheduled } from '../lib/scheduled';
import { accountDisplayName } from '../lib/ui';
import { money } from '../lib/format';
// The fee contract is loaded only when a real card-payment commission is saved.
import { isSafeMoneyValue } from '../lib/money';
import { accountMatchesFinancialProvider } from '../lib/financialProviders';
import type { EventKind, FinanceData, FinanceEvent, SavingSource, ScheduledTransaction } from '../types';
import { userErrorMessage } from '../lib/userMessage';

export type QuickActionContext =
  | {token:string;mode:'generic';kind?:EventKind;prefill?:QuickPrefill|null}
  | {token:string;mode:'credit';action:'purchase'|'payment';cardId:string;statementId?:string;amount?:number;note?:string;category?:string;fromAccountId?:string}
  | {token:string;mode:'lending';action:'lend'|'repay'|'writeoff';person?:string;amount?:number;accountId?:string;expectedReturnDate?:string}
  | {token:string;mode:'loan';loanId:string;amount?:number;accountId?:string}
  | {token:string;mode:'recurring';recurringId:string;amount?:number;accountId?:string}
  | {token:string;mode:'scheduled';scheduledId:string}
  | {token:string;mode:'savings';amount?:number;fromAccountId?:string;toAccountId?:string;note?:string;savingSource?:SavingSource};

type SpecialContext=Exclude<QuickActionContext,{mode:'generic'}>;

function ContextModal({data,asOf,context,onClose,onCreate,onCreateLinkedTransfer,onCompleteScheduled}:{data:FinanceData;asOf:string;context:SpecialContext;onClose:()=>void;onCreate:(event:FinanceEvent)=>Promise<void>;onCreateLinkedTransfer?:(principal:FinanceEvent,fee:FinanceEvent|null)=>Promise<void>;onCompleteScheduled?:(item:ScheduledTransaction,event:FinanceEvent)=>Promise<void>}){
  const accounts=useMemo(()=>allAccounts(data).filter(account=>account.kind!=='credit'),[data]);
  const defaultExpense=accounts.some(account=>account.id===data.state.settings.defaultExpenseAccount)?data.state.settings.defaultExpenseAccount:accounts[0]?.id||'';
  const defaultIncome=accounts.some(account=>account.id===data.state.settings.defaultIncomeAccount)?data.state.settings.defaultIncomeAccount:accounts[0]?.id||'';
  const card=context.mode==='credit'?creditCards(data).find(item=>item.id===context.cardId):undefined;
  const selectedStatement=context.mode==='credit'&&context.action==='payment'&&card
    ?(context.statementId?creditStatementById(data,context.statementId,asOf):recommendedPayableStatement(data,card.id,asOf))
    :undefined;
  const statementPurchases=selectedStatement?creditStatementEvents(data,selectedStatement.id).filter(event=>creditPurchaseAmount(event)>.005):[];
  const recurring=context.mode==='recurring'?allRecurringItems(data).find(item=>item.id===context.recurringId):undefined;
  const loans=useMemo(()=>[...(data.seed.loans??[]).map(item=>data.state.loanOverrides?.[item.id]??item),...(data.state.customLoans??[])],[data]);
  const loan=context.mode==='loan'?loans.find(item=>item.id===context.loanId):undefined;
  const scheduled=context.mode==='scheduled'?pendingScheduled(data).find(item=>item.id===context.scheduledId):undefined;
  const sameBankAccounts=context.mode==='credit'&&card?accounts.filter(account=>accountMatchesFinancialProvider(account,card.bankId)):accounts;
  // A newly counted Savings contribution is a bank operating → savings transfer.
  // Cash and even other savings accounts may be used by ordinary transfers,
  // but must not inflate freshly counted saving_cash_offset flow.
  const savingsTargets=accounts.filter(isSavingsAccount);
  const savingsSources=accounts.filter(isSavingContributionSource);
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
  const loanOutstandingAmount=loan?loanOutstanding(data,loan,asOf):0;
  const initialLoanPlan=loan&&!isSelfLoan(loan)?loanInstallmentPaymentPlan(data,loan,1,asOf):null;
  const initialAmount=context.mode==='credit'
    ?(context.amount??(context.action==='payment'&&card?(selectedStatement?.remaining??creditDebtForCard(data,card.id,asOf)):0))
    :context.mode==='lending'
      ?(context.amount??(context.action!=='lend'&&context.person?lendingOutstandingFor(data,context.person,asOf):0))
      :context.mode==='recurring'
        ?(context.amount??recurring?.amount??0)
        :context.mode==='loan'
          ?(loan&&isSelfLoan(loan)?(context.amount??Math.min(Number(loan.installment||loanOutstandingAmount),loanOutstandingAmount)):(initialLoanPlan?.amount??0))
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
  const [installmentCount,setInstallmentCount]=useState(1);
  const [date,setDate]=useState(asOf);
  const [accountId,setAccountId]=useState(initialAccount);
  const [fromAccountId,setFromAccountId]=useState(initialFrom);
  const [toAccountId,setToAccountId]=useState(initialTo);
  const [note,setNote]=useState(context.mode==='credit'?(context.note??''):context.mode==='recurring'?(recurring?`Πληρωμή: ${recurring.name}`:''):context.mode==='loan'?(loan?`${isSelfLoan(loan)?'ΕΠΙΣΤΡΟΦΗ':'Δόση'}: ${loan.name}`:''):context.mode==='scheduled'?(scheduled?.note??''):context.mode==='savings'?(context.note??'Μεταφορά στην άκρη'):'');
  const [person,setPerson]=useState(context.mode==='lending'?(context.person??''):'');
  const [expectedReturnDate,setExpectedReturnDate]=useState(context.mode==='lending'&&context.action==='lend'?(context.expectedReturnDate??''):'');
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [discardOpen,setDiscardOpen]=useState(false);
  const requestClose=()=>{
    if(saving)return;
    if(dirty){setDiscardOpen(true);return}
    onClose();
  };
  const [paymentFee,setPaymentFee]=useState('');
  const [writeoffConfirmed,setWriteoffConfirmed]=useState(false);
  const [confirmedWriteoffAmount,setConfirmedWriteoffAmount]=useState('');
  const [paymentFeeCategory,setPaymentFeeCategory]=useState(defaultCategory(data.state.settings,'expense'));
  const loanPaymentPlan=context.mode==='loan'&&loan&&!isSelfLoan(loan)?loanInstallmentPaymentPlan(data,loan,installmentCount,asOf):null;
  const remainingLoanInstallments=loan&&!isSelfLoan(loan)?loanRemainingInstallments(data,loan,asOf):0;

  const submit=async()=>{
    if(saving)return;
    try{
      if(context.mode==='loan'&&!/^\d+(?:[.,]\d{1,2})?$/.test(amount.trim()))throw new Error('Το πραγματικό ποσό δόσης πρέπει να έχει έως δύο δεκαδικά ψηφία.');
      const numeric=Number(amount.replace(',','.'));if(!Number.isFinite(numeric)||numeric<=0)throw new Error('Συμπλήρωσε ποσό μεγαλύτερο από μηδέν.');
      let event:FinanceEvent;
      if(context.mode==='credit'){
        if(!card||card.active===false)throw new Error('Η επιλεγμένη πιστωτική δεν είναι πλέον διαθέσιμη.');
        if(context.action==='payment'){
          const debt=creditDebtForCard(data,card.id,asOf);if(debt<=0)throw new Error('Η συγκεκριμένη κάρτα δεν έχει τρέχουσα οφειλή.');
          const maximum=selectedStatement?.remaining??debt;if(numeric>maximum+.01)throw new Error(`Η πληρωμή δεν μπορεί να ξεπερνά ${selectedStatement?'το υπόλοιπο της δήλωσης':'την οφειλή'} των ${money.format(maximum)}.`);
          if(!sameBankAccounts.some(account=>account.id===accountId))throw new Error(`Η αποπληρωμή πρέπει να γίνει από διαθέσιμο λογαριασμό της ίδιας τράπεζας με την ${cardLabel(card)}.`);
          event=createEvent({kind:'card_payment',date,amount:numeric,note:note.trim()||`Αποπληρωμή ${cardLabel(card)}`,fromAccountId:accountId,cardId:card.id});
          if(selectedStatement)event.statementId=selectedStatement.id;
        }else{
          event=createEvent({kind:'card_purchase',date,amount:numeric,note:note.trim()||`Αγορά με ${cardLabel(card)}`,category:context.category||defaultCategory(data.state.settings,'expense'),cardId:card.id});
        }
      }else if(context.mode==='lending'){
        if(context.action!=='writeoff'&&!accounts.some(account=>account.id===accountId))
          throw new Error('Ο επιλεγμένος λογαριασμός δεν είναι πλέον διαθέσιμος. Διάλεξε έναν ενεργό λογαριασμό.');
        const clean=person.trim();if(!clean)throw new Error('Γράψε το όνομα του προσώπου.');
        if(context.action==='writeoff'){
          if(date>asOf)throw new Error('Η πραγματική διαγραφή δεν μπορεί να καταχωριστεί με μελλοντική ημερομηνία.');
          const outstanding=lendingOutstandingFor(data,clean,date);
          if(outstanding<=0)throw new Error('Δεν υπάρχει καταγεγραμμένη απαίτηση για διαγραφή την επιλεγμένη ημερομηνία.');
          if(numeric>outstanding+.005)throw new Error(`Η διαγραφή δεν μπορεί να ξεπερνά την απαίτηση των ${money.format(outstanding)} την επιλεγμένη ημερομηνία.`);
          if(!writeoffConfirmed||confirmedWriteoffAmount!==amount)throw new Error('Επιβεβαίωσε ρητά το τρέχον ποσό διαγραφής πριν από την αποθήκευση.');
          event=createEvent({kind:'lending_writeoff',date,amount:numeric,note:note.trim()||'Επιβεβαιωμένη μερική διαγραφή απαίτησης',person:clean});
        }else if(context.action==='repay'){
          const outstanding=lendingOutstandingFor(data,clean);if(outstanding<=0)throw new Error('Δεν υπάρχει καταγεγραμμένη οφειλή για αυτό το πρόσωπο.');if(numeric>outstanding+.01)throw new Error(`Η επιστροφή δεν μπορεί να ξεπερνά την οφειλή των ${money.format(outstanding)}.`);
          event=createEvent({kind:'repayment',date,amount:numeric,note:note.trim()||'Επιστροφή δανεικών',accountId,person:clean});
        }else{
          if(expectedReturnDate&&expectedReturnDate<date)throw new Error('Η αναμενόμενη επιστροφή δεν μπορεί να είναι πριν από την ημερομηνία της κίνησης.');
          event=createEvent({kind:'lending',date,amount:numeric,note:note.trim()||'Πλήρωσα για άλλον',accountId,person:clean,expectedReturnDate:expectedReturnDate||undefined});
        }
      }else if(context.mode==='loan'){
        if(!loan)throw new Error('Η επιλεγμένη δόση ή το δάνειο δεν είναι πλέον διαθέσιμο.');
        const outstanding=loanOutstanding(data,loan,asOf);if(outstanding<=0)throw new Error('Η συγκεκριμένη υποχρέωση δεν έχει υπόλοιπο προς πληρωμή.');if(numeric>outstanding+.005)throw new Error(`Η πληρωμή δεν μπορεί να ξεπερνά το υπόλοιπο των ${money.format(outstanding)}.`);
        if(!accounts.some(account=>account.id===accountId))throw new Error('Ο λογαριασμός πληρωμής δεν είναι πλέον διαθέσιμος. Διάλεξε έναν ενεργό λογαριασμό.');
        if(!isSelfLoan(loan)&&!loanPaymentPlan)throw new Error('Δεν υπάρχουν διαθέσιμες δόσεις προς πληρωμή.');
        if(isSelfLoan(loan)){
          const savings=savingsTargets[0]?.id;if(!savings)throw new Error('Δεν υπάρχει αποταμιευτικός λογαριασμός για την επιστροφή της ΒΟΗΘΕΙΑΣ.');
          event=createEvent({kind:'transfer',date,amount:numeric,note:note.trim()||`ΕΠΙΣΤΡΟΦΗ: ${loan.name}`,fromAccountId:accountId,toAccountId:savings});
        }else if((loan.accountingMode??'expense-per-installment')==='liability-repayment'){
          event=createEvent({kind:'card_payment',date,amount:numeric,note:note.trim()||`Δόση: ${loan.name}`,fromAccountId:accountId});
        }else{
          const purpose=installmentExpensePurpose(loan);
          event=createEvent({kind:'expense',date,amount:numeric,note:note.trim()||`Δόση: ${loan.name}`,category:purpose.category,accountId});
          if(purpose.subcategory)event.subcategory=purpose.subcategory;
        }
        event.loanId=loan.id;
        if(loanPaymentPlan)setLoanPaymentInstallmentCount(event,loanPaymentPlan.count);
      }else if(context.mode==='scheduled'){
        if(!scheduled)throw new Error('Η προγραμματισμένη κίνηση δεν είναι πλέον εκκρεμής ή διαθέσιμη.');
        if(!onCompleteScheduled)throw new Error('Η ολοκλήρωση προγραμματισμένης κίνησης δεν είναι διαθέσιμη από αυτή την οθόνη.');
        event=scheduledToEvent(data,scheduled,{date,amount:numeric,accountId,fromAccountId,toAccountId});
        setSaving(true);
        await onCompleteScheduled(transitionScheduled(scheduled,'completed',event.id),event);
        onClose();return;
      }else if(context.mode==='recurring'){
        if(!recurring)throw new Error('Το πάγιο δεν είναι πλέον διαθέσιμο.');const accountError=recurringAccountError(accounts.map(account=>account.id),accountId);if(accountError)throw new Error(accountError);
        const purpose=recurringExpensePurpose(recurring);
        event=createEvent({kind:'expense',date,amount:numeric,note:note.trim()||`Πληρωμή: ${recurring.name}`,category:purpose.category,accountId,recurringId:recurring.id});
        if(purpose.subcategory)event.subcategory=purpose.subcategory;
      }else{
        if(!savingsSources.some(account=>account.id===fromAccountId))throw new Error('Ο λογαριασμός προέλευσης δεν είναι πλέον διαθέσιμος.');
        if(!savingsTargets.some(account=>account.id===toAccountId))throw new Error('Ο αποταμιευτικός λογαριασμός δεν είναι πλέον διαθέσιμος.');
        const savingError=savingContributionDraftError(data,{fromAccountId,toAccountId,amount:numeric});
        if(savingError)throw new Error(savingError);
        event=createEvent({kind:'saving_cash_offset',date,amount:numeric,note:note.trim()||'Μεταφορά στην άκρη',fromAccountId,toAccountId});
        event.savingSource=context.savingSource??'manual_transfer';
      }
      setSaving(true);
      if(context.mode==='credit'&&context.action==='payment'&&paymentFee.trim()){
        const feeValue=Number(paymentFee.replace(',','.'));
        if(!isSafeMoneyValue(feeValue)||feeValue<0)throw new Error('Η προμήθεια χρειάζεται έγκυρο ποσό σε ευρώ και λεπτά.');
        if(!onCreateLinkedTransfer)throw new Error('Δεν είναι διαθέσιμη η ενιαία ασφαλής αποθήκευση πληρωμής και προμήθειας.');
        const {buildLinkedTransferFee}=await import('../lib/linkedFees');
        const fee=buildLinkedTransferFee(data,event,{amount:feeValue,category:paymentFeeCategory});
        await onCreateLinkedTransfer(event,fee);
      }else{
        await onCreate(event);
      }
      onClose();
    }catch(reason){setError(userErrorMessage(reason,'Δεν μπορέσαμε να ολοκληρώσουμε την κίνηση. Έλεγξε τα στοιχεία και δοκίμασε ξανά.'))}
    finally{setSaving(false)}
  };

  const title=context.mode==='credit'?(context.action==='payment'?(selectedStatement?'Πληρωμή δήλωσης πιστωτικής':'Πληρωμή πιστωτικής'):'Αγορά με πιστωτική'):context.mode==='lending'?(context.action==='writeoff'?'Διαγραφή απαίτησης':context.action==='repay'?'Επιστροφή δανεικών':'Νέα οφειλή προς εσένα'):context.mode==='loan'?(loan&&isSelfLoan(loan)?'Επιστροφή ΒΟΗΘΕΙΑΣ':installmentCount>1?'Πληρωμή δόσεων':'Πληρωμή δόσης'):context.mode==='scheduled'?'Ολοκλήρωση προγραμματισμένης':context.mode==='recurring'?'Πληρωμή παγίου':'Μεταφορά στην αποταμίευση';
  const Icon=context.mode==='credit'?CreditCard:context.mode==='lending'?HandCoins:context.mode==='loan'?Landmark:context.mode==='scheduled'?CalendarClock:context.mode==='recurring'?ReceiptText:PiggyBank;
  const selectableAccounts=context.mode==='credit'&&context.action==='payment'?sameBankAccounts:accounts;
  const amountError=Boolean(error&&(error.includes('ποσό')||error.startsWith('Η πληρωμή δεν μπορεί')||error.startsWith('Η επιστροφή δεν μπορεί')));
  const targetLabel=context.mode==='credit'?(card?cardLabel(card):'Μη διαθέσιμη κάρτα'):context.mode==='loan'?(loan?.name??'Μη διαθέσιμη υποχρέωση'):context.mode==='recurring'?(recurring?.name??'Μη διαθέσιμο πάγιο'):context.mode==='lending'&&context.person?context.person:context.mode==='scheduled'?(scheduled?.note??'Μη διαθέσιμη προγραμματισμένη κίνηση'):'';
  const paymentMode=(context.mode==='credit'&&context.action==='payment')||context.mode==='loan'||context.mode==='recurring';
  const sourceLabel=accountId?accountDisplayName(data,accountId):'Μη διαθέσιμος λογαριασμός';
  const validActualLoanAmount=/^\d+(?:[.,]\d{1,2})?$/.test(amount.trim())&&Number(amount.replace(',','.'))>0;
  const actualLoanPaymentLabel=validActualLoanAmount?money.format(Number(amount.replace(',','.'))):'το ποσό που θα επιβεβαιώσεις';
  const paymentEffect=context.mode==='credit'&&context.action==='payment'
    ?selectedStatement
      ?`Από ${sourceLabel} προς ${targetLabel}. Η πληρωμή συνδέεται με τη δήλωση που έκλεισε ${selectedStatement.closeDate.split('-').reverse().join('/')} και μειώνει μόνο το υπόλοιπό της κατά μία πραγματική κίνηση.`
      :`Από ${sourceLabel} προς ${targetLabel}. Η καταχώριση μειώνει τον λογαριασμό πληρωμής και την παλαιότερη μη συνδεδεμένη οφειλή της συγκεκριμένης κάρτας μία φορά.`
    :context.mode==='loan'&&loan
      ?isSelfLoan(loan)
        ?`Από ${sourceLabel} προς την αποταμίευση, με ταυτόχρονη μείωση της υποχρέωσης ${targetLabel}. Δημιουργείται μία ενιαία κίνηση επιστροφής.`
        :loanPaymentPlan
          ?`Από ${sourceLabel} προς ${targetLabel}. Καλύπτονται οι δόσεις ${loanPaymentPlan.firstInstallment}${loanPaymentPlan.firstInstallment===loanPaymentPlan.lastInstallment?'':`–${loanPaymentPlan.lastInstallment}`} και η πραγματική πληρωμή θα είναι ${actualLoanPaymentLabel}.`
          :`Από ${sourceLabel} προς ${targetLabel}. Η καταχώριση ενημερώνει την ίδια υποχρέωση χωρίς δεύτερη χειροκίνητη εγγραφή.`
      :context.mode==='recurring'&&recurring
        ?`Από ${sourceLabel} προς ${targetLabel}. Καταγράφεται μία πραγματική πληρωμή του παγίου και χρεώνεται μόνο ο επιλεγμένος λογαριασμός.`
        :'';

  return <><DialogShell
    open={true}
    className="contextual-quick-modal"
    busy={saving}
    ariaLabelledBy="context-quick-title"
    ariaDescribedBy={error?'context-quick-error':'context-quick-description'}
    motionMode="none"
    preferredFocus='[data-autofocus="true"]'
    focusActive={!discardOpen}
    onRequestClose={requestClose}
  ><header><div><small>ΓΡΗΓΟΡΗ ΚΙΝΗΣΗ ΜΕ ΠΛΑΙΣΙΟ</small><h2 id="context-quick-title">{context.mode==='recurring'&&recurring?<RecurringBrandMark item={recurring} settings={data.state.settings} size={28}/>:<Icon size={20}/>} {title}</h2><p id="context-quick-description">Οι προεπιλογές εφαρμόζονται μόνο όταν ανοίγει αυτή η ενέργεια. Ό,τι αλλάξεις μέσα στη φόρμα παραμένει δική σου επιλογή μέχρι να κλείσεις ή να καταχωρίσεις.</p></div><IconButton type="button" aria-label="Κλείσιμο contextual καταχώρισης" disabled={saving} onClick={requestClose}><X/></IconButton></header><div className="entry-body" inert={saving}>{targetLabel?<div className="context-target" aria-label="Στόχος ενέργειας"><span>Στόχος</span><b>{targetLabel}</b></div>:null}{selectedStatement?<div className="rule-preview" data-credit-statement-payment-preview role="note" aria-label="Περιεχόμενο δήλωσης προς πληρωμή"><div className="logic-note compact"><ReceiptText/><span>Δήλωση {selectedStatement.openDate.split('-').reverse().join('/')}–{selectedStatement.closeDate.split('-').reverse().join('/')} · λήξη {selectedStatement.dueDate.split('-').reverse().join('/')} · υπόλοιπο {money.format(selectedStatement.remaining)}</span></div>{statementPurchases.length?<ul>{statementPurchases.slice(0,5).map(event=><li key={event.id}><span>{event.note}</span><b>{money.format(creditPurchaseAmount(event))}</b></li>)}</ul>:null}</div>:null}<div className="form-grid"><label><span>Ποσό</span><MoneyInput data-autofocus="true" value={amount} invalid={amountError} aria-describedby={amountError?'context-quick-error':undefined} onValueChange={value=>{setAmount(value);setDirty(true)}}/></label><label><span>Ημερομηνία</span><AppDateInput value={date} onChange={event=>{setDate(event.target.value);setWriteoffConfirmed(false);setDirty(true)}}/></label>
  {context.mode==='loan'&&loan&&!isSelfLoan(loan)&&remainingLoanInstallments>0?<label><span>Πόσες δόσεις</span><AppSelectInput value={String(installmentCount)} onChange={event=>{const count=Number(event.target.value);setInstallmentCount(count);const plan=loanInstallmentPaymentPlan(data,loan,count,asOf);setAmount(plan?String(plan.amount):'');setDirty(true)}}>{Array.from({length:remainingLoanInstallments},(_,index)=>index+1).map(count=><option key={count} value={count}>{count}</option>)}</AppSelectInput></label>:null}
  {context.mode==='loan'&&loan&&!isSelfLoan(loan)?<p className="logic-note compact">Η προκαθορισμένη δόση είναι πρόταση. Μπορείς να καταχωρίσεις το ακριβές ποσό σε ευρώ και λεπτά μόνο για αυτή την πληρωμή.</p>:null}
  {context.mode==='lending'?<label><span>Πρόσωπο</span><AppTextInput value={person} onChange={event=>{setPerson(event.target.value);setWriteoffConfirmed(false);setDirty(true)}}/></label>:null}
  {context.mode==='savings'?<><label><span>Από</span><AppSelectInput value={fromAccountId} onChange={event=>{setFromAccountId(event.target.value);setDirty(true)}}>{savingsSources.map(account=><option value={account.id} key={account.id}>{accountDisplayName(data,account.id)}</option>)}</AppSelectInput></label><label><span>Προς αποταμίευση</span><AppSelectInput value={toAccountId} onChange={event=>{setToAccountId(event.target.value);setDirty(true)}}>{savingsTargets.map(account=><option value={account.id} key={account.id}>{accountDisplayName(data,account.id)}</option>)}</AppSelectInput></label></>:context.mode==='scheduled'&&scheduled?.kind==='transfer'?<><label><span>Από</span><AppSelectInput value={fromAccountId} onChange={event=>{setFromAccountId(event.target.value);setDirty(true)}}>{accounts.map(account=><option value={account.id} key={account.id}>{accountDisplayName(data,account.id)}</option>)}</AppSelectInput></label><label><span>Προς</span><AppSelectInput value={toAccountId} onChange={event=>{setToAccountId(event.target.value);setDirty(true)}}>{accounts.map(account=><option value={account.id} key={account.id}>{accountDisplayName(data,account.id)}</option>)}</AppSelectInput></label></>:(context.mode==='credit'&&context.action==='purchase')||(context.mode==='lending'&&context.action==='writeoff')?null:<label><span>{context.mode==='credit'?'Πληρωμή από':context.mode==='lending'&&context.action==='repay'?'Επιστροφή σε':context.mode==='lending'?'Πληρωμή από':context.mode==='loan'||context.mode==='recurring'?'Πληρωμή από':'Λογαριασμός'}</span><AppSelectInput value={accountId} onChange={event=>{setAccountId(event.target.value);setDirty(true)}}>{selectableAccounts.map(account=><option value={account.id} key={account.id}>{accountDisplayName(data,account.id)}</option>)}</AppSelectInput></label>}
  {context.mode==='credit'&&context.action==='payment'?<><label><span>Προμήθεια πληρωμής (€) · προαιρετική</span><MoneyInput aria-label="Προμήθεια πληρωμής" value={paymentFee} onValueChange={value=>{setPaymentFee(value);setDirty(true)}}/></label>{Number(paymentFee.replace(',','.'))>0?<label><span>Κατηγορία προμήθειας</span><AppSelectInput value={paymentFeeCategory} onChange={event=>{setPaymentFeeCategory(event.target.value);setDirty(true)}}>{data.state.settings.expenseCategories.map(category=><option key={category} value={category}>{category}</option>)}</AppSelectInput></label>:null}<div className="logic-note compact wide" role="note">Η αποπληρωμή μειώνει το χρέος της πιστωτικής χωρίς δεύτερη δαπάνη. Τυχόν πραγματική προμήθεια καταχωρίζεται ξεχωριστά ως έξοδο, στην ίδια αποθήκευση.</div></>:null}
  {context.mode==='lending'&&context.action==='writeoff'?<div className="logic-note wide" data-lending-writeoff role="note">
    <p>Απαίτηση την {date}: <strong>{money.format(lendingOutstandingFor(data,person.trim(),date))}</strong>. Η διαγραφή μειώνει μόνο την απαίτηση και την καθαρή θέση. Δεν δημιουργεί είσπραξη, δαπάνη ή κίνηση λογαριασμού.</p>
    <label><input type="checkbox" checked={writeoffConfirmed&&confirmedWriteoffAmount===amount} onChange={event=>{setWriteoffConfirmed(event.target.checked);setConfirmedWriteoffAmount(amount);setDirty(true)}}/> Επιβεβαιώνω την οριστική, καταγεγραμμένη μείωση της απαίτησης.</label>
  </div>:null}
  {context.mode==='lending'&&context.action==='lend'?<label><span>Αναμενόμενη επιστροφή <em>προαιρετικό</em></span><AppDateInput value={expectedReturnDate} min={date} onChange={event=>{setExpectedReturnDate(event.target.value);setDirty(true)}}/></label>:null}{context.mode!=='scheduled'?<label className="wide"><span>Σχόλιο <em>προαιρετικό</em></span><AppTextInput value={note} onChange={event=>{setNote(event.target.value);setDirty(true)}}/></label>:<div className="wide"><span>Προγραμματισμένη κίνηση</span><b>{scheduled?.note??'Μη διαθέσιμη'}</b></div>}</div>{paymentEffect?<div className="payment-effect-summary" role="note" aria-label="Οικονομικό αποτέλεσμα πληρωμής"><span>Αποτέλεσμα</span><p>{paymentEffect}</p></div>:null}{context.mode==='credit'&&context.action==='payment'&&!sameBankAccounts.length?<FormError id="context-quick-account-warning">Δεν υπάρχει διαθέσιμος λογαριασμός της ίδιας τράπεζας για την αποπληρωμή.</FormError>:null}{context.mode==='loan'&&loan&&isSelfLoan(loan)&&!savingsTargets.length?<FormError id="context-quick-loan-warning">Δεν υπάρχει αποταμιευτικός λογαριασμός για την επιστροφή της ΒΟΗΘΕΙΑΣ.</FormError>:null}{context.mode==='savings'&&!savingsTargets.length?<FormError id="context-quick-saving-warning">Δεν υπάρχει διαθέσιμος αποταμιευτικός λογαριασμός.</FormError>:null}{error?<FormError id="context-quick-error">{error}</FormError>:null}<div className="editor-actions"><Button type="button" variant="secondary" disabled={saving} onClick={requestClose}>Ακύρωση</Button><Button type="button" variant="primary" disabled={saving} onClick={()=>void submit()}>{saving?'Αποθήκευση…':context.mode==='scheduled'?'Ολοκλήρωση':context.mode==='lending'&&context.action==='writeoff'?'Επιβεβαίωση διαγραφής':paymentMode?'Επιβεβαίωση πληρωμής':'Καταχώριση'}</Button></div></div></DialogShell>
  <ConfirmDialog open={discardOpen} title="Απόρριψη μη αποθηκευμένων αλλαγών;" description="Οι αλλαγές στη φόρμα δεν έχουν καταχωριστεί. Αν κλείσεις, θα χαθούν χωρίς νέα οικονομική κίνηση." confirmLabel="Απόρριψη" tone="destructive" onConfirm={()=>{setDiscardOpen(false);onClose()}} onCancel={()=>setDiscardOpen(false)}/>
  </>;
}

export function ContextualQuickAdd({open,data,asOf,context,initial,motionMode='system',onClose,onCreate,onCreateLinkedTransfer,onCompleteScheduled,onReceiptCleanupFailure,currentBalance}:{open:boolean;data:FinanceData;asOf:string;context:QuickActionContext|null;initial?:FinanceEvent|null;motionMode?:'system'|'reduced'|'full';onClose:()=>void;onCreate:(event:FinanceEvent)=>Promise<void>;onCreateLinkedTransfer?:(principal:FinanceEvent,fee:FinanceEvent|null)=>Promise<void>;onCompleteScheduled?:(item:ScheduledTransaction,event:FinanceEvent)=>Promise<void>;onReceiptCleanupFailure?:(draftId:string)=>void;currentBalance:(accountId:string)=>number}){
  if(!open||!context)return null;
  if(context.mode==='generic')return <ReceiptAwareQuickAdd key={context.token} open={open} data={data} asOf={asOf} initial={initial} initialKind={context.kind||'expense'} prefill={context.prefill||null} motionMode={motionMode} onClose={onClose} onCreate={onCreate} onCreateLinkedTransfer={onCreateLinkedTransfer} onReceiptCleanupFailure={onReceiptCleanupFailure} currentBalance={currentBalance}/>;
  return <ContextModal key={context.token} data={data} asOf={asOf} context={context} onClose={onClose} onCreate={onCreate} onCreateLinkedTransfer={onCreateLinkedTransfer} onCompleteScheduled={onCompleteScheduled}/>;
}