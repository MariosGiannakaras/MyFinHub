import { Copy, Eye, EyeOff, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BankBrandMark } from './BankBrandMark';
import { cardThemeClass } from '../lib/cardDesigns';
import { cardLabel } from '../lib/cards';
import { cardVaultErrorMessage, revealCardSecret, saveCardSecret } from '../lib/cardVaultClient';
import { normalizeLocalCvv, readLocalCvv, saveLocalCvv } from '../lib/localCvvVault';
import type { CardBank, PaymentCard } from '../types';

type Secrets={pan?:string;expiry?:string;cvv?:string};

function formatPan(value:string){return value.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();}
function formatExpiry(value:string){const d=value.replace(/\D/g,'').slice(0,4);return d.length>2?`${d.slice(0,2)}/${d.slice(2)}`:d;}
function maskedPan(card:PaymentCard){return card.last4?`•••• •••• •••• ${card.last4}`:'•••• •••• •••• ••••';}
function kindLabel(card:PaymentCard){return card.kind==='credit'?'Credit':card.kind==='prepaid'?'Prepaid':card.formFactor==='virtual'?'Virtual':'Debit';}
function localCvvMessage(error:unknown){
  if(error instanceof Error&&error.message==='INVALID_CVV')return 'Το CVV πρέπει να έχει 3 ή 4 αριθμητικά ψηφία.';
  if(error instanceof Error&&error.message==='LOCAL_CVV_DECRYPT_FAILED')return 'Το τοπικό CVV δεν μπόρεσε να αποκρυπτογραφηθεί.';
  return 'Το τοπικό vault CVV δεν είναι διαθέσιμο σε αυτόν τον browser.';
}

function PrototypeBrand({card,bank}:{card:PaymentCard;bank:CardBank}){
  const design=card.designId??'';
  if(design.startsWith('revolut'))return <span className="card-bank-name revolut-wordmark">Revolut</span>;
  if(design.startsWith('piraeus-'))return <span className={`card-bank-name piraeus-logo ${design==='piraeus-green'?'is-green':''}`}><span className="piraeus-slashes"><i/><i/><i/></span>Piraeus</span>;
  if(design.startsWith('alpha'))return <><span className="card-bank-name">ALPHA BANK</span>{design==='alpha'?<span className="alpha-enter">enter</span>:<span className="alpha-bonus-word">bonus</span>}</>;
  if(design.startsWith('payzy')||design.startsWith('viva'))return <BankBrandMark id={bank.id} name={bank.name} compact={false}/>;
  return <><span className="brand-mark custom-mark">{bank.name.trim().slice(0,1).toUpperCase()}</span><span className="card-bank-name">{bank.name}</span></>;
}

function PrototypeNetwork({card}:{card:PaymentCard}){
  if(card.network==='mastercard')return <div className="card-network mastercard-network" data-network="MASTERCARD"><span className="mastercard-symbol" aria-label="Mastercard"><i/><i/></span><span className="mastercard-word">mastercard</span><span className="card-network-type">{kindLabel(card)}</span></div>;
  return <div className="card-network visa-network" data-network="VISA"><span className="card-network-main">VISA</span><span className="card-network-type">{kindLabel(card)}</span></div>;
}

export function InteractivePaymentCard({
  card,bank,large=false,onUpsert,onArchive,archiveDisabled=false,startEditing=false,onEditingComplete,
}:{
  card:PaymentCard;bank:CardBank;large?:boolean;
  onUpsert?:(card:PaymentCard)=>void;
  onArchive?:(card:PaymentCard)=>void|Promise<void>;
  archiveDisabled?:boolean;
  startEditing?:boolean;
  onEditingComplete?:()=>void;
  onOpenCredit?:()=>void;
}){
  const [revealed,setRevealed]=useState<Secrets>({});
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [editing,setEditing]=useState(startEditing);
  const [pan,setPan]=useState('');
  const [expiry,setExpiry]=useState('');
  const [cvv,setCvv]=useState('');
  const [deleteOpen,setDeleteOpen]=useState(false);
  const [deleteProgress,setDeleteProgress]=useState(0);
  const cardRef=useRef<HTMLElement>(null);
  const sliderRef=useRef<HTMLDivElement>(null);
  const theme=cardThemeClass(card);
  const visible=Boolean(revealed.pan||revealed.expiry||revealed.cvv);
  const tiltEnabled=useMemo(()=>typeof window==='undefined'||!window.matchMedia('(prefers-reduced-motion: reduce)').matches,[]);

  useEffect(()=>{if(startEditing)setEditing(true)},[startEditing]);

  const loadSecrets=async()=>{
    setBusy(true);setMessage('');
    try{
      let server:Awaited<ReturnType<typeof revealCardSecret>>={};
      try{server=await revealCardSecret(card.id)}catch(error){if((error as {code?:string})?.code!=='CARD_SECRET_NOT_FOUND')throw error}
      let local:string|null=null;try{local=await readLocalCvv(card.id)}catch(error){setMessage(localCvvMessage(error))}
      const result={...server,cvv:local||undefined};setRevealed(result);return result;
    }catch(error){setMessage(cardVaultErrorMessage(error));return null}
    finally{setBusy(false)}
  };
  const toggleReveal=async()=>{if(visible){setRevealed({});return}await loadSecrets()};
  const copy=async(field:keyof Secrets,label:string)=>{
    const current=revealed[field]||(await loadSecrets())?.[field];if(!current)return;
    try{await navigator.clipboard.writeText(current);setMessage(`${label} αντιγράφηκε.`)}catch{setMessage('Δεν ήταν δυνατή η αντιγραφή.')}
  };
  const saveInline=async()=>{
    const digits=pan.replace(/\D/g,'');const normalizedExpiry=formatExpiry(expiry);let normalizedCvv='';
    if(digits.length!==16||!/^\d{2}\/\d{2}$/.test(normalizedExpiry)){setMessage('Έλεγξε αριθμό και λήξη.');return}
    try{normalizedCvv=normalizeLocalCvv(cvv)}catch(error){setMessage(localCvvMessage(error));return}
    setBusy(true);setMessage('');
    try{
      const receipt=await saveCardSecret(card.id,{pan:digits,expiry:normalizedExpiry});
      await saveLocalCvv(card.id,normalizedCvv);
      const next={...card,last4:receipt.last4??digits.slice(-4),vaultRef:card.id,updatedAt:new Date().toISOString()};
      onUpsert?.(next);setRevealed({});setEditing(false);setMessage('Η κάρτα αποθηκεύτηκε.');onEditingComplete?.();
    }catch(error){setMessage(error instanceof Error&&error.message.startsWith('LOCAL_')?localCvvMessage(error):cardVaultErrorMessage(error))}
    finally{setBusy(false)}
  };
  const cancelInline=()=>{setEditing(false);setPan('');setExpiry('');setCvv('');onEditingComplete?.()};
  const commitArchive=async()=>{
    if(!onArchive||archiveDisabled)return;
    setBusy(true);
    try{await onArchive(card);setRevealed({});setDeleteOpen(false);setDeleteProgress(0);setMessage('Η κάρτα αρχειοθετήθηκε και μπορεί να επανέλθει με τα ίδια στοιχεία.')}
    finally{setBusy(false)}
  };

  const pointerMove=(event:React.PointerEvent<HTMLElement>)=>{
    if(!tiltEnabled||event.pointerType==='touch'||deleteOpen||editing)return;
    const element=cardRef.current;if(!element)return;const rect=element.getBoundingClientRect();const x=(event.clientX-rect.left)/rect.width;const y=(event.clientY-rect.top)/rect.height;
    const ry=Math.max(-6.5,Math.min(6.5,(x-.5)*13));const rx=Math.max(-6.5,Math.min(6.5,-(y-.5)*13));element.style.transform=`perspective(1000px) rotateY(${ry}deg) rotateX(${rx}deg)`;
  };
  const resetTilt=()=>{if(cardRef.current)cardRef.current.style.transform='perspective(1000px) rotateY(0deg) rotateX(0deg)'};
  const moveDelete=(clientX:number)=>{const el=sliderRef.current;if(!el)return;const rect=el.getBoundingClientRect();const progress=Math.max(0,Math.min(1,(clientX-rect.left-19.5)/(rect.width-39)));setDeleteProgress(progress)};

  const number=visible&&revealed.pan?formatPan(revealed.pan):maskedPan(card);
  const shownExpiry=visible&&revealed.expiry?revealed.expiry:'••/••';
  const shownCvv=visible&&revealed.cvv?revealed.cvv:'•••';

  return <div className={`card-slot prototype-card-slot ${large?'is-large':''}`}>
    <article ref={cardRef} className={`payment-card prototype-payment-card ${theme} ${editing?'editing':''} ${deleteOpen?'delete-armed':''} ${large?'is-large':''}`} style={{'--delete-p':deleteProgress} as React.CSSProperties} onPointerMove={pointerMove} onPointerLeave={resetTilt} aria-label={`${cardLabel(card)} · ${bank.name}`}>
      <div className="card-inner">
        <header className="card-header">
          <div className="card-brand-block"><div className="card-brand"><PrototypeBrand card={card} bank={bank}/></div><div className="card-nickname">{card.nickname}</div></div>
          {!editing?<div className="card-toolbar"><button className="card-icon-btn" type="button" disabled={busy} aria-pressed={visible} aria-label={visible?'Απόκρυψη στοιχείων':'Εμφάνιση στοιχείων'} title={visible?'Απόκρυψη στοιχείων':'Εμφάνιση στοιχείων'} onClick={()=>void toggleReveal()}>{visible?<EyeOff/>:<Eye/>}</button>{onArchive?<button className="card-icon-btn" type="button" disabled={busy||archiveDisabled} aria-label="Διαγραφή κάρτας" title="Διαγραφή" onClick={()=>{setDeleteProgress(0);setDeleteOpen(true)}}><Trash2/></button>:null}</div>:null}
        </header>
        <div className="card-body">
          <div className="card-number-wrap">{editing?<input className="card-edit-input edit-number inline-number" value={pan} inputMode="numeric" maxLength={19} placeholder="1234 5678 9012 3456" aria-label="Αριθμός κάρτας" onChange={e=>setPan(formatPan(e.target.value))}/>:<><div className={`card-number ${visible?'':'masked'}`}>{number}</div><button className="copy-mini" type="button" disabled={busy} aria-label="Αντιγραφή αριθμού" title="Αντιγραφή αριθμού" onClick={()=>void copy('pan','Ο αριθμός κάρτας')}><Copy/></button></>}</div>
          <div className="card-fields">
            <div className="card-field"><span className="card-field-label">VALID THRU</span>{editing?<input className="card-edit-input edit-small inline-expiry" value={expiry} inputMode="numeric" maxLength={5} placeholder="MM/YY" aria-label="Ημερομηνία λήξης" onChange={e=>setExpiry(formatExpiry(e.target.value))}/>:<div className="card-field-line"><span className={`card-field-value ${visible?'':'masked'}`}>{shownExpiry}</span><button className="copy-mini" type="button" disabled={busy} aria-label="Αντιγραφή λήξης" title="Αντιγραφή λήξης" onClick={()=>void copy('expiry','Η λήξη')}><Copy/></button></div>}</div>
            <div className="card-field"><span className="card-field-label">CVV</span>{editing?<input className="card-edit-input edit-small inline-cvv" value={cvv} inputMode="numeric" maxLength={4} placeholder="CVV" aria-label="CVV" onChange={e=>setCvv(e.target.value.replace(/\D/g,'').slice(0,4))}/>:<div className="card-field-line"><span className={`card-field-value ${visible?'':'masked'}`}>{shownCvv}</span><button className="copy-mini" type="button" disabled={busy} aria-label="Αντιγραφή CVV" title="Αντιγραφή CVV" onClick={()=>void copy('cvv','Το CVV')}><Copy/></button></div>}</div>
            <PrototypeNetwork card={card}/>
          </div>
        </div>
        {editing?<div className="card-edit-actions"><button className="card-action" type="button" disabled={busy} onClick={cancelInline}>Ακύρωση</button><button className="card-action primary" type="button" disabled={busy} onClick={()=>void saveInline()}>Αποθήκευση</button></div>:null}
        {deleteOpen?<div className="delete-confirm"><div className="delete-confirm-head"><div className="delete-confirm-copy"><b>Διαγραφή κάρτας;</b><small>Σύρε μέχρι τέρμα για επιβεβαίωση. Η κάρτα θα αρχειοθετηθεί ώστε να μπορεί να επανέλθει με το ίδιο ιστορικό και τα ίδια vault στοιχεία.</small></div><button className="delete-cancel" type="button" aria-label="Ακύρωση διαγραφής" onClick={()=>{setDeleteOpen(false);setDeleteProgress(0)}}><X/></button></div><div ref={sliderRef} className="delete-slider" style={{'--p':deleteProgress} as React.CSSProperties}><span className="delete-slider-label">ΣΥΡΕ ΓΙΑ ΔΙΑΓΡΑΦΗ</span><button className="delete-slider-thumb" type="button" aria-label="Σύρε για διαγραφή" style={{transform:`translateX(calc(${deleteProgress} * (100% - 0px)))`}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);moveDelete(e.clientX)}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))moveDelete(e.clientX)}} onPointerUp={e=>{try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}if(deleteProgress>=.92){setDeleteProgress(1);void commitArchive()}else setDeleteProgress(0)}} onPointerCancel={()=>setDeleteProgress(0)}><Trash2/></button></div></div>:null}
      </div>
    </article>
    {message?<div className="r-card-status" role="status" aria-live="polite">{message}</div>:null}
  </div>;
}