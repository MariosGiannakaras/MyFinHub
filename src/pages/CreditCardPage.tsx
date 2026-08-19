import { ArchiveRestore, CreditCard, Pencil, Plus, ReceiptText, Trash2, WalletCards, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnimatedAmount } from '../components/AnimatedAmount';
import { AppDateInput } from '../components/AppDateInput';
import { AppSelectInput } from '../components/AppSelectInput';
import { CardCreateDialog } from '../components/CardCreateDialog';
import { InteractivePaymentCard } from '../components/InteractivePaymentCard';
import { useModalFocus } from '../hooks/useModalFocus';
import { cardBanks, creditCards, creditEventsForCard, primaryCreditCard, restoreCard } from '../lib/cards';
import { categoryPath, genericCategoryTree, subcategoriesFor } from '../lib/categories';
import { accountBalances, allAccounts, createEvent } from '../lib/domain';
import { money, shortDate } from '../lib/format';
import { accountDisplayName } from '../lib/ui';
import type { FinanceData, FinanceEvent, PaymentCard } from '../types';

export function CreditCardPage({
  data,asOf,onCreateEvent,onEditEvent,onDeleteEvent,onUpsertCard,onArchiveCard,
}:{
  data:FinanceData;asOf:string;
  onCreateEvent:(event:FinanceEvent)=>void;onEditEvent:(id:string)=>void;onDeleteEvent:(id:string)=>void;
  onUpsertCard:(card:PaymentCard)=>void;onArchiveCard:(card:PaymentCard)=>void;
}){
  const balances=accountBalances(data,asOf);
  const debt=Math.abs(Math.min(0,balances['credit-card']||0));
  const limit=data.state.settings.creditLimit??500;
  const available=Math.max(0,limit-debt);
  const usage=limit>0?Math.min(100,(debt/limit)*100):0;
  const banks=useMemo(()=>cardBanks(data),[data]);
  const activeCard=creditCards(data)[0];
  const historicalCard=primaryCreditCard(data);
  const card=activeCard??historicalCard;
  const bank=card?banks.find(item=>item.id===card.bankId):undefined;
  const cardEvents=useMemo(()=>card?creditEventsForCard(data,card.id):(data.state.events??[]).filter(event=>event.kind==='card_purchase'||event.kind==='card_payment'),[data,card]);
  const purchases=useMemo(()=>cardEvents.filter(event=>event.kind==='card_purchase').sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)),[cardEvents]);
  const payments=useMemo(()=>cardEvents.filter(event=>event.kind==='card_payment'&&!event.loanId).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)),[cardEvents]);
  const bankPrefix=card?.bankId??'piraeus';
  const eligibleAccounts=allAccounts(data).filter(account=>account.kind!=='credit'&&account.id.startsWith(`${bankPrefix}-`));
  const categories=genericCategoryTree(data.state.settings,'expense');
  const [createOpen,setCreateOpen]=useState(false);
  const [purchaseOpen,setPurchaseOpen]=useState(false);
  const [repayOpen,setRepayOpen]=useState(false);
  const [amount,setAmount]=useState('');const [date,setDate]=useState(asOf);const [note,setNote]=useState('');
  const [category,setCategory]=useState(categories[0]?.name||data.state.settings.expenseCategories[0]||'Άλλο');const [subcategory,setSubcategory]=useState('');
  const [sourceAccount,setSourceAccount]=useState(eligibleAccounts[0]?.id||data.state.settings.defaultExpenseAccount);const [error,setError]=useState('');const [message,setMessage]=useState('');
  const purchaseRef=useModalFocus<HTMLElement>(purchaseOpen,'[data-autofocus="true"]');const repayRef=useModalFocus<HTMLElement>(repayOpen,'[data-autofocus="true"]');

  const reset=()=>{setAmount('');setDate(asOf);setNote('');setError('')};
  const openPurchase=()=>{if(!activeCard){setMessage('Επαναφορά ή πρόσθεσε πρώτα την ενεργή πιστωτική κάρτα.');return}reset();setCategory(categories[0]?.name||'Άλλο');setSubcategory('');setPurchaseOpen(true)};
  const openRepay=()=>{reset();setAmount(debt>0?String(Number(debt.toFixed(2))):'');setSourceAccount(eligibleAccounts[0]?.id||'');setRepayOpen(true)};
  const closePurchase=()=>{setPurchaseOpen(false);setError('')};const closeRepay=()=>{setRepayOpen(false);setError('')};
  const remove=(event:FinanceEvent)=>{if(window.confirm(`Να διαγραφεί η κίνηση «${event.note}»;`))onDeleteEvent(event.id)};
  const submitPurchase=()=>{
    if(!activeCard){setError('Δεν υπάρχει ενεργή πιστωτική κάρτα.');return}
    const numeric=Number(amount.replace(',','.'));if(!Number.isFinite(numeric)||numeric<=0){setError('Βάλε θετικό ποσό αγοράς.');return}
    try{const event=createEvent({kind:'card_purchase',date,amount:numeric,note:note.trim()||category,category});event.subcategory=subcategory||undefined;event.cardId=activeCard.id;onCreateEvent(event);closePurchase()}
    catch(e){setError(e instanceof Error?e.message:'Η αγορά δεν καταχωρίστηκε.')}
  };
  const submitRepay=()=>{
    const numeric=Number(amount.replace(',','.'));if(debt<=0){setError('Δεν υπάρχει οφειλή προς αποπληρωμή.');return}if(!Number.isFinite(numeric)||numeric<=0){setError('Βάλε θετικό ποσό αποπληρωμής.');return}if(numeric>debt+.005){setError(`Η αποπληρωμή δεν μπορεί να ξεπερνά την οφειλή των ${money.format(debt)}.`);return}if(!eligibleAccounts.some(account=>account.id===sourceAccount)){setError(`Η αποπληρωμή πρέπει να γίνει από λογαριασμό της ${bank?.name??'ίδιας τράπεζας'}.`);return}
    try{const event=createEvent({kind:'card_payment',date,amount:numeric,note:'Αποπληρωμή πιστωτικής',fromAccountId:sourceAccount});if(card)event.cardId=card.id;onCreateEvent(event);closeRepay()}
    catch(e){setError(e instanceof Error?e.message:'Η αποπληρωμή δεν καταχωρίστηκε.')}
  };
  const restoreHistorical=()=>{if(!historicalCard)return;onUpsertCard(restoreCard(historicalCard));setMessage('Η πιστωτική επανήλθε με το ίδιο card id και όλο το ιστορικό της.')};
  const subs=subcategoriesFor(data.state.settings,'expense',category);

  return <div className="page-stack credit-card-redesign-page">
    <section className="page-heading"><div><span className="eyebrow">ΠΙΣΤΩΤΙΚΗ ΚΑΡΤΑ</span><h1>Πιστωτική Κάρτα</h1><p>Η οπτική κάρτα, το encrypted vault και οι αγορές/αποπληρωμές μοιράζονται πλέον την ίδια card identity. Η αρχειοθέτηση δεν διαγράφει ποτέ το οικονομικό ιστορικό.</p></div><div className="heading-actions"><button type="button" className="secondary" disabled={debt<=0||eligibleAccounts.length===0} onClick={openRepay}><ReceiptText/> Αποπληρωμή</button><button type="button" className="save-button" disabled={!activeCard} onClick={openPurchase}><CreditCard/> Νέα αγορά</button></div></section>

    {card&&bank?<section className="credit-card-stage neo-raised">
      <div className="credit-card-stage-card"><InteractivePaymentCard card={card} bank={bank} large onUpsert={onUpsertCard} onArchive={activeCard?cardToArchive=>{onArchiveCard(cardToArchive);setMessage('Η πιστωτική αρχειοθετήθηκε. Το υπόλοιπο και όλο το ιστορικό παραμένουν διαθέσιμα.')} : undefined}/>{!activeCard?<div className="credit-archive-banner"><ArchiveRestore/><span><b>Αρχειοθετημένη κάρτα</b><small>Τα ιστορικά δεδομένα και το server vault παραμένουν συνδεδεμένα στο ίδιο id.</small></span><button type="button" className="save-button" onClick={restoreHistorical}><ArchiveRestore/> Επαναφορά</button></div>:null}</div>
      <div className="credit-card-stage-stats"><div><span>Οφειλή</span><b><AnimatedAmount value={debt}/></b><small>Η liability παραμένει ακόμη κι αν η κάρτα αρχειοθετηθεί.</small></div><div><span>Διαθέσιμο</span><b><AnimatedAmount value={available}/></b><small>Συνολικό όριο {money.format(limit)}</small></div><div><span>Χρήση ορίου</span><b>{Math.round(usage)}%</b><div className="credit-usage" role="progressbar" aria-label="Χρήση πιστωτικού ορίου" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(usage)}><i style={{width:`${usage}%`}}/></div></div></div>
    </section>:<section className="credit-card-empty neo-raised"><CreditCard/><h2>Σύνδεσε την πιστωτική κάρτα</h2><p>Η υπάρχουσα liability και οι παλιές κινήσεις παραμένουν ανέπαφες. Η νέα κάρτα θα γίνει η κοινή οπτική/ασφαλής ταυτότητα για Κάρτες και Πιστωτική.</p><div className="credit-card-empty-actions"><button type="button" className="save-button" onClick={()=>setCreateOpen(true)}><Plus/> Προσθήκη πιστωτικής</button></div></section>}

    {message?<div className="action-status" role="status" aria-live="polite">{message}</div>:null}

    <section className="panel neo-raised"><div className="panel-head"><div><span>Αγορές πιστωτικής</span><small>{card?'Ιστορικό συνδεδεμένο με την ίδια κάρτα.':'Legacy ιστορικό πριν συνδεθεί card identity.'}</small></div><WalletCards/></div>{purchases.length?<div className="semantic-table-wrap"><table className="semantic-table credit-purchases-table"><caption className="sr-only">Αγορές με πιστωτική κάρτα</caption><thead><tr><th>Ημερομηνία</th><th>Περιγραφή</th><th>Κατηγορία</th><th className="amount">Ποσό</th><th className="actions">Ενέργειες</th></tr></thead><tbody>{purchases.map(event=><tr key={event.id}><td>{shortDate(event.date)}</td><td><b>{event.note}</b></td><td>{categoryPath(event.category,event.subcategory)}</td><td className="amount negative">{money.format(event.amount)}</td><td className="actions"><span className="row-actions"><button type="button" aria-label={`Επεξεργασία ${event.note}`} onClick={()=>onEditEvent(event.id)}><Pencil/></button><button type="button" className="danger" aria-label={`Διαγραφή ${event.note}`} onClick={()=>remove(event)}><Trash2/></button></span></td></tr>)}</tbody></table></div>:<div className="empty-state">Δεν υπάρχουν ακόμη αγορές με την πιστωτική.</div>}</section>

    <section className="panel neo-raised"><div className="panel-head"><div><span>Αποπληρωμές πιστωτικής</span><small>Μειώνουν την ίδια liability και τον λογαριασμό της τράπεζας, χωρίς δεύτερο έξοδο. Επιτρέπονται και όταν η κάρτα είναι αρχειοθετημένη ώστε να μην κλειδώνεται υπάρχουσα οφειλή.</small></div><ReceiptText/></div>{payments.length?<div className="semantic-table-wrap"><table className="semantic-table credit-payments-table"><caption className="sr-only">Αποπληρωμές πιστωτικής κάρτας</caption><thead><tr><th>Ημερομηνία</th><th>Από λογαριασμό</th><th className="amount">Ποσό</th><th className="actions">Ενέργειες</th></tr></thead><tbody>{payments.map(event=><tr key={event.id}><td>{shortDate(event.date)}</td><td>{event.fromAccountId?accountDisplayName(data,event.fromAccountId):'—'}</td><td className="amount">{money.format(event.amount)}</td><td className="actions"><span className="row-actions"><button type="button" className="danger" aria-label={`Διαγραφή αποπληρωμής ${shortDate(event.date)}`} onClick={()=>remove(event)}><Trash2/></button></span></td></tr>)}</tbody></table></div>:<div className="empty-inline">Δεν υπάρχουν ακόμη αποπληρωμές πιστωτικής.</div>}</section>

    <CardCreateDialog open={createOpen} data={data} banks={banks} initialBankId="piraeus" kindLock="credit" onClose={()=>setCreateOpen(false)} onSave={newCard=>{onUpsertCard(newCard);setMessage('Η πιστωτική δημιουργήθηκε ως κοινή κάρτα και εμφανίζεται και στην ενότητα Κάρτες.')}}/>

    {purchaseOpen?<div className="editor-backdrop" onMouseDown={closePurchase}><section ref={purchaseRef} className="panel neo-raised editor-dialog credit-dialog" role="dialog" aria-modal="true" aria-labelledby="credit-purchase-title" tabIndex={-1} onMouseDown={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closePurchase()}}}><div className="panel-head"><div><span id="credit-purchase-title">Νέα αγορά · {card?.nickname??'Πιστωτική'}</span><small>Η αγορά αυξάνει την ίδια liability, μετρά μία φορά ως έξοδο και κρατά το card id.</small></div><button type="button" className="icon-button" aria-label="Κλείσιμο αγοράς πιστωτικής" onClick={closePurchase}><X/></button></div><div className="settings-form editor-grid"><label><span>Ποσό</span><input data-autofocus="true" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value.replace(',','.'))}/></label><label><span>Ημερομηνία</span><AppDateInput value={date} onChange={e=>setDate(e.target.value)}/></label><label><span>Κατηγορία</span><AppSelectInput value={category} onChange={e=>{setCategory(e.target.value);setSubcategory('')}}>{categories.map(item=><option key={item.name}>{item.name}</option>)}</AppSelectInput></label>{subs.length?<label><span>Υποκατηγορία</span><AppSelectInput value={subcategory} onChange={e=>setSubcategory(e.target.value)}><option value="">Χωρίς υποκατηγορία</option>{subs.map(value=><option key={value}>{value}</option>)}</AppSelectInput></label>:null}<label className="wide"><span>Περιγραφή</span><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Τι αγόρασες;"/></label></div>{error?<div className="form-error" role="alert">{error}</div>:null}<div className="editor-actions"><button type="button" className="secondary" onClick={closePurchase}>Ακύρωση</button><button type="button" className="save-button" onClick={submitPurchase}>Καταχώριση αγοράς</button></div></section></div>:null}

    {repayOpen?<div className="editor-backdrop" onMouseDown={closeRepay}><section ref={repayRef} className="panel neo-raised editor-dialog credit-dialog" role="dialog" aria-modal="true" aria-labelledby="credit-repay-title" tabIndex={-1} onMouseDown={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closeRepay()}}}><div className="panel-head"><div><span id="credit-repay-title">Αποπληρωμή πιστωτικής</span><small>Το ίδιο ποσό αφαιρείται από λογαριασμό της {bank?.name??'ίδιας τράπεζας'} και από την οφειλή.</small></div><button type="button" className="icon-button" aria-label="Κλείσιμο αποπληρωμής πιστωτικής" onClick={closeRepay}><X/></button></div><div className="settings-form editor-grid"><label><span>Ποσό</span><input data-autofocus="true" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value.replace(',','.'))}/></label><label><span>Ημερομηνία</span><AppDateInput value={date} onChange={e=>setDate(e.target.value)}/></label><label className="wide"><span>Από λογαριασμό {bank?.name??''}</span><AppSelectInput value={sourceAccount} onChange={e=>setSourceAccount(e.target.value)}>{eligibleAccounts.map(account=><option key={account.id} value={account.id}>{accountDisplayName(data,account.id)} · {money.format(balances[account.id]||0)}</option>)}</AppSelectInput></label></div>{error?<div className="form-error" role="alert">{error}</div>:null}<div className="editor-actions"><button type="button" className="secondary" onClick={closeRepay}>Ακύρωση</button><button type="button" className="save-button" onClick={submitRepay}>Καταχώριση αποπληρωμής</button></div></section></div>:null}
  </div>;
}
