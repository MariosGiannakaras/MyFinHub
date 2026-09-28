import { CreditCard, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { AppTextInput } from './AppTextInput';
import { Button } from './Button';
import { DialogShell } from './DialogShell';
import { FormError } from './FormError';
import { IconButton } from './IconButton';
import { CardVaultClientError, cardVaultErrorMessage, revealCardSecret } from '../lib/cardVaultClient';
import { CardDetailsInputError, formatCardExpiryInput, formatCardNumberInput, saveCardDetails } from '../lib/cardDetails';
import type { PaymentCard } from '../types';
import '../styles/card-details-dialog.css';

export function CardDetailsDialog({
  open,card,requireCvv=false,motionMode='system',onSaved,onCancel,
}:{
  open:boolean;
  card:PaymentCard|null;
  requireCvv?:boolean;
  motionMode?:'system'|'reduced'|'full';
  onSaved:(card:PaymentCard)=>void;
  onCancel:()=>void;
}){
  const titleId=useId();
  const descriptionId=useId();
  const errorId=useId();
  const [pan,setPan]=useState('');
  const [expiry,setExpiry]=useState('');
  const [cvv,setCvv]=useState('');
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    if(!open||!card)return;
    let cancelled=false;
    setPan('');setExpiry('');setCvv('');setError('');setLoading(false);
    if(requireCvv||!card.vaultRef)return;
    setLoading(true);
    void (async()=>{
      let nextPan='';let nextExpiry='';let nextCvv='';let loadMessage='';
      try{
        const secret=await revealCardSecret(card.id);
        nextPan=secret.pan??'';
        nextExpiry=secret.expiry??'';
        nextCvv=secret.cvv??'';
      }catch(loadError){
        if(!(loadError instanceof CardVaultClientError&&loadError.code==='CARD_SECRET_NOT_FOUND'))loadMessage=cardVaultErrorMessage(loadError);
      }
      if(cancelled)return;
      setPan(formatCardNumberInput(nextPan));
      setExpiry(formatCardExpiryInput(nextExpiry));
      setCvv(nextCvv);
      setError(loadMessage);
    })().finally(()=>{if(!cancelled)setLoading(false)});
    return ()=>{cancelled=true};
  },[open,card?.id,requireCvv]);

  if(!card)return null;
  const busy=loading||saving;
  const cancel=()=>{if(!busy)onCancel()};
  const clearError=()=>{if(error)setError('')};
  const submit=async()=>{
    if(busy)return;
    setSaving(true);setError('');
    try{
      const updated=await saveCardDetails(card,{pan,expiry,cvv},{requireCvv});
      onSaved(updated);
    }catch(saveError){
      if(saveError instanceof CardDetailsInputError)setError(saveError.message);
      else setError(cardVaultErrorMessage(saveError));
    }finally{setSaving(false)}
  };

  return <DialogShell
    open={open}
    className="app-card-details-dialog"
    role="dialog"
    ariaLabelledBy={titleId}
    ariaDescribedBy={error?`${descriptionId} ${errorId}`:descriptionId}
    busy={busy}
    motionMode={motionMode}
    preferredFocus='[data-autofocus="true"]'
    onRequestClose={cancel}
  >
    <header><div><small>ΑΣΦΑΛΗ ΣΤΟΙΧΕΙΑ ΚΑΡΤΑΣ</small><h2 id={titleId}>Στοιχεία · {card.nickname}</h2><p id={descriptionId}>Ο αριθμός, η λήξη και το CVV αποθηκεύονται μαζί κρυπτογραφημένα στο card vault και συγχρονίζονται στις εγκεκριμένες εφαρμογές.</p></div><IconButton aria-label="Κλείσιμο στοιχείων κάρτας" disabled={busy} onClick={cancel}><X aria-hidden="true"/></IconButton></header>
    <div className="settings-form app-card-details-dialog-body">
      <label className="wide"><span>Αριθμός κάρτας</span><AppTextInput data-autofocus="true" autoComplete="cc-number" inputMode="numeric" value={pan} disabled={loading} invalid={Boolean(error)} aria-label="Αριθμός κάρτας" placeholder="1234 5678 9012 3456" onChange={event=>{setPan(formatCardNumberInput(event.target.value));clearError()}}/></label>
      <label><span>Λήξη</span><AppTextInput autoComplete="cc-exp" inputMode="numeric" maxLength={5} value={expiry} disabled={loading} invalid={Boolean(error)} aria-label="Λήξη κάρτας" placeholder="MM/YY" onChange={event=>{setExpiry(formatCardExpiryInput(event.target.value));clearError()}}/></label>
      <label><span>CVV</span><AppTextInput autoComplete="cc-csc" inputMode="numeric" maxLength={4} value={cvv} disabled={loading} invalid={Boolean(error)} aria-label="CVV κάρτας" placeholder={requireCvv?'CVV':'Άφησέ το κενό για διατήρηση'} onChange={event=>{setCvv(event.target.value.replace(/\D/g,'').slice(0,4));clearError()}}/></label>
      <div className="app-card-details-security-note" role="note"><CreditCard aria-hidden="true"/><span>Δεν εφαρμόζεται Luhn ή σταθερό μήκος PAN. Κρατάμε μόνο αριθμητικά ψηφία, ώστε να μη μπλοκάρονται έγκυρες κάρτες διαφορετικών δικτύων.</span></div>
      {error?<FormError id={errorId}>{error}</FormError>:null}
    </div>
    <footer>
      <Button variant="secondary" disabled={busy} onClick={cancel}>Ακύρωση</Button>
      <Button variant="primary" disabled={busy} onClick={()=>void submit()}>{saving?'Αποθήκευση…':'Αποθήκευση στοιχείων'}</Button>
    </footer>
  </DialogShell>;
}
