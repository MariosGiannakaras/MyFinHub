import { MessageSquareText, Pencil, Search, Trash2 } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { AppSelectInput } from '../components/AppSelectInput';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FinanceIcon } from '../components/FinanceIcon';
import { LegacyTransactionEditor } from '../components/LegacyTransactionEditor';
import { SortDirectionControl, type SortDirection } from '../components/SortDirectionControl';
import { Tooltip } from '../components/Tooltip';
import { TransactionSplitDetails } from '../components/TransactionSplitDetails';
import { categoryPath } from '../lib/categories';
import { allAccounts, effectiveLegacyTransactions, flowImpactEvent, flowImpactLegacy } from '../lib/domain';
import { cleanNote, money, shortDate } from '../lib/format';
import { accountDisplayName, eventKindLabel } from '../lib/ui';
import type { FinanceData, LegacyTransaction, SplitPart } from '../types';

function noteParts(note:string){
  const lines=note.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  return {title:lines[0]||'Χωρίς περιγραφή',comment:lines.slice(1).join('\n')};
}

type TransactionRow={
  id:string;date:string;note:string;category:string;subcategory?:string;accountIds:string[];kind:string;amount:number;
  impact:{income:number;expense:number;saving:number;refund:number};source:'legacy'|'event';parts:SplitPart[];legacy?:LegacyTransaction;overridden?:boolean;
};
type DeleteTarget={id:string;source:'legacy'|'event'};

export function TransactionsPage({
  data,month,onEditEvent,onDeleteEvent,onEditLegacy,onDeleteLegacy,
}:{
  data:FinanceData;month:string;
  onEditEvent:(id:string)=>void;onDeleteEvent:(id:string)=>void;
  onEditLegacy:(transaction:LegacyTransaction)=>void;onDeleteLegacy:(id:string)=>void;
}){
  const [query,setQuery]=useState('');
  const [account,setAccount]=useState('all');
  const [type,setType]=useState('all');
  const [sortDirection,setSortDirection]=useState<SortDirection>('desc');
  const [message,setMessage]=useState('');
  const [editingLegacy,setEditingLegacy]=useState<LegacyTransaction|null>(null);
  const [deleteTarget,setDeleteTarget]=useState<DeleteTarget|null>(null);
  const deferred=useDeferredValue(query.toLocaleLowerCase('el-GR'));
  const accounts=allAccounts(data).filter(item=>item.kind!=='credit');
  const sourceRows=useMemo<TransactionRow[]>(()=>{
    const legacy=effectiveLegacyTransactions(data).filter(t=>t.date.startsWith(month)).map(t=>({
      id:t.id,date:t.date,note:cleanNote(t.note),category:t.category||'Άλλο',subcategory:t.subcategory,
      accountIds:[t.accountId,t.fromAccountId,t.toAccountId].filter(Boolean) as string[],kind:t.type,amount:t.amount,
      impact:flowImpactLegacy(data,t),source:'legacy' as const,parts:[] as SplitPart[],legacy:t,overridden:Boolean(data.state.overrides?.[t.id]),
    }));
    const events=(data.state.events??[]).filter(e=>e.date.startsWith(month)&&!['card_purchase','card_payment'].includes(e.kind)).map(e=>({
      id:e.id,date:e.date,note:e.note,category:e.kind==='split'?'Διαχωρισμός':(e.category||e.kind),subcategory:e.subcategory,
      accountIds:[...new Set(e.legs.map(l=>l.accountId).filter(id=>id!=='credit-card'))],kind:e.kind,amount:e.amount,
      impact:flowImpactEvent(e),source:'event' as const,parts:e.kind==='split'?(e.parts??[]):[],
    }));
    return [...legacy,...events];
  },[data,month]);
  const types=useMemo(()=>[...new Set(sourceRows.map(row=>row.kind))].sort((a,b)=>eventKindLabel(a).localeCompare(eventKindLabel(b),'el')),[sourceRows]);
  const rows=useMemo(()=>{
    const direction=sortDirection==='asc'?1:-1;
    return sourceRows.filter(r=>(account==='all'||r.accountIds.includes(account))&&(type==='all'||r.kind===type)&&(!deferred||`${r.note} ${r.category} ${r.subcategory||''} ${r.kind} ${r.parts.map(part=>`${part.label} ${part.category} ${part.subcategory||''}`).join(' ')}`.toLocaleLowerCase('el-GR').includes(deferred))).sort((a,b)=>direction*(a.date.localeCompare(b.date)||a.id.localeCompare(b.id)));
  },[sourceRows,account,type,deferred,sortDirection]);
  const accountText=(ids:string[])=>ids.map(id=>accounts.find(a=>a.id===id)?.short||accountDisplayName(data,id)).join(' → ')||'—';
  const amountPrefix=(row:{kind:string;impact:{income:number;expense:number}})=>row.kind==='transfer'?'↔ ':row.impact.income>0?'+':row.impact.expense>0?'−':'';
  const metadata=(row:TransactionRow)=>{
    const category=row.kind==='split'?'Επιμέρους κατηγορίες':categoryPath(row.category,row.subcategory);
    if(row.source!=='legacy')return category;
    return `${category} · ${row.overridden?'Ιστορικό · override':'Ιστορικό'}`;
  };
  const edit=(row:TransactionRow)=>{
    setMessage('');
    if(row.source==='event')onEditEvent(row.id);
    else if(row.legacy)setEditingLegacy(row.legacy);
  };
  const askDelete=(row:TransactionRow)=>{setMessage('');setDeleteTarget({id:row.id,source:row.source})};
  const confirmDelete=()=>{
    if(!deleteTarget)return;
    if(deleteTarget.source==='event')onDeleteEvent(deleteTarget.id);
    else onDeleteLegacy(deleteTarget.id);
    setMessage(deleteTarget.source==='legacy'?'Η ιστορική κίνηση εξαιρέθηκε μέσω tombstone και η αλλαγή αποθηκεύεται.':'Η κίνηση αφαιρέθηκε και η αλλαγή αποθηκεύεται.');
    setDeleteTarget(null);
  };
  const saveLegacy=(transaction:LegacyTransaction)=>{onEditLegacy(transaction);setMessage('Η ιστορική κίνηση ενημερώθηκε μέσω override και η αλλαγή αποθηκεύεται.')};
  const rowActions=(row:TransactionRow,title:string,compact=false)=><div className={compact?'mobile-row-actions':'row-actions'}>
    {compact?<button type="button" className="text-button" style={{minHeight:44}} aria-label={`Επεξεργασία ${title}`} onClick={()=>edit(row)}><Pencil size={15}/> Επεξεργασία</button>:<Tooltip label={`Επεξεργασία: ${title}`} side="left"><button type="button" aria-label={`Επεξεργασία ${title}`} onClick={()=>edit(row)}><Pencil/></button></Tooltip>}
    {compact?<button type="button" className="text-button danger-text" style={{minHeight:44}} aria-label={`Διαγραφή ${title}`} onClick={()=>askDelete(row)}><Trash2 size={15}/> Διαγραφή</button>:<Tooltip label={`Διαγραφή: ${title}`} side="left"><button type="button" aria-label={`Διαγραφή ${title}`} className="danger" onClick={()=>askDelete(row)}><Trash2/></button></Tooltip>}
  </div>;

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">ΚΙΝΗΣΕΙΣ</span><h1>Συναλλαγές</h1><p>Καθημερινές τραπεζικές και μετρητές κινήσεις. Η πιστωτική διαχειρίζεται στη δική της ενότητα.</p></div></section>
    <section className="panel neo-raised transactions-workspace">
      <div className="filterbar transaction-searchbar"><label className="filter-label search-filter"><span>Αναζήτηση</span><span className="searchbox"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Περιγραφή, κατηγορία ή υποκατηγορία"/></span></label><div className="transaction-sort-summary"><SortDirectionControl value={sortDirection} onChange={setSortDirection} label="Σειρά συναλλαγών ανά ημερομηνία"/><span>{rows.length} κινήσεις</span></div></div>
      <div className="mobile-transaction-filters transaction-filter-controls" aria-label="Φίλτρα συναλλαγών" style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}><label className="filter-label" style={{flex:'1 1 180px',minWidth:0}}><span>Τύπος</span><AppSelectInput aria-label="Φίλτρο τύπου κίνησης" value={type} onChange={e=>setType(e.target.value)}><option value="all">Όλοι οι τύποι</option>{types.map(value=><option key={value} value={value}>{eventKindLabel(value)}</option>)}</AppSelectInput></label><label className="filter-label" style={{flex:'1 1 220px',minWidth:0}}><span>Λογαριασμός</span><AppSelectInput aria-label="Φίλτρο λογαριασμού" value={account} onChange={e=>setAccount(e.target.value)}><option value="all">Όλοι οι λογαριασμοί</option>{accounts.map(a=><option value={a.id} key={a.id}>{accountDisplayName(data,a.id)}</option>)}</AppSelectInput></label></div>
      {message?<div className="action-status" role="status" aria-live="polite">{message}</div>:null}
      {!rows.length?<div className="empty-state transaction-empty-state">Δεν υπάρχουν κινήσεις για τα επιλεγμένα φίλτρα και την περίοδο.</div>:<>
        <div className="semantic-table-wrap desktop-finance-table"><table className="semantic-table transaction-semantic-table"><caption className="sr-only">Κινήσεις για {month}</caption><thead><tr><th scope="col" aria-sort={sortDirection==='asc'?'ascending':'descending'}>Ημερομηνία</th><th scope="col">Περιγραφή</th><th scope="col">Τύπος</th><th scope="col">Λογαριασμός</th><th scope="col" className="amount">Ποσό</th><th scope="col" className="actions">Ενέργειες</th></tr></thead><tbody>{rows.map(r=>{const note=noteParts(r.note);return <tr key={r.id} className={`transaction-row kind-${r.kind}`} data-transaction-kind={r.kind} data-transaction-source={r.source} data-legacy-override={r.overridden?'true':undefined}><td>{shortDate(r.date)}</td><td className="transaction-description-cell"><div className="transaction-title-line"><FinanceIcon settings={data.state.settings} kind={r.kind} category={r.category} subcategory={r.subcategory} note={r.note} size={17}/><b>{note.title}</b></div>{note.comment?<small className="transaction-comment" title={note.comment}><MessageSquareText size={13} aria-hidden="true"/><span>{note.comment}</span></small>:null}<small className="transaction-meta">{metadata(r)}</small>{r.kind==='split'?<TransactionSplitDetails parts={r.parts}/>:null}</td><td><em className={`flow-pill ${r.kind}`}>{eventKindLabel(r.kind)}</em></td><td className="transaction-account-cell">{accountText(r.accountIds)}</td><td className={`amount ${r.impact.income>0?'positive':r.impact.expense>0?'negative':''}`}>{amountPrefix(r)}{money.format(r.amount)}</td><td className="actions">{rowActions(r,note.title)}</td></tr>})}</tbody></table></div>
        <div className="mobile-transaction-list" role="list" aria-label={`Κινήσεις για ${month}`}>{rows.map(r=>{const note=noteParts(r.note);return <article key={r.id} role="listitem" className={`mobile-transaction-row kind-${r.kind}`} data-mobile-transaction-kind={r.kind} data-transaction-source={r.source} data-legacy-override={r.overridden?'true':undefined}><div className="mobile-transaction-main"><div className="mobile-transaction-identity"><FinanceIcon settings={data.state.settings} kind={r.kind} category={r.category} subcategory={r.subcategory} note={r.note} size={17}/><div><b>{note.title}</b><small>{r.kind==='split'?'Επιμέρους κατηγορίες':categoryPath(r.category,r.subcategory)}</small></div></div><strong className={r.impact.income>0?'positive':r.impact.expense>0?'negative':''}>{amountPrefix(r)}{money.format(r.amount)}</strong></div>{note.comment?<div className="mobile-transaction-comment" title={note.comment}><MessageSquareText size={13} aria-hidden="true"/><span>{note.comment}</span></div>:null}{r.kind==='split'?<TransactionSplitDetails parts={r.parts}/>:null}<div className="mobile-transaction-meta"><span>{shortDate(r.date)}</span><em className={`flow-pill ${r.kind}`}>{eventKindLabel(r.kind)}</em><span className="mobile-account-path">{accountText(r.accountIds)}</span></div>{rowActions(r,note.title,true)}{r.source==='legacy'?<small className="mobile-history-label">{r.overridden?'Ιστορικό · override':'Ιστορικό εισαγωγής'}</small>:null}</article>})}</div>
      </>}
    </section>
    {editingLegacy?<LegacyTransactionEditor key={editingLegacy.id} data={data} transaction={editingLegacy} onSave={saveLegacy} onClose={()=>setEditingLegacy(null)}/>:null}
    <ConfirmDialog open={Boolean(deleteTarget)} title="Διαγραφή κίνησης;" description={deleteTarget?.source==='legacy'?'Η αρχική εισαγόμενη εγγραφή θα παραμείνει ανέπαφη. Η κίνηση θα εξαιρεθεί από υπολογισμούς και λίστες μέσω tombstone.':'Η κίνηση θα αφαιρεθεί από τα οικονομικά δεδομένα. Μπορείς να χρησιμοποιήσεις Αναίρεση αμέσως μετά.'} confirmLabel="Διαγραφή" tone="destructive" motionMode={data.state.settings.motion||'system'} onConfirm={confirmDelete} onCancel={()=>setDeleteTarget(null)}/>
  </div>;
}
