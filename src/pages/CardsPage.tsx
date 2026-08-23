import { ArchiveRestore, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CardCreateDialog } from '../components/CardCreateDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormError } from '../components/FormError';
import { InteractivePaymentCard } from '../components/InteractivePaymentCard';
import { Tooltip } from '../components/Tooltip';
import { useModalFocus } from '../hooks/useModalFocus';
import { archivedCardsForBank, cardBanks, cardsForBank, restoreCard } from '../lib/cards';
import { cardVaultErrorMessage } from '../lib/cardVaultClient';
import type { CardBank, FinanceData, PaymentCard } from '../types';

export function CardsPage({
  data,onUpsertBank,onUpsertCard,onArchiveCard,onDeleteCard,
}:{
  data:FinanceData;
  onUpsertBank:(bank:CardBank)=>void;
  onUpsertCard:(card:PaymentCard)=>void;
  onArchiveCard:(card:PaymentCard)=>void;
  onDeleteCard:(card:PaymentCard)=>Promise<void>;
}){
  const banks=useMemo(()=>cardBanks(data),[data]);
  const [bankOpen,setBankOpen]=useState(false);
  const [bankName,setBankName]=useState('');
  const [cardBankId,setCardBankId]=useState<string|null>(null);
  const [editingCardId,setEditingCardId]=useState<string|null>(null);
  const [deleteTarget,setDeleteTarget]=useState<PaymentCard|null>(null);
  const [deleteBusy,setDeleteBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const bankRef=useModalFocus<HTMLElement>(bankOpen,'[data-autofocus="true"]',()=>{setBankOpen(false);setError('')});
  const cardBank=cardBankId?banks.find(bank=>bank.id===cardBankId):undefined;

  const saveBank=()=>{
    const name=bankName.trim();if(!name){setError('Γράψε το όνομα της τράπεζας για να μπορέσουμε να τη δημιουργήσουμε.');return}
    if(banks.some(bank=>bank.name.localeCompare(name,'el',{sensitivity:'base'})===0)){setError('Υπάρχει ήδη τράπεζα με αυτό το όνομα. Έλεγξε το όνομα ή χρησιμοποίησε την υπάρχουσα στήλη.');return}
    const now=Date.now();onUpsertBank({id:`custom-${now}`,name:name.toUpperCase(),order:Math.max(60,...banks.map(bank=>bank.order+10)),custom:true});
    setBankOpen(false);setBankName('');setError('');setMessage('Η τράπεζα προστέθηκε.');
  };
  const saveCard=(card:PaymentCard)=>{onUpsertCard(card);setMessage(`Η «${card.nickname}» αποθηκεύτηκε.`)};
  const createCard=(card:PaymentCard)=>{onUpsertCard(card);if(!card.vaultRef&&!card.last4)setEditingCardId(card.id);setMessage('Συμπλήρωσε αριθμό, λήξη και CVV απευθείας πάνω στη νέα κάρτα.')};
  const archive=(card:PaymentCard)=>{onArchiveCard(card);setMessage(`Η «${card.nickname}» αρχειοθετήθηκε. Τα αποθηκευμένα στοιχεία της παραμένουν διαθέσιμα αν την επαναφέρεις.`)};
  const restore=(card:PaymentCard)=>{onUpsertCard(restoreCard(card));setMessage(`Η «${card.nickname}» επανήλθε με τα ίδια αποθηκευμένα στοιχεία.`)};
  const confirmDelete=async()=>{
    if(!deleteTarget)return;
    setDeleteBusy(true);setMessage('');
    try{
      const name=deleteTarget.nickname;
      await onDeleteCard(deleteTarget);
      setDeleteTarget(null);
      setMessage(`Η «${name}» διαγράφηκε οριστικά μαζί με τα αποθηκευμένα στοιχεία της.`);
    }catch(error){
      setMessage(cardVaultErrorMessage(error));
    }finally{setDeleteBusy(false)}
  };

  return <div className="page-stack cards-prototype-page">
    <section className="page-heading"><div><span className="eyebrow">ΚΑΡΤΕΣ</span><h1>Κάρτες</h1><p>Χρεωστικές και προπληρωμένες κάρτες μόνο για ασφαλή αποθήκευση και προβολή των στοιχείων τους. Οι συναλλαγές καταχωρούνται στους αντίστοιχους λογαριασμούς, όχι στις κάρτες.</p></div><div className="heading-actions"><button type="button" className="save-button" onClick={()=>{setBankName('');setError('');setBankOpen(true)}}><Plus/> Προσθήκη τράπεζας</button></div></section>

    <section className="cards-workspace cards-prototype-workspace neo-raised" aria-label="Χρεωστικές και προπληρωμένες κάρτες ανά τράπεζα">
      <div className="cards-grid cards-prototype-grid" style={{'--bank-count':Math.max(1,banks.length)} as React.CSSProperties}>{banks.map(bank=>{
        const active=cardsForBank(data,bank.id);const archived=archivedCardsForBank(data,bank.id);
        return <section className="bank-column cards-bank-column" key={bank.id} data-bank={bank.id}>
          <header className="bank-column-head"><div className="bank-column-title"><b>{bank.name}</b><small>{active.length} {active.length===1?'κάρτα':'κάρτες'}</small></div><Tooltip label={`Προσθήκη κάρτας στην ${bank.name}`} side="left"><button type="button" className="bank-add-btn" aria-label={`Προσθήκη κάρτας στην ${bank.name}`} onClick={()=>setCardBankId(bank.id)}><Plus/></button></Tooltip></header>
          <div className="bank-stack">{active.length?active.map(card=><InteractivePaymentCard key={card.id} card={card} bank={bank} onUpsert={saveCard} onArchive={archive} startEditing={editingCardId===card.id} onEditingComplete={()=>setEditingCardId(current=>current===card.id?null:current)}/>):<button type="button" className="bank-empty" onClick={()=>setCardBankId(bank.id)}>Δεν υπάρχουν χρεωστικές ή προπληρωμένες κάρτες</button>}</div>
          {archived.length?<details className="cards-archive"><summary><ArchiveRestore/> Αρχειοθετημένες · {archived.length}</summary><div className="card-archive-list">{archived.map(card=><article className="card-archive-row" key={card.id}><div className="card-archive-identity"><b>{card.nickname}</b><small>{card.last4?`•••• ${card.last4} · `:''}{card.kind==='prepaid'?'Προπληρωμένη':'Χρεωστική'}</small></div><div className="card-archive-actions"><button type="button" className="save-button" onClick={()=>restore(card)}><ArchiveRestore/> Επαναφορά</button><button type="button" className="danger" onClick={()=>setDeleteTarget(card)}><Trash2/> Οριστική διαγραφή</button></div></article>)}</div></details>:null}
        </section>;
      })}</div>
    </section>

    {message?<div className="action-status" role="status" aria-live="polite">{message}</div>:null}

    <CardCreateDialog open={Boolean(cardBank)} data={data} banks={cardBank?[cardBank]:banks.slice(0,1)} initialBankId={cardBank?.id} allowedKinds={['debit','prepaid']} onClose={()=>setCardBankId(null)} onSave={createCard}/>

    {bankOpen?<div className="picker-backdrop open" aria-hidden="false" onMouseDown={()=>setBankOpen(false)}><section ref={bankRef} className="picker compact neo-raised" role="dialog" aria-modal="true" aria-labelledby="new-bank-title" aria-describedby={error?'new-bank-error':undefined} tabIndex={-1} onMouseDown={event=>event.stopPropagation()}><div className="picker-head"><div><h2 id="new-bank-title">Νέα τράπεζα</h2><p>Η νέα τράπεζα θα αποκτήσει δική της στήλη και ξεχωριστό κουμπί προσθήκης καρτών.</p></div><button type="button" className="close-picker" aria-label="Κλείσιμο" onClick={()=>setBankOpen(false)}>×</button></div><div className="modal-form-grid one"><div className="modal-field"><label>Όνομα τράπεζας</label><input data-autofocus="true" maxLength={36} value={bankName} onChange={event=>setBankName(event.target.value)} placeholder="π.χ. N26" aria-invalid={Boolean(error)} aria-describedby={error?'new-bank-error':undefined}/></div></div>{error?<FormError id="new-bank-error">{error}</FormError>:null}<div className="modal-actions"><button type="button" className="modal-secondary" onClick={()=>setBankOpen(false)}>Ακύρωση</button><button type="button" className="modal-primary" onClick={saveBank}><Plus/> Προσθήκη τράπεζας</button></div></section></div>:null}

    <ConfirmDialog open={Boolean(deleteTarget)} title="Οριστική διαγραφή κάρτας;" description="Θα διαγραφεί η κάρτα και τα αποθηκευμένα PAN/λήξη/CVV. Δεν υπάρχει οικονομικό ιστορικό συνδεδεμένο με χρεωστικές ή προπληρωμένες κάρτες μέσα στο MyFinHub." confirmLabel="Οριστική διαγραφή" tone="destructive" busy={deleteBusy} motionMode={data.state.settings.motion} onConfirm={()=>void confirmDelete()} onCancel={()=>{if(!deleteBusy)setDeleteTarget(null)}}/>
  </div>;
}
