import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowDownToLine, ArrowLeftRight, BanknoteArrowDown, Check, CircleDollarSign, RotateCcw, Scale, Split, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppDateInput } from './AppDateInput';
import { AppSelectInput } from './AppSelectInput';
import { FinanceIcon } from './FinanceIcon';
import { useModalFocus } from '../hooks/useModalFocus';
import { genericCategoryTree, subcategoriesFor } from '../lib/categories';
import { allAccounts, createEvent, frequentDescriptions } from '../lib/domain';
import { entryDefaults, entryDraftError } from '../lib/inputSemantics';
import {
  createExpenseSplitEvent,
  createTransferEvent,
  defaultTransferPair,
  splitAllocation,
  splitDraftError,
  transferDraftError,
} from '../lib/ledgerFoundations';
import { preserveLoanPaymentLink } from '../lib/loans';
import { money } from '../lib/format';
import { accountDisplayName } from '../lib/ui';
import { userErrorMessage } from '../lib/userMessage';
import type { EventKind, FinanceData, FinanceEvent, SplitPart } from '../types';

export type QuickPrefill = { note:string; amount:number; category?:string; subcategory?:string; accountId?:string };

const genericKinds: Array<{kind:EventKind; label:string; desc:string; icon:ReactNode}> = [
  {kind:'expense',label:'Αγόρασα',desc:'Κανονικό έξοδο',icon:<CircleDollarSign/>},
  {kind:'income',label:'Πήρα χρήματα',desc:'Πραγματικό έσοδο',icon:<ArrowDownToLine/>},
  {kind:'transfer',label:'Μετέφερα',desc:'Μεταξύ λογαριασμών',icon:<ArrowLeftRight/>},
  {kind:'withdrawal',label:'Πήρα μετρητά',desc:'Ανάληψη από λογαριασμό',icon:<BanknoteArrowDown/>},
  {kind:'refund',label:'Επιστροφή αγοράς',desc:'Μειώνει τα πραγματικά έξοδα',icon:<RotateCcw/>},
  {kind:'reconciliation',label:'Διόρθωση υπολοίπου',desc:'Προσαρμογή εκτός εξόδων',icon:<Scale/>},
  {kind:'split',label:'Σύνθετη αγορά',desc:'Μία πληρωμή, πολλές κατηγορίες',icon:<Split/>},
];
const labelForKind=(kind:EventKind)=>genericKinds.find(item=>item.kind===kind)?.label||'Κίνηση';

export function QuickAdd({ open, data, asOf, initial, initialKind='expense', prefill=null, motionMode='system', onClose, onCreate, currentBalance }: { open:boolean; data:FinanceData; asOf:string; initial?:FinanceEvent|null; initialKind?:EventKind; prefill?:QuickPrefill|null; motionMode?:'system'|'reduced'|'full'; onClose:()=>void; onCreate:(event:FinanceEvent)=>void; currentBalance:(accountId:string)=>number }) {
  const systemReduced = useReducedMotion();
  const reduce = Boolean(systemReduced) || motionMode==='reduced';
  const accounts = allAccounts(data).filter(a=>a.kind!=='credit');
  const accountIds = useMemo(()=>new Set(accounts.map(account=>account.id)),[accounts]);
  const transferDefaults = useMemo(()=>defaultTransferPair(data),[data]);
  const fallbackAccount=accounts[0]?.id||'cash';
  const frequent = useMemo(()=>frequentDescriptions(data,'expense',10),[data]);
  const [kind,setKind]=useState<EventKind>('expense');
  const [amount,setAmount]=useState('');
  const [date,setDate]=useState(asOf);
  const [note,setNote]=useState('');
  const [category,setCategory]=useState(data.state.settings.expenseCategories[0]||'Άλλο');
  const [subcategory,setSubcategory]=useState('');
  const [accountId,setAccountId]=useState(data.state.settings.defaultExpenseAccount||fallbackAccount);
  const [from,setFrom]=useState(transferDefaults.from);
  const [to,setTo]=useState(transferDefaults.to);
  const [person,setPerson]=useState('');
  const [actualBalance,setActualBalance]=useState('');
  const [parts,setParts]=useState<SplitPart[]>([{id:'p1',label:'',category:data.state.settings.expenseCategories[0]||'Άλλο',amount:0},{id:'p2',label:'',category:data.state.settings.expenseCategories[1]||data.state.settings.expenseCategories[0]||'Άλλο',amount:0}]);
  const [error,setError]=useState('');
  const [dirty,setDirty]=useState(false);
  const categoryKind=kind==='income'?'income':'expense';
  const categoryTree=genericCategoryTree(data.state.settings,categoryKind);
  const categoryOptions=categoryTree.map(item=>item.name);
  const subcategoryOptions=subcategoriesFor(data.state.settings,categoryKind,category);
  const splitStatus=useMemo(()=>{
    if(kind!=='split'||!amount.trim()||!Number.isFinite(Number(amount)))return null;
    return splitAllocation(Number(amount),parts);
  },[kind,amount,parts]);

  const freshParts=()=>[
    {id:'p1',label:'',category:data.state.settings.expenseCategories[0]||'Άλλο',amount:0},
    {id:'p2',label:'',category:data.state.settings.expenseCategories[1]||data.state.settings.expenseCategories[0]||'Άλλο',amount:0},
  ] satisfies SplitPart[];

  useEffect(()=>{
    if(!open)return;
    if(initial){
      const defaults=entryDefaults(initial.kind,data.state.settings,fallbackAccount);
      setKind(initial.kind);
      setAmount(String(initial.amount||''));
      setDate(initial.date||asOf);
      setNote(initial.note||'');
      setCategory(initial.category||defaults.category);
      setSubcategory(initial.subcategory||'');
      setAccountId(initial.accountId||initial.legs.find(l=>l.accountId!=='credit-card')?.accountId||defaults.accountId);
      setFrom(initial.fromAccountId||initial.legs.find(l=>l.amount<0)?.accountId||transferDefaults.from);
      setTo(initial.toAccountId||initial.legs.find(l=>l.amount>0)?.accountId||transferDefaults.to);
      setPerson(initial.person||'');
      setParts(initial.parts?.length?initial.parts:freshParts());
      setActualBalance(initial.kind==='reconciliation'?String(currentBalance(initial.accountId||initial.legs[0]?.accountId||defaults.accountId)):'');
    }else{
      const defaults=entryDefaults(initialKind,data.state.settings,fallbackAccount);
      setKind(initialKind);
      setAmount(prefill?String(prefill.amount):'');
      setDate(asOf);
      setNote(prefill?.note||'');
      setCategory(prefill?.category||defaults.category);
      setSubcategory(prefill?.subcategory||'');
      setAccountId(prefill?.accountId||defaults.accountId);
      setFrom(transferDefaults.from);
      setTo(transferDefaults.to);
      setPerson('');
      setActualBalance('');
      setParts(freshParts());
    }
    setError('');setDirty(false);
  },[open,initial,initialKind,prefill,asOf,transferDefaults.from,transferDefaults.to]);

  const reconciliationBase=(id:string)=>currentBalance(id)-(initial?.kind==='reconciliation'?Number(initial.legs.find(l=>l.accountId===id)?.amount||0):0);
  const transferLike=['transfer','saving_cash_offset','withdrawal','card_payment'].includes(kind);
  const lendingLike=['lending','repayment'].includes(kind);
  const mark=()=>setDirty(true);
  const requestClose=()=>{if(dirty&&!window.confirm('Έχεις αλλαγές που δεν έχουν αποθηκευτεί. Θέλεις να κλείσεις την καταχώριση και να τις απορρίψεις;'))return;onClose()};
  const modalRef=useModalFocus<HTMLElement>(open,'[data-autofocus="true"]',requestClose);
  const reset=()=>{setAmount('');setNote('');setSubcategory('');setError('');setActualBalance('');setDirty(false)};
  const chooseKind=(next:EventKind)=>{
    const defaults=entryDefaults(next,data.state.settings,fallbackAccount);
    const nextTree=genericCategoryTree(data.state.settings,next==='income'?'income':'expense');
    const nextCategory=nextTree.some(item=>item.name===defaults.category)?defaults.category:(nextTree[0]?.name||defaults.category);
    setKind(next);setError('');setAccountId(defaults.accountId);setCategory(nextCategory);setSubcategory('');mark();
    if(next==='transfer'){setFrom(transferDefaults.from);setTo(transferDefaults.to)}
    if(next==='saving_cash_offset'){setFrom(transferDefaults.from);setTo(accounts.find(account=>account.kind==='savings'&&account.id!==transferDefaults.from)?.id||transferDefaults.to)}
    if(next==='withdrawal'){setFrom(transferDefaults.from);setTo(accounts.find(account=>account.kind==='cash'&&account.id!==transferDefaults.from)?.id||transferDefaults.to)}
  };
  const submit=()=>{
    try{
      const draftError=entryDraftError(kind,{amount,person,actualBalance,parts});
      if(draftError) throw new Error(draftError);
      const numeric=Number(amount);
      const actual=kind==='reconciliation'?Number(actualBalance):undefined;
      let event:FinanceEvent;
      if(kind==='transfer'){
        const transferError=transferDraftError(data,{fromAccountId:from,toAccountId:to,amount:numeric});
        if(transferError)throw new Error(transferError);
        event=createTransferEvent(data,{date,amount:numeric,note:note||labelForKind(kind),fromAccountId:from,toAccountId:to});
      }else if(kind==='split'){
        const splitError=splitDraftError(data,{accountId,amount:numeric,parts});
        if(splitError)throw new Error(splitError);
        event=createExpenseSplitEvent(data,{date,amount:numeric,note:note||labelForKind(kind),accountId,parts});
      }else{
        event=createEvent({kind,date,amount:kind==='reconciliation'?Math.abs((actual as number)-reconciliationBase(accountId)):numeric,note:note||labelForKind(kind),category,accountId,fromAccountId:from,toAccountId:to,person:person.trim(),actualBalance:actual,currentBalance:reconciliationBase(accountId)});
      }
      event.subcategory=subcategory||undefined;
      if(initial){event.id=initial.id;event.createdAt=initial.createdAt;event.updatedAt=new Date().toISOString();preserveLoanPaymentLink(event,initial)}
      onCreate(event); reset(); onClose();
    }catch(e){setError(userErrorMessage(e,'Δεν μπορέσαμε να καταχωρίσουμε την κίνηση. Έλεγξε τα στοιχεία και δοκίμασε ξανά.'))}
  };

  const accountOptions=(current:string)=>current&&!accountIds.has(current)?<><option value={current} disabled>Μη διαθέσιμος · {accountDisplayName(data,current)}</option>{accounts.map(a=><option key={a.id} value={a.id}>{accountDisplayName(data,a.id)}</option>)}</>:accounts.map(a=><option key={a.id} value={a.id}>{accountDisplayName(data,a.id)}</option>);

  return <AnimatePresence>{open?<motion.div className="modal-backdrop" initial={reduce?false:{opacity:0}} animate={{opacity:1}} exit={reduce?undefined:{opacity:0}} onMouseDown={requestClose}>
    <motion.section ref={modalRef} className="quick-modal neo-raised" role="dialog" aria-modal="true" aria-labelledby="quick-add-title" aria-describedby="quick-add-description" tabIndex={-1} initial={reduce?false:{opacity:0,scale:.97,y:12}} animate={{opacity:1,scale:1,y:0}} exit={reduce?undefined:{opacity:0,scale:.98,y:8}} transition={{duration:reduce?0:.18}} onMouseDown={e=>e.stopPropagation()}>
      <header><div><small>{initial?'ΕΠΕΞΕΡΓΑΣΙΑ':'ΓΡΗΓΟΡΗ ΚΙΝΗΣΗ'}</small><h2 id="quick-add-title">{initial?'Επεξεργασία κίνησης':'Τι έγινε;'}</h2><p id="quick-add-description">Για καθημερινές κινήσεις. Κάρτες, δόσεις, δάνεια, αποταμίευση και συνδρομές διαχειρίζονται από τις δικές τους ενότητες.</p></div><button type="button" className="icon-button" aria-label="Κλείσιμο καταχώρισης" onClick={requestClose}><X/></button></header>
      {genericKinds.some(item=>item.kind===kind)?<div className="kind-grid generic-kind-grid" role="group" aria-label="Είδος οικονομικής κίνησης">{genericKinds.map(k=><button type="button" key={k.kind} className={kind===k.kind?'active':''} aria-pressed={kind===k.kind} onClick={()=>chooseKind(k.kind)}><span>{k.icon}</span><b>{k.label}</b><small>{k.desc}</small></button>)}</div>:null}
      <div className="entry-body">
        {kind==='expense'?<div className="frequent-strip"><span>Συχνά</span>{frequent.slice(0,6).map(f=><button type="button" key={f.label} onClick={()=>{setNote(f.label);setAmount(String(f.lastAmount));setCategory(f.category||category);setSubcategory('');if(f.accountId)setAccountId(f.accountId);mark()}}><FinanceIcon kind="expense" note={f.label} category={f.category} size={14}/><span>{f.label}</span><small>{money.format(f.lastAmount)}</small></button>)}</div>:null}
        <div className="form-grid">
          {kind!=='reconciliation'?<label><span>Ποσό</span><div className="money-input"><b>€</b><input data-autofocus="true" inputMode="decimal" value={amount} onChange={e=>{setAmount(e.target.value.replace(',','.'));mark()}}/></div></label>:null}
          <label><span>Ημερομηνία</span><AppDateInput value={date} onChange={e=>{setDate(e.target.value);mark()}}/></label>
          {!transferLike && kind!=='card_purchase'?<label><span>Λογαριασμός</span><AppSelectInput value={accountId} onChange={e=>{setAccountId(e.target.value);mark()}}>{accountOptions(accountId)}</AppSelectInput></label>:null}
          {transferLike?<><label><span>Από</span><AppSelectInput value={from} onChange={e=>{setFrom(e.target.value);mark()}}>{accountOptions(from)}</AppSelectInput></label>{kind!=='card_payment'?<label><span>Προς</span><AppSelectInput value={to} onChange={e=>{setTo(e.target.value);mark()}}>{accountOptions(to)}</AppSelectInput></label>:null}</>:null}
          {!['transfer','withdrawal','saving_cash_offset','card_payment','reconciliation'].includes(kind)?<><label><span>Κατηγορία</span><AppSelectInput value={category} onChange={e=>{setCategory(e.target.value);setSubcategory('');mark()}}>{categoryOptions.map(c=><option key={c}>{c}</option>)}</AppSelectInput></label>{subcategoryOptions.length?<label><span>Υποκατηγορία</span><AppSelectInput value={subcategory} onChange={e=>{setSubcategory(e.target.value);mark()}}><option value="">Χωρίς υποκατηγορία</option>{subcategoryOptions.map(value=><option key={value}>{value}</option>)}</AppSelectInput></label>:null}</>:null}
          {lendingLike?<label><span>Πρόσωπο</span><input value={person} onChange={e=>{setPerson(e.target.value);mark()}} placeholder="π.χ. Χρήστος"/></label>:null}
          {kind==='reconciliation'?<><label><span>Πραγματικό υπόλοιπο</span><div className="money-input"><b>€</b><input data-autofocus="true" inputMode="decimal" value={actualBalance} onChange={e=>{setActualBalance(e.target.value.replace(',','.'));mark()}}/></div></label><div className="reconcile-preview"><span>Αναμενόμενο τώρα</span><b>{money.format(reconciliationBase(accountId))}</b><span>Διαφορά</span><strong>{actualBalance.trim()&&Number.isFinite(Number(actualBalance))?money.format(Number(actualBalance)-reconciliationBase(accountId)):'—'}</strong></div></>:null}
          <label className="wide"><span>Σχόλιο <em>προαιρετικό</em></span><input value={note} onChange={e=>{setNote(e.target.value);mark()}} placeholder="Σύντομη περιγραφή μόνο αν χρειάζεται"/></label>
        </div>
        {kind==='split'?<div className="split-box"><div className="split-head"><b>Επιμέρους ποσά</b><span aria-live="polite">{splitStatus?splitStatus.remainingCents===0?`Συμπληρώθηκαν ${money.format(splitStatus.allocatedCents/100)}`:splitStatus.remainingCents>0?`Απομένουν ${money.format(splitStatus.remainingCents/100)}`:`Υπέρβαση ${money.format(Math.abs(splitStatus.remainingCents)/100)}`:`Σύνολο: ${money.format(parts.reduce((s,p)=>s+Number(p.amount||0),0))}`}</span></div>{parts.map((p,i)=>{const subs=subcategoriesFor(data.state.settings,'expense',p.category);return <div className="split-line split-line-taxonomy" key={p.id}><input aria-label={`Περιγραφή μέρους ${i+1}`} placeholder="Περιγραφή" value={p.label} onChange={e=>{setParts(ps=>ps.map((x,j)=>j===i?{...x,label:e.target.value}:x));mark()}}/><AppSelectInput aria-label={`Κατηγορία μέρους ${i+1}`} value={p.category} onChange={e=>{setParts(ps=>ps.map((x,j)=>j===i?{...x,category:e.target.value,subcategory:undefined}:x));mark()}}>{genericCategoryTree(data.state.settings,'expense').map(c=><option key={c.name}>{c.name}</option>)}</AppSelectInput>{subs.length?<AppSelectInput aria-label={`Υποκατηγορία μέρους ${i+1}`} value={p.subcategory||''} onChange={e=>{setParts(ps=>ps.map((x,j)=>j===i?{...x,subcategory:e.target.value||undefined}:x));mark()}}><option value="">—</option>{subs.map(value=><option key={value}>{value}</option>)}</AppSelectInput>:null}<input aria-label={`Ποσό μέρους ${i+1}`} inputMode="decimal" placeholder="0,00" value={p.amount||''} onChange={e=>{const parsed=Number(e.target.value.replace(',','.'));setParts(ps=>ps.map((x,j)=>j===i?{...x,amount:Number.isFinite(parsed)?parsed:0}:x));mark()}}/><button type="button" aria-label={`Αφαίρεση μέρους ${i+1}`} disabled={parts.length<=2} onClick={()=>{setParts(ps=>ps.filter((_,j)=>j!==i));mark()}}><X size={15}/></button></div>})}<button type="button" className="text-button" onClick={()=>{setParts(ps=>[...ps,{id:`p${Date.now()}`,label:'',category:genericCategoryTree(data.state.settings,'expense')[0]?.name||'Άλλο',amount:0}]);mark()}}>+ Προσθήκη μέρους</button></div>:null}
        {error?<div className="form-error" role="alert" aria-live="assertive">{error}</div>:null}
      </div>
      <footer><button type="button" className="secondary" onClick={requestClose}>Ακύρωση</button><button type="button" className="save-button" onClick={submit}><Check size={17}/> {initial?'Εφαρμογή αλλαγών':'Καταχώριση'}</button></footer>
    </motion.section>
  </motion.div>:null}</AnimatePresence>;
}
