import { ArchiveRestore, CreditCard, Pencil, Plus, ReceiptText, Trash2, WalletCards, X } from 'lucide-react';
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
import { cardBanks, creditCards, creditDebtForCard, creditEventsForCard, creditLimitForCard, restoreCard } from '../lib/cards';
import { cardVaultErrorMessage } from '../lib/cardVaultClient';
import { categoryPath, genericCategoryTree, subcategoriesFor } from '../lib/categories';
import { allAccounts, createEvent } from '../lib/domain';
import { money, shortDate } from '../lib/format';
import { accountDisplayName } from '../lib/ui';
import { userErrorMessage } from '../lib/userMessage';
import type { FinanceData, FinanceEvent, PaymentCard } from '../types';

export function CreditCardPage({
  data,asOf,onCreateEvent,onEditEvent,onDeleteEvent,onUpsertCard,onArchiveCard,onDeleteCard,onPayCard,
}:{
  data:FinanceData;asOf:string;
  onCreateEvent:(event:FinanceEvent)=>void;onEditEvent:(id:string)=>void;onDeleteEvent:(id:string)=>void;
  onUpsertCard:(card:PaymentCard)=>void;onArchiveCard:(card:PaymentCard)=>void;onDeleteCard:(card:PaymentCard)=>Promise<void>;onPayCard:(cardId:string)=>void;
}){
  const banks=useMemo(()=>cardBanks(data),[data]);
  const allCredit=useMemo(()=>creditCards(data,{includeArchived:true}),[data]);
  const activeCredit=useMemo(()=>allCredit.filter(card=>card.active!==false),[allCredit]);
  const archivedCredit=useMemo(()=>allCredit.filter(card=>card.active===false),[allCredit]);
  const [selectedCardId,setSelectedCardId]=useState('');
  const [purchaseSortDirection,setPurchaseSortDirection]=useState<SortDirection>('desc');
  const [paymentSortDirection,setPaymentSortDirection]=useState<SortDirection>('desc');
  useEffect(()=>{
    if(selectedCardId&&activeCredit.some(card=>card.id===selectedCardId))return;
    setSelectedCardId(activeCredit[0]?.id??'');
  },[selectedCardId,activeCredit]);
  const card=activeCredit.find(item=>item.id===selectedCardId)??activeCredit[0];
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
  const bankPrefix=card?.bankId??'';
  const eligibleAccounts=allAccounts(data).filter(account=>account.kind!=='credit'&&Boolean(bankPrefix)&&account.id.startsWith(`${bankPrefix}-`));
  const categories=genericCategoryTree(data.state.settings,'expense');
  const [createOpen,setCreateOpen]=useState(false);
  const [purchaseOpen,setPurchaseOpen]=useState(false);
  const [archiveOpen,setArchiveOpen]=useState(false);
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

  const reset=()=>{setAmount('');setDate(asOf);setNote('');setError('')};
  const openPurchase=()=>{if(!card){setMessage('Πρόσθεσε ή επανάφερε πρώτα ενεργή πιστωτική κάρτα.');return}reset();setCategory(categories[0]?.name||'Άλλο');setSubcategory('');setPurchaseOpen(true)};
  const openRepay=()=>{if(!card)return;onPayCard(card.id)};
  const closePurchase=()=>{setPurchaseOpen(false);setError('')};
  const requestDelete=(event:FinanceEvent)=>setDeleteEventTarget(event);
  const confirmDelete=()=>{if(!deleteEventTarget)return;onDeleteEvent(deleteEventTarget.id);setMessage(deleteEventTarget.kind==='card_payment'?'Η αποπληρωμή διαγράφηκε.':'Η αγορά διαγράφηκε.');setDeleteEventTarget(null)};
  const archiveFromStack=(target:PaymentCard)=>{onArchiveCard(target);setMessage(`Η «${target.nickname}» αρχειοθετήθηκε. Το οικονομικό ιστορικό και τα ασφαλή στοιχεία παραμένουν συνδεδεμένα.`)};
  const restoreArchived=(target:PaymentCard)=>{const restored=restoreCard(target);onUpsertCard(restored);setSelectedCardId(restored.id);setMessage(`Η «${restored.nickname}» επανήλθε με το ίδιο ιστορικό και τα ασφαλή στοιχεία της.`)};
  const confirmCardDelete=async()=>{
    if(!deleteCardTarget)return;
    if(creditDebtForCard(data,deleteCardTarget.id,asOf)>.005){setMessage('Η ολική διαγραφή επιτρέπεται μόνο αφού εξοφληθεί πλήρως η πιστωτική.');setDeleteCardTarget(null);return}
    setDeleteCardBusy(true);setMessage('');
    try{
      const name=deleteCardTarget.nickname;
      await onDeleteCard(deleteCardTarget);
      setDeleteCardTarget(null);
      setMessage(`Η «${name}» διαγράφηκε οριστικά. Τα προστατευμένα στοιχεία αφαιρέθηκαν, ενώ οι ιστορικές κινήσεις παραμένουν ως «Διαγραμμένη κάρτα».`);
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

  return <div className="page-stack credit-card-redesign-page">
    <section className="page-heading">
      <div><span className="eyebrow">ΠΙΣΤΩΤΙΚΗ ΚΑΡΤΑ</span><h1>Πιστωτική Κάρτα</h1><p>Μόνο οι πιστωτικές κάρτες έχουν αγορές, αποπληρωμές, όρια και οικονομικό ιστορικό. Οι αρχειοθετημένες πιστωτικές μένουν εκτός της καθημερινής στοίβας.</p></div>
      <div className="heading-actions">
        {archivedCredit.length?<button type="button" className="secondary" onClick={()=>setArchiveOpen(true)}><ArchiveRestore/> Αρχείο καρτών · {archivedCredit.length}</button>:null}
        <button type="button" className="secondary" disabled={!card||debt<=0||eligibleAccounts.length===0} onClick={openRepay}><ReceiptText/> Αποπληρωμή</button>
        <button type="button" className="save-button" disabled={!card} onClick={openPurchase}><CreditCard/> Νέα αγορά</button>
      </div>
    </section>

    {card&&bank?<section className="credit-card-stage neo-raised">
      <div className="credit-card-stage-card">
        <CanonicalCreditCardStack cards={activeCredit} banks={banks} selectedCardId={card.id} onActiveCardChange={setSelectedCardId} onArchiveCard={archiveFromStack}/>
      </div>
      <div className="credit-card-stage-stats">
        <div><span>Οφειλή</span><b><AnimatedAmount value={debt}/></b><small>Μόνο για τη συγκεκριμένη κάρτα.</small></div>
        <div><span>Διαθέσιμο</span><b><AnimatedAmount value={available}/></b><small>Όριο {money.format(limit)} <Tooltip label="Αλλαγή ορίου πιστωτικής" side="top"><button type="button" className="inline-icon-action" aria-label="Αλλαγή ορίου πιστωτικής" onClick={editLimit}><Pencil/></button></Tooltip></small></div>
        <div><span>Χρήση ορίου</span><b className={overLimit?'negative':''}>{Math.round(usage)}%</b><div className={`credit-usage ${overLimit?'over-limit':''}`.trim()} role="progressbar" aria-label="Χρήση πιστωτικού ορίου" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(usageBar)} aria-valuetext={`${Math.round(usage)}% χρήση πιστωτικού ορίου${overLimit?' — υπέρβαση ορίου':''}`}><i style={{width:`${usageBar}%`}}/></div>{overLimit?<small className="negative">Υπέρβαση ορίου κατά {money.format(overLimitAmount)}</small>:null}</div>
      </div>
    </section>:<section className="credit-card-empty neo-raised"><CreditCard/><h2>Δεν υπάρχει ενεργή πιστωτική κάρτα</h2><p>{archivedCredit.length?'Οι αρχειοθετημένες πιστωτικές παραμένουν στο ξεχωριστό αρχείο και δεν εμφανίζονται στην ενεργή στοίβα.':'Πρόσθεσε πιστωτική κάρτα για να συνδέσεις αγορές, αποπληρωμές, όριο και προστατευμένα στοιχεία.'}</p><div className="credit-card-empty-actions"><button type="button" className="save-button" onClick={()=>setCreateOpen(true)}><Plus/> Προσθήκη πιστωτικής</button>{archivedCredit.length?<button type="button" className="secondary" onClick={()=>setArchiveOpen(true)}><ArchiveRestore/> Αρχείο καρτών</button>:null}</div></section>}

    {message?<div className="action-status" role="status" aria-live="polite">{message}</div>:null}

    <section className="panel neo-raised"><div className="panel-head"><div><span>Αγορές πιστωτικής</span><small>{card?`Ιστορικό μόνο για «${card.nickname}».`:'Επίλεξε ενεργή πιστωτική κάρτα.'}</small></div><div className="panel-head-actions"><SortDirectionControl value={purchaseSortDirection} onChange={setPurchaseSortDirection} label="Σειρά αγορών πιστωτικής ανά ημερομηνία"/><WalletCards/></div></div>{purchases.length?<div className="semantic-table-wrap"><table className="semantic-table credit-purchases-table"><caption className="sr-only">Αγορές με πιστωτική κάρτα</caption><thead><tr><th aria-sort={purchaseSortDirection==='asc'?'ascending':'descending'}>Ημερομηνία</th><th>Περιγραφή</th><th>Κατηγορία</th><th className="amount">Ποσό</th><th className="actions">Ενέργειες</th></tr></thead><tbody>{purchases.map(event=><tr key={event.id}><td>{shortDate(event.date)}</td><td><b>{event.note}</b></td><td>{categoryPath(event.category,event.subcategory)}</td><td className="amount negative">{money.format(event.amount)}</td><td className="actions"><span className="row-actions"><Tooltip label={`Επεξεργασία ${event.note}`} side="left"><button type="button" aria-label={`Επεξεργασία ${event.note}`} onClick={()=>onEditEvent(event.id)}><Pencil/></button></Tooltip><Tooltip label={`Διαγραφή ${event.note}`} side="left"><button type="button" className="danger" aria-label={`Διαγραφή ${event.note}`} onClick={()=>requestDelete(event)}><Trash2/></button></Tooltip></span></td></tr>)}</tbody></table></div>:<div className="empty-state">Δεν υπάρχουν ακόμη αγορές για την επιλεγμένη πιστωτική.</div>}</section>

    <section className="panel neo-raised"><div className="panel-head"><div><span>Αποπληρωμές πιστωτικής</span><small>Μειώνουν μόνο την οφειλή της επιλεγμένης κάρτας και τον λογαριασμό πληρωμής, χωρίς δεύτερο έξοδο.</small></div><div className="panel-head-actions"><SortDirectionControl value={paymentSortDirection} onChange={setPaymentSortDirection} label="Σειρά αποπληρωμών πιστωτικής ανά ημερομηνία"/><ReceiptText/></div></div>{payments.length?<div className="semantic-table-wrap"><table className="semantic-table credit-payments-table"><caption className="sr-only">Αποπληρωμές πιστωτικής κάρτας</caption><thead><tr><th aria-sort={paymentSortDirection==='asc'?'ascending':'descending'}>Ημερομηνία</th><th>Από λογαριασμό</th><th className="amount">Ποσό</th><th className="actions">Ενέργειες</th></tr></thead><tbody>{payments.map(event=><tr key={event.id}><td>{shortDate(event.date)}</td><td>{event.fromAccountId?accountDisplayName(data,event.fromAccountId):'—'}</td><td className="amount">{money.format(event.amount)}</td><td className="actions"><span className="row-actions"><Tooltip label={`Διαγραφή αποπληρωμής ${shortDate(event.date)}`} side="left"><button type="button" className="danger" aria-label={`Διαγραφή αποπληρωμής ${shortDate(event.date)}`} onClick={()=>requestDelete(event)}><Trash2/></button></Tooltip></span></td></tr>)}</tbody></table></div>:<div className="empty-inline">Δεν υπάρχουν ακόμη αποπληρωμές για την επιλεγμένη πιστωτική.</div>}</section>

    <CardCreateDialog open={createOpen} data={data} banks={banks} initialBankId={card?.bankId??archivedCredit[0]?.bankId??'piraeus'} kindLock="credit" onClose={()=>setCreateOpen(false)} onSave={newCard=>{const withLimit={...newCard,creditLimit:newCard.creditLimit??data.state.settings.creditLimit??0};onUpsertCard(withLimit);setSelectedCardId(withLimit.id);setMessage('Η πιστωτική δημιουργήθηκε και προστέθηκε στην ενεργή στοίβα.')}}/>

    {archiveOpen?<div className="picker-backdrop open" aria-hidden="false" onMouseDown={()=>setArchiveOpen(false)}><section ref={archiveRef} className="picker compact neo-raised card-archive-manager" role="dialog" aria-modal="true" aria-labelledby="credit-archive-title" tabIndex={-1} onMouseDown={event=>event.stopPropagation()}><div className="picker-head"><div><h2 id="credit-archive-title">Αρχείο πιστωτικών καρτών</h2><p>Οι κάρτες εδώ δεν εμφανίζονται στην ενεργή στοίβα. Η επαναφορά διατηρεί το ίδιο ιστορικό και τα ίδια προστατευμένα στοιχεία.</p></div><button type="button" className="close-picker" aria-label="Κλείσιμο αρχείου καρτών" onClick={()=>setArchiveOpen(false)}>×</button></div><div className="card-archive-list">{archivedCredit.map((archived,index)=>{const archivedBank=banks.find(item=>item.id===archived.bankId);const archivedDebt=creditDebtForCard(data,archived.id,asOf);const canDelete=archivedDebt<=.005;return <article className="card-archive-row" key={archived.id}><div className="card-archive-identity"><b>{archived.nickname}</b><small>{archivedBank?.name??archived.bankId}{archived.last4?` · •••• ${archived.last4}`:''} · Οφειλή {money.format(archivedDebt)}</small></div><div className="card-archive-actions"><button data-autofocus={index===0?'true':undefined} type="button" className="save-button" onClick={()=>restoreArchived(archived)}><ArchiveRestore/> Επαναφορά</button><button type="button" className="danger" disabled={!canDelete} aria-disabled={!canDelete} title={canDelete?'Οριστική διαγραφή πιστωτικής':'Η πιστωτική πρέπει πρώτα να εξοφληθεί πλήρως.'} onClick={()=>{if(canDelete)setDeleteCardTarget(archived)}}><Trash2/> Ολική διαγραφή</button></div></article>})}</div><div className="card-archive-note" role="note">Η ολική διαγραφή ακολουθεί τον κανόνα A: επιτρέπεται μόνο με μηδενική οφειλή. Διαγράφει το card profile και όλα τα αποθηκευμένα μυστικά, αλλά κρατά τις ιστορικές αγορές/αποπληρωμές συνδεδεμένες σε ουδέτερη αναφορά «Διαγραμμένη κάρτα».</div></section></div>:null}

    {purchaseOpen?<div className="editor-backdrop" onMouseDown={closePurchase}><section ref={purchaseRef} className="panel neo-raised editor-dialog credit-dialog" role="dialog" aria-modal="true" aria-labelledby="credit-purchase-title" tabIndex={-1} onMouseDown={e=>e.stopPropagation()}><div className="panel-head"><div><span id="credit-purchase-title">Νέα αγορά · {card?.nickname??'Πιστωτική'}</span><small>Η αγορά αυξάνει μόνο την οφειλή της επιλεγμένης κάρτας, μετρά μία φορά ως έξοδο και συνδέεται με τη συγκεκριμένη κάρτα.</small></div><button type="button" className="icon-button" aria-label="Κλείσιμο αγοράς πιστωτικής" onClick={closePurchase}><X/></button></div><div className="settings-form editor-grid"><label><span>Ποσό</span><MoneyInput data-autofocus="true" value={amount} onValueChange={setAmount} invalid={Boolean(error)}/></label><label><span>Ημερομηνία</span><AppDateInput value={date} onChange={e=>setDate(e.target.value)}/></label><label><span>Κατηγορία</span><AppSelectInput value={category} onChange={e=>{setCategory(e.target.value);setSubcategory('')}}>{categories.map(item=><option key={item.name}>{item.name}</option>)}</AppSelectInput></label>{subs.length?<label><span>Υποκατηγορία</span><AppSelectInput value={subcategory} onChange={e=>setSubcategory(e.target.value)}><option value="">Χωρίς υποκατηγορία</option>{subs.map(value=><option key={value}>{value}</option>)}</AppSelectInput></label>:null}<label className="wide"><span>Περιγραφή</span><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Τι αγόρασες;"/></label></div>{error?<div className="form-error" role="alert">{error}</div>:null}<div className="editor-actions"><button type="button" className="secondary" onClick={closePurchase}>Ακύρωση</button><button type="button" className="save-button" onClick={submitPurchase}>Καταχώριση αγοράς</button></div></section></div>:null}

    <MoneyEditDialog open={limitOpen} title={card?`Όριο · ${card.nickname}`:'Όριο πιστωτικής'} description="Το όριο επηρεάζει μόνο τη διαθέσιμη πίστωση και τις προειδοποιήσεις υπέρβασης. Δεν δημιουργεί οικονομική κίνηση." label="Πιστωτικό όριο" value={limitText} error={limitError} motionMode={data.state.settings.motion} onValueChange={value=>{setLimitText(value);if(limitError)setLimitError('')}} onConfirm={saveLimit} onCancel={closeLimit}/>
    <ConfirmDialog open={Boolean(deleteEventTarget)} title="Διαγραφή κίνησης πιστωτικής;" description={deleteEventTarget?.kind==='card_payment'?'Η αποπληρωμή θα αφαιρεθεί και η οφειλή της κάρτας θα υπολογιστεί ξανά από τις υπόλοιπες κινήσεις.':'Η αγορά θα αφαιρεθεί από το οικονομικό ιστορικό της κάρτας και από τα σχετικά σύνολα.'} confirmLabel="Διαγραφή" tone="destructive" motionMode={data.state.settings.motion} onConfirm={confirmDelete} onCancel={()=>setDeleteEventTarget(null)}/>
    <ConfirmDialog open={Boolean(deleteCardTarget)} title="Ολική διαγραφή πιστωτικής;" description="Η κάρτα έχει μηδενική οφειλή. Θα διαγραφούν οριστικά το card profile, PAN, λήξη και CVV. Οι παλιές αγορές και αποπληρωμές δεν θα διαγραφούν και θα εμφανίζονται με ουδέτερη αναφορά «Διαγραμμένη κάρτα»." confirmLabel="Ολική διαγραφή" tone="destructive" busy={deleteCardBusy} motionMode={data.state.settings.motion} onConfirm={()=>void confirmCardDelete()} onCancel={()=>{if(!deleteCardBusy)setDeleteCardTarget(null)}}/>
  </div>;
}
