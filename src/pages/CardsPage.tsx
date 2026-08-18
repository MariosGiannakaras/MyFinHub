import { Copy, CreditCard, Eye, EyeOff, Link2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useModalFocus } from '../hooks/useModalFocus';
import { cardBanks, cardKindLabel, cardLabel, cardNetworkLabel, cardsForBank } from '../lib/cards';
import { deleteLocalCvv, hasLocalCvv, normalizeLocalCvv, readLocalCvv, saveLocalCvv } from '../lib/localCvvVault';
import type { CardBank, CardKind, CardNetwork, FinanceData, PaymentCard } from '../types';

function localCvvError(error: unknown) {
  if (error instanceof Error && error.message === 'INVALID_CVV') return 'Το CVV πρέπει να έχει 3 ή 4 αριθμητικά ψηφία.';
  if (error instanceof Error && error.message === 'LOCAL_CVV_DECRYPT_FAILED') return 'Το τοπικό CVV δεν μπόρεσε να αποκρυπτογραφηθεί σε αυτόν τον browser.';
  return 'Η ασφαλής τοπική αποθήκευση CVV δεν είναι διαθέσιμη σε αυτόν τον browser.';
}

export function CardsPage({data,onUpsertBank,onUpsertCard,onArchiveCard,onOpenCredit}:{data:FinanceData;onUpsertBank:(bank:CardBank)=>void;onUpsertCard:(card:PaymentCard)=>void;onArchiveCard:(card:PaymentCard)=>void;onOpenCredit:()=>void}){
  const banks=cardBanks(data);
  const [visible,setVisible]=useState(false);
  const [bankOpen,setBankOpen]=useState(false);
  const [cardBank,setCardBank]=useState<CardBank|null>(null);
  const [bankName,setBankName]=useState('');
  const [nickname,setNickname]=useState('');
  const [kind,setKind]=useState<CardKind>('debit');
  const [network,setNetwork]=useState<CardNetwork>('visa');
  const [holder,setHolder]=useState('');
  const [last4,setLast4]=useState('');
  const [newCvv,setNewCvv]=useState('');
  const [error,setError]=useState('');
  const [localMessage,setLocalMessage]=useState('');
  const [cvvEditorCard,setCvvEditorCard]=useState<PaymentCard|null>(null);
  const [cvvEditorValue,setCvvEditorValue]=useState('');
  const [cvvEditorHasStored,setCvvEditorHasStored]=useState(false);
  const [cvvBusy,setCvvBusy]=useState<string|null>(null);
  const [revealedCvvs,setRevealedCvvs]=useState<Record<string,string>>({});
  const bankRef=useModalFocus<HTMLElement>(bankOpen,'input');
  const cardRef=useModalFocus<HTMLElement>(Boolean(cardBank),'input');
  const cvvRef=useModalFocus<HTMLElement>(Boolean(cvvEditorCard),'[data-autofocus="true"]');

  const startBank=()=>{setBankName('');setError('');setBankOpen(true)};
  const closeBank=()=>{setBankOpen(false);setError('')};
  const saveBank=()=>{const name=bankName.trim();if(!name){setError('Συμπλήρωσε όνομα τράπεζας.');return}const id=`custom-${Date.now()}`;onUpsertBank({id,name:name.toUpperCase(),order:Math.max(60,...banks.map(bank=>bank.order+10)),custom:true});closeBank()};

  const startCard=(bank:CardBank)=>{setCardBank(bank);setNickname('');setKind('debit');setNetwork('visa');setHolder('');setLast4('');setNewCvv('');setError('')};
  const closeCard=()=>{setCardBank(null);setNewCvv('');setError('')};
  const saveCard=async()=>{
    if(!cardBank)return;
    const name=nickname.trim();
    const digits=last4.replace(/\D/g,'');
    if(!name){setError('Συμπλήρωσε ένα όνομα για την κάρτα.');return}
    if(digits&&digits.length!==4){setError('Τα τελευταία ψηφία πρέπει να είναι ακριβώς 4.');return}
    const id=`card-${Date.now()}`;
    if(newCvv.trim()){
      try{await saveLocalCvv(id,normalizeLocalCvv(newCvv))}
      catch(localError){setError(localCvvError(localError));return}
    }
    const now=new Date().toISOString();
    onUpsertCard({id,bankId:cardBank.id,nickname:name,kind,network,holderName:holder.trim()||undefined,last4:digits||undefined,active:true,createdAt:now,updatedAt:now});
    closeCard();
  };

  const openCvvEditor=async(card:PaymentCard)=>{
    setCvvEditorCard(card);setCvvEditorValue('');setError('');setCvvEditorHasStored(false);
    try{setCvvEditorHasStored(await hasLocalCvv(card.id))}catch{setCvvEditorHasStored(false)}
  };
  const closeCvvEditor=()=>{setCvvEditorCard(null);setCvvEditorValue('');setError('')};
  const saveEditedCvv=async()=>{
    if(!cvvEditorCard)return;
    setCvvBusy(cvvEditorCard.id);
    try{
      const normalized=normalizeLocalCvv(cvvEditorValue);
      await saveLocalCvv(cvvEditorCard.id,normalized);
      setRevealedCvvs(current=>({...current,[cvvEditorCard.id]:normalized}));
      setLocalMessage('Το CVV αποθηκεύτηκε κρυπτογραφημένο μόνο σε αυτόν τον browser.');
      closeCvvEditor();
    }catch(localError){setError(localCvvError(localError))}
    finally{setCvvBusy(null)}
  };
  const removeEditedCvv=async()=>{
    if(!cvvEditorCard)return;
    setCvvBusy(cvvEditorCard.id);
    try{
      await deleteLocalCvv(cvvEditorCard.id);
      setRevealedCvvs(current=>{const next={...current};delete next[cvvEditorCard.id];return next});
      setLocalMessage('Το CVV διαγράφηκε από αυτή τη συσκευή.');
      closeCvvEditor();
    }catch(localError){setError(localCvvError(localError))}
    finally{setCvvBusy(null)}
  };
  const toggleCvv=async(card:PaymentCard)=>{
    if(revealedCvvs[card.id]){setRevealedCvvs(current=>{const next={...current};delete next[card.id];return next});return}
    setCvvBusy(card.id);
    try{
      const cvv=await readLocalCvv(card.id);
      if(!cvv){await openCvvEditor(card);return}
      setRevealedCvvs(current=>({...current,[card.id]:cvv}));
    }catch(localError){setLocalMessage(localCvvError(localError))}
    finally{setCvvBusy(null)}
  };
  const copyCvv=async(card:PaymentCard)=>{
    const cvv=revealedCvvs[card.id];if(!cvv)return;
    try{await navigator.clipboard.writeText(cvv);setLocalMessage(`Το CVV της «${cardLabel(card)}» αντιγράφηκε.`)}catch{setLocalMessage('Δεν ήταν δυνατή η αντιγραφή από αυτόν τον browser.')}
  };
  const archiveCard=async(card:PaymentCard)=>{
    if(!window.confirm(`Να κρυφτεί η κάρτα «${cardLabel(card)}» από τις ενεργές; Το τοπικό CVV της συσκευής θα διαγραφεί.`))return;
    setCvvBusy(card.id);
    try{
      await deleteLocalCvv(card.id);
      setRevealedCvvs(current=>{const next={...current};delete next[card.id];return next});
      onArchiveCard(card);
    }catch(localError){setLocalMessage(`${localCvvError(localError)} Η κάρτα δεν αρχειοθετήθηκε ώστε να μη μείνει κρυφό CVV χωρίς έλεγχο.`)}
    finally{setCvvBusy(null)}
  };

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">ΚΑΡΤΕΣ</span><h1>Κάρτες</h1><p>Οι κάρτες είναι οργανωμένες ανά τράπεζα. Τα πραγματικά στοιχεία παραμένουν κρυμμένα μέχρι να τα εμφανίσεις.</p></div><div className="heading-actions"><button type="button" className="secondary privacy-toggle" aria-pressed={visible} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>} {visible?'Απόκρυψη':'Εμφάνιση στοιχείων'}</button><button type="button" className="save-button" onClick={startBank}><Plus size={17}/> Τράπεζα</button></div></section>

    <section className="banks-scroll" aria-label="Κάρτες ανά τράπεζα">{banks.map(bank=>{const cards=cardsForBank(data,bank.id);return <article className="bank-column" key={bank.id}><header><div><span>{bank.name}</span><small>{cards.length} {cards.length===1?'κάρτα':'κάρτες'}</small></div><button type="button" aria-label={`Προσθήκη κάρτας στην ${bank.name}`} onClick={()=>startCard(bank)}><Plus size={17}/></button></header><div className="bank-card-stack">{cards.map(card=>{const revealedCvv=revealedCvvs[card.id];const busy=cvvBusy===card.id;return <article className={`payment-card bank-${bank.id} network-${card.network}`} key={card.id}><div className="payment-card-top"><span>{bank.name}</span><b>{cardNetworkLabel(card)}</b></div><div className="payment-card-chip" aria-hidden="true"/><div className={`payment-card-number ${!visible?'masked-card-text':''}`}>{visible?(card.last4?`•••• •••• •••• ${card.last4}`:'Δεν έχουν αποθηκευτεί στοιχεία'):'•••• •••• •••• ••••'}</div><div className="payment-card-bottom"><div><small>ΚΑΤΟΧΟΣ</small><b className={!visible?'masked-card-text':''}>{card.holderName||cardLabel(card)}</b></div><div><small>ΛΗΞΗ</small><b>{visible?'••/••':'••/••'}</b></div></div><footer><span>{cardKindLabel(card)}</span>{card.kind==='credit'?<button type="button" onClick={onOpenCredit}><Link2 size={14}/> Πιστωτική</button>:null}<button type="button" aria-label={`Αρχειοθέτηση ${cardLabel(card)}`} disabled={busy} onClick={()=>{void archiveCard(card)}}><Trash2 size={14}/></button></footer><div className="secure-card-actions" aria-label="Ασφαλή στοιχεία κάρτας"><button type="button" disabled title="Θα ενεργοποιηθεί από το κρυπτογραφημένο server card vault"><Copy size={13}/> Αριθμός</button><button type="button" disabled title="Θα ενεργοποιηθεί από το κρυπτογραφημένο server card vault"><Copy size={13}/> Λήξη</button></div><div className="local-cvv-row"><span><small>CVV · μόνο αυτή η συσκευή</small><b>{revealedCvv||'•••'}</b></span><div><button type="button" disabled={busy} aria-label={revealedCvv?`Απόκρυψη CVV ${cardLabel(card)}`:`Εμφάνιση CVV ${cardLabel(card)}`} onClick={()=>{void toggleCvv(card)}}>{revealedCvv?<EyeOff size={14}/>:<Eye size={14}/>}</button><button type="button" disabled={!revealedCvv||busy} aria-label={`Αντιγραφή CVV ${cardLabel(card)}`} onClick={()=>{void copyCvv(card)}}><Copy size={14}/></button><button type="button" disabled={busy} aria-label={`Αλλαγή CVV ${cardLabel(card)}`} onClick={()=>{void openCvvEditor(card)}}><Pencil size={14}/></button></div></div></article>})}{!cards.length?<button type="button" className="empty-bank-card" onClick={()=>startCard(bank)}><Plus/><span>Προσθήκη κάρτας</span></button>:null}</div></article>})}</section>

    <div className="logic-note compact card-security-note"><CreditCard/><div><b>Ασφαλή στοιχεία</b><span>Το CVV αποθηκεύεται κρυπτογραφημένο αποκλειστικά σε αυτόν τον browser και δεν αποστέλλεται ποτέ σε Vercel ή Supabase. Παραμένει μετά από logout, κλείσιμο browser και νέο deploy στην ίδια διεύθυνση. Μπορεί να χαθεί αν καθαριστούν τα δεδομένα του site, χρησιμοποιείται ιδιωτική περιήγηση ή αλλάξεις browser, συσκευή ή origin.</span></div></div>
    {localMessage?<div className="action-status" role="status" aria-live="polite">{localMessage}</div>:null}

    {bankOpen?<div className="editor-backdrop" onMouseDown={closeBank}><section ref={bankRef} className="panel neo-raised editor-dialog compact-dialog" role="dialog" aria-modal="true" aria-labelledby="new-bank-title" tabIndex={-1} onMouseDown={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closeBank()}}}><div className="panel-head"><div><span id="new-bank-title">Νέα τράπεζα</span><small>Οι πέντε βασικές τράπεζες παραμένουν πάντα στην προκαθορισμένη σειρά.</small></div><button type="button" className="icon-button" aria-label="Κλείσιμο νέας τράπεζας" onClick={closeBank}><X/></button></div><div className="settings-form"><label><span>Όνομα</span><input value={bankName} onChange={e=>setBankName(e.target.value)} placeholder="Τράπεζα"/></label></div>{error?<div className="form-error" role="alert">{error}</div>:null}<div className="editor-actions"><button type="button" className="secondary" onClick={closeBank}>Ακύρωση</button><button type="button" className="save-button" onClick={saveBank}>Προσθήκη</button></div></section></div>:null}

    {cardBank?<div className="editor-backdrop" onMouseDown={closeCard}><section ref={cardRef} className="panel neo-raised editor-dialog" role="dialog" aria-modal="true" aria-labelledby="new-card-title" tabIndex={-1} onMouseDown={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closeCard()}}}><div className="panel-head"><div><span id="new-card-title">Νέα κάρτα · {cardBank.name}</span><small>Το CVV μένει μόνο σε αυτή τη συσκευή. Τα υπόλοιπα μυστικά στοιχεία δεν γράφονται στο συνηθισμένο οικονομικό state.</small></div><button type="button" className="icon-button" aria-label="Κλείσιμο νέας κάρτας" onClick={closeCard}><X/></button></div><div className="settings-form editor-grid"><label><span>Όνομα κάρτας</span><input data-autofocus="true" value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="π.χ. Blue Debit"/></label><label><span>Τύπος</span><select value={kind} onChange={e=>setKind(e.target.value as CardKind)}><option value="debit">Χρεωστική</option><option value="prepaid">Prepaid</option><option value="credit">Πιστωτική</option></select></label><label><span>Δίκτυο</span><select value={network} onChange={e=>setNetwork(e.target.value as CardNetwork)}><option value="visa">Visa</option><option value="mastercard">Mastercard</option><option value="other">Άλλο</option></select></label><label><span>Τελευταία 4 ψηφία</span><input inputMode="numeric" maxLength={4} value={last4} onChange={e=>setLast4(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="1234"/></label><label><span>CVV <em>μόνο τοπικά</em></span><input inputMode="numeric" autoComplete="off" maxLength={4} value={newCvv} onChange={e=>setNewCvv(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="•••"/></label><label className="wide"><span>Όνομα κατόχου <em>προαιρετικό</em></span><input value={holder} onChange={e=>setHolder(e.target.value)}/></label></div>{error?<div className="form-error" role="alert">{error}</div>:null}<div className="editor-actions"><button type="button" className="secondary" onClick={closeCard}>Ακύρωση</button><button type="button" className="save-button" onClick={()=>{void saveCard()}}>Προσθήκη κάρτας</button></div></section></div>:null}

    {cvvEditorCard?<div className="editor-backdrop" onMouseDown={closeCvvEditor}><section ref={cvvRef} className="panel neo-raised editor-dialog compact-dialog" role="dialog" aria-modal="true" aria-labelledby="local-cvv-title" tabIndex={-1} onMouseDown={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closeCvvEditor()}}}><div className="panel-head"><div><span id="local-cvv-title">CVV · {cardLabel(cvvEditorCard)}</span><small>Κρυπτογραφείται και αποθηκεύεται μόνο στο IndexedDB αυτού του browser. Δεν συγχρονίζεται στο cloud.</small></div><button type="button" className="icon-button" aria-label="Κλείσιμο επεξεργασίας CVV" onClick={closeCvvEditor}><X/></button></div><div className="settings-form"><label><span>CVV / CVC</span><input data-autofocus="true" inputMode="numeric" autoComplete="off" maxLength={4} value={cvvEditorValue} onChange={e=>setCvvEditorValue(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="3 ή 4 ψηφία"/></label></div>{error?<div className="form-error" role="alert">{error}</div>:null}<div className="editor-actions">{cvvEditorHasStored?<button type="button" className="danger-button" disabled={cvvBusy===cvvEditorCard.id} onClick={()=>{void removeEditedCvv()}}>Διαγραφή από συσκευή</button>:null}<button type="button" className="secondary" onClick={closeCvvEditor}>Ακύρωση</button><button type="button" className="save-button" disabled={cvvBusy===cvvEditorCard.id} onClick={()=>{void saveEditedCvv()}}>Αποθήκευση CVV</button></div></section></div>:null}
  </div>;
}
