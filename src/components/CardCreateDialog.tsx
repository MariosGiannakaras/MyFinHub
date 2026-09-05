import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppSelectInput } from './AppSelectInput';
import { BankBrandMark } from './BankBrandMark';
import { FormError } from './FormError';
import { useModalFocus } from '../hooks/useModalFocus';
import { cardThemeClass, designsForBank } from '../lib/cardDesigns';
import type { CardBank, CardKind, CardNetwork, FinanceData, PaymentCard } from '../types';

function kindLabel(kind:CardKind,virtual=false){return virtual?'Virtual':kind==='credit'?'Credit':kind==='prepaid'?'Prepaid':'Debit'}
function kindOptionLabel(kind:CardKind){return kind==='credit'?'Πιστωτική':kind==='prepaid'?'Προπληρωμένη':'Χρεωστική'}

export function CardCreateDialog({
  open,data:_data,banks,initialBankId,kindLock,allowedKinds,onClose,onSave,
}:{
  open:boolean;data:FinanceData;banks:CardBank[];initialBankId?:string;kindLock?:CardKind;allowedKinds?:CardKind[];
  onClose:()=>void;onSave:(card:PaymentCard)=>void;
}){
  const allowedKindsKey=allowedKinds?.join('|')??'';
  const selectableKinds:CardKind[]=kindLock?[kindLock]:(allowedKinds?.length?allowedKinds:['debit','credit','prepaid']);
  const [bankId,setBankId]=useState(initialBankId||banks[0]?.id||'piraeus');
  const [nickname,setNickname]=useState('');
  const [kind,setKind]=useState<CardKind>(kindLock||selectableKinds[0]||'debit');
  const [network,setNetwork]=useState<CardNetwork>('visa');
  const [designId,setDesignId]=useState('');
  const [error,setError]=useState('');
  const ref=useModalFocus<HTMLElement>(open,'[data-autofocus="true"]',onClose);
  const bank=banks.find(item=>item.id===bankId)??banks[0];
  const designs=useMemo(()=>designsForBank(bank?.id||'custom'),[bank?.id]);
  const resolvedKind=kindLock||kind;
  const displayedDesigns=resolvedKind==='credit'
    ? designs.filter(item=>item.kind==='credit')
    : resolvedKind==='prepaid'
      ? designs.filter(item=>item.kind!=='credit')
      : designs.filter(item=>item.kind==='debit');
  const selected=displayedDesigns.find(item=>item.id===designId);

  useEffect(()=>{
    if(!open)return;
    const nextBank=initialBankId&&banks.some(item=>item.id===initialBankId)?initialBankId:banks[0]?.id||'piraeus';
    const nextKind=kindLock||(allowedKindsKey?allowedKindsKey.split('|')[0] as CardKind:'debit');
    setBankId(nextBank);setNickname('');setKind(nextKind);setNetwork('visa');setDesignId('');setError('');
  },[open,initialBankId,kindLock,banks,allowedKindsKey]);

  if(!open||!bank)return null;
  const preview:PaymentCard={id:'preview',bankId:bank.id,nickname:nickname.trim()||'Όνομα κάρτας',kind:resolvedKind,network,formFactor:selected?.formFactor,designId:selected?.id,active:true,createdAt:'',updatedAt:''};

  const pickDesign=(id:string)=>{
    const item=displayedDesigns.find(option=>option.id===id);if(!item)return;
    setDesignId(item.id);setNetwork(item.network);setError('');
  };
  const changeBank=(next:string)=>{setBankId(next);setDesignId('');setError('')};
  const submit=()=>{
    const name=nickname.trim();if(!name){setError('Γράψε ένα όνομα για την κάρτα ώστε να μπορείς να την ξεχωρίζεις.');return}if(!selected){setError('Διάλεξε σχέδιο ή χρώμα για να συνεχίσεις.');return}
    const now=new Date().toISOString();
    onSave({id:`card-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,bankId:bank.id,nickname:name,kind:resolvedKind,network,formFactor:selected.formFactor,designId:selected.id,active:true,createdAt:now,updatedAt:now});onClose();
  };

  return <div className="picker-backdrop open prototype-card-picker" aria-hidden="false" onMouseDown={onClose}>
    <section ref={ref} className="picker card-create-modal neo-raised" role="dialog" aria-modal="true" aria-labelledby="card-create-title" aria-describedby={error?'card-create-error':undefined} tabIndex={-1} onMouseDown={event=>event.stopPropagation()}>
      <div className="picker-head"><div><h2 id="card-create-title">{kindLock==='credit'?'Νέα πιστωτική κάρτα':`Νέα κάρτα${banks.length===1?` · ${bank.name}`:''}`}</h2><p>Συμπλήρωσε τα βασικά χαρακτηριστικά. Μετά θα γράψεις αριθμό, λήξη και CVV απευθείας πάνω στην κάρτα.</p></div><button className="icon-button close-picker" type="button" aria-label="Κλείσιμο" onClick={onClose}>×</button></div>
      <div className="card-preview-stage" aria-label="Προεπισκόπηση νέας κάρτας"><div className="card-preview-shell"><article className={`payment-card prototype-payment-card ${selected?cardThemeClass(preview):'card-preview-neutral'}`}><div className="card-inner"><header className="card-header"><div className="card-brand-block"><div className="card-brand"><BankBrandMark id={bank.id} name={bank.name} compact={false}/></div><div className="card-nickname">{preview.nickname}</div></div></header><div className="card-body"><div className="card-number-wrap"><div className="card-number preview-placeholder">•••• •••• •••• ••••</div></div><div className="card-fields"><div className="card-field"><span className="card-field-label">VALID THRU</span><div className="card-field-line"><span className="card-field-value preview-placeholder">MM/YY</span></div></div><div className="card-field"><span className="card-field-label">CVV</span><div className="card-field-line"><span className="card-field-value preview-placeholder">CVV</span></div></div><div className="card-network visa-network"><span className="card-network-main">{network==='mastercard'?'MASTERCARD':'VISA'}</span><span className="card-network-type">{kindLabel(resolvedKind,selected?.formFactor==='virtual')}</span></div></div></div></div></article></div></div>
      <div className="modal-form-grid">
        {banks.length>1?<div className="modal-field"><label>Τράπεζα</label><AppSelectInput aria-label="Τράπεζα νέας κάρτας" value={bank.id} onChange={event=>changeBank(event.target.value)}>{banks.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</AppSelectInput></div>:null}
        <div className="modal-field"><label>Όνομα κάρτας</label><input data-autofocus="true" maxLength={36} value={nickname} onChange={event=>setNickname(event.target.value)} placeholder="π.χ. Blue Debit"/></div>
        {!kindLock&&selectableKinds.length>1?<div className="modal-field"><label>Τύπος</label><AppSelectInput aria-label="Τύπος νέας κάρτας" value={kind} onChange={event=>{setKind(event.target.value as CardKind);setDesignId('')}}>{selectableKinds.map(item=><option key={item} value={item}>{kindOptionLabel(item)}</option>)}</AppSelectInput></div>:null}
        <div className="modal-field"><label>Δίκτυο</label><AppSelectInput aria-label="Δίκτυο νέας κάρτας" value={network} onChange={event=>setNetwork(event.target.value as CardNetwork)}><option value="visa">Visa</option><option value="mastercard">Mastercard</option></AppSelectInput></div>
        <div className="modal-field design-field"><label>Σχέδιο / χρώμα</label><div className="design-picker" role="radiogroup" aria-label="Σχέδιο κάρτας">{displayedDesigns.map(item=><button key={item.id} type="button" className="design-option" role="radio" aria-checked={selected?.id===item.id} onClick={()=>pickDesign(item.id)}><span className="design-swatch" style={{background:item.swatch}}/><b>{item.label}</b><small>{item.note}</small></button>)}</div></div>
      </div>
      {error?<FormError id="card-create-error">{error}</FormError>:null}
      <div className="modal-actions"><button type="button" className="secondary modal-secondary" onClick={onClose}>Ακύρωση</button><button type="button" className="save-button modal-primary" onClick={submit}><Plus/> Προσθήκη κάρτας</button></div>
    </section>
  </div>;
}
