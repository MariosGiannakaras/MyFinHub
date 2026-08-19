import { Plus, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BankBrandMark } from './BankBrandMark';
import { useModalFocus } from '../hooks/useModalFocus';
import { cardThemeClass, designsForBank } from '../lib/cardDesigns';
import { archivedCardMatch, archivedCardsForBank, restoreCard } from '../lib/cards';
import type { CardBank, CardKind, CardNetwork, FinanceData, PaymentCard } from '../types';

export function CardCreateDialog({
  open,data,banks,initialBankId,kindLock,onClose,onSave,
}:{
  open:boolean;data:FinanceData;banks:CardBank[];initialBankId?:string;kindLock?:CardKind;
  onClose:()=>void;onSave:(card:PaymentCard)=>void;
}){
  const [bankId,setBankId]=useState(initialBankId||banks[0]?.id||'piraeus');
  const [nickname,setNickname]=useState('');
  const [kind,setKind]=useState<CardKind>(kindLock||'debit');
  const [network,setNetwork]=useState<CardNetwork>('visa');
  const [designId,setDesignId]=useState('');
  const [holder,setHolder]=useState('');
  const [last4,setLast4]=useState('');
  const [error,setError]=useState('');
  const ref=useModalFocus<HTMLElement>(open,'[data-autofocus="true"]');
  const bank=banks.find(item=>item.id===bankId)??banks[0];
  const designs=useMemo(()=>designsForBank(bank?.id||'custom'),[bank?.id]);
  const lockedDesigns=kindLock?designs.filter(item=>item.kind===kindLock):designs;
  // The prototype's catalog has banks whose real-world samples are all debit.
  // A locked credit record may still reuse that bank's visual surface: design
  // is presentation metadata, while `kind` remains the authoritative model.
  const displayedDesigns=lockedDesigns.length?lockedDesigns:designs;
  const selected=displayedDesigns.find(item=>item.id===designId)??displayedDesigns[0];
  const archived=bank?archivedCardsForBank(data,bank.id).filter(card=>!kindLock||card.kind===kindLock):[];

  useEffect(()=>{
    if(!open)return;
    const nextBank=initialBankId&&banks.some(item=>item.id===initialBankId)?initialBankId:banks[0]?.id||'piraeus';
    setBankId(nextBank);setNickname('');setKind(kindLock||'debit');setNetwork('visa');setHolder('');setLast4('');setError('');
    const options=designsForBank(nextBank);const matching=kindLock?options.filter(item=>item.kind===kindLock):options;const usable=matching.length?matching:options;const preferred=usable[0];
    setDesignId(preferred?.id||'');if(preferred)setNetwork(preferred.network);
  },[open,initialBankId,kindLock,banks]);

  if(!open||!bank)return null;
  const resolvedKind=kindLock||kind;
  const preview:PaymentCard={id:'preview',bankId:bank.id,nickname:nickname.trim()||'Όνομα κάρτας',kind:resolvedKind,network,formFactor:selected?.formFactor,designId:selected?.id,holderName:holder.trim()||undefined,last4:last4.replace(/\D/g,'')||undefined,active:true,createdAt:'',updatedAt:''};

  const pickDesign=(id:string)=>{
    const item=displayedDesigns.find(option=>option.id===id);if(!item)return;
    setDesignId(item.id);if(!kindLock)setKind(item.kind);setNetwork(item.network);setError('');
  };
  const changeBank=(next:string)=>{
    setBankId(next);const options=designsForBank(next);const matching=kindLock?options.filter(item=>item.kind===kindLock):options;const usable=matching.length?matching:options;const preferred=usable[0];
    setDesignId(preferred?.id||'');if(preferred)setNetwork(preferred.network);setError('');
  };
  const submit=()=>{
    const name=nickname.trim();const digits=last4.replace(/\D/g,'');
    if(!name){setError('Συμπλήρωσε όνομα κάρτας.');return}
    if(digits&&digits.length!==4){setError('Τα τελευταία ψηφία πρέπει να είναι ακριβώς 4.');return}
    if(!selected){setError('Επίλεξε σχέδιο κάρτας.');return}
    const match=archivedCardMatch(data,{bankId:bank.id,kind:resolvedKind,last4:digits||undefined});
    if(match){
      const restored=restoreCard({...match,nickname:name,network,formFactor:selected.formFactor,designId:selected.id,holderName:holder.trim()||match.holderName,last4:digits||match.last4});
      onSave(restored);onClose();return;
    }
    const now=new Date().toISOString();
    onSave({id:`card-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,bankId:bank.id,nickname:name,kind:resolvedKind,network,formFactor:selected.formFactor,designId:selected.id,holderName:holder.trim()||undefined,last4:digits||undefined,active:true,createdAt:now,updatedAt:now});
    onClose();
  };

  return <div className="editor-backdrop card-create-backdrop" onMouseDown={onClose}>
    <section ref={ref} className="panel neo-raised editor-dialog card-create-dialog" role="dialog" aria-modal="true" aria-labelledby="card-create-title" tabIndex={-1} onMouseDown={event=>event.stopPropagation()} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();onClose()}}}>
      <div className="card-create-preview-stage" aria-label="Προεπισκόπηση νέας κάρτας">
        <article className={`r-payment-card is-preview ${cardThemeClass(preview)}`}>
          <div className="r-card-inner"><header className="r-card-head"><div className="r-card-brand"><BankBrandMark id={bank.id} name={bank.name} compact={false}/><div><b>{bank.name}</b><small>{preview.nickname}</small></div></div></header><div className="r-card-spacer"/><div className="r-card-number-line"><span>{digitsPreview(last4)}</span></div><div className="r-card-fields"><div><small>VALID THRU</small><span>MM/YY</span></div><div><small>CVV · LOCAL</small><span>•••</span></div><div className="r-card-network"><b>{network==='mastercard'?'Mastercard':network==='visa'?'Visa':'Card'}</b><small>{resolvedKind==='credit'?'Πιστωτική':resolvedKind==='prepaid'?'Prepaid':'Χρεωστική'}{selected?.formFactor==='virtual'?' · Virtual':''}</small></div></div></div>
        </article>
      </div>
      <div className="panel-head card-create-head"><div><span id="card-create-title">{kindLock==='credit'?'Νέα πιστωτική κάρτα':'Νέα κάρτα'}</span><small>Διάλεξε ταυτότητα και εμφάνιση. PAN/λήξη και CVV προστίθενται μετά από το ασφαλές editor της ίδιας κάρτας.</small></div><button type="button" className="icon-button" aria-label="Κλείσιμο" onClick={onClose}><X/></button></div>
      <div className="settings-form editor-grid card-create-fields">
        {banks.length>1?<label><span>Τράπεζα</span><select value={bank.id} onChange={event=>changeBank(event.target.value)}>{banks.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>:null}
        <label><span>Όνομα κάρτας</span><input data-autofocus="true" maxLength={80} value={nickname} onChange={event=>setNickname(event.target.value)} placeholder="π.χ. Everyday"/></label>
        {!kindLock?<label><span>Τύπος</span><select value={kind} onChange={event=>setKind(event.target.value as CardKind)}><option value="debit">Χρεωστική</option><option value="credit">Πιστωτική</option><option value="prepaid">Prepaid</option></select></label>:null}
        <label><span>Δίκτυο</span><select value={network} onChange={event=>setNetwork(event.target.value as CardNetwork)}><option value="visa">Visa</option><option value="mastercard">Mastercard</option><option value="other">Άλλο</option></select></label>
        <label><span>Κάτοχος</span><input maxLength={120} value={holder} onChange={event=>setHolder(event.target.value)} placeholder="Προαιρετικό"/></label>
        <label><span>Τελευταία 4 ψηφία</span><input inputMode="numeric" maxLength={4} value={last4} onChange={event=>setLast4(event.target.value.replace(/\D/g,'').slice(0,4))} placeholder="1234"/></label>
      </div>
      <div className="card-design-field"><span>Σχέδιο / χρώμα</span><div className="card-design-grid" role="radiogroup" aria-label="Σχέδιο κάρτας">{displayedDesigns.map(item=><button key={item.id} type="button" role="radio" aria-checked={selected?.id===item.id} className="card-design-option" onClick={()=>pickDesign(item.id)}><i style={{background:item.swatch}}/><b>{item.label}</b><small>{item.note}</small></button>)}</div></div>
      {archived.length?<div className="archived-card-candidates"><b>Υπάρχουν αρχειοθετημένες κάρτες</b><span>Αν ταιριάζει η ίδια κάρτα, επανάφερέ την ώστε να κρατήσει το ίδιο id, vault και ιστορικό.</span>{archived.slice(0,4).map(item=><button type="button" key={item.id} onClick={()=>{onSave(restoreCard(item));onClose()}}><RotateCcw/> {item.nickname}{item.last4?` · •••• ${item.last4}`:''}</button>)}</div>:null}
      {error?<div className="form-error" role="alert">{error}</div>:null}
      <div className="editor-actions"><button type="button" className="secondary" onClick={onClose}>Ακύρωση</button><button type="button" className="save-button" onClick={submit}><Plus/> {archivedCardMatch(data,{bankId:bank.id,kind:resolvedKind,last4:last4||undefined})?'Επαναφορά κάρτας':'Προσθήκη κάρτας'}</button></div>
    </section>
  </div>;
}

function digitsPreview(last4:string){const digits=last4.replace(/\D/g,'');return digits.length===4?`•••• •••• •••• ${digits}`:'•••• •••• •••• ••••';}