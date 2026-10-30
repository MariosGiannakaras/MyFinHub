import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useAccountMetadata } from '../hooks/useAccountMetadata';
import { formatIban } from '../lib/iban';
import { copyTextWithFallback } from '../lib/copyTextWithFallback';
import { IconButton } from './IconButton';

function compactIban(value:string){
  const normalized=value.replace(/\s+/g,'');
  if(normalized.length<=8)return value;
  return `${normalized.slice(0,4)} •••• •••• •••• ${normalized.slice(-4)}`;
}

export function AccountIban({accountId,variant='default',fallback}:{accountId:string;variant?:'default'|'dashboard';fallback?:string}){
  const metadata=useAccountMetadata();
  const [copied,setCopied]=useState(false);
  const [copyError,setCopyError]=useState(false);
  const record=metadata.records[accountId];
  const iban=record?.iban??null;
  const formattedIban=iban?formatIban(iban):'';
  const compact=variant==='dashboard';
  const visibleIban=iban?(compact?compactIban(formattedIban):formattedIban):'';
  const copyLabel=formattedIban?(compact?'Αντιγραφή IBAN':`Αντιγραφή IBAN ${formattedIban}`):'';
  const copy=async()=>{
    if(!iban)return;
    try{await copyTextWithFallback(iban);setCopyError(false);setCopied(true);window.setTimeout(()=>setCopied(false),1800)}catch{setCopied(false);setCopyError(true)}
  };
  return <div className={`account-iban${compact?' account-iban-dashboard':''}`} data-account-iban={accountId}>
    {!compact?<span className="account-iban-label">IBAN</span>:null}
    {metadata.loading&&!metadata.loaded?<span className="account-iban-value">Φόρτωση…</span>:iban?<span className="account-iban-value" title={visibleIban}>{visibleIban}</span>:<span className="account-iban-value muted">{fallback??'Δεν έχει οριστεί'}</span>}
    {iban?<IconButton type="button" className="inline-icon-action account-iban-copy" aria-label={copyLabel} title={copyLabel} onClick={()=>void copy()}>{copied?<Check size={14} aria-hidden="true"/>:<Copy size={14} aria-hidden="true"/>}</IconButton>:null}
    {copied?<span className="sr-only" role="status" aria-live="polite">Το IBAN αντιγράφηκε.</span> : null}
    {copyError?<span className="sr-only" role="alert" aria-live="assertive">Η αντιγραφή IBAN απέτυχε. Δοκίμασε ξανά.</span> : null}
  </div>;
}
