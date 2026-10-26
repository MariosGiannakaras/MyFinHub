import { CreditCard, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { AppTextInput } from './AppTextInput';
import { Button } from './Button';
import { DialogShell } from './DialogShell';
import { FormError } from './FormError';
import { IconButton } from './IconButton';
import { CardVaultClientError, cardVaultErrorMessage, revealCardSecret } from '../lib/cardVaultClient';
import { CardDetailsInputError, formatCardExpiryInput, formatCardNumberInput, normalizeCardDetailsInput, saveCardDetails } from '../lib/cardDetails';
import type { PaymentCard } from '../types';
import '../styles/card-details-dialog.css';

export function CardDetailsDialog({
  open,card,requireCvv=false,motionMode='system',inline=false,onEditProfile,onBeforeSave,onSaved,onCancel,
}:{
  open:boolean;
  card:PaymentCard|null;
  requireCvv?:boolean;
  motionMode?:'system'|'reduced'|'full';
  inline?:boolean;
  onEditProfile?:()=>void;
  onBeforeSave?:(card:PaymentCard)=>Promise<void>;
  onSaved:(card:PaymentCard)=>Promise<void>;
  onCancel:()=>void;
}){
  const inlineRef=useRef<HTMLElement|null>(null);
  const titleId=useId();
  const descriptionId=useId();
  const errorId=useId();
  const noticeId=useId();
  const [pan,setPan]=useState('');
  const [expiry,setExpiry]=useState('');
  const [cvv,setCvv]=useState('');
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  useEffect(()=>{
    if(!open||!card)return;
    let cancelled=false;
    setPan('');setExpiry('');setCvv('');setError('');setNotice('');setLoading(false);
    if(requireCvv){setNotice('Συμπλήρωσε τα ασφαλή στοιχεία της νέας κάρτας. Θα αποθηκευτούν μόνο στο κρυπτογραφημένο card vault.');return}
    if(!card.vaultRef){setNotice(card.last4?`Η κάρτα έχει μόνο τα παλιότερα τελευταία 4 ψηφία •••• ${card.last4}. Τα πλήρη στοιχεία δεν υπάρχουν ακόμη στο card vault· συμπλήρωσέ τα μία φορά για ασφαλή συγχρονισμό.`:'Δεν υπάρχουν ακόμη πλήρη στοιχεία στο card vault. Συμπλήρωσέ τα και αποθήκευσε.');return}
    setLoading(true);
    void (async()=>{
      let nextPan='';let nextExpiry='';let nextCvv='';let loadMessage='';let loadNotice='';
      try{
        const secret=await revealCardSecret(card.id);
        nextPan=secret.pan??'';
        nextExpiry=secret.expiry??'';
        nextCvv=secret.cvv??'';
      }catch(loadError){
        if(loadError instanceof CardVaultClientError&&loadError.code==='CARD_SECRET_NOT_FOUND')loadNotice=card.last4?`Δεν βρέθηκαν πλήρη στοιχεία στο card vault. Τα •••• ${card.last4} είναι μόνο metadata· συμπλήρωσε ξανά PAN/λήξη και, αν θέλεις, CVV.`:'Δεν βρέθηκαν πλήρη στοιχεία στο card vault. Συμπλήρωσέ τα και αποθήκευσε.';
        else loadMessage=cardVaultErrorMessage(loadError);
      }
      if(cancelled)return;
      setPan(formatCardNumberInput(nextPan));
      setExpiry(formatCardExpiryInput(nextExpiry));
      setCvv(nextCvv);
      setNotice(loadNotice);
      setError(loadMessage);
    })().finally(()=>{if(!cancelled)setLoading(false)});
    return ()=>{cancelled=true};
  },[open,card?.id,requireCvv]);

  useEffect(()=>{
    if(!inline||!open||loading||!card)return;
    const frame=requestAnimationFrame(()=>inlineRef.current?.querySelector<HTMLInputElement>('[data-autofocus="true"]')?.focus());
    return()=>cancelAnimationFrame(frame);
  },[inline,open,loading,card?.id]);

  if(!card)return null;
  const busy=loading||saving;
  const cancel=()=>{if(!busy)onCancel()};
  const clearError=()=>{if(error)setError('')};
  const submit=async()=>{
    if(busy)return;
    setSaving(true);setError('');
    let vaultSaved=false;
    let profileStaged=false;
    try{
      normalizeCardDetailsInput({pan,expiry,cvv},{requireCvv});
      if(requireCvv){await onBeforeSave?.(card);profileStaged=true;}
      const updated=await saveCardDetails(card,{pan,expiry,cvv},{requireCvv});
      vaultSaved=true;
      await onSaved(updated);
    }catch(saveError){
      if(saveError instanceof CardDetailsInputError)setError(saveError.message);
      else if(vaultSaved)setError('Τα ασφαλή στοιχεία αποθηκεύτηκαν στο vault, αλλά το προφίλ δεν επιβεβαιώθηκε. Επαναφόρτωσε και επανάλαβε τη σύνδεση της κάρτας.');
      else if(requireCvv&&!profileStaged)setError('Η δημιουργία του προφίλ δεν αποθηκεύτηκε. Δεν στάλθηκαν ασφαλή στοιχεία στο vault. Επαναφόρτωσε και δοκίμασε ξανά.');
      else if(requireCvv)setError('Το προφίλ της κάρτας αποθηκεύτηκε, αλλά η ασφαλής αποθήκευση δεν ολοκληρώθηκε. Τα στοιχεία μπορείς να τα συμπληρώσεις ξανά.');
      else setError(cardVaultErrorMessage(saveError));
    }finally{setSaving(false)}
  };

  const content=<>
    <header><div><small>ΑΣΦΑΛΗ ΣΤΟΙΧΕΙΑ ΚΑΡΤΑΣ</small><h2 id={titleId}>Στοιχεία · {card.nickname}</h2><p id={descriptionId}>Ο αριθμός, η λήξη και το CVV αποθηκεύονται μαζί κρυπτογραφημένα στο card vault και συγχρονίζονται στις εγκεκριμένες εφαρμογές.</p></div><IconButton aria-label="Κλείσιμο στοιχείων κάρτας" disabled={busy} onClick={cancel}><X aria-hidden="true"/></IconButton></header>
    <div className="settings-form app-card-details-dialog-body">
      <label className="wide"><span>Αριθμός κάρτας</span><AppTextInput data-autofocus="true" autoComplete="cc-number" inputMode="numeric" maxLength={39} value={pan} disabled={loading} invalid={Boolean(error)} aria-label="Αριθμός κάρτας" placeholder="1234 5678 9012 3456" onChange={event=>{setPan(formatCardNumberInput(event.target.value));clearError()}}/></label>
      <label><span>Λήξη</span><AppTextInput autoComplete="cc-exp" inputMode="numeric" maxLength={5} value={expiry} disabled={loading} invalid={Boolean(error)} aria-label="Λήξη κάρτας" placeholder="MM/YY" onChange={event=>{setExpiry(formatCardExpiryInput(event.target.value));clearError()}}/></label>
      <label><span>CVV</span><AppTextInput autoComplete="cc-csc" inputMode="numeric" maxLength={4} value={cvv} disabled={loading} invalid={Boolean(error)} aria-label="CVV κάρτας" placeholder={requireCvv?'CVV':'Προαιρετικό'} onChange={event=>{setCvv(event.target.value.replace(/\D/g,'').slice(0,4));clearError()}}/>{!requireCvv?<small className="card-cvv-preserve-hint">Κενό = διατήρηση υπάρχοντος CVV</small>:null}</label>
      <div className="app-card-details-security-note" role="note"><CreditCard aria-hidden="true"/><span>Χωρίς έλεγχο Luhn ή δικτύου. Όρια: αριθμός έως 32 ψηφία, λήξη έως 5 χαρακτήρες, CVV έως 4 ψηφία.</span></div>
      {notice?<div id={noticeId} className="app-card-details-notice" role="status">{notice}</div>:null}
      {error?<FormError id={errorId}>{error}</FormError>:null}
    </div>
    <footer>
      {inline&&onEditProfile?<Button variant="secondary" disabled={busy} onClick={onEditProfile}>Όνομα / σχέδιο</Button>:null}
      <Button variant="secondary" disabled={busy} onClick={cancel}>Ακύρωση</Button>
      <Button variant="primary" disabled={busy} onClick={()=>void submit()}>{saving?'Αποθήκευση…':'Αποθήκευση στοιχείων'}</Button>
    </footer>
  </>;
  if(inline)return <section ref={inlineRef} className="app-card-details-inline" role="group" aria-labelledby={titleId} aria-describedby={[descriptionId,notice?noticeId:'',error?errorId:''].filter(Boolean).join(' ')}>{content}</section>;
  return <DialogShell open={open} className="app-card-details-dialog" role="dialog" ariaLabelledBy={titleId} ariaDescribedBy={[descriptionId,notice?noticeId:'',error?errorId:''].filter(Boolean).join(' ')} busy={busy} motionMode={motionMode} preferredFocus='[data-autofocus="true"]' onRequestClose={cancel}>{content}</DialogShell>;
}
