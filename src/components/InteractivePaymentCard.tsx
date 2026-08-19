import { Archive, Copy, CreditCard, Eye, EyeOff, Link2, Pencil, ShieldCheck, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { BankBrandMark } from './BankBrandMark';
import { useModalFocus } from '../hooks/useModalFocus';
import { cardThemeClass } from '../lib/cardDesigns';
import { cardKindLabel, cardLabel, cardNetworkLabel } from '../lib/cards';
import { cardVaultErrorMessage, deleteCardSecret, revealCardSecret, saveCardSecret } from '../lib/cardVaultClient';
import { deleteLocalCvv, normalizeLocalCvv, readLocalCvv, saveLocalCvv } from '../lib/localCvvVault';
import type { CardBank, PaymentCard } from '../types';

type Secrets={pan?:string;expiry?:string;cvv?:string};

function maskedPan(card:PaymentCard){return card.last4?`•••• •••• •••• ${card.last4}`:'•••• •••• •••• ••••';}
function formatPan(value:string){return value.replace(/\D/g,'').slice(0,19).replace(/(.{4})/g,'$1 ').trim();}
function formatExpiry(value:string){const d=value.replace(/\D/g,'').slice(0,4);return d.length>2?`${d.slice(0,2)}/${d.slice(2)}`:d;}
function localCvvMessage(error:unknown){
  if(error instanceof Error&&error.message==='INVALID_CVV')return 'Το CVV πρέπει να έχει 3 ή 4 αριθμητικά ψηφία.';
  if(error instanceof Error&&error.message==='LOCAL_CVV_DECRYPT_FAILED')return 'Το τοπικό CVV δεν μπόρεσε να αποκρυπτογραφηθεί.';
  return 'Το τοπικό vault CVV δεν είναι διαθέσιμο σε αυτόν τον browser.';
}

export function InteractivePaymentCard({
  card,bank,large=false,onUpsert,onArchive,onOpenCredit,archiveDisabled=false,
}:{
  card:PaymentCard;bank:CardBank;large?:boolean;
  onUpsert?:(card:PaymentCard)=>void;
  onArchive?:(card:PaymentCard)=>void|Promise<void>;
  onOpenCredit?:()=>void;
  archiveDisabled?:boolean;
}){
  const [revealed,setRevealed]=useState<Secrets>({});
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [editorOpen,setEditorOpen]=useState(false);
  const [pan,setPan]=useState('');
  const [expiry,setExpiry]=useState('');
  const [cvv,setCvv]=useState('');
  const [archiveOpen,setArchiveOpen]=useState(false);
  const [archiveProgress,setArchiveProgress]=useState(0);
  const cardRef=useRef<HTMLElement>(null);
  const editorRef=useModalFocus<HTMLElement>(editorOpen,'[data-autofocus="true"]');
  const theme=cardThemeClass(card);
  const visible=Boolean(revealed.pan||revealed.expiry||revealed.cvv);
  const number=visible&&revealed.pan?formatPan(revealed.pan):maskedPan(card);
  const shownExpiry=visible&&revealed.expiry?revealed.expiry:'••/••';
  const shownCvv=visible&&revealed.cvv?revealed.cvv:'•••';
  const tiltEnabled=useMemo(()=>typeof window==='undefined'||!window.matchMedia('(prefers-reduced-motion: reduce)').matches,[]);

  const copy=async(value:string|undefined,label:string)=>{
    if(!value)return;
    try{await navigator.clipboard.writeText(value);setMessage(`${label} αντιγράφηκε.`)}catch{setMessage('Δεν ήταν δυνατή η αντιγραφή.')}
  };
  const loadSecrets=async()=>{
    setBusy(true);setMessage('');
    try{
      let server:Awaited<ReturnType<typeof revealCardSecret>>={};
      try{server=await revealCardSecret(card.id)}catch(error){
        const code=(error as {code?:string})?.code;
        if(code!=='CARD_SECRET_NOT_FOUND')throw error;
      }
      let local:string|null=null;
      try{local=await readLocalCvv(card.id)}catch(error){setMessage(localCvvMessage(error))}
      setRevealed({...server,cvv:local||undefined});
      return {...server,cvv:local||undefined};
    }catch(error){setMessage(cardVaultErrorMessage(error));return null}
    finally{setBusy(false)}
  };
  const toggleReveal=async()=>{
    if(visible){setRevealed({});return}
    await loadSecrets();
  };
  const openEditor=async()=>{
    const loaded=await loadSecrets();
    setPan(loaded?.pan?formatPan(loaded.pan):'');setExpiry(loaded?.expiry||'');setCvv(loaded?.cvv||'');setEditorOpen(true);
  };
  const saveEditor=async()=>{
    setBusy(true);setMessage('');
    try{
      const normalizedCvv=cvv.trim()?normalizeLocalCvv(cvv):'';
      let last4=card.last4;
      if(pan.trim()||expiry.trim()){
        const receipt=await saveCardSecret(card.id,{pan:pan.trim()||undefined,expiry:expiry.trim()||undefined});
        if(receipt.last4)last4=receipt.last4;
      }
      if(normalizedCvv)await saveLocalCvv(card.id,normalizedCvv);
      const next={...card,last4,vaultRef:(pan.trim()||expiry.trim())?card.id:card.vaultRef,updatedAt:new Date().toISOString()};
      onUpsert?.(next);
      setRevealed({pan:pan.replace(/\D/g,'')||undefined,expiry:expiry||undefined,cvv:normalizedCvv||undefined});
      setEditorOpen(false);setMessage('Τα ασφαλή στοιχεία ενημερώθηκαν. PAN/λήξη στο server vault, CVV μόνο στη συσκευή.');
    }catch(error){setMessage(error instanceof Error&&error.message.startsWith('LOCAL_')?localCvvMessage(error):cardVaultErrorMessage(error))}
    finally{setBusy(false)}
  };
  const clearServerSecrets=async()=>{
    if(!window.confirm('Να διαγραφούν οριστικά ο αποθηκευμένος αριθμός και η λήξη από το server vault; Το ιστορικό της κάρτας δεν επηρεάζεται.'))return;
    setBusy(true);
    try{await deleteCardSecret(card.id);onUpsert?.({...card,last4:undefined,vaultRef:undefined,updatedAt:new Date().toISOString()});setPan('');setExpiry('');setRevealed(current=>({...current,pan:undefined,expiry:undefined}));setMessage('Ο αριθμός και η λήξη διαγράφηκαν από το server vault.');}
    catch(error){setMessage(cardVaultErrorMessage(error))}
    finally{setBusy(false)}
  };
  const archive=async()=>{
    if(!onArchive)return;
    setBusy(true);
    try{
      try{await deleteLocalCvv(card.id)}catch(error){setMessage(`${localCvvMessage(error)} Η κάρτα δεν αρχειοθετήθηκε ώστε να μη μείνει τοπικό CVV χωρίς έλεγχο.`);return}
      await onArchive(card);setRevealed({});setArchiveOpen(false);setArchiveProgress(0);
    }finally{setBusy(false)}
  };

  const pointerMove=(event:React.PointerEvent<HTMLElement>)=>{
    if(!tiltEnabled||event.pointerType==='touch'||archiveOpen)return;
    const element=cardRef.current;if(!element)return;
    const rect=element.getBoundingClientRect();const x=(event.clientX-rect.left)/rect.width;const y=(event.clientY-rect.top)/rect.height;
    const ry=Math.max(-6.5,Math.min(6.5,(x-.5)*13));const rx=Math.max(-6.5,Math.min(6.5,-(y-.5)*13));
    element.style.transform=`perspective(1100px) rotateY(${ry}deg) rotateX(${rx}deg)`;
  };
  const resetTilt=()=>{if(cardRef.current)cardRef.current.style.transform='perspective(1100px) rotateY(0deg) rotateX(0deg)'};

  return <div className={`r-card-slot ${large?'is-large':''}`}>
    <article ref={cardRef} className={`r-payment-card ${theme} ${large?'is-large':''} ${archiveOpen?'archive-armed':''}`} onPointerMove={pointerMove} onPointerLeave={resetTilt} aria-label={`${cardLabel(card)} · ${bank.name}`}>
      <div className="r-card-inner">
        <header className="r-card-head">
          <div className="r-card-brand"><BankBrandMark id={bank.id} name={bank.name} compact={false}/><div><b>{bank.name}</b><small>{card.nickname}</small></div></div>
          <div className="r-card-tools">
            <button type="button" disabled={busy} aria-pressed={visible} aria-label={visible?'Απόκρυψη στοιχείων':'Εμφάνιση στοιχείων'} onClick={()=>void toggleReveal()}>{visible?<EyeOff/>:<Eye/>}</button>
            <button type="button" disabled={busy} aria-label="Επεξεργασία ασφαλών στοιχείων" onClick={()=>void openEditor()}><Pencil/></button>
            {onArchive?<button type="button" disabled={busy||archiveDisabled} aria-label="Αρχειοθέτηση κάρτας" onClick={()=>setArchiveOpen(true)}><Archive/></button>:null}
          </div>
        </header>
        <div className="r-card-spacer"/>
        <div className="r-card-number-line"><span>{number}</span><button type="button" disabled={!revealed.pan||busy} aria-label="Αντιγραφή αριθμού κάρτας" onClick={()=>void copy(revealed.pan,'Ο αριθμός κάρτας')}><Copy/></button></div>
        <div className="r-card-fields">
          <div><small>VALID THRU</small><span>{shownExpiry}</span><button type="button" disabled={!revealed.expiry||busy} aria-label="Αντιγραφή λήξης" onClick={()=>void copy(revealed.expiry,'Η λήξη')}><Copy/></button></div>
          <div><small>CVV · LOCAL</small><span>{shownCvv}</span><button type="button" disabled={!revealed.cvv||busy} aria-label="Αντιγραφή CVV" onClick={()=>void copy(revealed.cvv,'Το CVV')}><Copy/></button></div>
          <div className="r-card-network"><b>{cardNetworkLabel(card)}</b><small>{cardKindLabel(card)}{card.formFactor==='virtual'?' · Virtual':''}</small></div>
        </div>
        {card.kind==='credit'&&onOpenCredit?<button type="button" className="r-card-credit-link" onClick={onOpenCredit}><Link2/> Πιστωτική</button>:null}
      </div>
      {archiveOpen?<div className="r-card-archive-confirm">
        <div><b>Αρχειοθέτηση κάρτας;</b><small>Το ιστορικό, οι κινήσεις, το υπόλοιπο και το server vault παραμένουν. Το τοπικό CVV αφαιρείται από αυτή τη συσκευή.</small><button type="button" aria-label="Ακύρωση αρχειοθέτησης" onClick={()=>{setArchiveOpen(false);setArchiveProgress(0)}}><X/></button></div>
        <label className="r-card-archive-slider"><span>ΣΥΡΕ ΓΙΑ ΑΡΧΕΙΟΘΕΤΗΣΗ</span><input aria-label="Σύρε για αρχειοθέτηση" type="range" min="0" max="100" value={archiveProgress} onChange={e=>setArchiveProgress(Number(e.target.value))} onPointerUp={()=>{if(archiveProgress>=92)void archive();else setArchiveProgress(0)}} onKeyUp={e=>{if((e.key==='Enter'||e.key===' ')&&archiveProgress>=92)void archive()}}/></label>
        <button type="button" className="r-card-archive-keyboard" disabled={busy} onClick={()=>void archive()}><Archive/> Αρχειοθέτηση</button>
      </div>:null}
    </article>
    {message?<div className="r-card-status" role="status" aria-live="polite">{message}</div>:null}

    {editorOpen?<div className="editor-backdrop" onMouseDown={()=>setEditorOpen(false)}><section ref={editorRef} className="panel neo-raised editor-dialog card-secret-dialog" role="dialog" aria-modal="true" aria-labelledby={`card-secret-${card.id}`} tabIndex={-1} onMouseDown={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setEditorOpen(false)}}}>
      <div className="panel-head"><div><span id={`card-secret-${card.id}`}>Ασφαλή στοιχεία · {cardLabel(card)}</span><small>Ο αριθμός/λήξη αποθηκεύονται κρυπτογραφημένα στο server vault. Το CVV κρυπτογραφείται μόνο σε αυτόν τον browser.</small></div><button type="button" className="icon-button" aria-label="Κλείσιμο" onClick={()=>setEditorOpen(false)}><X/></button></div>
      <div className="settings-form editor-grid">
        <label className="wide"><span>Αριθμός κάρτας</span><input data-autofocus="true" inputMode="numeric" autoComplete="off" value={pan} onChange={e=>setPan(formatPan(e.target.value))} placeholder="1234 5678 9012 3456"/></label>
        <label><span>Λήξη</span><input inputMode="numeric" autoComplete="off" value={expiry} onChange={e=>setExpiry(formatExpiry(e.target.value))} placeholder="MM/YY"/></label>
        <label><span>CVV · μόνο συσκευή</span><input inputMode="numeric" autoComplete="off" value={cvv} onChange={e=>setCvv(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="3–4 ψηφία"/></label>
      </div>
      <div className="logic-note compact"><ShieldCheck/><div><b>Διαχωρισμένα vaults</b><span>Το CVV δεν αποστέλλεται στο API. Δεν μπαίνει σε FinanceData, Supabase, backups, logs ή analytics.</span></div></div>
      <div className="editor-actions card-secret-actions"><button type="button" className="danger-text" disabled={busy||(!card.vaultRef&&!card.last4)} onClick={()=>void clearServerSecrets()}>Διαγραφή PAN/λήξης</button><span/><button type="button" className="secondary" onClick={()=>setEditorOpen(false)}>Ακύρωση</button><button type="button" className="save-button" disabled={busy} onClick={()=>void saveEditor()}>Αποθήκευση</button></div>
    </section></div>:null}
  </div>;
}
