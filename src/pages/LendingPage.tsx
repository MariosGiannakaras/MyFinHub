import { ChevronRight, Eye, EyeOff, HandCoins, Info, Plus, RotateCcw, Search, UserRound, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AnimatedAmount } from '../components/AnimatedAmount';
import { AppDateInput } from '../components/AppDateInput';
import { AppSelectInput } from '../components/AppSelectInput';
import { FormError } from '../components/FormError';
import { MoneyInput } from '../components/MoneyInput';
import type { QuickActionContext } from '../components/ContextualQuickAdd';
import { useModalFocus } from '../hooks/useModalFocus';
import { allAccounts, createEvent } from '../lib/domain';
import { money, shortDate } from '../lib/format';
import { lendingHistory, lendingOutstandingFor, lendingRows } from '../lib/lending';
import { accountDisplayName } from '../lib/ui';
import { userErrorMessage } from '../lib/userMessage';
import type { FinanceData, FinanceEvent } from '../types';

type LendingQuickContext=Omit<Extract<QuickActionContext,{mode:'lending'}>,'token'>;
type LendingHistoryFilter='all'|'lent'|'repaid'|'forgiven';

const personInitials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toLocaleUpperCase('el-GR')||'').join('');

export function LendingPage({data,asOf,onCreateEvent,onQuickAdd}:{data:FinanceData;asOf:string;onCreateEvent:(event:FinanceEvent)=>void;onQuickAdd?:(context:LendingQuickContext)=>void}){
  const rows=useMemo(()=>lendingRows(data),[data]);
  const history=useMemo(()=>lendingHistory(data),[data]);
  const total=useMemo(()=>rows.reduce((sum,row)=>sum+row.outstanding,0),[rows]);
  const accounts=useMemo(()=>allAccounts(data).filter(account=>account.kind!=='credit'),[data]);
  const [visible,setVisible]=useState(false);
  const [selectedPerson,setSelectedPerson]=useState(()=>rows[0]?.person||'');
  const [peopleQuery,setPeopleQuery]=useState('');
  const [historyFilter,setHistoryFilter]=useState<LendingHistoryFilter>('all');
  const [open,setOpen]=useState(false);const [kind,setKind]=useState<'lending'|'repayment'>('lending');const [person,setPerson]=useState('');const [amount,setAmount]=useState('');const [date,setDate]=useState(asOf);const [expectedReturnDate,setExpectedReturnDate]=useState('');const [account,setAccount]=useState(data.state.settings.defaultExpenseAccount);const [note,setNote]=useState('');const [error,setError]=useState('');const modalRef=useModalFocus<HTMLElement>(open,'[data-autofocus="true"]',()=>{setOpen(false);setError('')});

  useEffect(()=>{
    if(!rows.length){if(selectedPerson)setSelectedPerson('');return}
    if(!rows.some(row=>row.person===selectedPerson))setSelectedPerson(rows[0]!.person);
  },[rows,selectedPerson]);

  const filteredPeople=useMemo(()=>{const query=peopleQuery.trim().toLocaleLowerCase('el-GR');return query?rows.filter(row=>row.person.toLocaleLowerCase('el-GR').includes(query)):rows},[peopleQuery,rows]);
  const selectedRow=useMemo(()=>rows.find(row=>row.person===selectedPerson)??null,[rows,selectedPerson]);
  const selectedHistory=useMemo(()=>history.filter(row=>row.person===selectedPerson),[history,selectedPerson]);
  const filteredHistory=useMemo(()=>historyFilter==='all'?selectedHistory:selectedHistory.filter(row=>row.action===historyFilter),[historyFilter,selectedHistory]);
  const selectedTotals=useMemo(()=>selectedHistory.reduce((summary,row)=>{if(row.action==='lent')summary.lent+=row.amount;if(row.action==='repaid')summary.repaid+=row.amount;if(row.action==='forgiven')summary.forgiven+=row.amount;return summary},{lent:0,repaid:0,forgiven:0}),[selectedHistory]);
  const knownPeople=useMemo(()=>{const query=person.trim().toLocaleLowerCase('el-GR');return rows.filter(row=>kind==='lending'||row.outstanding>0).filter(row=>!query||row.person.toLocaleLowerCase('el-GR').includes(query)).slice(0,6)},[rows,kind,person]);
  const preferredAccount=(next:'lending'|'repayment')=>{const preferred=next==='lending'?data.state.settings.defaultExpenseAccount:data.state.settings.defaultIncomeAccount;return accounts.some(item=>item.id===preferred)?preferred:accounts[0]?.id||''};
  const start=(next:'lending'|'repayment',presetPerson='')=>{setKind(next);setPerson(presetPerson);setAmount('');setDate(asOf);setExpectedReturnDate('');setAccount(preferredAccount(next));setNote('');setError('');setOpen(true)};
  const startForPerson=(next:'lending'|'repayment',presetPerson:string)=>{if(onQuickAdd){onQuickAdd({mode:'lending',action:next==='lending'?'lend':'repay',person:presetPerson,amount:next==='repayment'?lendingOutstandingFor(data,presetPerson):undefined,accountId:preferredAccount(next)});return}start(next,presetPerson)};
  const close=()=>{setOpen(false);setError('')};
  const submit=()=>{const cleanPerson=person.trim();const numeric=Number(amount.replace(',','.'));if(!cleanPerson){setError('Γράψε το όνομα του προσώπου για να ξέρεις σε ποιον αφορά η κίνηση.');return}if(!Number.isFinite(numeric)||numeric<=0){setError('Έλεγξε το ποσό — πρέπει να είναι μεγαλύτερο από μηδέν.');return}if(!accounts.some(item=>item.id===account)){setError('Επίλεξε διαθέσιμο λογαριασμό για αυτή την κίνηση.');return}if(kind==='lending'&&expectedReturnDate&&expectedReturnDate<date){setError('Η αναμενόμενη επιστροφή δεν μπορεί να είναι πριν από την ημερομηνία της κίνησης.');return}if(kind==='repayment'){const outstanding=lendingOutstandingFor(data,cleanPerson);if(outstanding<=0){setError('Δεν υπάρχει καταγεγραμμένη οφειλή για αυτό το πρόσωπο.');return}if(numeric>outstanding+.01){setError(`Η επιστροφή δεν μπορεί να ξεπερνά την οφειλή των ${money.format(outstanding)}.`);return}}try{const event=createEvent({kind,date,amount:numeric,note:note.trim()||(kind==='lending'?'Πλήρωσα για άλλον':'Επιστροφή δανεικών'),accountId:account,person:cleanPerson,expectedReturnDate:kind==='lending'?(expectedReturnDate||undefined):undefined});onCreateEvent(event);setSelectedPerson(cleanPerson);close()}catch(e){setError(userErrorMessage(e,'Δεν μπορέσαμε να καταχωρίσουμε την κίνηση. Έλεγξε τα στοιχεία και δοκίμασε ξανά.'))}};

  return <div className="page-stack lending-page">
    <div className="lending-approved-desktop">
      <section className="page-heading lending-approved-heading"><div><span className="eyebrow">ΔΑΝΕΙΚΑ / ΟΦΕΙΛΕΣ</span><h1>Δανεικά / Οφειλές</h1><p>Τα άτομα στα οποία έχεις καταγράψει δανεικά και επιστροφές, συγκεντρωμένα σε ένα σημείο.</p></div></section>

      <section className="lending-approved-layout">
        <aside className="panel neo-raised lending-people-panel" aria-label="Άτομα με δανεικά">
          <div className="lending-people-head"><div><span>Τα άτομα μου</span><small>{rows.length} {rows.length===1?'πρόσωπο':'πρόσωπα'} με ιστορικό</small></div></div>
          <label className="lending-people-search"><Search size={17}/><span className="sr-only">Αναζήτηση ατόμου</span><input value={peopleQuery} onChange={event=>setPeopleQuery(event.target.value)} placeholder="Αναζήτηση ατόμου…"/></label>
          <div className="lending-people-list">
            {filteredPeople.length?filteredPeople.map(row=><button type="button" key={row.person} className={`lending-person-row ${selectedPerson===row.person?'active':''}`} aria-pressed={selectedPerson===row.person} onClick={()=>{setSelectedPerson(row.person);setHistoryFilter('all')}}>
              <span className="lending-person-avatar" aria-hidden="true">{personInitials(row.person)||<UserRound size={18}/>}</span>
              <span className="lending-person-copy"><b className={!visible?'private-text':''}>{row.person}</b><small>{row.outstanding>0?'Μου χρωστάει':'Εξοφλημένο'}</small></span>
              <strong className={row.outstanding>0?'positive':''}><AnimatedAmount value={row.outstanding} hidden={!visible}/></strong><ChevronRight size={18}/>
            </button>):<div className="empty-state lending-people-empty">Δεν βρέθηκε άτομο με αυτό το όνομα.</div>}
          </div>
        </aside>

        <div className="lending-detail-stack">
          <section className="panel neo-raised lending-selected-panel">
            <div className="lending-selected-toolbar"><button type="button" className="secondary privacy-toggle" aria-pressed={visible} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>} {visible?'Απόκρυψη':'Εμφάνιση'} στοιχείων</button><button type="button" className="save-button" onClick={()=>start('lending')}><Plus size={17}/> Νέο άτομο</button></div>
            {selectedRow?<>
              <div className="lending-selected-identity"><span className="lending-selected-avatar" aria-hidden="true">{personInitials(selectedRow.person)||<UserRound size={22}/>}</span><div><h2 className={!visible?'private-text':''}>{selectedRow.person}</h2><p>{selectedRow.outstanding>0?'Μου χρωστάει':'Η απαίτηση έχει εξοφληθεί'}</p></div></div>
              <div className="lending-metric-grid">
                <article><span className="lending-metric-icon receivable"><HandCoins size={18}/></span><div><small>Τρέχουσα απαίτηση</small><b className={selectedRow.outstanding>0?'positive':''}><AnimatedAmount value={selectedRow.outstanding} hidden={!visible}/></b></div></article>
                <article><span className="lending-metric-icon lent"><Plus size={18}/></span><div><small>Συνολικά δανεισμένα</small><b><AnimatedAmount value={selectedTotals.lent} hidden={!visible}/></b></div></article>
                <article><span className="lending-metric-icon repaid"><RotateCcw size={18}/></span><div><small>Έχει επιστραφεί</small><b><AnimatedAmount value={selectedTotals.repaid} hidden={!visible}/></b></div></article>
              </div>
              <div className="lending-selected-note"><Info size={17}/><span>Οι κινήσεις και τα υπόλοιπα αφορούν αποκλειστικά το επιλεγμένο πρόσωπο. Τυχόν διαγραφή απαίτησης καταγράφεται ξεχωριστά.</span></div>
            </>:<div className="empty-state lending-selected-empty">Δεν υπάρχει ακόμη πρόσωπο με ιστορικό δανεικών.</div>}
          </section>

          <section className="panel neo-raised lending-quick-panel"><div className="panel-head"><div><span>Γρήγορες ενέργειες</span><small>Οι ενέργειες χρησιμοποιούν την υπάρχουσα λογική δανεικών και επιστροφών.</small></div></div><div className="lending-quick-actions"><button type="button" className="lending-quick-action repayment" disabled={!selectedRow||selectedRow.outstanding<=0} onClick={()=>selectedRow&&startForPerson('repayment',selectedRow.person)}><RotateCcw size={17}/> Νέα επιστροφή (Μου δίνει)</button><button type="button" className="lending-quick-action lending" disabled={!selectedRow} onClick={()=>selectedRow&&startForPerson('lending',selectedRow.person)}><Plus size={17}/> Νέα κίνηση (Του δίνω)</button></div></section>
        </div>
      </section>

      <section className="panel neo-raised lending-selected-history">
        <div className="lending-history-head"><div><span>Κινήσεις{selectedRow?<>: <b className={!visible?'private-text':''}>{selectedRow.person}</b></>:null}</span><small>Όλες οι καταγεγραμμένες κινήσεις για το επιλεγμένο πρόσωπο.</small></div><label><span className="sr-only">Φίλτρο κινήσεων</span><AppSelectInput value={historyFilter} onChange={event=>setHistoryFilter(event.target.value as LendingHistoryFilter)}><option value="all">Όλες οι κινήσεις</option><option value="lent">Δανεικά προς άλλον</option><option value="repaid">Επιστροφές</option><option value="forgiven">Διαγραφές</option></AppSelectInput></label></div>
        {selectedRow&&filteredHistory.length?<><div className="semantic-table-wrap"><table className="semantic-table lending-approved-table"><caption className="sr-only">Κινήσεις δανεικών για {selectedRow.person}</caption><thead><tr><th scope="col">Ημερομηνία</th><th scope="col">Περιγραφή</th><th scope="col">Τύπος</th><th scope="col" className="amount">Ποσό</th><th scope="col" className="amount">Υπόλοιπο</th><th scope="col">Λογαριασμός</th></tr></thead><tbody>{filteredHistory.map(row=><tr key={row.id}><td>{shortDate(row.date)}</td><td><span className={!visible?'private-text':''}>{row.note}</span></td><td><span className={`receivable-action ${row.action}`}>{row.action==='lent'?'Του δίνω':row.action==='repaid'?'Μου δίνει':'Διαγραφή'}</span></td><td className={`amount ${row.action==='repaid'?'positive':''}`}>{row.action==='lent'?'+':'−'}{money.format(row.amount)}</td><td className="amount"><AnimatedAmount value={row.runningOutstanding} hidden={!visible}/></td><td>{row.accountId?accountDisplayName(data,row.accountId):'Ιστορικό'}</td></tr>)}</tbody></table></div><div className="lending-history-summary">{filteredHistory.length} {filteredHistory.length===1?'κίνηση':'κινήσεις'} · Υπόλοιπο: <b><AnimatedAmount value={selectedRow.outstanding} hidden={!visible}/></b></div></>:<div className="empty-state lending-history-empty">Δεν υπάρχουν κινήσεις για το επιλεγμένο φίλτρο.</div>}
      </section>
    </div>

    <section className="page-heading lending-mobile-only"><div><span className="eyebrow">ΔΑΝΕΙΚΑ / ΟΦΕΙΛΕΣ</span><h1>Δανεικά / Οφειλές</h1><p>Πλήρες ιστορικό για όσα πλήρωσες για άλλους και όσα σου επέστρεψαν. Δεν θεωρούνται προσωπικό έξοδο όσο παραμένουν απαίτηση.</p></div><div className="heading-actions"><button type="button" className="secondary privacy-toggle" aria-pressed={visible} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>} {visible?'Απόκρυψη στοιχείων':'Εμφάνιση στοιχείων'}</button><button type="button" className="save-button" onClick={()=>start('lending')}><HandCoins size={17}/> Νέα κίνηση</button></div></section>
    <section className="credit-hero receivable-hero neo-raised lending-mobile-only"><div><span>Συνολικά προς είσπραξη</span><b><AnimatedAmount value={total} hidden={!visible}/></b><small>{rows.length} πρόσωπα με ιστορικό</small></div><HandCoins size={54}/></section>
    <section className="receivable-person-grid lending-mobile-only">{rows.map(row=><article className="panel neo-raised" key={row.person}><div className="loan-title"><span className="account-mark"><UserRound/></span><div><h3 className={!visible?'private-text':''}>{row.person}</h3><small>{row.events} καταγεγραμμένες κινήσεις</small></div><b className={row.outstanding>0?'positive':''}><AnimatedAmount value={row.outstanding} hidden={!visible}/></b></div><div className="receivable-person-actions"><span>{row.outstanding>0?'Εκκρεμεί':'Εξοφλημένο'}</span><button type="button" className="text-button" onClick={()=>startForPerson('lending',row.person)}><Plus size={14}/> Νέο</button>{row.outstanding>0?<button type="button" className="text-button" onClick={()=>startForPerson('repayment',row.person)}><RotateCcw size={14}/> Επιστροφή</button>:null}</div></article>)}</section>
    <section className="panel neo-raised lending-mobile-only"><div className="panel-head"><div><span>Πλήρες ιστορικό</span><small>Ημερομηνία, πρόσωπο, ενέργεια, ποσό και τρέχουσα οφειλή μετά από κάθε κίνηση.</small></div></div>{history.length?<div className="semantic-table-wrap"><table className="semantic-table receivables-table"><caption className="sr-only">Πλήρες ιστορικό δανεικών και επιστροφών</caption><thead><tr><th scope="col">Ημερομηνία</th><th scope="col">Πρόσωπο</th><th scope="col">Κίνηση</th><th scope="col">Σχόλιο</th><th scope="col">Λογαριασμός</th><th scope="col" className="amount">Ποσό</th><th scope="col" className="amount">Υπόλοιπο</th></tr></thead><tbody>{history.map(row=><tr key={row.id}><td>{shortDate(row.date)}</td><td><b className={!visible?'private-text':''}>{row.person}</b></td><td><span className={`receivable-action ${row.action}`}>{row.action==='lent'?'Πλήρωσα για άλλον':row.action==='repaid'?'Μου επέστρεψαν':'Χάρισμα'}</span></td><td><span className={!visible?'private-text':''}>{row.note}</span></td><td>{row.accountId?accountDisplayName(data,row.accountId):'Ιστορικό'}</td><td className="amount">{row.action==='lent'?'+':'−'}{money.format(row.amount)}</td><td className="amount"><AnimatedAmount value={row.runningOutstanding} hidden={!visible}/></td></tr>)}</tbody></table></div>:<div className="empty-state">Δεν υπάρχει ιστορικό δανεικών.</div>}</section>

    {open?<div className="editor-backdrop" onMouseDown={close}><section ref={modalRef} className="panel neo-raised editor-dialog lending-dialog" role="dialog" aria-modal="true" aria-labelledby="lending-dialog-title" aria-describedby={error?'lending-dialog-error':undefined} tabIndex={-1} onMouseDown={e=>e.stopPropagation()}><div className="panel-head"><div><span id="lending-dialog-title">{kind==='lending'?'Πλήρωσα για άλλον':'Μου επέστρεψαν'}</span><small>{kind==='lending'?'Αυξάνει όσα σου χρωστά το πρόσωπο. Η ημερομηνία επιστροφής είναι προαιρετική και χρησιμοποιείται μόνο για υπενθυμίσεις.':'Μειώνει την οφειλή και αυξάνει τον επιλεγμένο λογαριασμό.'}</small></div><button type="button" className="icon-button" aria-label="Κλείσιμο κίνησης δανεικών" onClick={close}><X/></button></div><div className="settings-form editor-grid"><div className="lending-person-field"><label><span>Πρόσωπο</span><input data-autofocus="true" value={person} onChange={e=>setPerson(e.target.value)} placeholder="Όνομα" aria-autocomplete="list" aria-controls={knownPeople.length?'known-people-options':undefined} aria-invalid={Boolean(error)} aria-describedby={error?'lending-dialog-error':undefined}/></label>{knownPeople.length?<div id="known-people-options" className="known-people-suggestions" role="listbox" aria-label="Γνωστά πρόσωπα">{knownPeople.map(row=><button type="button" role="option" aria-selected={row.person===person} key={row.person} onClick={()=>setPerson(row.person)}>{row.person}{kind==='repayment'?<small>{money.format(row.outstanding)}</small>:null}</button>)}</div>:null}</div><label><span>Ποσό</span><MoneyInput value={amount} onValueChange={setAmount} placeholder="0,00" invalid={Boolean(error)} aria-describedby={error?'lending-dialog-error':undefined}/></label><label><span>Ημερομηνία</span><AppDateInput value={date} onChange={e=>{setDate(e.target.value);if(expectedReturnDate&&expectedReturnDate<e.target.value)setExpectedReturnDate('')}}/></label><label><span>{kind==='lending'?'Πληρωμή από':'Επιστροφή σε'}</span><AppSelectInput value={account} onChange={e=>setAccount(e.target.value)}>{accounts.map(item=><option key={item.id} value={item.id}>{accountDisplayName(data,item.id)}</option>)}</AppSelectInput></label>{kind==='lending'?<label><span>Αναμενόμενη επιστροφή <em>προαιρετικό</em></span><AppDateInput value={expectedReturnDate} min={date} onChange={e=>setExpectedReturnDate(e.target.value)}/></label>:null}<label className="wide"><span>Σχόλιο <em>προαιρετικό</em></span><input value={note} onChange={e=>setNote(e.target.value)}/></label></div>{error?<FormError id="lending-dialog-error">{error}</FormError>:null}<div className="editor-actions"><button type="button" className="secondary" onClick={close}>Ακύρωση</button><button type="button" className="save-button" onClick={submit}>Καταχώριση</button></div></section></div>:null}
  </div>;
}
