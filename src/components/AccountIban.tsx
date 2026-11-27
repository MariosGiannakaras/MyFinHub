import { Check, Copy, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  const copyInFlight=useRef(false);
  const successResetTimer=useRef<number|null>(null);
  useEffect(()=>()=>{if(successResetTimer.current!==null)window.clearTimeout(successResetTimer.current)},[]);
  const record=metadata.records[accountId];
  const iban=record?.iban??null;
  const formattedIban=iban?formatIban(iban):'';
  const compact=variant==='dashboard';
  const visibleIban=iban?(compact?compactIban(formattedIban):formattedIban):'';
  const copyLabel=formattedIban?(compact?'Αντιγραφή IBAN':`Αντιγραφή IBAN ${formattedIban}`):'';
  const copy=async()=>{
    if(!iban||copyInFlight.current)return;
    // Lock before any clipboard promise. A second click must not race the
    // first result or leave an earlier success/error announcement visible.
    copyInFlight.current=true;
    if(successResetTimer.current!==null){
      window.clearTimeout(successResetTimer.current);
      successResetTimer.current=null;
    }
    setCopied(false);setCopyError(false);
    try{
      await copyTextWithFallback(iban);
      setCopied(true);
      successResetTimer.current=window.setTimeout(()=>{
        setCopied(false);successResetTimer.current=null;
      },1800);
    }catch{setCopyError(true)}
    finally{copyInFlight.current=false}
  };
  return <div className={`account-iban${compact?' account-iban-dashboard':''}`} data-account-iban={accountId}>
    {!compact?<span className="account-iban-label">IBAN</span>:null}
    {metadata.loading&&!metadata.loaded?<span className="account-iban-value">Φόρτωση…</span>:iban?<span className="account-iban-value" title={visibleIban}>{visibleIban}</span>:<span className="account-iban-value muted">{fallback??'Δεν έχει οριστεί'}</span>}
    {iban?<IconButton type="button" className="inline-icon-action account-iban-copy" data-copy-error={copyError||undefined} aria-label={copyError?'Η αντιγραφή IBAN απέτυχε. Δοκίμασε ξανά.':copyLabel} title={copyError?'Η αντιγραφή IBAN απέτυχε. Δοκίμασε ξανά.':copyLabel} onClick={()=>void copy()}>{copied?<Check size={14} aria-hidden="true"/>:copyError?<X size={14} aria-hidden="true"/>:<Copy size={14} aria-hidden="true"/>}</IconButton>:null}
    {copied?<span className="sr-only" role="status" aria-live="polite">Το IBAN αντιγράφηκε.</span> : null}
    {copyError?<span className="sr-only" role="alert" aria-live="assertive">Η αντιγραφή IBAN απέτυχε. Δοκίμασε ξανά.</span> : null}
  </div>;
}
