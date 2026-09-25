import { Archive, Copy, Eye, EyeOff, Pencil, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { BankBrandMark } from './BankBrandMark';
import { cardThemeClass } from '../lib/cardDesigns';
import { cardLabel } from '../lib/cards';
import { cardVaultErrorMessage, revealCardSecret } from '../lib/cardVaultClient';
import type { CardBank, PaymentCard } from '../types';

type Secrets={pan?:string;expiry?:string;cvv?:string};

function formatPan(value:string){return value.replace(/\D/g,'').replace(/(.{4})/g,'$1 ').trim();}
function maskedPan(card:PaymentCard){return card.last4?`•••• •••• •••• ${card.last4}`:'•••• •••• •••• ••••';}
function kindLabel(card:PaymentCard){return card.kind==='credit'?'Credit':card.kind==='prepaid'?'Prepaid':card.formFactor==='virtual'?'Virtual':'Debit';}
function PrototypeBrand({card,bank}:{card:PaymentCard;bank:CardBank}){
  const design=card.designId??'';
  const alphaVariant=design==='alpha'?'enter':design.startsWith('alpha')?'bonus':null;
  return <><BankBrandMark id={bank.id} name={bank.name} compact={false}/>{alphaVariant?<span className={alphaVariant==='enter'?'alpha-enter':'alpha-bonus-word'}>{alphaVariant}</span>:null}</>;
}

function PrototypeNetwork({card}:{card:PaymentCard}){
  if(card.network==='mastercard')return <div className="card-network mastercard-network" data-network="MASTERCARD"><span className="mastercard-symbol" aria-label="Mastercard"><i/><i/></span><span className="mastercard-word">mastercard</span><span className="card-network-type">{kindLabel(card)}</span></div>;
  return <div className="card-network visa-network" data-network="VISA"><span className="card-network-main">VISA</span><span className="card-network-type">{kindLabel(card)}</span></div>;
}

export function InteractivePaymentCard({
  card,bank,large=false,onEditDetails,onArchive,archiveDisabled=false,
}:{
  card:PaymentCard;bank:CardBank;large?:boolean;
  onEditDetails?:(card:PaymentCard)=>void;
  onArchive?:(card:PaymentCard)=>void|Promise<void>;
  archiveDisabled?:boolean;
  onOpenCredit?:()=>void;
}){
  const [revealed,setRevealed]=useState<Secrets>({});
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [deleteOpen,setDeleteOpen]=useState(false);
  const [deleteProgress,setDeleteProgress]=useState(0);
  const [deleteOffset,setDeleteOffset]=useState(0);
  const cardRef=useRef<HTMLElement>(null);
  const sliderRef=useRef<HTMLDivElement>(null);
  const theme=cardThemeClass(card);
  const visible=Boolean(revealed.pan||revealed.expiry||revealed.cvv);
  const tiltEnabled=useMemo(()=>typeof window==='undefined'||!window.matchMedia('(prefers-reduced-motion: reduce)').matches,[]);

  const loadSecrets=async()=>{
    setBusy(true);setMessage('');
    try{
      let server:Awaited<ReturnType<typeof revealCardSecret>>={};
      try{server=await revealCardSecret(card.id)}catch(error){if((error as {code?:string})?.code!=='CARD_SECRET_NOT_FOUND')throw error}
      setRevealed(server);return server;
    }catch(error){setMessage(cardVaultErrorMessage(error));return null}
    finally{setBusy(false)}
  };

  const toggleReveal=async()=>{if(visible){setRevealed({});return}await loadSecrets()};
  const copy=async(field:keyof Secrets,label:string)=>{
    const current=revealed[field]||(await loadSecrets())?.[field];if(!current)return;
    try{await navigator.clipboard.writeText(current);setMessage(`${label} αντιγράφηκε.`)}catch{setMessage('Δεν ήταν δυνατή η αντιγραφή.')}
  };
  const resetDelete=()=>{setDeleteOpen(false);setDeleteProgress(0);setDeleteOffset(0)};
  const commitArchive=async()=>{
    if(!onArchive||archiveDisabled)return;
    setBusy(true);
    try{await onArchive(card);setRevealed({});resetDelete();setMessage('Η κάρτα αρχειοθετήθηκε και μπορεί να επανέλθει με τα ίδια στοιχεία.')}
    finally{setBusy(false)}
  };

  const pointerMove=(event:React.PointerEvent<HTMLElement>)=>{
    if(!tiltEnabled||event.pointerType==='touch'||deleteOpen)return;
    const element=cardRef.current;if(!element)return;const rect=element.getBoundingClientRect();const x=(event.clientX-rect.left)/rect.width;const y=(event.clientY-rect.top)/rect.height;
    const ry=Math.max(-6.5,Math.min(6.5,(x-.5)*13));const rx=Math.max(-6.5,Math.min(6.5,-(y-.5)*13));element.style.transform=`perspective(1000px) rotateY(${ry}deg) rotateX(${rx}deg)`;
  };
  const resetTilt=()=>{if(cardRef.current)cardRef.current.style.transform='perspective(1000px) rotateY(0deg) rotateX(0deg)'};
  const moveDelete=(clientX:number)=>{const el=sliderRef.current;if(!el)return;const rect=el.getBoundingClientRect();const max=Math.max(0,rect.width-47);const progress=Math.max(0,Math.min(1,(clientX-rect.left-19.5)/Math.max(1,rect.width-39)));setDeleteProgress(progress);setDeleteOffset(progress*max)};

  const number=visible&&revealed.pan?formatPan(revealed.pan):maskedPan(card);
  const shownExpiry=visible&&revealed.expiry?revealed.expiry:'••/••';
  const shownCvv=visible&&revealed.cvv?revealed.cvv:'•••';

  return <div className={`card-slot r-card-slot prototype-card-slot ${large?'is-large':''}`}>
    <article ref={cardRef} className={`payment-card r-payment-card prototype-payment-card ${theme} ${deleteOpen?'delete-armed':''} ${large?'is-large':''}`} style={{'--delete-p':deleteProgress} as React.CSSProperties} onPointerMove={pointerMove} onPointerLeave={resetTilt} aria-label={`${cardLabel(card)} · ${bank.name}`}>
      <div className="card-inner">
        <header className="card-header">
          <div className="card-brand-block"><div className="card-brand"><PrototypeBrand card={card} bank={bank}/></div><div className="card-nickname">{card.nickname}</div></div>
          <div className="card-toolbar">
            <button className="card-icon-btn" type="button" disabled={busy} aria-pressed={visible} aria-label={visible?'Απόκρυψη στοιχείων':'Εμφάνιση στοιχείων'} title={visible?'Απόκρυψη στοιχείων':'Εμφάνιση στοιχείων'} onClick={()=>void toggleReveal()}>{visible?<EyeOff/>:<Eye/>}</button>
            {onEditDetails?<button className="card-icon-btn" type="button" disabled={busy} aria-label={`Επεξεργασία ασφαλών στοιχείων ${card.nickname}`} title="Επεξεργασία στοιχείων κάρτας" onClick={()=>onEditDetails(card)}><Pencil/></button>:null}
            {onArchive?<button className="card-icon-btn" type="button" disabled={busy||archiveDisabled} aria-label="Αρχειοθέτηση κάρτας" title="Αρχειοθέτηση κάρτας" onClick={()=>{setDeleteProgress(0);setDeleteOffset(0);setDeleteOpen(true)}}><Archive/></button>:null}
          </div>
        </header>
        <div className="card-body">
          <div className="card-number-wrap"><div className={`card-number ${visible?'':'masked'}`}>{number}</div><button className="copy-mini" type="button" disabled={busy} aria-label="Αντιγραφή αριθμού" title="Αντιγραφή αριθμού" onClick={()=>void copy('pan','Ο αριθμός κάρτας')}><Copy/></button></div>
          <div className="card-fields">
            <div className="card-field"><span className="card-field-label">VALID THRU</span><div className="card-field-line"><span className={`card-field-value ${visible?'':'masked'}`}>{shownExpiry}</span><button className="copy-mini" type="button" disabled={busy} aria-label="Αντιγραφή λήξης" title="Αντιγραφή λήξης" onClick={()=>void copy('expiry','Η λήξη')}><Copy/></button></div></div>
            <div className="card-field"><span className="card-field-label">CVV</span><div className="card-field-line"><span className={`card-field-value ${visible?'':'masked'}`}>{shownCvv}</span><button className="copy-mini" type="button" disabled={busy} aria-label="Αντιγραφή CVV" title="Αντιγραφή CVV" onClick={()=>void copy('cvv','Το CVV')}><Copy/></button></div></div>
            <PrototypeNetwork card={card}/>
          </div>
        </div>
        {deleteOpen?<div className="delete-confirm r-card-archive-confirm"><div className="delete-confirm-head"><div className="delete-confirm-copy"><b>Αρχειοθέτηση κάρτας;</b><small>Σύρε μέχρι τέρμα για επιβεβαίωση. Η κάρτα θα μεταφερθεί στο αρχείο και μπορεί να επανέλθει με τα ίδια στοιχεία.</small></div><button className="delete-cancel" type="button" aria-label="Ακύρωση αρχειοθέτησης" title="Ακύρωση αρχειοθέτησης" onClick={resetDelete}><X/></button></div><div ref={sliderRef} className="delete-slider" style={{'--p':deleteProgress} as React.CSSProperties}><span className="delete-slider-label">ΣΥΡΕ ΓΙΑ ΑΡΧΕΙΟΘΕΤΗΣΗ</span><button className="delete-slider-thumb r-card-archive-keyboard" type="button" aria-label="Σύρε για αρχειοθέτηση" title="Αρχειοθέτηση κάρτας" style={{transform:`translateX(${deleteOffset}px)`}} onClick={e=>{if(e.detail===0)void commitArchive()}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);moveDelete(e.clientX)}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))moveDelete(e.clientX)}} onPointerUp={e=>{try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}if(deleteProgress>=.92){setDeleteProgress(1);void commitArchive()}else{setDeleteProgress(0);setDeleteOffset(0)}}} onPointerCancel={()=>{setDeleteProgress(0);setDeleteOffset(0)}}><Archive/><span className="sr-only">Αρχειοθέτηση</span></button></div></div>:null}
      </div>
    </article>
    {message?<div className="r-card-status" role="status" aria-live="polite">{message}</div>:null}
  </div>;
}
