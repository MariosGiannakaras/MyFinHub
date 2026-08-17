import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowDownToLine, ArrowLeftRight, BanknoteArrowDown, Check, CircleDollarSign, CreditCard, HandCoins, PiggyBank, RotateCcw, Scale, Split, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { allAccounts, createEvent, frequentDescriptions } from '../lib/domain';
import { entryDefaults, entryDraftError } from '../lib/inputSemantics';
import { preserveLoanPaymentLink } from '../lib/loans';
import { money } from '../lib/format';
import type { EventKind, FinanceData, FinanceEvent, SplitPart } from '../types';

const kinds: Array<{kind:EventKind; label:string; desc:string; icon:ReactNode}> = [
  {kind:'expense',label:'Αγόρασα',desc:'Κανονικό έξοδο',icon:<CircleDollarSign/>},
  {kind:'income',label:'Πήρα χρήματα',desc:'Πραγματικό έσοδο',icon:<ArrowDownToLine/>},
  {kind:'transfer',label:'Μετέφερα',desc:'Μεταξύ λογαριασμών',icon:<ArrowLeftRight/>},
  {kind:'saving_cash_offset',label:'Αποταμίευσα',desc:'Μισθοδοσίας → Ταμιευτηρίου, με μετρητά ως αντίκρισμα',icon:<PiggyBank/>},
  {kind:'withdrawal',label:'Πήρα μετρητά',desc:'Τράπεζα → Μετρητά',icon:<BanknoteArrowDown/>},
  {kind:'refund',label:'Μου επέστρεψαν',desc:'Refund που μειώνει spending',icon:<RotateCcw/>},
  {kind:'lending',label:'Πλήρωσα για άλλον',desc:'Αυξάνει όσα μου χρωστούν',icon:<HandCoins/>},
  {kind:'repayment',label:'Μου επέστρεψαν δανεικά',desc:'Μειώνει την οφειλή',icon:<HandCoins/>},
  {kind:'card_purchase',label:'Αγορά με πιστωτική',desc:'Expense + liability',icon:<CreditCard/>},
  {kind:'card_payment',label:'Πλήρωσα πιστωτική',desc:'Τράπεζα → οφειλή κάρτας',icon:<CreditCard/>},
  {kind:'reconciliation',label:'Διόρθωση υπολοίπου',desc:'Adjustment εκτός spending',icon:<Scale/>},
  {kind:'split',label:'Σύνθετη αγορά',desc:'Μία πληρωμή, πολλές κατηγορίες',icon:<Split/>},
];

export function QuickAdd({ open, data, asOf, initial, initialKind='expense', motionMode='system', onClose, onCreate, currentBalance }: { open:boolean; data:FinanceData; asOf:string; initial?:FinanceEvent|null; initialKind?:EventKind; motionMode?:'system'|'reduced'|'full'; onClose:()=>void; onCreate:(event:FinanceEvent)=>void; currentBalance:(accountId:string)=>number }) {
  const systemReduced = useReducedMotion();
  const reduce = systemReduced || motionMode==='reduced';
  const accounts = allAccounts(data).filter(a=>a.kind!=='credit');
  const fallbackAccount=accounts[0]?.id||'cash';
  const frequent = useMemo(()=>frequentDescriptions(data,'expense',10),[data]);
  const [kind,setKind]=useState<EventKind>('expense');
  const [amount,setAmount]=useState('');
  const [date,setDate]=useState(asOf);
  const [note,setNote]=useState('');
  const [category,setCategory]=useState(data.state.settings.expenseCategories[0]||'Άλλο');
  const [accountId,setAccountId]=useState(data.state.settings.defaultExpenseAccount||fallbackAccount);
  const [from,setFrom]=useState('piraeus-payroll');
  const [to,setTo]=useState('piraeus-savings');
  const [person,setPerson]=useState('');
  const [actualBalance,setActualBalance]=useState('');
  const [parts,setParts]=useState<SplitPart[]>([{id:'p1',label:'',category:data.state.settings.expenseCategories[0]||'Άλλο',amount:0},{id:'p2',label:'',category:data.state.settings.expenseCategories[1]||'Άλλο',amount:0}]);
  const [error,setError]=useState('');
  const categoryOptions=kind==='income'?data.state.settings.incomeCategories:data.state.settings.expenseCategories;

  useEffect(()=>{
    if(!open)return;
    if(initial){
      const defaults=entryDefaults(initial.kind,data.state.settings,fallbackAccount);
      setKind(initial.kind);setAmount(String(initial.amount||''));setDate(initial.date||asOf);setNote(initial.note||'');setCategory(initial.category||defaults.category);setAccountId(initial.accountId||initial.legs.find(l=>l.accountId!=='credit-card')?.accountId||defaults.accountId);setFrom(initial.fromAccountId||initial.legs.find(l=>l.amount<0)?.accountId||'piraeus-payroll');setTo(initial.toAccountId||initial.legs.find(l=>l.amount>0)?.accountId||'piraeus-savings');setPerson(initial.person||'');setParts(initial.parts?.length?initial.parts:[{id:'p1',label:'',category:data.state.settings.expenseCategories[0]||'Άλλο',amount:0},{id:'p2',label:'',category:data.state.settings.expenseCategories[1]||'Άλλο',amount:0}]);setActualBalance(initial.kind==='reconciliation'?String(currentBalance(initial.accountId||initial.legs[0]?.accountId||defaults.accountId)):'');setError('');
    }else{const defaults=entryDefaults(initialKind,data.state.settings,fallbackAccount);setKind(initialKind);setAmount('');setDate(asOf);setNote('');setCategory(defaults.category);setAccountId(defaults.accountId);setFrom('piraeus-payroll');setTo('piraeus-savings');setPerson('');setActualBalance('');setParts([{id:'p1',label:'',category:data.state.settings.expenseCategories[0]||'Άλλο',amount:0},{id:'p2',label:'',category:data.state.settings.expenseCategories[1]||'Άλλο',amount:0}]);setError('');}
  },[open,initial,initialKind,asOf,data]);

  const reconciliationBase=(id:string)=>currentBalance(id)-(initial?.kind==='reconciliation'?Number(initial.legs.find(l=>l.accountId===id)?.amount||0):0);
  const transferLike=['transfer','saving_cash_offset','withdrawal','card_payment'].includes(kind);
  const lendingLike=['lending','repayment'].includes(kind);
  const reset=()=>{setAmount('');setNote('');setError('');setActualBalance('');};
  const chooseKind=(next:EventKind)=>{
    const defaults=entryDefaults(next,data.state.settings,fallbackAccount);
    setKind(next);setError('');setAccountId(defaults.accountId);setCategory(defaults.category);
    if(next==='saving_cash_offset'){setFrom('piraeus-payroll');setTo('piraeus-savings');}
    if(next==='withdrawal'){setFrom('piraeus-payroll');setTo('cash');}
  };
  const submit=()=>{
    try{
      const draftError=entryDraftError(kind,{amount,person,actualBalance,parts});
      if(draftError) throw new Error(draftError);
      const numeric=Number(amount);
      const actual=kind==='reconciliation'?Number(actualBalance):undefined;
      const event=createEvent({kind,date,amount:kind==='reconciliation'?Math.abs((actual as number)-reconciliationBase(accountId)):numeric,note:note||kinds.find(k=>k.kind===kind)?.label||'',category,accountId,fromAccountId:from,toAccountId:to,person:person.trim(),parts:kind==='split'?parts:undefined,actualBalance:actual,currentBalance:reconciliationBase(accountId)});
      if(initial){event.id=initial.id;event.createdAt=initial.createdAt;event.updatedAt=new Date().toISOString();preserveLoanPaymentLink(event,initial);}
      onCreate(event); reset(); onClose();
    }catch(e){setError(e instanceof Error?e.message:'Δεν ήταν δυνατή η καταχώριση.');}
  };

  return <AnimatePresence>{open?<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={onClose}>
    <motion.section className="quick-modal neo-raised" role="dialog" aria-modal="true" aria-label="Γρήγορη προσθήκη" initial={reduce?false:{opacity:0,scale:.97,y:12}} animate={{opacity:1,scale:1,y:0}} exit={reduce?undefined:{opacity:0,scale:.98,y:8}} transition={{duration:.18}} onMouseDown={e=>e.stopPropagation()}>
      <header><div><small>{initial?'EDIT EVENT':'SMART ENTRY'}</small><h2>{initial?'Επεξεργασία κίνησης':'Τι έγινε;'}</h2><p>Διάλεξε την πραγματική ενέργεια. Το RheomIQ δημιουργεί τα σωστά ledger legs από πίσω.</p></div><button className="icon-button" onClick={onClose}><X/></button></header>
      <div className="kind-grid">{kinds.map(k=><button key={k.kind} className={kind===k.kind?'active':''} onClick={()=>chooseKind(k.kind)}><span>{k.icon}</span><b>{k.label}</b><small>{k.desc}</small></button>)}</div>
      <div className="entry-body">
        {kind==='expense'?<div className="frequent-strip"><span>Συχνά</span>{frequent.slice(0,6).map(f=><button key={f.label} onClick={()=>{setNote(f.label);setAmount(String(f.lastAmount));setCategory(f.category||category);if(f.accountId)setAccountId(f.accountId)}}>{f.label}<small>{money.format(f.lastAmount)}</small></button>)}</div>:null}
        <div className="form-grid">
          {kind!=='reconciliation'?<label><span>Ποσό</span><div className="money-input"><b>€</b><input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value.replace(',','.'))} autoFocus/></div></label>:null}
          <label><span>Ημερομηνία</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
          {!transferLike && kind!=='card_purchase'?<label><span>Λογαριασμός</span><select value={accountId} onChange={e=>setAccountId(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>:null}
          {transferLike?<><label><span>Από</span><select value={from} onChange={e=>setFrom(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>{kind!=='card_payment'?<label><span>Προς</span><select value={to} onChange={e=>setTo(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>:null}</>:null}
          {!['transfer','withdrawal','saving_cash_offset','card_payment','reconciliation'].includes(kind)?<label><span>Κατηγορία</span><select value={category} onChange={e=>setCategory(e.target.value)}>{categoryOptions.map(c=><option key={c}>{c}</option>)}</select></label>:null}
          {lendingLike?<label><span>Πρόσωπο</span><input value={person} onChange={e=>setPerson(e.target.value)} placeholder="π.χ. Χρήστος"/></label>:null}
          {kind==='reconciliation'?<><label><span>Πραγματικό υπόλοιπο</span><div className="money-input"><b>€</b><input inputMode="decimal" value={actualBalance} onChange={e=>setActualBalance(e.target.value.replace(',','.'))}/></div></label><div className="reconcile-preview"><span>Αναμενόμενο τώρα</span><b>{money.format(reconciliationBase(accountId))}</b><span>Διαφορά</span><strong>{actualBalance.trim()&&Number.isFinite(Number(actualBalance))?money.format(Number(actualBalance)-reconciliationBase(accountId)):'—'}</strong></div></>:null}
          <label className="wide"><span>Σχόλιο <em>προαιρετικό</em></span><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Επίλεξε συχνή κίνηση ή γράψε μόνο αν χρειάζεται"/></label>
        </div>
        {kind==='saving_cash_offset'?<div className="logic-note"><PiggyBank/><div><b>Η σωστή λογική αποταμίευσης σου</b><span>Τα μετρητά δεν αλλάζουν. Μειώνεται μόνο η Μισθοδοσίας και αυξάνεται ισόποσα ο Ταμιευτηρίου. Τα φυσικά μετρητά είναι το αντίκρισμα/αιτία της ενέργειας.</span></div></div>:null}
        {kind==='split'?<div className="split-box"><div className="split-head"><b>Επιμέρους ποσά</b><span>Σύνολο: {money.format(parts.reduce((s,p)=>s+Number(p.amount||0),0))}</span></div>{parts.map((p,i)=><div className="split-line" key={p.id}><input placeholder="Περιγραφή" value={p.label} onChange={e=>setParts(ps=>ps.map((x,j)=>j===i?{...x,label:e.target.value}:x))}/><select value={p.category} onChange={e=>setParts(ps=>ps.map((x,j)=>j===i?{...x,category:e.target.value}:x))}>{data.state.settings.expenseCategories.map(c=><option key={c}>{c}</option>)}</select><input inputMode="decimal" placeholder="0,00" value={p.amount||''} onChange={e=>setParts(ps=>ps.map((x,j)=>j===i?{...x,amount:Number(e.target.value.replace(',','.'))}:x))}/><button onClick={()=>setParts(ps=>ps.filter((_,j)=>j!==i))}><X size={15}/></button></div>)}<button className="text-button" onClick={()=>setParts(ps=>[...ps,{id:`p${Date.now()}`,label:'',category:data.state.settings.expenseCategories[0]||'Άλλο',amount:0}])}>+ Προσθήκη μέρους</button></div>:null}
        {error?<div className="form-error">{error}</div>:null}
      </div>
      <footer><button className="secondary" onClick={onClose}>Ακύρωση</button><button className="save-button" onClick={submit}><Check size={17}/> {initial?'Αποθήκευση αλλαγών':'Καταχώριση'}</button></footer>
    </motion.section>
  </motion.div>:null}</AnimatePresence>;
}
