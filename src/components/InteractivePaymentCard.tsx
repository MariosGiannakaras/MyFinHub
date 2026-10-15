import { Archive, Copy, Eye, EyeOff, Pencil, X } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { BankBrandMark } from './BankBrandMark';
import { CardNetworkMark } from './CardNetworkMark';
import { cardBrandSurfaceTone, cardThemeClass } from '../lib/cardDesigns';
import { cardLabel } from '../lib/cards';
import { cardVaultErrorMessage, revealCardSecret } from '../lib/cardVaultClient';
import type { CardBank, PaymentCard } from '../types';
import './InteractivePaymentCard.css';

type Secrets={pan?:string;expiry?:string;cvv?:string};

function formatPan(value:string){return value.replace(/\D/g,'').replace(/(.{4})/g,'$1 ').trim();}
function maskedPan(card:PaymentCard){return card.last4?`•••• •••• •••• ${card.last4}`:'•••• •••• •••• ••••';}
function kindLabel(card:PaymentCard){return card.kind==='credit'?'Credit':card.kind==='prepaid'?'Prepaid':card.formFactor==='virtual'?'Virtual':'Debit';}

/** Presentation-only: the archive mutation begins after the exit choreography. */
async function playArchiveShred(card:HTMLElement){
  if(!card.parentElement||typeof card.animate!=='function'||window.matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced')return;
  const host=card.parentElement;
  const layer=document.createElement('div');
  layer.className='r-card-archive-shred';
  layer.setAttribute('aria-hidden','true');
  const slices:HTMLElement[]=[];
  for(let index=0;index<9;index++){
    const slice=document.createElement('div');
    slice.className='r-card-archive-slice';
    slice.style.clipPath=`inset(${index*100/9}% 0 ${Math.max(0,100-(index+1)*100/9)}% 0 round 22px)`;
    const snapshot=card.cloneNode(true) as HTMLElement;
    snapshot.classList.remove('delete-armed');
    snapshot.classList.add('r-card-archive-ghost');
    snapshot.removeAttribute('id');
    snapshot.querySelector('.delete-confirm')?.remove();
    snapshot.querySelectorAll('button').forEach(button=>button.remove());
    // Decorative clones must never duplicate revealed PAN, expiry or CVV.
    snapshot.querySelectorAll('.card-number,.card-field-value').forEach(node=>{node.textContent='••••'});
    slice.appendChild(snapshot);
    layer.appendChild(slice);
    slices.push(slice);
  }
  host.appendChild(layer);
  const animations=[
    card.animate([{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(18px) scale(.9)'}],{duration:560,easing:'cubic-bezier(.2,.82,.2,1)',fill:'forwards'}),
    ...slices.map((slice,index)=>slice.animate([
      {transform:'translate3d(0,0,0) rotateZ(0deg)',opacity:1,filter:'blur(0)'},
      {offset:.25,transform:'translate3d(0,-4px,0) rotateZ(0deg)',opacity:1},
      {transform:`translate3d(${(index%2===0?-1:1)*(48+index*5)}px, ${20+(index-4)*5}px, 0) rotateZ(${index%2===0?-7:7}deg)`,opacity:0,filter:'blur(2px)'}
    ],{duration:620,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'}))
  ];
  try{await Promise.all(animations.map(animation=>animation.finished))}
  finally{animations.forEach(animation=>animation.cancel());layer.remove()}
}

function PrototypeBrand({card,bank}:{card:PaymentCard;bank:CardBank}){
  const design=card.designId??'';
  const alphaVariant=design==='alpha'?'enter':design.startsWith('alpha')?'bonus':null;
  return <><BankBrandMark id={bank.id} name={bank.name} compact={false} role="card-mark" surfaceTone={cardBrandSurfaceTone(card)}/>{alphaVariant?<span className={alphaVariant==='enter'?'alpha-enter':'alpha-bonus-word'}>{alphaVariant}</span>:null}</>;
}

export function InteractivePaymentCard({
  card,bank,large=false,onEditCard,onEditDetails,onArchive,archiveDisabled=false,detailsEditor,
}:{
  card:PaymentCard;bank:CardBank;large?:boolean;
  onEditCard?:(card:PaymentCard)=>void;
  onEditDetails?:(card:PaymentCard)=>void;
  onArchive?:(card:PaymentCard)=>void|Promise<void>;
  archiveDisabled?:boolean;
  detailsEditor?:ReactNode;
  onOpenCredit?:()=>void;
}){
  const [revealed,setRevealed]=useState<Secrets>({});
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [deleteOpen,setDeleteOpen]=useState(false);
  const [deleteProgress,setDeleteProgress]=useState(0);
  const [deleteOffset,setDeleteOffset]=useState(0);
  const cardRef=useRef<HTMLElement>(null);
  const archivingRef=useRef(false);
  const sliderRef=useRef<HTMLDivElement>(null);
  const theme=cardThemeClass(card);
  const visible=Boolean(revealed.pan||revealed.expiry||revealed.cvv);
  const tiltEnabled=useMemo(()=>typeof window==='undefined'||!window.matchMedia('(prefers-reduced-motion: reduce)').matches,[]);

  const loadSecrets=async()=>{
    setBusy(true);setMessage('');
    try{
      // A missing server vault entry is not a successful reveal.
      const server=await revealCardSecret(card.id);
      if(!server.pan&&!server.expiry&&!server.cvv){
        setMessage('Δεν υπάρχουν αποθηκευμένα πλήρη στοιχεία για αυτή την κάρτα.');
        setRevealed({});
        return null;
      }
      setRevealed(server);return server;
    }catch(error){setRevealed({});setMessage(cardVaultErrorMessage(error));return null}
    finally{setBusy(false)}
  };

  const toggleReveal=async()=>{if(visible){setRevealed({});return}await loadSecrets()};
  const copy=async(field:keyof Secrets,label:string)=>{
    const current=revealed[field]||(await loadSecrets())?.[field];if(!current)return;
    try{await navigator.clipboard.writeText(current);setMessage(`${label} αντιγράφηκε.`)}catch{setMessage('Δεν ήταν δυνατή η αντιγραφή.')}
  };
  const resetDelete=()=>{setDeleteOpen(false);setDeleteProgress(0);setDeleteOffset(0)};
  const commitArchive=async()=>{
    if(!onArchive||archiveDisabled||archivingRef.current)return;
    archivingRef.current=true;
    setBusy(true);setMessage('');
    try{
      if(cardRef.current)await playArchiveShred(cardRef.current);
      await onArchive(card);
      setRevealed({});resetDelete();setMessage('Η κάρτα αρχειοθετήθηκε και μπορεί να επανέλθει με τα ίδια στοιχεία.');
    }catch{
      setMessage('Η αρχειοθέτηση δεν ολοκληρώθηκε. Η κάρτα παραμένει διαθέσιμη.');
      resetDelete();
    }finally{archivingRef.current=false;setBusy(false)}
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
    <article ref={cardRef} data-command-card-id={card.id} tabIndex={-1} className={`payment-card r-payment-card prototype-payment-card ${theme} ${deleteOpen?'delete-armed':''} ${large?'is-large':''}`} style={{'--delete-p':deleteProgress} as React.CSSProperties} onPointerMove={pointerMove} onPointerLeave={resetTilt} aria-label={`${cardLabel(card)} · ${bank.name}`}>
      <div className="card-inner">
        {detailsEditor ? detailsEditor : <>
        <header className="card-header">
          <div className="card-brand-block"><div className="card-brand"><PrototypeBrand card={card} bank={bank}/></div><div className="card-nickname">{card.nickname}</div></div>
          <div className="card-toolbar">
            <button className="card-icon-btn card-icon-reveal" type="button" disabled={busy} aria-pressed={visible} aria-label={visible?'Απόκρυψη στοιχείων':'Εμφάνιση στοιχείων'} title={visible?'Απόκρυψη στοιχείων':'Εμφάνιση στοιχείων'} onClick={()=>void toggleReveal()}>{visible?<EyeOff/>:<Eye/>}</button>
            {(onEditDetails||onEditCard)?<button className="card-icon-btn card-icon-management" type="button" disabled={busy} aria-label={`Επεξεργασία κάρτας ${card.nickname}`} title="Επεξεργασία στοιχείων" onClick={()=>{if(onEditDetails)onEditDetails(card);else onEditCard?.(card)}}><Pencil/></button>:null}
            {onArchive?<button className="card-icon-btn card-icon-management" type="button" disabled={busy||archiveDisabled} aria-label="Αρχειοθέτηση κάρτας" title="Αρχειοθέτηση κάρτας" onClick={()=>{setDeleteProgress(0);setDeleteOffset(0);setDeleteOpen(true)}}><Archive/></button>:null}
          </div>
        </header>
        <div className="card-body">
          <div className="card-number-wrap"><div className={`card-number ${visible&&revealed.pan?'revealed':'masked'}`}>{number}</div><button className="copy-mini" type="button" disabled={busy} aria-label="Αντιγραφή αριθμού" title="Αντιγραφή αριθμού" onClick={()=>void copy('pan','Ο αριθμός κάρτας')}><Copy/></button></div>
          <div className="card-fields">
            <div className="card-field"><span className="card-field-label">VALID THRU</span><div className="card-field-line"><span className={`card-field-value ${visible?'':'masked'}`}>{shownExpiry}</span><button className="copy-mini" type="button" disabled={busy} aria-label="Αντιγραφή λήξης" title="Αντιγραφή λήξης" onClick={()=>void copy('expiry','Η λήξη')}><Copy/></button></div></div>
            <div className="card-field"><span className="card-field-label">CVV</span><div className="card-field-line"><span className={`card-field-value ${visible?'':'masked'}`}>{shownCvv}</span><button className="copy-mini" type="button" disabled={busy} aria-label="Αντιγραφή CVV" title="Αντιγραφή CVV" onClick={()=>void copy('cvv','Το CVV')}><Copy/></button></div></div>
            <CardNetworkMark network={card.network} detail={kindLabel(card)}/>
          </div>
        </div>
        {deleteOpen?<div className="delete-confirm r-card-archive-confirm"><div className="delete-confirm-head"><div className="delete-confirm-copy"><b>Αρχειοθέτηση κάρτας;</b><small>Σύρε μέχρι τέρμα για επιβεβαίωση. Η κάρτα θα μεταφερθεί στο αρχείο και μπορεί να επανέλθει με τα ίδια στοιχεία.</small></div><button className="delete-cancel" type="button" aria-label="Ακύρωση αρχειοθέτησης" title="Ακύρωση αρχειοθέτησης" onClick={resetDelete}><X/></button></div><div ref={sliderRef} className="delete-slider" style={{'--p':deleteProgress} as React.CSSProperties}><span className="delete-slider-label">ΣΥΡΕ ΓΙΑ ΑΡΧΕΙΟΘΕΤΗΣΗ</span><button className="delete-slider-thumb r-card-archive-keyboard" type="button" aria-label="Σύρε για αρχειοθέτηση" title="Αρχειοθέτηση κάρτας" style={{transform:`translateX(${deleteOffset}px)`}} onClick={e=>{if(e.detail===0)void commitArchive()}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);moveDelete(e.clientX)}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))moveDelete(e.clientX)}} onPointerUp={e=>{try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}if(deleteProgress>=.92){setDeleteProgress(1);void commitArchive()}else{setDeleteProgress(0);setDeleteOffset(0)}}} onPointerCancel={()=>{setDeleteProgress(0);setDeleteOffset(0)}}><Archive/><span className="sr-only">Αρχειοθέτηση</span></button></div></div>:null}
        </>}
      </div>
    </article>
    {message?<div className="r-card-status" role="alert" aria-live="assertive">{message}</div>:null}
  </div>;
}
