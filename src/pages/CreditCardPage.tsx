import { ArchiveRestore, ChevronLeft, ChevronRight, CreditCard, Pencil, Plus, ReceiptText, Trash2, WalletCards, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AnimatedAmount } from '../components/AnimatedAmount';
import { AppDateInput } from '../components/AppDateInput';
import { AppSelectInput } from '../components/AppSelectInput';
import { CanonicalCreditCardStack } from '../components/CanonicalCreditCardStack';
import { CardCreateDialog } from '../components/CardCreateDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MoneyEditDialog } from '../components/MoneyEditDialog';
import { MoneyInput } from '../components/MoneyInput';
import { SortDirectionControl, type SortDirection } from '../components/SortDirectionControl';
import { Tooltip } from '../components/Tooltip';
import { useModalFocus } from '../hooks/useModalFocus';
import { canPermanentlyDeleteCreditCard, cardBanks, creditCards, creditDebtForCard, creditEventsForCard, creditLimitForCard, deletedCreditCards, restoreCard } from '../lib/cards';
import { cardVaultErrorMessage } from '../lib/cardVaultClient';
import { categoryPath, genericCategoryTree, subcategoriesFor } from '../lib/categories';
import { cardStatementConfiguration, creditStatementEvents, creditStatementViews, recommendedPayableStatement, unlinkedCreditStatementEvents } from '../lib/creditStatements';
import { allAccounts, createEvent } from '../lib/domain';
import { money, shortDate } from '../lib/format';
import { accountDisplayName } from '../lib/ui';
import { userErrorMessage } from '../lib/userMessage';
import type { CreditStatementStatus, FinanceData, FinanceEvent, PaymentCard } from '../types';

const statementStatusLabel:Record<CreditStatementStatus,string>={open:'Ανοιχτή',closed:'Κλειστή',due:'Προς πληρωμή',paid:'Εξοφλημένη'};
const boundaryLabel=(value:PaymentCard['statementBoundaryRule'])=>value==='include-closing-day'?'Η ημέρα κλεισίματος ανήκει στη δήλωση που κλείνει εκείνη την ημέρα':value==='next-cycle'?'Η ημέρα κλεισίματος ανήκει στον επόμενο κύκλο':'Αναμένει τελική επιλογή προϊόντος';

type CardDeckMode='horizontal'|'stack';

export function CreditCardPage({
  data,asOf,onCreateEvent,onEditEvent,onDeleteEvent,onUpsertCard,onArchiveCard,onDeleteCard,onPayCard,
}:{
  data:FinanceData;asOf:string;
  onCreateEvent:(event:FinanceEvent)=>void;onEditEvent:(id:string)=>void;onDeleteEvent:(id:string)=>void;
  onUpsertCard:(card:PaymentCard)=>void;onArchiveCard:(card:PaymentCard)=>void;onDeleteCard:(card:PaymentCard)=>Promise<void>;onPayCard:(cardId:string,statementId?:string)=>void;
}){
  const banks=useMemo(()=>cardBanks(data),[data]);
  const allCredit=useMemo(()=>creditCards(data,{includeArchived:true}),[data]);
  const activeCredit=useMemo(()=>allCredit.filter(card=>card.active!==false),[allCredit]);
  const archivedCredit=useMemo(()=>allCredit.filter(card=>card.active===false),[allCredit]);
  const deletedCredit=useMemo(()=>deletedCreditCards(data),[data]);
  const deletedHistory=useMemo(()=>deletedCredit.map(reference=>({
    reference,
    statements:creditStatementViews(data,reference.id,asOf),
    events:creditEventsForCard(data,reference.id).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id)),
  })).filter(item=>item.events.length>0||item.statements.length>0),[data,deletedCredit,asOf]);
  const [selectedCardId,setSelectedCardId]=useState('');
  const [cardDeckMode,setCardDeckMode]=useState<CardDeckMode>('horizontal');
  const [purchaseSortDirection,setPurchaseSortDirection]=useState<SortDirection>('desc');
  const [paymentSortDirection,setPaymentSortDirection]=useState<SortDirection>('desc');
  useEffect(()=>{
    if(selectedCardId&&activeCredit.some(card=>card.id===selectedCardId))return;
    setSelectedCardId(activeCredit[0]?.id??'');
  },[selectedCardId,activeCredit]);
  const card=activeCredit.find(item=>item.id===selectedCardId)??activeCredit[0];
  const selectedCardIndex=card?Math.max(0,activeCredit.findIndex(item=>item.id===card.id)):0;
  const selectRelativeCard=(step:number)=>{
    if(activeCredit.length<2)return;
    const next=(selectedCardIndex+step+activeCredit.length)%activeCredit.length;
    setSelectedCardId(activeCredit[next].id);
  };
  const bank=card?banks.find(item=>item.id===card.bankId):undefined;
  const debt=card?creditDebtForCard(data,card.id,asOf):0;
  const limit=card?creditLimitForCard(data,card):0;
  const available=Math.max(0,limit-debt);
  const usage=limit>0?(debt/limit)*100:0;
  const usageBar=Math.min(100,Math.max(0,usage));
  const overLimit=limit>0&&debt>limit+.005;
  const overLimitAmount=overLimit?debt-limit:0;
  const cardEvents=useMemo(()=>card?creditEventsForCard(data,card.id):[],[data,card]);
  const purchases=useMemo(()=>{const direction=purchaseSortDirection==='asc'?1:-1;return cardEvents.filter(event=>event.kind==='card_purchase').sort((a,b)=>direction*(a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)))},[cardEvents,purchaseSortDirection]);
  const payments=useMemo(()=>{const direction=paymentSortDirection==='asc'?1:-1;return cardEvents.filter(event=>event.kind==='card_payment'&&!event.loanId).sort((a,b)=>direction*(a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)))},[cardEvents,paymentSortDirection]);
  const statementConfig=card?cardStatementConfiguration(card):null;
  const statements=useMemo(()=>card?creditStatementViews(data,card.id,asOf):[],[data,card,asOf]);
  const payableStatement=card?recommendedPayableStatement(data,card.id,asOf):undefined;
  const primaryStatement=payableStatement??statements[0];
  const unlinkedStatementEvents=useMemo(()=>card?unlinkedCreditStatementEvents(data,card.id):[],[data,card]);
  const bankPrefix=card?.bankId??'';
  const eligibleAccounts=allAccounts(data).filter(account=>account.kind!=='credit'&&Boolean(bankPrefix)&&account.id.startsWith(`${bankPrefix}-`));
  const categories=genericCategoryTree(data.state.settings,'expense');
  const [createOpen,setCreateOpen]=useState(false);
  const [purchaseOpen,setPurchaseOpen]=useState(false);
  const [archiveOpen,setArchiveOpen]=useState(false);
  const [statementSetupOpen,setStatementSetupOpen]=useState(false);
  const [statementClosingText,setStatementClosingText]=useState('');
  const [statementDueText,setStatementDueText]=useState('');
  const [statementSetupError,setStatementSetupError]=useState('');
  const [deleteEventTarget,setDeleteEventTarget]=useState<FinanceEvent|null>(null);
  const [deleteCardTarget,setDeleteCardTarget]=useState<PaymentCard|null>(null);
  const [deleteCardBusy,setDeleteCardBusy]=useState(false);
  const [limitOpen,setLimitOpen]=useState(false);
  const [limitText,setLimitText]=useState('');
  const [limitError,setLimitError]=useState('');
  const [amount,setAmount]=useState('');
  const [date,setDate]=useState(asOf);
  const [note,setNote]=useState('');
  const [category,setCategory]=useState(categories[0]?.name||data.state.settings.expenseCategories[0]||'Άλλο');
  const [subcategory,setSubcategory]=useState('');
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const purchaseRef=useModalFocus<HTMLElement>(purchaseOpen,'[data-autofocus="true"]',()=>setPurchaseOpen(false));
  const archiveRef=useModalFocus<HTMLElement>(archiveOpen,'[data-autofocus="true"]',()=>setArchiveOpen(false));
  const statementSetupRef=useModalFocus<HTMLElement>(statementSetupOpen,'[data-autofocus="true"]',()=>setStatementSetupOpen(false));

  const reset=()=>{setAmount('');setDate(asOf);setNote('');setError('')};
  const openPurchase=()=>{if(!card){setMessage('Πρόσθεσε ή επανάφερε πρώτα ενεργή πιστωτική κάρτα.');return}reset();setCategory(categories[0]?.name||'Άλλο');setSubcategory('');setPurchaseOpen(true)};
  const openRepay=()=>{if(!card)return;onPayCard(card.id,payableStatement?.id)};
  const openStatementSetup=()=>{if(!card)return;setStatementClosingText(card.statementClosingDay?String(card.statementClosingDay):'');setStatementDueText(card.statementDueDay?String(card.statementDueDay):'');setStatementSetupError('');setStatementSetupOpen(true)};
  const saveStatementSetup=()=>{
    if(!card)return;
    const closing=Number(statementClosingText);const due=Number(statementDueText);
    if(!Number.isInteger(closing)||closing<1||closing>31||!Number.isInteger(due)||due<1||due>31){setStatementSetupError('Η ημέρα κλεισίματος και η ημέρα πληρωμής πρέπει να είναι ακέραιοι από 1 έως 31.');return}
    onUpsertCard({...card,statementClosingDay:closing,statementDueDay:due,updatedAt:new Date().toISOString()});
    setStatementSetupOpen(false);
    setMessage(card.statementBoundaryRule?'Η ρύθμιση του κύκλου ενημερώθηκε. Τα ήδη αποθηκευμένα statements δεν ξαναγράφονται.':'Οι ημέρες του κύκλου αποθηκεύτηκαν. Η αυτόματη σύνδεση νέων αγορών θα ενεργοποιηθεί μόνο όταν κλειδωθεί ρητά ο κανόνας για αγορά ακριβώς στην ημέρα κλεισίματος.');
  };
  const closePurchase=()=>{setPurchaseOpen(false);setError('')};
  const requestDelete=(event:FinanceEvent)=>setDeleteEventTarget(event);
  const confirmDelete=()=>{if(!deleteEventTarget)return;onDeleteEvent(deleteEventTarget.id);setMessage(deleteEventTarget.kind==='card_payment'?'Η αποπληρωμή διαγράφηκε. Το υπόλοιπο του συνδεδεμένου statement υπολογίζεται ξανά από τις πραγματικές κινήσεις.':'Η αγορά διαγράφηκε. Το statement, όταν υπάρχει, υπολογίζεται ξανά χωρίς ιστορική επανεκχώρηση.');setDeleteEventTarget(null)};
  const archiveFromStack=(target:PaymentCard)=>{onArchiveCard(target);setMessage(`Η «${target.nickname}» αρχειοθετήθηκε. Το οικονομικό ιστορικό και τα ασφαλή στοιχεία παραμένουν συνδεδεμένα.`)};
  const restoreArchived=(target:PaymentCard)=>{const restored=restoreCard(target);onUpsertCard(restored);setSelectedCardId(restored.id);setMessage(`Η «${restored.nickname}» επανήλθε με το ίδιο ιστορικό και τα ασφαλή στοιχεία της.`)};
  const confirmCardDelete=async()=>{
    if(!deleteCardTarget)return;
    if(!canPermanentlyDeleteCreditCard(data,deleteCardTarget.id,asOf)){setMessage('Η ολική διαγραφή επιτρέπεται μόνο για αρχειοθετημένη και πλήρως εξοφλημένη πιστωτική.');setDeleteCardTarget(null);return}
    setDeleteCardBusy(true);setMessage('');
    try{
      const name=deleteCardTarget.nickname;
      await onDeleteCard(deleteCardTarget);
      setDeleteCardTarget(null);
      setMessage(`Η «${name}» διαγράφηκε οριστικά. Τα προστατευμένα στοιχεία αφαιρέθηκαν, ενώ οι ιστορικές κινήσεις και τα statements παραμένουν ως «Διαγραμμένη κάρτα».`);
    }catch(error){setMessage(cardVaultErrorMessage(error))}
    finally{setDeleteCardBusy(false)}
  };
  const submitPurchase=()=>{
    if(!card){setError('Δεν υπάρχει ενεργή επιλεγμένη πιστωτική κάρτα.');return}
    const numeric=Number(amount.replace(',','.'));if(!Number.isFinite(numeric)||numeric<=0){setError('Έλεγξε το ποσό της αγοράς — πρέπει να είναι μεγαλύτερο από μηδέν.');return}
    if(limit>0&&debt+numeric>limit+.005){setError(`Η αγορά ξεπερνά το διαθέσιμο όριο των ${money.format(available)}.`);return}
    try{const event=createEvent({kind:'card_purchase',date,amount:numeric,note:note.trim()||category,category});event.subcategory=subcategory||undefined;event.cardId=card.id;onCreateEvent(event);closePurchase()}
    catch(e){setError(userErrorMessage(e,'Δεν μπορέσαμε να καταχωρίσουμε την αγορά. Έλεγξε τα στοιχεία και δοκίμασε ξανά.'))}
  };
  const editLimit=()=>{if(!card)return;setLimitText(String(limit));setLimitError('');setLimitOpen(true)};
  const closeLimit=()=>{setLimitOpen(false);setLimitError('')};
  const saveLimit=()=>{
    if(!card)return;
    const numeric=Number(limitText.replace(',','.'));if(!Number.isFinite(numeric)||numeric<0){setLimitError('Έλεγξε το όριο — χρειάζεται αριθμός ίσος ή μεγαλύτερος από μηδέν.');return}
    onUpsertCard({...card,creditLimit:numeric,updatedAt:new Date().toISOString()});setMessage(`Το όριο της «${card.nickname}» ενημερώθηκε σε ${money.format(numeric)}.`);closeLimit()
  };
  const subs=subcategoriesFor(data.state.settings,'expense',category);
  const statementEventRows=(statementId:string)=>creditStatementEvents(data,statementId);

  return <div className="page-stack credit-card-redesign-page">
    <section className="page-heading">
      <div><span className="eyebrow">ΠΙΣΤΩΤΙΚΗ ΚΑΡΤΑ</span><h1>Πιστωτική Κάρτα</h1><p>Η κάρτα, το διαθέσιμο όριο και όλες οι πραγματικές κινήσεις της σε μία καθαρή εικόνα.</p></div>
      <div className="heading-actions">
        {archivedCredit.length?<button type="button" className="secondary" onClick={()=>setArchiveOpen(true)}><ArchiveRestore/> Αρχείο καρτών · {archivedCredit.length}</button>:null}
        <button type="button" className="secondary" disabled={!card||debt<=0||eligibleAccounts.length===0} onClick={openRepay}><ReceiptText/> Αποπληρωμή</button>
        <button type="button" className="save-button" disabled={!card} onClick={openPurchase}><CreditCard/> Νέα αγορά</button>
      </div>
    </section>

    {card&&bank?<section className="credit-card-stage neo-raised">
      <div className="credit-card-stage-card" data-card-view={cardDeckMode}>
        <div className="credit-card-view-controls" aria-label="Τρόπος προβολής πιστωτικών καρτών">
          <div className="credit-card-view-mode" role="group" aria-label="Εμφάνιση καρτών">
            <button type="button" className={cardDeckMode==='horizontal'?'active':''} aria-pressed={cardDeckMode==='horizontal'} onClick={()=>setCardDeckMode('horizontal')}>Οριζόντια</button>
            <button type="button" className={cardDeckMode==='stack'?'active':''} aria-pressed={cardDeckMode==='stack'} onClick={()=>setCardDeckMode('stack')}>Στοίβα</button>
          </div>
          {activeCredit.length>1&&cardDeckMode==='horizontal'?<div className="credit-card-horizontal-nav" role="group" aria-label="Εναλλαγή πιστωτικής κάρτας"><button type="button" aria-label="Προηγούμενη πιστωτική κάρτα" onClick={()=>selectRelativeCard(-1)}><ChevronLeft/></button><span>{selectedCardIndex+1} / {activeCredit.length}</span><button type="button" aria-label="Επόμενη πιστωτική κάρτα" onClick={()=>selectRelativeCard(1)}><ChevronRight/></button></div>:null}
        </div>
        <CanonicalCreditCardStack cards={activeCredit} banks={banks} selectedCardId={card.id} onActiveCardChange={setSelectedCardId} onArchiveCard={archiveFromStack}/>
      </div>
      <div className="credit-card-stage-stats">
        <div><span>Χρησιμοποιημένο</span><b><AnimatedAmount value={debt}/></b><small>Πραγματική οφειλή της επιλεγμένης κάρτας.</small></div>
        <div><span>Διαθέσιμο</span><b><AnimatedAmount value={available}/></b><small>Συνολικό όριο {money.format(limit)} <Tooltip label="Αλλαγή ορίου πιστωτικής" side="top"><button type="button" className="inline-icon-action" aria-label="Αλλαγή ορίου πιστωτικής" onClick={editLimit}><Pencil/></button></Tooltip></small></div>
        <div><span>Χρήση ορίου</span><b className={overLimit?'negative':''}>{Math.round(usage)}%</b><div className={`credit-usage ${overLimit?'over-limit':''}`.trim()} role="progressbar" aria-label="Χρήση πιστωτικού ορίου" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(usageBar)} aria-valuetext={`${Math.round(usage)}% χρήση πιστωτικού ορίου${overLimit?' — υπέρβαση ορίου':''}`}><i style={{width:`${usageBar}%`}}/></div>{overLimit?<small className="negative">Υπέρβαση ορίου κατά {money.format(overLimitAmount)}</small>:null}</div>
        <div className="credit-card-next-payment"><span>Επόμενη πληρωμή</span><b>{primaryStatement?.remaining&&primaryStatement.remaining>.005?money.format(primaryStatement.remaining):debt>.005?money.format(debt):'—'}</b><small>{primaryStatement?`έως ${shortDate(primaryStatement.dueDate)}`:'Δεν υπάρχει ενεργό persisted statement.'}</small><button type="button" className="secondary" disabled={!card||debt<=0||eligibleAccounts.length===0} onClick={openRepay}>Αποπληρωμή</button></div>
        <button type="button" className="credit-cycle-link" onClick={openStatementSetup}>Ρύθμιση κύκλου <ChevronRight/></button>
      </div>
    </section>:<section className="credit-card-empty neo-raised"><CreditCard/><h2>Δεν υπάρχει ενεργή πιστωτική κάρτα</h2><p>{archivedCredit.length?'Οι αρχειοθετημένες πιστωτικές παραμένουν στο ξεχωριστό αρχείο και δεν εμφανίζονται στην ενεργή στοίβα.':'Πρόσθεσε πιστωτική κάρτα για να συνδέσεις αγορές, αποπληρωμές, όριο και προστατευμένα στοιχεία.'}</p><div className="credit-card-empty-actions"><button type="button" className="save-button" onClick={()=>setCreateOpen(true)}><Plus/> Προσθήκη πιστωτικής</button>{archivedCredit.length?<button type="button" className="secondary" onClick={()=>setArchiveOpen(true)}><ArchiveRestore/> Αρχείο καρτών</button>:null}</div></section>}

    {message?<div className="action-status" role="status" aria-live="polite">{message}</div>:null}

    <section className="panel neo-raised" data-credit-statements aria-labelledby="credit-statements-title">
      <div className="panel-head"><div><span id="credit-statements-title">Δηλώσεις πιστωτικής</span><small>{card?'Κύκλος, ημερομηνία πληρωμής, αγορές και πραγματικές αποπληρωμές της επιλεγμένης κάρτας.':'Επίλεξε ενεργή πιστωτική κάρτα.'}</small></div>{card?<button type="button" className="secondary" onClick={openStatementSetup}><Pencil/> Ρύθμιση κύκλου</button>:<ReceiptText/>}</div>
      {!card?<div className="empty-state">Δεν υπάρχει ενεργή πιστωτική για προβολή statements.</div>:!statementConfig?<div className="empty-state" data-statement-setup-required><b>Χρειάζεται πλήρης ρύθμιση κύκλου.</b><p>{card.statementClosingDay&&card.statementDueDay?'Οι ημέρες κλεισίματος και πληρωμής έχουν αποθηκευτεί, αλλά ο κανόνας για αγορά ακριβώς στην ημέρα κλεισίματος παραμένει σκόπιμα ανοικτός.':'Συμπλήρωσε ημέρα κλεισίματος και ημέρα πληρωμής. Η ακριβής μεταχείριση αγοράς στην ημέρα κλεισίματος δεν θα μαντευτεί.'}</p><button type="button" className="secondary" onClick={openStatementSetup}>Ρύθμιση κύκλου</button></div>:<>
        <div className="action-status" role="note"><b>Κύκλος:</b> κλείσιμο την ημέρα {statementConfig.closingDay} · πληρωμή την επόμενη διαθέσιμη ημέρα {statementConfig.dueDay}. <span>{boundaryLabel(card.statementBoundaryRule)}.</span></div>
        {primaryStatement?<article className="panel neo-flat" data-primary-credit-statement={primaryStatement.id}>
          <div className="panel-head"><div><span>{statementStatusLabel[primaryStatement.status]} · {shortDate(primaryStatement.closeDate)}</span><small>Περίοδος {shortDate(primaryStatement.openDate)} – {shortDate(primaryStatement.closeDate)} · Πληρωμή έως {shortDate(primaryStatement.dueDate)}</small></div>{primaryStatement.remaining>.005?<button type="button" className="save-button" onClick={()=>onPayCard(card.id,primaryStatement.id)}><ReceiptText/> Πληρωμή {money.format(primaryStatement.remaining)}</button>:<b>Εξοφλημένη</b>}</div>
          <div className="credit-card-stage-stats"><div><span>Αγορές δήλωσης</span><b>{money.format(primaryStatement.purchaseTotal)}</b></div><div><span>Πληρωμές</span><b>{money.format(primaryStatement.paymentTotal)}</b></div><div><span>Υπόλοιπο</span><b className={primaryStatement.remaining>.005?'negative':''}>{money.format(primaryStatement.remaining)}</b></div></div>
          <details><summary>Προβολή κινήσεων δήλωσης · {primaryStatement.purchaseIds.length} αγορές / {primaryStatement.paymentIds.length} πληρωμές</summary><div className="semantic-table-wrap"><table className="semantic-table"><caption className="sr-only">Κινήσεις κύριας δήλωσης πιστωτικής</caption><thead><tr><th>Ημερομηνία</th><th>Τύπος</th><th>Περιγραφή</th><th className="amount">Ποσό</th></tr></thead><tbody>{statementEventRows(primaryStatement.id).map(event=><tr key={event.id}><td>{shortDate(event.date)}</td><td>{event.kind==='card_purchase'?'Αγορά':'Αποπληρωμή'}</td><td>{event.note||'—'}</td><td className={`amount ${event.kind==='card_purchase'?'negative':''}`.trim()}>{money.format(event.amount)}</td></tr>)}</tbody></table></div></details>
        </article>:<div className="empty-inline">Δεν υπάρχει ακόμη persisted statement. Οι νέες αγορές μπορούν να συνδεθούν μόνο επειδή η κάρτα έχει πλήρη, ρητή ρύθμιση κύκλου.</div>}
        {statements.length>1?<details className="panel neo-flat" data-statement-history><summary>Ιστορικό δηλώσεων · {statements.length}</summary>{statements.filter(item=>item.id!==primaryStatement?.id).map(statement=><article key={statement.id} className="panel neo-flat"><div className="panel-head"><div><span>{statementStatusLabel[statement.status]} · {shortDate(statement.closeDate)}</span><small>{shortDate(statement.openDate)} – {shortDate(statement.closeDate)} · πληρωμή έως {shortDate(statement.dueDate)}</small></div><b>{money.format(statement.remaining)}</b></div><details><summary>Κινήσεις · {statement.purchaseIds.length+statement.paymentIds.length}</summary><div className="semantic-table-wrap"><table className="semantic-table"><tbody>{statementEventRows(statement.id).map(event=><tr key={event.id}><td>{shortDate(event.date)}</td><td>{event.kind==='card_purchase'?'Αγορά':'Αποπληρωμή'}</td><td>{event.note||'—'}</td><td className="amount">{money.format(event.amount)}</td></tr>)}</tbody></table></div></details></article>)}</details>:null}
      </>}
      {card&&unlinkedStatementEvents.length?<div className="action-status" role="note" data-unlinked-credit-history><b>{unlinkedStatementEvents.length} παλιές κινήσεις χωρίς statement σύνδεση.</b> Παραμένουν οικονομικά έγκυρες και δεν επανεκχωρούνται αυτόματα με σημερινές ρυθμίσεις.</div>:null}
    </section>

    <section className="panel neo-raised"><div className="panel-head"><div><span>Αγορές πιστωτικής</span><small>{card?`Αναλυτικό ιστορικό μόνο για «${card.nickname}».`:'Επίλεξε ενεργή πιστωτική κάρτα.'}</small></div><div className="panel-head-actions"><SortDirectionControl value={purchaseSortDirection} onChange={setPurchaseSortDirection} label="Σειρά αγορών πιστωτικής ανά ημερομηνία"/><WalletCards/></div></div>{purchases.length?<div className="semantic-table-wrap"><table className="semantic-table credit-purchases-table"><caption className="sr-only">Αγορές με πιστωτική κάρτα</caption><thead><tr><th aria-sort={purchaseSortDirection==='asc'?'ascending':'descending'}>Ημερομηνία</th><th>Περιγραφή</th><th>Κατηγορία</th><th className="amount">Ποσό</th><th className="actions">Ενέργειες</th></tr></thead><tbody>{purchases.map(event=><tr key={event.id}><td>{shortDate(event.date)}</td><td><b>{event.note}</b></td><td>{categoryPath(event.category,event.subcategory)}</td><td className="amount negative">{money.format(event.amount)}</td><td className="actions"><span className="row-actions"><Tooltip label={`Επεξεργασία ${event.note}`} side="left"><button type="button" aria-label={`Επεξεργασία ${event.note}`} onClick={()=>onEditEvent(event.id)}><Pencil/></button></Tooltip><Tooltip label={`Διαγραφή ${event.note}`} side="left"><button type="button" className="danger" aria-label={`Διαγραφή ${event.note}`} onClick={()=>requestDelete(event)}><Trash2/></button></Tooltip></span></td></tr>)}</tbody></table></div>:<div className="empty-state">Δεν υπάρχουν ακόμη αγορές για την επιλεγμένη πιστωτική.</div>}</section>

    <section className="panel neo-raised"><div className="panel-head"><div><span>Αποπληρωμές πιστωτικής</span><small>Μειώνουν μόνο την οφειλή της επιλεγμένης κάρτας και τον λογαριασμό πληρωμής, χωρίς δεύτερο έξοδο.</small></div><div className="panel-head-actions"><SortDirectionControl value={paymentSortDirection} onChange={setPaymentSortDirection} label="Σειρά αποπληρωμών πιστωτικής ανά ημερομηνία"/><ReceiptText/></div></div>{payments.length?<div className="semantic-table-wrap"><table className="semantic-table credit-payments-table"><caption className="sr-only">Αποπληρωμές πιστωτικής κάρτας</caption><thead><tr><th aria-sort={paymentSortDirection==='asc'?'ascending':'descending'}>Ημερομηνία</th><th>Από λογαριασμό</th><th>Statement</th><th className="amount">Ποσό</th><th className="actions">Ενέργειες</th></tr></thead><tbody>{payments.map(event=><tr key={event.id}><td>{shortDate(event.date)}</td><td>{event.fromAccountId?accountDisplayName(data,event.fromAccountId):'—'}</td><td>{event.statementId?shortDate((data.state.creditStatements??[]).find(item=>item.id===event.statementId)?.closeDate??event.date):'Χωρίς σύνδεση'}</td><td className="amount">{money.format(event.amount)}</td><td className="actions"><span className="row-actions"><Tooltip label={`Διαγραφή αποπληρωμής ${shortDate(event.date)}`} side="left"><button type="button" className="danger" aria-label={`Διαγραφή αποπληρωμής ${shortDate(event.date)}`} onClick={()=>requestDelete(event)}><Trash2/></button></Tooltip></span></td></tr>)}</tbody></table></div>:<div className="empty-inline">Δεν υπάρχουν ακόμη αποπληρωμές για την επιλεγμένη πιστωτική.</div>}</section>

    {deletedHistory.length?<section className="panel neo-raised deleted-credit-history" aria-labelledby="deleted-credit-history-title"><div className="panel-head"><div><span id="deleted-credit-history-title">Ιστορικό διαγραμμένων πιστωτικών</span><small>Read-only οικονομικό ιστορικό και δηλώσεις με ουδέτερη ταυτότητα. Δεν διατηρούνται nickname, τράπεζα, last4 ή προστατευμένα στοιχεία.</small></div><ArchiveRestore/></div>{deletedHistory.map(({reference,events,statements:deletedStatements})=><article className="deleted-credit-history-card" key={reference.id}><div className="panel-head"><div><span>Διαγραμμένη κάρτα</span><small>Διαγράφηκε {shortDate(reference.deletedAt.slice(0,10))} · {deletedStatements.length} {deletedStatements.length===1?'δήλωση':'δηλώσεις'} · {events.length} {events.length===1?'κίνηση':'κινήσεις'}</small></div></div>{deletedStatements.length?<div data-deleted-statement-history>{deletedStatements.map(statement=><details key={statement.id} className="panel neo-flat"><summary>{statementStatusLabel[statement.status]} · έκλεισε {shortDate(statement.closeDate)} · υπόλοιπο {money.format(statement.remaining)}</summary><div className="semantic-table-wrap"><table className="semantic-table"><caption className="sr-only">Ιστορική δήλωση διαγραμμένης πιστωτικής</caption><thead><tr><th>Ημερομηνία</th><th>Τύπος</th><th>Περιγραφή</th><th className="amount">Ποσό</th></tr></thead><tbody>{statementEventRows(statement.id).map(event=><tr key={event.id}><td>{shortDate(event.date)}</td><td>{event.kind==='card_purchase'?'Αγορά':'Αποπληρωμή'}</td><td>{event.note||'—'}</td><td className="amount">{money.format(event.amount)}</td></tr>)}</tbody></table></div></details>)}</div>:null}<details><summary>Όλες οι διατηρημένες κινήσεις · {events.length}</summary><div className="semantic-table-wrap"><table className="semantic-table"><caption className="sr-only">Ιστορικές κινήσεις διαγραμμένης πιστωτικής κάρτας</caption><thead><tr><th>Ημερομηνία</th><th>Τύπος</th><th>Περιγραφή</th><th className="amount">Ποσό</th></tr></thead><tbody>{events.map(event=><tr key={event.id}><td>{shortDate(event.date)}</td><td>{event.kind==='card_purchase'?'Αγορά':'Αποπληρωμή'}</td><td>{event.note||'—'}</td><td className={`amount ${event.kind==='card_purchase'?'negative':''}`.trim()}>{money.format(event.amount)}</td></tr>)}</tbody></table></div></details></article>)}</section>:null}

    <CardCreateDialog open={createOpen} data={data} banks={banks} initialBankId={card?.bankId??archivedCredit[0]?.bankId??'piraeus'} kindLock="credit" onClose={()=>setCreateOpen(false)} onSave={newCard=>{const withLimit={...newCard,creditLimit:newCard.creditLimit??data.state.settings.creditLimit??0};onUpsertCard(withLimit);setSelectedCardId(withLimit.id);setMessage('Η πιστωτική δημιουργήθηκε και προστέθηκε στην ενεργή στοίβα. Ρύθμισε τον κύκλο δήλωσης πριν ενεργοποιηθεί statement σύνδεση.')}}/>

    {archiveOpen?<div className="picker-backdrop open" aria-hidden="false" onMouseDown={()=>setArchiveOpen(false)}><section ref={archiveRef} className="picker compact neo-raised card-archive-manager" role="dialog" aria-modal="true" aria-labelledby="credit-archive-title" tabIndex={-1} onMouseDown={event=>event.stopPropagation()}><div className="picker-head"><div><h2 id="credit-archive-title">Αρχείο πιστωτικών καρτών</h2><p>Οι κάρτες εδώ δεν εμφανίζονται στην ενεργή στοίβα. Η επαναφορά διατηρεί το ίδιο ιστορικό, statements και προστατευμένα στοιχεία.</p></div><button type="button" className="close-picker" aria-label="Κλείσιμο αρχείου καρτών" onClick={()=>setArchiveOpen(false)}>×</button></div><div className="card-archive-list">{archivedCredit.map((archived,index)=>{const archivedBank=banks.find(item=>item.id===archived.bankId);const archivedDebt=creditDebtForCard(data,archived.id,asOf);const archivedStatements=creditStatementViews(data,archived.id,asOf);const canDelete=canPermanentlyDeleteCreditCard(data,archived.id,asOf);return <article className="card-archive-row" key={archived.id}><div className="card-archive-identity"><b>{archived.nickname}</b><small>{archivedBank?.name??archived.bankId}{archived.last4?` · •••• ${archived.last4}`:''} · Οφειλή {money.format(archivedDebt)} · Statements {archivedStatements.length}</small></div><div className="card-archive-actions"><button data-autofocus={index===0?'true':undefined} type="button" className="save-button" onClick={()=>restoreArchived(archived)}><ArchiveRestore/> Επαναφορά</button><button type="button" className="danger" disabled={!canDelete} aria-disabled={!canDelete} title={canDelete?'Οριστική διαγραφή πιστωτικής':'Η πιστωτική πρέπει να είναι αρχειοθετημένη και πλήρως εξοφλημένη.'} onClick={()=>{if(canDelete)setDeleteCardTarget(archived)}}><Trash2/> Ολική διαγραφή</button></div></article>})}</div><div className="card-archive-note" role="note">Η ολική διαγραφή ακολουθεί τον κανόνα A: επιτρέπεται μόνο σε αρχειοθετημένη πιστωτική με μηδενική οφειλή. Διαγράφει το card profile και όλα τα αποθηκευμένα μυστικά, αλλά κρατά τις ιστορικές αγορές/αποπληρωμές και τα persisted statements συνδεδεμένα σε ουδέτερη αναφορά «Διαγραμμένη κάρτα».</div></section></div>:null}

    {statementSetupOpen&&card?<div className="editor-backdrop" onMouseDown={()=>setStatementSetupOpen(false)}><section ref={statementSetupRef} className="panel neo-raised editor-dialog credit-dialog" role="dialog" aria-modal="true" aria-labelledby="credit-statement-setup-title" tabIndex={-1} onMouseDown={event=>event.stopPropagation()}><div className="panel-head"><div><span id="credit-statement-setup-title">Ρύθμιση κύκλου · {card.nickname}</span><small>Οι ρυθμίσεις εφαρμόζονται σε νέες statement συνδέσεις. Δεν ξαναγράφουν ή επανεκχωρούν παλιές κινήσεις.</small></div><button type="button" className="icon-button" aria-label="Κλείσιμο ρύθμισης κύκλου" onClick={()=>setStatementSetupOpen(false)}><X/></button></div><div className="settings-form editor-grid"><label><span>Ημέρα κλεισίματος</span><input data-autofocus="true" inputMode="numeric" type="number" min="1" max="31" value={statementClosingText} onChange={event=>setStatementClosingText(event.target.value)}/></label><label><span>Ημέρα πληρωμής</span><input inputMode="numeric" type="number" min="1" max="31" value={statementDueText} onChange={event=>setStatementDueText(event.target.value)}/></label><div className="wide" role="note"><span>Αγορά ακριβώς στην ημέρα κλεισίματος</span><b>{boundaryLabel(card.statementBoundaryRule)}</b><p>Αυτό το πεδίο δεν αλλάζει από εδώ όσο η τελική σημασιολογική επιλογή παραμένει ανοικτή. Το MyFinHub δεν μαντεύει ιστορικά ή νέα όρια κύκλου.</p></div></div>{statementSetupError?<div className="form-error" role="alert">{statementSetupError}</div>:null}<div className="editor-actions"><button type="button" className="secondary" onClick={()=>setStatementSetupOpen(false)}>Ακύρωση</button><button type="button" className="save-button" onClick={saveStatementSetup}>Αποθήκευση ημερών</button></div></section></div>:null}

    {purchaseOpen?<div className="editor-backdrop" onMouseDown={closePurchase}><section ref={purchaseRef} className="panel neo-raised editor-dialog credit-dialog" role="dialog" aria-modal="true" aria-labelledby="credit-purchase-title" tabIndex={-1} onMouseDown={e=>e.stopPropagation()}><div className="panel-head"><div><span id="credit-purchase-title">Νέα αγορά · {card?.nickname??'Πιστωτική'}</span><small>Η αγορά αυξάνει μόνο την οφειλή της επιλεγμένης κάρτας και μετρά μία φορά ως έξοδο. Statement σύνδεση γίνεται μόνο όταν υπάρχει πλήρης, ρητή ρύθμιση κύκλου.</small></div><button type="button" className="icon-button" aria-label="Κλείσιμο αγοράς πιστωτικής" onClick={closePurchase}><X/></button></div><div className="settings-form editor-grid"><label><span>Ποσό</span><MoneyInput data-autofocus="true" value={amount} onValueChange={setAmount} invalid={Boolean(error)}/></label><label><span>Ημερομηνία</span><AppDateInput value={date} onChange={e=>setDate(e.target.value)}/></label><label><span>Κατηγορία</span><AppSelectInput value={category} onChange={e=>{setCategory(e.target.value);setSubcategory('')}}>{categories.map(item=><option key={item.name}>{item.name}</option>)}</AppSelectInput></label>{subs.length?<label><span>Υποκατηγορία</span><AppSelectInput value={subcategory} onChange={e=>setSubcategory(e.target.value)}><option value="">Χωρίς υποκατηγορία</option>{subs.map(value=><option key={value}>{value}</option>)}</AppSelectInput></label>:null}<label className="wide"><span>Περιγραφή</span><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Τι αγόρασες;"/></label></div>{error?<div className="form-error" role="alert">{error}</div>:null}<div className="editor-actions"><button type="button" className="secondary" onClick={closePurchase}>Ακύρωση</button><button type="button" className="save-button" onClick={submitPurchase}>Καταχώριση αγοράς</button></div></section></div>:null}

    <MoneyEditDialog open={limitOpen} title={card?`Όριο · ${card.nickname}`:'Όριο πιστωτικής'} description="Το όριο επηρεάζει μόνο τη διαθέσιμη πίστωση και τις προειδοποιήσεις υπέρβασης. Δεν δημιουργεί οικονομική κίνηση." label="Πιστωτικό όριο" value={limitText} error={limitError} motionMode={data.state.settings.motion} onValueChange={value=>{setLimitText(value);if(limitError)setLimitError('')}} onConfirm={saveLimit} onCancel={closeLimit}/>
    <ConfirmDialog open={Boolean(deleteEventTarget)} title="Διαγραφή κίνησης πιστωτικής;" description={deleteEventTarget?.kind==='card_payment'?'Η αποπληρωμή θα αφαιρεθεί και η οφειλή της κάρτας και του συνδεδεμένου statement θα υπολογιστούν ξανά από τις υπόλοιπες κινήσεις.':'Η αγορά θα αφαιρεθεί από το οικονομικό ιστορικό και από το συνδεδεμένο statement, χωρίς επανεκχώρηση άλλων παλιών κινήσεων.'} confirmLabel="Διαγραφή" tone="destructive" motionMode={data.state.settings.motion} onConfirm={confirmDelete} onCancel={()=>setDeleteEventTarget(null)}/>
    <ConfirmDialog open={Boolean(deleteCardTarget)} title="Ολική διαγραφή πιστωτικής;" description="Η κάρτα είναι αρχειοθετημένη και έχει μηδενική οφειλή. Θα διαγραφούν οριστικά το card profile, PAN, λήξη και CVV. Οι παλιές αγορές, αποπληρωμές και δηλώσεις δεν θα διαγραφούν και θα εμφανίζονται με ουδέτερη αναφορά «Διαγραμμένη κάρτα»." confirmLabel="Ολική διαγραφή" tone="destructive" busy={deleteCardBusy} motionMode={data.state.settings.motion} onConfirm={()=>void confirmCardDelete()} onCancel={()=>{if(!deleteCardBusy)setDeleteCardTarget(null)}}/>
  </div>;
}
