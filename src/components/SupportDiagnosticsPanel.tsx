import { formatLocalTimestamp } from '../lib/formatTimestamp';
import { ClipboardCopy, Wrench } from 'lucide-react';
import { useState } from 'react';
import type { FinanceData } from '../types';
import { allAccounts, effectiveLegacyTransactions } from '../lib/domain';
import { copyTextWithFallback } from '../lib/copyTextWithFallback';
import { Button } from './Button';
import { OperationFeedback } from './OperationFeedback';

type Props={
  data:FinanceData;
  filePath:string;
  lastSavedAt:string|null;
};

function compactPath(value:string){
  const normalized=String(value||'').replace(/\\/g,'/');
  const parts=normalized.split('/').filter(Boolean);
  return parts.at(-1)||'—';
}

function diagnostics(data:FinanceData,filePath:string,lastSavedAt:string|null){
  return {
    app:data.app,
    schemaVersion:data.schemaVersion,
    updatedAt:data.updatedAt,
    lastSavedAt:lastSavedAt??null,
    storage:compactPath(filePath),
    counts:{
      accounts:allAccounts(data).length,
      transactions:effectiveLegacyTransactions(data).length,
      events:(data.state.events??[]).length,
      recurring:(data.seed.recurring?.length??0)+(data.state.recurringCustom?.length??0),
      cards:(data.state.cards??[]).length,
      loans:(data.seed.loans?.length??0)+(data.state.customLoans?.length??0),
      savingsGoals:(data.state.savingsGoals??[]).length,
      budgets:(data.state.budgets??[]).length,
      rules:(data.state.transactionRules??[]).length,
    },
  };
}

export function SupportDiagnosticsPanel({data,filePath,lastSavedAt}:Props){
  const[message,setMessage]=useState('');
  const[copyError,setCopyError]=useState(false);
  const snapshot=diagnostics(data,filePath,lastSavedAt);
  const copy=async()=>{
    setMessage('');
    try{
      await copyTextWithFallback(JSON.stringify(snapshot,null,2));
      setCopyError(false);
      setMessage('Τα ασφαλή διαγνωστικά αντιγράφηκαν.');
    }catch{
      setCopyError(true);
      setMessage('Δεν ήταν δυνατή η αντιγραφή διαγνωστικών.');
    }
  };
  return <section className="panel surface-raised support-diagnostics" aria-labelledby="support-diagnostics-title">
    <div className="panel-head"><div><span id="support-diagnostics-title">Διαγνωστικά υποστήριξης</span><small>Μόνο για development/support builds. Δεν περιλαμβάνονται ποσά, περιγραφές συναλλαγών, στοιχεία κάρτας ή tokens.</small></div><Wrench/></div>
    <div className="support-diagnostics-grid">
      <span><small>Έκδοση σχήματος</small><b>{snapshot.schemaVersion}</b></span>
      <span><small>Λογαριασμοί</small><b>{snapshot.counts.accounts}</b></span>
      <span><small>Συναλλαγές</small><b>{snapshot.counts.transactions}</b></span>
      <span><small>Κινήσεις</small><b>{snapshot.counts.events}</b></span>
      <span><small>Πάγια</small><b>{snapshot.counts.recurring}</b></span>
      <span><small>Κάρτες</small><b>{snapshot.counts.cards}</b></span>
      <span><small>Δάνεια</small><b>{snapshot.counts.loans}</b></span>
      <span><small>Στόχοι αποταμίευσης</small><b>{snapshot.counts.savingsGoals}</b></span>
      <span><small>Προϋπολογισμοί</small><b>{snapshot.counts.budgets}</b></span>
      <span><small>Κανόνες</small><b>{snapshot.counts.rules}</b></span>
      <span><small>Αποθήκευση</small><b>{snapshot.storage}</b></span>
      <span><small>Τελευταία αποθήκευση</small><b>{formatLocalTimestamp(snapshot.lastSavedAt)}</b></span>
    </div>
    <div className="editor-actions"><Button type="button" variant="secondary" onClick={()=>void copy()}><ClipboardCopy size={15}/> Αντιγραφή ασφαλών διαγνωστικών</Button></div>
    {message?<OperationFeedback className="logic-note compact" tone={copyError?'error':'success'}>{message}</OperationFeedback>:null}
  </section>;
}
