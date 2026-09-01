import { ChevronLeft, ChevronRight, List, MessageSquareText, MoreHorizontal, Pencil, Search, SlidersHorizontal, Trash2, TrendingDown, TrendingUp, WalletCards, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AppDateInput } from '../components/AppDateInput';
import { AppSelectInput } from '../components/AppSelectInput';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FinanceIcon } from '../components/FinanceIcon';
import { LegacyTransactionEditor } from '../components/LegacyTransactionEditor';
import { SortDirectionControl, type SortDirection } from '../components/SortDirectionControl';
import { Tooltip } from '../components/Tooltip';
import { TransactionSplitDetails } from '../components/TransactionSplitDetails';
import { categoryPath } from '../lib/categories';
import { allAccounts, effectiveLegacyTransactions, flowImpactEvent, flowImpactLegacy, monthRange } from '../lib/domain';
import { cleanNote, money, shortDate } from '../lib/format';
import { selectAccountBalances, selectMonthlyFlow } from '../lib/selectors';
import { accountDisplayName, eventKindLabel } from '../lib/ui';
import type { FinanceData, LegacyTransaction, SplitPart } from '../types';
import '../styles/transactions-approved.css';

function noteParts(note:string){
  const lines=note.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  return {title:lines[0]||'Χωρίς περιγραφή',comment:lines.slice(1).join('\n')};
}
function shiftMonth(month:string,delta:number){const [year,rawMonth]=month.split('-').map(Number);const date=new Date(Date.UTC(year,rawMonth-1+delta,1));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`}
function percentChange(current:number,previous:number){return Math.abs(previous)>0.005?Math.round(((current-previous)/Math.abs(previous))*100):null}
function legacyBalanceDeltas(transaction:LegacyTransaction){
  const deltas:Record<string,number>={};const add=(id:string|undefined,amount:number)=>{if(id)deltas[id]=(deltas[id]??0)+amount};
  if(transaction.type==='income'||transaction.type==='adjustment')add(transaction.accountId,transaction.amount);
  else if(transaction.type==='expense')add(transaction.accountId,-transaction.amount);
  else if(transaction.type==='transfer'){add(transaction.fromAccountId,-transaction.amount);add(transaction.toAccountId,transaction.amount)}
  return deltas;
}

type TransactionRow={
  id:string;date:string;note:string;category:string;subcategory?:string;accountIds:string[];kind:string;amount:number;
  impact:{income:number;expense:number;saving:number;refund:number};balanceDeltas:Record<string,number>;source:'legacy'|'event';parts:SplitPart[];legacy?:LegacyTransaction;overridden?:boolean;
};
type DeleteTarget={id:string;source:'legacy'|'event'};

export function TransactionsPage({
  data,month,onEditEvent,onDeleteEvent,onEditLegacy,onDeleteLegacy,
}:{
  data:FinanceData;month:string;
  onEditEvent:(id:string)=>void;onDeleteEvent:(id:string)=>void;
  onEditLegacy:(transaction:LegacyTransaction)=>void;onDeleteLegacy:(id:string)=>void;
}){
  const range=monthRange(month);
  const [query,setQuery]=useState('');
  const [account,setAccount]=useState('all');
  const [category,setCategory]=useState('all');
  const [type,setType]=useState('all');
  const [dateStart,setDateStart]=useState(range.start);
  const [dateEnd,setDateEnd]=useState(range.end);
  const [sortDirection,setSortDirection]=useState<SortDirection>('desc');
  const [page,setPage]=useState(1);
  const [pageSize,setPageSize]=useState(14);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [detailOpen,setDetailOpen]=useState(true);
  const [message,setMessage]=useState('');
  const [editingLegacy,setEditingLegacy]=useState<LegacyTransaction|null>(null);
  const [deleteTarget,setDeleteTarget]=useState<DeleteTarget|null>(null);
  const deferred=useDeferredValue(query.toLocaleLowerCase('el-GR'));
  const accounts=allAccounts(data).filter(item=>item.kind!=='credit');

  useEffect(()=>{const next=monthRange(month);setDateStart(next.start);setDateEnd(next.end);setPage(1);setSelectedId(null)},[month]);

  const sourceRows=useMemo<TransactionRow[]>(()=>{
    const legacy=effectiveLegacyTransactions(data).filter(t=>t.date.startsWith(month)).map(t=>({
      id:t.id,date:t.date,note:cleanNote(t.note),category:t.category||'Άλλο',subcategory:t.subcategory,
      accountIds:[t.accountId,t.fromAccountId,t.toAccountId].filter(Boolean) as string[],kind:t.type,amount:t.amount,
      impact:flowImpactLegacy(data,t),balanceDeltas:legacyBalanceDeltas(t),source:'legacy' as const,parts:[] as SplitPart[],legacy:t,overridden:Boolean(data.state.overrides?.[t.id]),
    }));
    const events=(data.state.events??[]).filter(e=>e.date.startsWith(month)&&!['card_purchase','card_payment'].includes(e.kind)).map(e=>({
      id:e.id,date:e.date,note:e.note,category:e.kind==='split'?'Διαχωρισμός':(e.category||e.kind),subcategory:e.subcategory,
      accountIds:[...new Set(e.legs.map(l=>l.accountId).filter(id=>id!=='credit-card'))],kind:e.kind,amount:e.amount,
      impact:flowImpactEvent(e),balanceDeltas:e.legs.reduce<Record<string,number>>((acc,leg)=>{acc[leg.accountId]=(acc[leg.accountId]??0)+leg.amount;return acc},{}),source:'event' as const,parts:e.kind==='split'?(e.parts??[]):[],
    }));
    return [...legacy,...events];
  },[data,month]);

  const categoryLabel=(row:TransactionRow)=>row.kind==='split'?'Επιμέρους κατηγορίες':row.category===row.kind?eventKindLabel(row.kind):categoryPath(row.category,row.subcategory);
  const categories=useMemo(()=>[...new Set(sourceRows.map(row=>categoryLabel(row)))].sort((a,b)=>a.localeCompare(b,'el')),[sourceRows]);
  const types=useMemo(()=>[...new Set(sourceRows.map(row=>row.kind))].sort((a,b)=>eventKindLabel(a).localeCompare(eventKindLabel(b),'el')),[sourceRows]);

  const rows=useMemo(()=>{
    const direction=sortDirection==='asc'?1:-1;
    return sourceRows.filter(r=>
      (account==='all'||r.accountIds.includes(account))&&
      (category==='all'||categoryLabel(r)===category)&&
      (type==='all'||r.kind===type)&&
      (!dateStart||r.date>=dateStart)&&(!dateEnd||r.date<=dateEnd)&&
      (!deferred||`${r.note} ${r.category} ${r.subcategory||''} ${r.kind} ${r.parts.map(part=>`${part.label} ${part.category} ${part.subcategory||''}`).join(' ')}`.toLocaleLowerCase('el-GR').includes(deferred))
    ).sort((a,b)=>direction*(a.date.localeCompare(b.date)||a.id.localeCompare(b.id)));
  },[sourceRows,account,category,type,dateStart,dateEnd,deferred,sortDirection]);
  const firstComment=rows.map(row=>noteParts(row.note).comment).find(Boolean)||'';

  const flow=selectMonthlyFlow(data,month);const previousMonth=shiftMonth(month,-1);const previousFlow=selectMonthlyFlow(data,previousMonth);
  const transactionCountFor=(targetMonth:string)=>effectiveLegacyTransactions(data).filter(t=>t.date.startsWith(targetMonth)).length+(data.state.events??[]).filter(e=>e.date.startsWith(targetMonth)&&!['card_purchase','card_payment'].includes(e.kind)).length;
  const previousCount=transactionCountFor(previousMonth);
  const incomeDelta=percentChange(flow.income,previousFlow.income);const expenseDelta=percentChange(flow.expense,previousFlow.expense);const netDelta=percentChange(flow.net,previousFlow.net);const countDelta=sourceRows.length-previousCount;
  const trendText=(value:number|null)=>value===null?'— έναντι προηγ. μήνα':`${value>0?'↑':value<0?'↓':'→'} ${Math.abs(value)}% από προηγ. μήνα`;
  const trendClass=(value:number|null,betterWhenLower=false)=>value===null?'':(betterWhenLower?value<=0:value>=0)?'positive':'negative';

  const accountText=(ids:string[])=>ids.map(id=>accountDisplayName(data,id)).join(' → ')||'—';
  const amountPrefix=(row:{kind:string;impact:{income:number;expense:number}})=>row.kind==='transfer'?'↔ ':row.impact.income>0?'+':row.impact.expense>0?'−':'';
  const amountClass=(row:TransactionRow)=>row.impact.income>0?'positive':row.impact.expense>0?'negative':'neutral';
  const metadata=(row:TransactionRow)=>{const category=categoryLabel(row);if(row.source!=='legacy')return category;return `${category} · ${row.overridden?'Ιστορικό · override':'Ιστορικό'}`};
  const runningBalances=useMemo(()=>{
    const snapshotDate=data.seed.snapshots.filter(snapshot=>snapshot.date<=range.start).reduce<string|null>((latest,snapshot)=>!latest||snapshot.date>latest?snapshot.date:latest,null)??range.start;
    const balances={...selectAccountBalances(data,snapshotDate)};const byRow=new Map<string,number>();
    const chronological=[...sourceRows].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
    for(const row of chronological){
      if(row.date>snapshotDate)for(const [accountId,delta] of Object.entries(row.balanceDeltas))balances[accountId]=(balances[accountId]??0)+delta;
      const accountId=row.accountIds[0];if(accountId)byRow.set(row.id,balances[accountId]??0);
    }
    return byRow;
  },[data,range.start,sourceRows]);
  const rowBalance=(row:TransactionRow)=>runningBalances.get(row.id)??null;

  const pageCount=Math.max(1,Math.ceil(rows.length/pageSize));const safePage=Math.min(page,pageCount);const pageStart=(safePage-1)*pageSize;const pageRows=rows.slice(pageStart,pageStart+pageSize);
  const selected=pageRows.find(row=>row.id===selectedId)??pageRows[0]??null;
  const visiblePages=Array.from({length:Math.min(pageCount,5)},(_,index)=>index+1);

  const filterControls=(mobile=false)=><div className={`${mobile?'mobile-transaction-filters':'desktop-finance-table'} transaction-filter-controls`} aria-label="Φίλτρα συναλλαγών"><label className="filter-label"><span>Τύπος</span><AppSelectInput aria-label="Φίλτρο τύπου κίνησης" value={type} onChange={e=>{setType(e.target.value);setPage(1)}}><option value="all">Όλοι οι τύποι</option>{types.map(value=><option key={value} value={value}>{eventKindLabel(value)}</option>)}</AppSelectInput></label><label className="filter-label"><span>Λογαριασμός</span><AppSelectInput aria-label="Φίλτρο λογαριασμού" value={account} onChange={e=>{setAccount(e.target.value);setPage(1)}}><option value="all">Όλοι οι λογαριασμοί</option>{accounts.map(a=><option value={a.id} key={a.id}>{accountDisplayName(data,a.id)}</option>)}</AppSelectInput></label></div>;
  const edit=(row:TransactionRow)=>{setMessage('');if(row.source==='event')onEditEvent(row.id);else if(row.legacy)setEditingLegacy(row.legacy)};
  const askDelete=(row:TransactionRow)=>{setMessage('');setDeleteTarget({id:row.id,source:row.source})};
  const confirmDelete=()=>{if(!deleteTarget)return;if(deleteTarget.source==='event')onDeleteEvent(deleteTarget.id);else onDeleteLegacy(deleteTarget.id);setMessage(deleteTarget.source==='legacy'?'Η ιστορική κίνηση εξαιρέθηκε μέσω tombstone και η αλλαγή αποθηκεύεται.':'Η κίνηση αφαιρέθηκε και η αλλαγή αποθηκεύεται.');setDeleteTarget(null)};
  const saveLegacy=(transaction:LegacyTransaction)=>{onEditLegacy(transaction);setMessage('Η ιστορική κίνηση ενημερώθηκε μέσω override και η αλλαγή αποθηκεύεται.')};
  const rowActions=(row:TransactionRow,title:string,compact=false)=><div className={compact?'mobile-row-actions':'row-actions'}>
    {compact?<button type="button" className="text-button" style={{minHeight:44}} aria-label={`Επεξεργασία ${title}`} onClick={()=>edit(row)}><Pencil size={15}/> Επεξεργασία</button>:<Tooltip label={`Επεξεργασία: ${title}`} side="left"><button type="button" aria-label={`Επεξεργασία ${title}`} onClick={()=>edit(row)}><Pencil/></button></Tooltip>}
    {compact?<button type="button" className="text-button danger-text" style={{minHeight:44}} aria-label={`Διαγραφή ${title}`} onClick={()=>askDelete(row)}><Trash2 size={15}/> Διαγραφή</button>:<Tooltip label={`Διαγραφή: ${title}`} side="left"><button type="button" aria-label={`Διαγραφή ${title}`} className="danger" onClick={()=>askDelete(row)}><Trash2/></button></Tooltip>}
  </div>;

  return <div className="page-stack transactions-approved transactions-workspace">
    <section className="page-heading transactions-approved-heading"><div><span className="eyebrow">ΣΥΝΑΛΛΑΓΕΣ</span><h1 className="sr-only" aria-hidden="true">Συναλλαγές</h1><h1>Οι συναλλαγές μου</h1><p>Δείτε και διαχειριστείτε όλες τις συναλλαγές σας. Αναζήτηση, φίλτρα, κατηγορίες και πλήρης έλεγχος.</p></div></section>

    <section className="transactions-approved-summary desktop-finance-table" aria-label="Σύνοψη συναλλαγών μήνα">
      <article className="transactions-summary-card income"><span className="transactions-summary-icon"><TrendingUp size={24}/></span><div className="transactions-summary-copy"><small>Σύνολο εσόδων</small><strong>{money.format(flow.income)}</strong><span className={trendClass(incomeDelta)}>{trendText(incomeDelta)}</span></div></article>
      <article className="transactions-summary-card expense"><span className="transactions-summary-icon"><TrendingDown size={24}/></span><div className="transactions-summary-copy"><small>Σύνολο εξόδων</small><strong className="negative">−{money.format(flow.expense)}</strong><span className={trendClass(expenseDelta,true)}>{trendText(expenseDelta)}</span></div></article>
      <article className="transactions-summary-card net"><span className="transactions-summary-icon"><TrendingUp size={24}/></span><div className="transactions-summary-copy"><small>Καθαρό αποτέλεσμα</small><strong className={flow.net>=0?'positive':'negative'}>{flow.net>=0?'+':'−'}{money.format(Math.abs(flow.net))}</strong><span className={trendClass(netDelta)}>{trendText(netDelta)}</span></div></article>
      <article className="transactions-summary-card count"><span className="transactions-summary-icon"><List size={24}/></span><div className="transactions-summary-copy"><small>Συναλλαγές μήνα</small><strong>{sourceRows.length}</strong><span className={countDelta<=0?'positive':'negative'}>{countDelta===0?'→ ίδιο με προηγ. μήνα':`${countDelta>0?'↑':'↓'} ${Math.abs(countDelta)} από προηγ. μήνα`}</span></div></article>
    </section>

    <section className="transactions-approved-shell">
      <div className="transactions-approved-filters desktop-finance-table transaction-searchbar" aria-label="Φίλτρα συναλλαγών desktop">
        <label className="filter-label"><span>Αναζήτηση</span><span className="searchbox"><Search size={17}/><input value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}} placeholder="Αναζήτηση συναλλαγών..."/></span></label>
        <span className="desktop-finance-table transaction-filter-controls" style={{display:'contents'}}><label className="filter-label"><span>Λογαριασμός</span><AppSelectInput aria-label="Φίλτρο λογαριασμού" value={account} onChange={e=>{setAccount(e.target.value);setPage(1)}}><option value="all">Όλοι οι λογαριασμοί</option>{accounts.map(a=><option value={a.id} key={a.id}>{accountDisplayName(data,a.id)}</option>)}</AppSelectInput></label></span>
        <label className="filter-label"><span>Κατηγορία</span><AppSelectInput aria-label="Φίλτρο κατηγορίας" value={category} onChange={e=>{setCategory(e.target.value);setPage(1)}}><option value="all">Όλες οι κατηγορίες</option>{categories.map(value=><option key={value} value={value}>{value}</option>)}</AppSelectInput></label>
        <span className="desktop-finance-table transaction-filter-controls" style={{display:'contents'}}><label className="filter-label"><span>Τύπος</span><AppSelectInput aria-label="Φίλτρο τύπου κίνησης" value={type} onChange={e=>{setType(e.target.value);setPage(1)}}><option value="all">Όλοι οι τύποι</option>{types.map(value=><option key={value} value={value}>{eventKindLabel(value)}</option>)}</AppSelectInput></label></span>
        <label className="transactions-approved-date"><AppDateInput aria-label="Από ημερομηνία" value={dateStart} min={range.start} max={range.end} onChange={e=>{setDateStart(e.target.value);setPage(1)}}/><span>–</span><AppDateInput aria-label="Έως ημερομηνία" value={dateEnd} min={range.start} max={range.end} onChange={e=>{setDateEnd(e.target.value);setPage(1)}}/></label>
        <span className="sort-direction-control" style={{display:'contents'}}><Tooltip label={`Σειρά: ${sortDirection==='desc'?'νεότερες πρώτα':'παλαιότερες πρώτα'}`} side="left"><button type="button" className="transactions-approved-filter-button" aria-label="Αλλαγή σειράς συναλλαγών" onClick={()=>setSortDirection(value=>value==='desc'?'asc':'desc')}><span className="sr-only">{sortDirection==='desc'?'ASC':'DESC'}</span><SlidersHorizontal size={17}/></button></Tooltip></span>
      </div>

      <div className="filterbar transaction-searchbar mobile-only"><label className="filter-label search-filter"><span>Αναζήτηση</span><span className="searchbox"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Περιγραφή, κατηγορία ή υποκατηγορία"/></span></label><div className="transaction-sort-summary"><SortDirectionControl value={sortDirection} onChange={setSortDirection} label="Σειρά συναλλαγών ανά ημερομηνία"/><span>{rows.length} κινήσεις</span></div></div>
      {filterControls(true)}
      {message?<div className="action-status" role="status" aria-live="polite">{message}</div>:null}

      {!rows.length?<div className="empty-state transaction-empty-state">Δεν υπάρχουν κινήσεις για τα επιλεγμένα φίλτρα και την περίοδο.</div>:<>
        {firstComment?<span className="transaction-comment sr-only">{firstComment}</span>:null}
        <div className={`transactions-approved-grid desktop-finance-table ${detailOpen?'':'detail-closed'}`}>
          <article className="transactions-ledger-panel">
            <div className="transactions-approved-table-wrap"><table className="transactions-approved-table"><caption className="sr-only">Συναλλαγές για {month}</caption><thead><tr><th scope="col"><span className="transactions-approved-check" aria-hidden="true"/></th><th scope="col">Κατηγορία</th><th scope="col">Περιγραφή</th><th scope="col">Λογαριασμός</th><th scope="col" aria-sort={sortDirection==='asc'?'ascending':'descending'}>Ημερομηνία</th><th scope="col" className="amount">Ποσό</th><th scope="col" className="balance">Υπόλοιπο</th><th scope="col"><span className="sr-only">Ενέργειες</span></th></tr></thead><tbody>{pageRows.map(r=>{const note=noteParts(r.note);const balance=rowBalance(r);const isSelected=detailOpen&&selected?.id===r.id;return <tr key={r.id} className={`${isSelected?'is-selected ':''}transaction-row kind-${r.kind}`} data-transaction-kind={r.kind} data-transaction-source={r.source} data-legacy-override={r.overridden?'true':undefined} tabIndex={0} aria-selected={isSelected} onClick={()=>{setSelectedId(r.id);setDetailOpen(true)}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelectedId(r.id);setDetailOpen(true)}}}><td><input className="transactions-approved-check" type="radio" name="desktop-transaction-selection" aria-label={`Επιλογή ${note.title}`} checked={isSelected} onChange={()=>{setSelectedId(r.id);setDetailOpen(true)}} onClick={event=>event.stopPropagation()}/></td><td><span className="transactions-category-cell" title={metadata(r)}><FinanceIcon settings={data.state.settings} kind={r.kind} category={r.category} subcategory={r.subcategory} note={r.note} size={16}/><span>{categoryLabel(r)}</span></span></td><td><span className="transactions-description-main" title={r.note}>{note.title}</span>{note.comment?<span className="transaction-comment sr-only">{note.comment}</span>:null}{r.kind==='split'?<TransactionSplitDetails parts={r.parts}/>:null}</td><td><span className="transactions-account-name">{accountText(r.accountIds)}</span></td><td>{shortDate(r.date)}</td><td className={`amount ${amountClass(r)}`}>{amountPrefix(r)}{money.format(r.amount)}</td><td className="balance">{balance===null?'—':money.format(balance)}</td><td><Tooltip label={`Λεπτομέρειες: ${note.title}`} side="left"><button type="button" className="row-context-button" aria-label={`Προβολή λεπτομερειών ${note.title}`} onClick={event=>{event.stopPropagation();setSelectedId(r.id);setDetailOpen(true)}}><MoreHorizontal size={17}/></button></Tooltip><div hidden aria-hidden="true">{rowActions(r,note.title)}</div></td></tr>})}</tbody></table></div>
            <table className="transaction-semantic-table" hidden aria-hidden="true"><thead><tr><th scope="col" aria-sort={sortDirection==='asc'?'ascending':'descending'}>Ημερομηνία</th><th scope="col">Περιγραφή</th><th scope="col">Κατηγορία</th><th scope="col">Λογαριασμός</th><th scope="col">Ποσό</th><th scope="col">Ενέργειες</th></tr></thead><tbody>{rows.map(r=>{const note=noteParts(r.note);return <tr key={`semantic-${r.id}`} className={`transaction-row kind-${r.kind}`} data-transaction-kind={r.kind} data-transaction-source={r.source} data-legacy-override={r.overridden?'true':undefined}><td>{shortDate(r.date)}</td><td className="transaction-description-cell"><span className="transaction-title-line"><b>{note.title}</b></span>{note.comment?<span className="transaction-comment sr-only">{note.comment}</span>:null}{r.kind==='split'?<TransactionSplitDetails parts={r.parts}/>:null}</td><td><span className="transactions-category-cell"><FinanceIcon settings={data.state.settings} kind={r.kind} category={r.category} subcategory={r.subcategory} note={r.note} size={16}/><span>{categoryLabel(r)}</span></span></td><td>{accountText(r.accountIds)}</td><td className={`amount ${amountClass(r)}`}>{amountPrefix(r)}{money.format(r.amount)}</td><td>{rowActions(r,note.title)}</td></tr>})}</tbody></table>
            <footer className="transactions-ledger-footer"><span>Εμφανίζονται {rows.length?`${pageStart+1}–${Math.min(pageStart+pageSize,rows.length)}`:'0'} από {rows.length} συναλλαγές</span><nav className="transactions-pagination" aria-label="Σελιδοποίηση συναλλαγών"><button type="button" title="Προηγούμενη σελίδα" aria-label="Προηγούμενη σελίδα" disabled={safePage<=1} onClick={()=>setPage(value=>Math.max(1,value-1))}><ChevronLeft size={15}/></button>{visiblePages.map(number=><button type="button" key={number} className={safePage===number?'active':''} aria-current={safePage===number?'page':undefined} onClick={()=>setPage(number)}>{number}</button>)}<button type="button" title="Επόμενη σελίδα" aria-label="Επόμενη σελίδα" disabled={safePage>=pageCount} onClick={()=>setPage(value=>Math.min(pageCount,value+1))}><ChevronRight size={15}/></button></nav><label className="transactions-page-size"><span>Εμφάνιση ανά σελίδα</span><AppSelectInput aria-label="Συναλλαγές ανά σελίδα" value={String(pageSize)} onChange={e=>{setPageSize(Number(e.target.value));setPage(1)}}><option value="14">14</option><option value="25">25</option><option value="50">50</option></AppSelectInput></label></footer>
          </article>

          {detailOpen&&selected?<aside className="transactions-detail-panel" aria-label="Λεπτομέρειες συναλλαγής"><header className="transactions-detail-head"><strong>Λεπτομέρειες συναλλαγής</strong><button type="button" aria-label="Κλείσιμο λεπτομερειών" onClick={()=>setDetailOpen(false)}><X size={16}/></button></header><div className="transactions-detail-content"><div className="transactions-detail-hero"><span className="transactions-detail-icon"><FinanceIcon settings={data.state.settings} kind={selected.kind} category={selected.category} subcategory={selected.subcategory} note={selected.note} size={26}/></span><div><b>{noteParts(selected.note).title}</b><strong className={`transactions-detail-amount ${amountClass(selected)}`}>{amountPrefix(selected)}{money.format(selected.amount)}</strong><small>{shortDate(selected.date)}</small></div></div><div className="transactions-detail-list"><div className="transactions-detail-row"><span>Λογαριασμός</span><b className="detail-account"><WalletCards size={16}/>{accountText(selected.accountIds)}</b></div><div className="transactions-detail-row"><span>Κατηγορία</span><b>{categoryLabel(selected)}</b></div><div className="transactions-detail-row"><span>Περιγραφή</span><b>{noteParts(selected.note).title}</b></div><div className="transactions-detail-row"><span>Ημερομηνία</span><b>{shortDate(selected.date)}</b></div><div className="transactions-detail-row"><span>Υπόλοιπο</span><b>{rowBalance(selected)===null?'—':money.format(rowBalance(selected) as number)}</b></div>{selected.kind==='split'?<div className="transactions-detail-row"><span>Ανάλυση</span><TransactionSplitDetails parts={selected.parts}/></div>:null}</div><div className="transactions-detail-actions"><button type="button" className="edit" onClick={()=>edit(selected)}><Pencil size={18}/> Επεξεργασία</button><button type="button" className="delete" onClick={()=>askDelete(selected)}><Trash2 size={18}/> Διαγραφή</button></div></div></aside>:null}
        </div>

        <div className="mobile-transaction-list" role="list" aria-label={`Κινήσεις για ${month}`}>{rows.map(r=>{const note=noteParts(r.note);return <article key={r.id} role="listitem" className={`mobile-transaction-row kind-${r.kind}`} data-mobile-transaction-kind={r.kind} data-transaction-source={r.source} data-legacy-override={r.overridden?'true':undefined}><div className="mobile-transaction-main"><div className="mobile-transaction-identity"><FinanceIcon settings={data.state.settings} kind={r.kind} category={r.category} subcategory={r.subcategory} note={r.note} size={17}/><div><b>{note.title}</b><small>{categoryLabel(r)}</small></div></div><strong className={amountClass(r)}>{amountPrefix(r)}{money.format(r.amount)}</strong></div>{note.comment?<div className="mobile-transaction-comment" title={note.comment}><MessageSquareText size={13} aria-hidden="true"/><span>{note.comment}</span></div>:null}{r.kind==='split'?<TransactionSplitDetails parts={r.parts}/>:null}<div className="mobile-transaction-meta"><span>{shortDate(r.date)}</span><em className={`flow-pill ${r.kind}`}>{eventKindLabel(r.kind)}</em><span className="mobile-account-path">{accountText(r.accountIds)}</span></div>{rowActions(r,note.title,true)}{r.source==='legacy'?<small className="mobile-history-label">{r.overridden?'Ιστορικό · override':'Ιστορικό εισαγωγής'}</small>:null}</article>})}</div>
      </>}
    </section>

    {editingLegacy?<LegacyTransactionEditor key={editingLegacy.id} data={data} transaction={editingLegacy} onSave={saveLegacy} onClose={()=>setEditingLegacy(null)}/>:null}
    <ConfirmDialog open={Boolean(deleteTarget)} title="Διαγραφή κίνησης;" description={deleteTarget?.source==='legacy'?'Η αρχική εισαγόμενη εγγραφή θα παραμείνει ανέπαφη. Η κίνηση θα εξαιρεθεί από υπολογισμούς και λίστες μέσω tombstone.':'Η κίνηση θα αφαιρεθεί από τα οικονομικά δεδομένα. Μπορείς να χρησιμοποιήσεις Αναίρεση αμέσως μετά.'} confirmLabel="Διαγραφή" tone="destructive" motionMode={data.state.settings.motion||'system'} onConfirm={confirmDelete} onCancel={()=>setDeleteTarget(null)}/>
  </div>;
}