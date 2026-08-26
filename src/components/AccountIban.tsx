import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useAccountMetadata } from '../hooks/useAccountMetadata';
import { formatIban } from '../lib/iban';
import '../styles/part47.css';

async function copyText(value:string){
  if(navigator.clipboard?.writeText){
    try{await navigator.clipboard.writeText(value);return}catch{/* fall through to the same-origin legacy copy path */}
  }
  const node=document.createElement('textarea');node.value=value;node.setAttribute('readonly','');node.style.position='fixed';node.style.opacity='0';document.body.append(node);node.select();const ok=document.execCommand('copy');node.remove();if(!ok)throw new Error('COPY_FAILED');
}

export function AccountIban({accountId}:{accountId:string}){
  const metadata=useAccountMetadata();
  const [copied,setCopied]=useState(false);
  const record=metadata.records[accountId];
  const iban=record?.iban??null;
  const formattedIban=iban?formatIban(iban):'';
  const maskedIban=formattedIban?`${formattedIban.slice(0,4)} •••• •••• ${formattedIban.slice(-4)}`:'';
  const copyLabel=formattedIban?`Αντιγραφή IBAN ${formattedIban}`:'';
  const copy=async()=>{
    if(!iban)return;
    try{await copyText(iban);setCopied(true);window.setTimeout(()=>setCopied(false),1800)}catch{setCopied(false)}
  };
  return <div className="account-iban" data-account-iban={accountId}>
    <span className="account-iban-label">IBAN</span>
    {metadata.loading&&!metadata.loaded?<span className="account-iban-value">Φόρτωση…</span>:iban?<span className="account-iban-value" title={formattedIban}>{maskedIban}</span>:<span className="account-iban-value muted">Δεν έχει οριστεί</span>}
    {iban?<button type="button" className="inline-icon-action account-iban-copy" aria-label={copyLabel} title={copyLabel} onClick={()=>void copy()}>{copied?<Check size={14} aria-hidden="true"/>:<Copy size={14} aria-hidden="true"/>}</button>:null}
    {copied?<span className="sr-only" role="status" aria-live="polite">Το IBAN αντιγράφηκε.</span>:null}
  </div>;
}
