import { Eye, EyeOff, HandCoins, Plus, RotateCcw, UserRound, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnimatedAmount } from '../components/AnimatedAmount';
import { useModalFocus } from '../hooks/useModalFocus';
import { genericCategoryTree, subcategoriesFor } from '../lib/categories';
import { allAccounts } from '../lib/domain';
import { money, shortDate } from '../lib/format';
import { lendingHistory, lendingOutstandingFor, lendingRows, personBalanceLabel, type LendingAction } from '../lib/lending';
import { createPersonEvent, settlementMethodLabel } from '../lib/personSettlements';
import { accountDisplayName } from '../lib/ui';
import type { FinanceData, FinanceEvent, PersonAction, SettlementMethod } from '../types';

const actionLabels:Record<PersonAction,string>={
  paid_for_other:'Πλήρωσα για άλλον',
  paid_by_other:'Πλήρωσε άλλος για μένα',
  shared_purchase:'Μοιρασμένη αγορά',
  settlement_received:'Μου επέστρεψαν',
  settlement_sent:'Επέστρεψα εγώ',
  forgiven:'Χάρισμα / συμψηφισμός',
};
const historyLabels:Record<LendingAction,string>={
  lent:'Πλήρωσα για άλλον',
  repaid:'Μου επέστρεψαν',
  forgiven:'Χάρισμα / συμψηφισμός',
  paid_by_other:'Πλήρωσε άλλος για μένα',
  shared_purchase:'Μερίδιο άλλου σε αγορά',
  settlement_sent:'Επέστρεψα εγώ',
  settlement_received:'Μου επέστρεψαν',
};
const settlementActions=new Set<PersonAction>(['settlement_received','settlement_sent']);
const categoryActions=new Set<PersonAction>(['paid_by_other','shared_purchase']);
const accountActions=new Set<PersonAction>(['paid_for_other','shared_purchase','settlement_received','settlement_sent']);

export function LendingPage({data,asOf,onCreateEvent}:{data:FinanceData;asOf:string;onCreateEvent:(event:FinanceEvent)=>void}){
  const rows=lendingRows(data);const history=lendingHistory(data);const accounts=allAccounts(data).filter(account=>account.kind!=='credit');
  const expenseCategories=genericCategoryTree(data.state.settings,'expense');
  const receivableTotal=rows.reduce((sum,row)=>sum+Math.max(0,row.outstanding),0);
  const payableTotal=rows.reduce((sum,row)=>sum+Math.max(0,-row.outstanding),0);
  const [visible,setVisible]=useState(false);const [open,setOpen]=useState(false);const [action,setAction]=useState<PersonAction>('paid_for_other');const [person,setPerson]=useState('');const [amount,setAmount]=useState('');const [personShare,setPersonShare]=useState('');const [date,setDate]=useState(asOf);const [account,setAccount]=useState(data.state.settings.defaultExpenseAccount);const [method,setMethod]=useState<SettlementMethod>('iris');const [category,setCategory]=useState(expenseCategories[0]?.name||'Άλλο');const [subcategory,setSubcategory]=useState('');const [note,setNote]=useState('');const [error,setError]=useState('');const modalRef=useModalFocus<HTMLElement>(open,'[data-autofocus="true"]');
  const currentBalance=useMemo(()=>lendingOutstandingFor(data,person.trim()),[data,person]);
  const availableSubcategories=subcategoriesFor(data.state.settings,'expense',category);
  const sharedOwnShare=action==='shared_purchase'?Math.max(0,Number(amount||0)-Number(personShare||0)):0;

  const start=(next:PersonAction,presetPerson='')=>{
    setAction(next);setPerson(presetPerson);setAmount('');setPersonShare('');setDate(asOf);setNote('');setError('');setCategory(expenseCategories[0]?.name||'Άλλο');setSubcategory('');
    if(next==='settlement_received'){setAccount(data.state.settings.defaultIncomeAccount);setMethod('cash')}
    else if(next==='settlement_sent'){setAccount(data.state.settings.defaultExpenseAccount);setMethod('iris')}
    else{setAccount(data.state.settings.defaultExpenseAccount);setMethod('iris')}
    setOpen(true);
  };
  const close=()=>{setOpen(false);setError('')};
  const changeAction=(next:PersonAction)=>{
    setAction(next);setError('');setPersonShare('');
    if(next==='settlement_received'){setAccount(data.state.settings.defaultIncomeAccount);setMethod('cash')}
    else if(next==='settlement_sent'){setAccount(data.state.settings.defaultExpenseAccount);setMethod('iris')}
  };
  const submit=()=>{
    const numeric=Number(amount.replace(',','.'));const share=Number(personShare.replace(',','.'));
    try{
      const event=createPersonEvent({action,person,date,amount:numeric,note,accountId:accountActions.has(action)?account:undefined,category:categoryActions.has(action)?category:undefined,subcategory:categoryActions.has(action)?subcategory||undefined:undefined,settlementMethod:settlementActions.has(action)?method:undefined,personShare:action==='shared_purchase'?share:undefined,currentBalance});
      onCreateEvent(event);close();
    }catch(e){setError(e instanceof Error?e.message:'Δεν ήταν δυνατή η καταχώριση.')}
  };

  return <div className="page-stack"><section className="page-heading"><div><span className="eyebrow">ΠΡΟΣΩΠΑ & ΣΥΜΨΗΦΙΣΜΟΙ</span><h1>Δανεικά & τακτοποιήσεις</h1><p>Το IRIS, τα μετρητά και οι τραπεζικές μεταφορές είναι τρόποι τακτοποίησης — όχι νέο εισόδημα ή νέο έξοδο.</p></div><div className="heading-actions"><button type="button" className="secondary privacy-toggle" aria-pressed={visible} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>} {visible?'Απόκρυψη στοιχείων':'Εμφάνιση στοιχείων'}</button><button type="button" className="save-button" onClick={()=>start('paid_for_other')}><HandCoins size={17}/> Νέα κίνηση</button></div></section>

  <section className="person-balance-summary"><article className="panel neo-raised"><span>Μου χρωστάνε</span><b className="positive"><AnimatedAmount value={receivableTotal} hidden={!visible}/></b><small>Ποσά που έχω πληρώσει για άλλους και δεν έχουν τακτοποιηθεί.</small></article><article className="panel neo-raised"><span>Χρωστάω</span><b className="negative"><AnimatedAmount value={payableTotal} hidden={!visible}/></b><small>Έξοδα δικά μου που πληρώθηκαν προσωρινά από άλλους.</small></article></section>

  <section className="receivable-person-grid">{rows.map(row=><article className="panel neo-raised" key={row.person}><div className="loan-title"><span className="account-mark"><UserRound/></span><div><h3 className={!visible?'private-text':''}>{row.person}</h3><small>{row.events} καταγεγραμμένες κινήσεις</small></div><b className={row.outstanding>0?'positive':row.outstanding<0?'negative':''}><AnimatedAmount value={Math.abs(row.outstanding)} hidden={!visible}/></b></div><div className="person-balance-state"><span>{personBalanceLabel(row.outstanding)}</span>{Math.abs(row.outstanding)>.009?<small>{row.outstanding>0?'Πρέπει να σου επιστραφούν χρήματα.':'Πρέπει να επιστρέψεις χρήματα.'}</small>:null}</div><div className="receivable-person-actions"><button type="button" className="text-button" onClick={()=>start('paid_for_other',row.person)}><Plus size={14}/> Πλήρωσα</button><button type="button" className="text-button" onClick={()=>start('paid_by_other',row.person)}><Plus size={14}/> Πλήρωσε άλλος</button>{row.outstanding>.009?<button type="button" className="text-button" onClick={()=>start('settlement_received',row.person)}><RotateCcw size={14}/> Μου επέστρεψαν</button>:null}{row.outstanding<-.009?<button type="button" className="text-button" onClick={()=>start('settlement_sent',row.person)}><RotateCcw size={14}/> Επέστρεψα</button>:null}</div></article>)}</section>

  <section className="panel neo-raised"><div className="panel-head"><div><span>Πλήρες ιστορικό</span><small>Θετικό υπόλοιπο = σου χρωστά. Αρνητικό = χρωστάς εσύ. Οι τακτοποιήσεις δεν επηρεάζουν income/spending.</small></div></div>{history.length?<div className="semantic-table-wrap"><table className="semantic-table receivables-table"><caption className="sr-only">Πλήρες ιστορικό δανεικών και τακτοποιήσεων</caption><thead><tr><th scope="col">Ημερομηνία</th><th scope="col">Πρόσωπο</th><th scope="col">Κίνηση</th><th scope="col">Τρόπος</th><th scope="col">Σχόλιο</th><th scope="col">Λογαριασμός</th><th scope="col" className="amount">Ποσό</th><th scope="col" className="amount">Υπόλοιπο</th></tr></thead><tbody>{history.map(row=><tr key={row.id}><td>{shortDate(row.date)}</td><td><b className={!visible?'private-text':''}>{row.person}</b></td><td><span className={`receivable-action ${row.action}`}>{historyLabels[row.action]}</span></td><td>{row.settlementMethod?settlementMethodLabel(row.settlementMethod):'—'}</td><td><span className={!visible?'private-text':''}>{row.note}</span></td><td>{row.accountId?accountDisplayName(data,row.accountId):'—'}</td><td className="amount">{money.format(row.amount)}</td><td className={`amount ${row.runningOutstanding>0?'positive':row.runningOutstanding<0?'negative':''}`}><AnimatedAmount value={row.runningOutstanding} hidden={!visible}/></td></tr>)}</tbody></table></div>:<div className="empty-state">Δεν υπάρχει ιστορικό με άλλα πρόσωπα.</div>}</section>

  {open?<div className="editor-backdrop" onMouseDown={close}><section ref={modalRef} className="panel neo-raised editor-dialog lending-dialog" role="dialog" aria-modal="true" aria-labelledby="lending-dialog-title" tabIndex={-1} onMouseDown={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();close()}}}><div className="panel-head"><div><span id="lending-dialog-title">Κίνηση με πρόσωπο</span><small>{actionLabels[action]}</small></div><button type="button" className="icon-button" aria-label="Κλείσιμο κίνησης" onClick={close}><X/></button></div><div className="settings-form editor-grid">
    <label className="wide"><span>Τι έγινε</span><select value={action} onChange={e=>changeAction(e.target.value as PersonAction)}><option value="paid_for_other">Πλήρωσα για άλλον</option><option value="paid_by_other">Πλήρωσε άλλος για μένα</option><option value="shared_purchase">Μοιρασμένη αγορά — πλήρωσα εγώ</option><option value="settlement_received">Μου επέστρεψαν χρήματα</option><option value="settlement_sent">Επέστρεψα χρήματα</option><option value="forgiven">Χάρισμα / μη χρηματικός συμψηφισμός</option></select></label>
    <label><span>Πρόσωπο</span><input data-autofocus="true" list="known-people" value={person} onChange={e=>setPerson(e.target.value)} placeholder="Όνομα"/><datalist id="known-people">{rows.map(row=><option key={row.person} value={row.person}/>)}</datalist></label>
    <label><span>{action==='shared_purchase'?'Συνολική πληρωμή':'Ποσό'}</span><input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value.replace(',','.'))} placeholder="0,00"/></label>
    {action==='shared_purchase'?<><label><span>Μερίδιο άλλου</span><input inputMode="decimal" value={personShare} onChange={e=>setPersonShare(e.target.value.replace(',','.'))} placeholder="0,00"/></label><div className="derived-field"><span>Δικό μου έξοδο</span><b>{money.format(sharedOwnShare)}</b></div></>:null}
    <label><span>Ημερομηνία</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    {accountActions.has(action)?<label><span>{action==='settlement_received'?'Μπαίνουν σε':'Πληρωμή από'}</span><select value={account} onChange={e=>setAccount(e.target.value)}>{accounts.map(item=><option key={item.id} value={item.id}>{accountDisplayName(data,item.id)}</option>)}</select></label>:null}
    {settlementActions.has(action)?<label><span>Τρόπος τακτοποίησης</span><select value={method} onChange={e=>setMethod(e.target.value as SettlementMethod)}><option value="iris">IRIS</option><option value="cash">Μετρητά</option><option value="bank_transfer">Τραπεζική μεταφορά</option><option value="other">Άλλο</option></select></label>:null}
    {categoryActions.has(action)?<><label><span>Κατηγορία δικού μου εξόδου</span><select value={category} onChange={e=>{setCategory(e.target.value);setSubcategory('')}}>{expenseCategories.map(item=><option key={item.name} value={item.name}>{item.name}</option>)}</select></label><label><span>Υποκατηγορία <em>προαιρετική</em></span><select value={subcategory} onChange={e=>setSubcategory(e.target.value)}><option value="">Χωρίς υποκατηγορία</option>{availableSubcategories.map(value=><option key={value} value={value}>{value}</option>)}</select></label></>:null}
    {person.trim()&&Math.abs(currentBalance)>.009?<div className="current-person-balance wide"><span>Τωρινό υπόλοιπο με το πρόσωπο</span><b className={currentBalance>0?'positive':'negative'}>{personBalanceLabel(currentBalance)} · {money.format(Math.abs(currentBalance))}</b></div>:null}
    <label className="wide"><span>Σχόλιο <em>προαιρετικό</em></span><input value={note} onChange={e=>setNote(e.target.value)} placeholder={settlementActions.has(action)?'π.χ. IRIS για φαγητό':'Περιγραφή'}/></label>
  </div>{error?<div className="form-error" role="alert">{error}</div>:null}<div className="editor-actions"><button type="button" className="secondary" onClick={close}>Ακύρωση</button><button type="button" className="save-button" onClick={submit}>Καταχώριση</button></div></section></div>:null}</div>;
}
