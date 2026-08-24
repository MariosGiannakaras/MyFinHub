import { RefreshCw, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAccountMetadata } from '../hooks/useAccountMetadata';
import { refreshAccountMetadata, saveAccountMetadata } from '../lib/accountMetadataClient';
import { allAccounts } from '../lib/domain';
import { formatIban, isValidIban, normalizeIban } from '../lib/iban';
import { accountDisplayName } from '../lib/ui';
import type { FinanceData } from '../types';
import '../styles/part47.css';

export function AccountMetadataSettings({data}:{data:FinanceData}){
  const metadata=useAccountMetadata();
  const accounts=useMemo(()=>allAccounts(data).filter(account=>account.kind!=='credit'),[data]);
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [dirty,setDirty]=useState<Record<string,boolean>>({});
  const [busy,setBusy]=useState<Record<string,boolean>>({});
  const [messages,setMessages]=useState<Record<string,string>>({});
  const revisionKey=Object.values(metadata.records).map(record=>`${record.accountId}:${record.revision}`).sort().join('|');

  useEffect(()=>{
    setDrafts(current=>{
      const next={...current};
      for(const account of accounts)if(!dirty[account.id])next[account.id]=formatIban(metadata.records[account.id]?.iban??'');
      return next;
    });
  },[accounts,dirty,metadata.loaded,revisionKey]);

  const save=async(accountId:string)=>{
    const raw=drafts[accountId]??'';
    if(!isValidIban(raw)){setMessages(current=>({...current,[accountId]:'Έλεγξε το IBAN. Χρειάζεται έγκυρη διεθνής μορφή και checksum.'}));return}
    setBusy(current=>({...current,[accountId]:true}));
    try{
      const record=await saveAccountMetadata(accountId,normalizeIban(raw));
      setDrafts(current=>({...current,[accountId]:formatIban(record.iban)}));
      setDirty(current=>({...current,[accountId]:false}));
      setMessages(current=>({...current,[accountId]:record.iban?'Το IBAN αποθηκεύτηκε.':'Το IBAN αφαιρέθηκε από τον ενεργό λογαριασμό.'}));
    }catch(error){setMessages(current=>({...current,[accountId]:error instanceof Error?error.message:'Δεν ήταν δυνατή η αποθήκευση του IBAN.'}))}
    finally{setBusy(current=>({...current,[accountId]:false}))}
  };

  return <section className="panel neo-raised account-metadata-settings" aria-labelledby="account-metadata-title">
    <div className="panel-head"><div><span id="account-metadata-title">IBAN λογαριασμών</span><small>Αποθηκεύεται σε ξεχωριστό owner-only metadata store με stable account ID. Δεν μπαίνει στο FinanceData, στο ledger ή στο finance Undo/Redo.</small></div><button type="button" className="secondary" disabled={metadata.loading} onClick={()=>void refreshAccountMetadata(true)}><RefreshCw size={15} aria-hidden="true"/> Ανανέωση</button></div>
    {metadata.error?<div className="logic-note compact" role="status"><span>Τα οικονομικά δεδομένα παραμένουν διαθέσιμα, αλλά το account metadata δεν φορτώθηκε: {metadata.error}</span></div>:null}
    <div className="account-metadata-list">
      {accounts.map(account=>{
        const value=drafts[account.id]??'';
        const invalid=Boolean(value.trim())&&!isValidIban(value);
        return <div className="account-metadata-row" key={account.id} data-account-metadata-row={account.id}>
          <div className="account-metadata-identity"><b>{accountDisplayName(data,account.id)}</b><small>{account.kind==='cash'?'Ο λογαριασμός μπορεί να μείνει χωρίς IBAN.':'Stable account metadata'}</small></div>
          <label><span>IBAN</span><input inputMode="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false} aria-invalid={invalid||undefined} value={value} placeholder="π.χ. GR16 0110 …" onChange={event=>{setDrafts(current=>({...current,[account.id]:event.target.value.toUpperCase()}));setDirty(current=>({...current,[account.id]:true}));setMessages(current=>({...current,[account.id]:''}))}}/></label>
          <button type="button" className="save-button" disabled={Boolean(busy[account.id])||invalid||!dirty[account.id]} onClick={()=>void save(account.id)}><Save size={15} aria-hidden="true"/> Αποθήκευση</button>
          {messages[account.id]?<small className={invalid?'form-error':''} role="status" aria-live="polite">{messages[account.id]}</small>:null}
        </div>;
      })}
    </div>
  </section>;
}
