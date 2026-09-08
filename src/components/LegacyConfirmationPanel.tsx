import { Check, ChevronDown, ChevronUp, Clock3, Plus, ShieldCheck, Split, Trash2, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import { AppSelectInput } from './AppSelectInput';
import { AppTextInput } from './AppTextInput';
import { CategorySelectInput } from './CategorySelectInput';
import { MoneyInput } from './MoneyInput';
import { Tooltip } from './Tooltip';
import { useModalFocus } from '../hooks/useModalFocus';
import { reviewSuggestions, suggestSplitParts } from '../lib/domain';
import { cleanNote, money, shortDate } from '../lib/format';
import { accountDisplayName, reviewConfidenceLabel, reviewSemanticLabel } from '../lib/ui';
import type { FinanceData, ReviewDecision, SplitPart } from '../types';

export function LegacyConfirmationPanel({
  data,
  onDecision,
  idPrefix='legacy-confirmation',
}:{
  data:FinanceData;
  onDecision:(id:string,decision:ReviewDecision)=>void;
  idPrefix?:string;
}){
  const suggestions=reviewSuggestions(data).slice(0,120);
  const [expanded,setExpanded]=useState(false);
  const [splitTx,setSplitTx]=useState<string|null>(null);
  const active=suggestions.find(s=>s.transaction.id===splitTx);
  const [parts,setParts]=useState<SplitPart[]>([]);
  const modalRef=useModalFocus<HTMLElement>(Boolean(active),'input',()=>setSplitTx(null));
  const act=(id:string,status:ReviewDecision['status'],semanticKind?:ReviewDecision['semanticKind'])=>{
    const now=new Date();
    const snoozedUntil=status==='snoozed'?new Date(now.getTime()+24*60*60*1000).toISOString():undefined;
    onDecision(id,{status,semanticKind,decidedAt:now.toISOString(),snoozedUntil});
  };
  const openSplit=(id:string)=>{
    const suggestion=suggestions.find(item=>item.transaction.id===id);
    if(!suggestion)return;
    const parsed=suggestSplitParts(suggestion.transaction.note,suggestion.transaction.category||'Άλλο');
    setParts(parsed.length?parsed:[{id:'sp-1',label:'',category:suggestion.transaction.category||'Άλλο',amount:suggestion.transaction.amount,kind:'expense'}]);
    setSplitTx(id);
  };
  const splitSum=parts.reduce((sum,part)=>sum+part.amount,0);
  const splitValid=Boolean(parts.length)&&Math.abs(splitSum-(active?.transaction.amount??0))<.01&&parts.every(part=>Number.isFinite(part.amount)&&part.amount>0);
  const closeSplit=()=>setSplitTx(null);
  const listId=`${idPrefix}-list`;

  if(!suggestions.length)return null;

  return <section className={`attention-approved-group pending legacy-confirmation-panel ${expanded?'is-expanded':'is-collapsed'}`} data-legacy-confirmation-panel aria-labelledby={`${idPrefix}-title`}>
    <header className="attention-approved-group-head">
      <div className="attention-approved-group-title">
        <span className="attention-approved-group-icon" aria-hidden="true"><ShieldCheck/></span>
        <div><h2 id={`${idPrefix}-title`}>Προς επιβεβαίωση ({suggestions.length})</h2><p>Παλαιότερες κινήσεις όπου το MyFinHub εντόπισε πιθανή διαφορετική σημασιολογία. Καμία αναφορά δεν αλλάζει χωρίς δική σου επιβεβαίωση.</p></div>
      </div>
      <button type="button" className="attention-approved-group-link legacy-confirmation-toggle" aria-expanded={expanded} aria-controls={listId} onClick={()=>setExpanded(value=>!value)}>{expanded?'Απόκρυψη':'Προβολή'} {expanded?<ChevronUp/>:<ChevronDown/>}</button>
    </header>
    {expanded?<div id={listId} className="review-list legacy-confirmation-list" role="list" aria-label="Κινήσεις προς επιβεβαίωση">{suggestions.map(s=><article role="listitem" className="review-row legacy-confirmation-row" key={s.transaction.id}>
      <div className={`confidence-orb ${s.confidence}`} aria-label={reviewConfidenceLabel(s.confidence)}>{s.confidence==='high'?'Υψηλή':s.confidence==='medium'?'Μέτρια':'Χαμηλή'}</div>
      <div className="review-copy"><div className="review-meta"><span>{shortDate(s.transaction.date)}</span><em>{accountDisplayName(data,s.transaction.accountId)}</em><b>{money.format(s.transaction.amount)}</b></div><h3>{cleanNote(s.transaction.note).split('\n')[0]}</h3><p>{s.reason}</p><span className="suggestion-tag">{s.semanticKind==='split_required'?<Split size={14}/>:<ShieldCheck size={14}/>} Πρόταση: {reviewSemanticLabel(s.semanticKind)}</span></div>
      <div className="review-buttons">{s.semanticKind==='split_required'?<button type="button" className="approve" onClick={()=>openSplit(s.transaction.id)}><Split size={15}/> Άνοιγμα διαχωρισμού</button>:<button type="button" className="approve" disabled={s.semanticKind==='iris_context'} onClick={()=>act(s.transaction.id,'confirmed',s.semanticKind==='iris_context'?undefined:s.semanticKind)}><Check size={15}/> Επιβεβαίωση</button>}<button type="button" onClick={()=>act(s.transaction.id,'kept')}><Undo2 size={15}/> Κράτα ως είναι</button><button type="button" onClick={()=>act(s.transaction.id,'snoozed')}><Clock3 size={15}/> Αργότερα</button></div>
    </article>)}</div>:null}
    {active?<div className="editor-backdrop" onMouseDown={closeSplit}><section ref={modalRef} className="panel neo-raised editor-dialog" role="dialog" aria-modal="true" aria-labelledby={`${idPrefix}-split-title`} tabIndex={-1} onMouseDown={event=>event.stopPropagation()}><div className="panel-head"><div><span id={`${idPrefix}-split-title`}>Διαχωρισμός κίνησης</span><small>{cleanNote(active.transaction.note).replace(/\n/g,' · ')}</small></div><button type="button" className="icon-button" aria-label="Κλείσιμο επεξεργασίας διαχωρισμού" onClick={closeSplit}><X/></button></div><div className="split-review-summary"><span>Αρχικό ποσό <b>{money.format(active.transaction.amount)}</b></span><span>Μέρη <b className={Math.abs(splitSum-active.transaction.amount)<.01?'positive':'negative'}>{money.format(splitSum)}</b></span></div>{parts.map((part,index)=><div className="review-part" key={part.id}><AppTextInput aria-label={`Περιγραφή μέρους ${index+1}`} value={part.label} onChange={event=>setParts(items=>items.map((item,itemIndex)=>itemIndex===index?{...item,label:event.target.value}:item))}/><AppSelectInput aria-label={`Τύπος μέρους ${index+1}`} value={part.kind||'expense'} onChange={event=>setParts(items=>items.map((item,itemIndex)=>itemIndex===index?{...item,kind:event.target.value as SplitPart['kind']}:item))}><option value="expense">Έξοδο</option><option value="income">Έσοδο</option><option value="refund">Επιστροφή αγοράς</option><option value="saving">Αποταμίευση</option><option value="transfer">Μεταφορά</option><option value="reconciliation">Διόρθωση</option></AppSelectInput><CategorySelectInput settings={data.state.settings} kind="expense" category={part.category} subcategory={part.subcategory} aria-label={`Κατηγορία ή υποκατηγορία μέρους ${index+1}`} onChange={selection=>setParts(items=>items.map((item,itemIndex)=>itemIndex===index?{...item,category:selection.category,subcategory:selection.subcategory||undefined}:item))}/><MoneyInput aria-label={`Ποσό μέρους ${index+1}`} value={Number.isFinite(part.amount)&&part.amount>0?String(part.amount):''} onValueChange={value=>{const numeric=Number(value.replace(',','.'));setParts(items=>items.map((item,itemIndex)=>itemIndex===index?{...item,amount:Number.isFinite(numeric)?numeric:0}:item))}} invalid={!Number.isFinite(part.amount)||part.amount<=0}/><Tooltip label={`Αφαίρεση μέρους ${index+1}`} side="left"><button type="button" className="danger" aria-label={`Αφαίρεση μέρους ${index+1}`} onClick={()=>setParts(items=>items.filter((_,itemIndex)=>itemIndex!==index))}><Trash2/></button></Tooltip></div>)}{!splitValid?<div className="form-error" role="alert">Τα ποσά των μερών πρέπει να είναι θετικά και το άθροισμά τους να είναι ίσο με το αρχικό ποσό.</div>:null}<div className="editor-actions"><button type="button" className="secondary" onClick={()=>setParts(items=>[...items,{id:`sp-${Date.now()}`,label:'',category:active.transaction.category||'Άλλο',amount:0,kind:'expense'}])}><Plus/> Προσθήκη μέρους</button><button type="button" className="save-button" disabled={!splitValid} onClick={()=>{onDecision(active.transaction.id,{status:'confirmed',semanticKind:'split',parts,decidedAt:new Date().toISOString()});closeSplit()}}><Check/> Επιβεβαίωση διαχωρισμού</button></div></section></div>:null}
  </section>;
}