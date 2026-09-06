import { useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronUp, CirclePause, ListFilter, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useModalFocus } from '../hooks/useModalFocus';
import { allAccounts } from '../lib/domain';
import { categoryTree } from '../lib/categories';
import { money } from '../lib/format';
import { normalizeTransactionRule, transactionRuleMatchingEvents } from '../lib/transactionRules';
import { accountDisplayName } from '../lib/ui';
import type { FinanceData, TransactionRule, TransactionRuleScope } from '../types';
import { AppSelectInput } from './AppSelectInput';
import { FormError } from './FormError';
import './TransactionRulesWorkspace.css';

const now=()=>new Date().toISOString();
const ruleId=()=>`rule-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const scopeLabel=(scope:TransactionRuleScope)=>scope==='manual'?'χειροκίνητη καταχώριση':scope==='imported'?'εισαγωγή':'επιβεβαίωση από έλεγχο';

export function TransactionRulesWorkspace({
  data,
  onUpsertRule,
  onDeleteRule,
}:{
  data:FinanceData;
  onUpsertRule:(rule:TransactionRule)=>void;
  onDeleteRule:(id:string)=>void;
}){
  const expenseFallback=data.state.settings.expenseCategories[0]||'Άλλο';
  const expenseTree=useMemo(()=>categoryTree(data.state.settings,'expense'),[data.state.settings]);
  const categorySubcategories=useMemo(()=>new Map(expenseTree.map(item=>[item.name,new Set(item.subcategories)])),[expenseTree]);
  const accounts=allAccounts(data).filter(account=>account.kind!=='credit');
  const accountIds=new Set(accounts.map(account=>account.id));
  const categoryNames=new Set(data.state.settings.expenseCategories);
  const rules=(data.state.transactionRules??[]).slice().sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
  const nextPriority=rules.reduce((max,rule)=>Math.max(max,rule.priority),0)+100;

  const[editorOpen,setEditorOpen]=useState(false);
  const[editingRuleId,setEditingRuleId]=useState<string|null>(null);
  const[ruleName,setRuleName]=useState('');
  const[ruleDescription,setRuleDescription]=useState('');
  const[ruleMerchant,setRuleMerchant]=useState('');
  const[ruleAccount,setRuleAccount]=useState('');
  const[ruleMode,setRuleMode]=useState<'contains'|'equals'>('contains');
  const[ruleCategory,setRuleCategory]=useState(expenseFallback);
  const[ruleSubcategory,setRuleSubcategory]=useState('');
  const[ruleDefaultNote,setRuleDefaultNote]=useState('');
  const[ruleScope,setRuleScope]=useState<'all'|TransactionRuleScope>('manual');
  const[ruleError,setRuleError]=useState('');

  function clearEditor(open=false){
    setEditingRuleId(null);
    setRuleName('');
    setRuleDescription('');
    setRuleMerchant('');
    setRuleAccount('');
    setRuleMode('contains');
    setRuleCategory(expenseFallback);
    setRuleSubcategory('');
    setRuleDefaultNote('');
    setRuleScope('manual');
    setRuleError('');
    setEditorOpen(open);
  }

  const editorRef=useModalFocus<HTMLElement>(editorOpen,'input:not([readonly]):not(:disabled)',()=>clearEditor(false));
  const editingRule=rules.find(rule=>rule.id===editingRuleId);
  const availableSubcategories=expenseTree.find(item=>item.name===ruleCategory)?.subcategories??[];
  const draftRule=useMemo<TransactionRule>(()=>({
    id:editingRuleId||'preview',
    name:ruleName||'Προεπισκόπηση',
    enabled:true,
    priority:editingRule?.priority??nextPriority,
    scopes:ruleScope==='all'?['manual','imported','review']:[ruleScope],
    match:{description:ruleDescription,merchant:ruleMerchant,accountId:ruleAccount||undefined,mode:ruleMode},
    action:{category:ruleCategory||undefined,subcategory:ruleSubcategory||undefined,note:ruleDefaultNote||undefined},
    createdAt:editingRule?.createdAt??now(),
    updatedAt:now(),
  }),[editingRuleId,editingRule?.priority,editingRule?.createdAt,nextPriority,ruleName,ruleScope,ruleDescription,ruleMerchant,ruleAccount,ruleMode,ruleCategory,ruleSubcategory,ruleDefaultNote]);
  const previewMatches=useMemo(()=>transactionRuleMatchingEvents(data,draftRule),[data,draftRule]);

  const invalidReason=(rule:TransactionRule)=>{
    if(rule.match.accountId&&!accountIds.has(rule.match.accountId))return 'Ο λογαριασμός της συνθήκης δεν είναι πλέον διαθέσιμος.';
    if(rule.action.category&&!categoryNames.has(rule.action.category))return 'Η κατηγορία της ενέργειας δεν είναι πλέον διαθέσιμη.';
    if(rule.action.subcategory&&!rule.action.category)return 'Η υποκατηγορία δεν έχει πλέον συνδεδεμένη κατηγορία.';
    if(rule.action.category&&rule.action.subcategory&&!categorySubcategories.get(rule.action.category)?.has(rule.action.subcategory))return 'Η υποκατηγορία της ενέργειας δεν είναι πλέον διαθέσιμη σε αυτή την κατηγορία.';
    return '';
  };

  const activeCount=rules.filter(rule=>rule.enabled).length;
  const invalidCount=rules.filter(rule=>Boolean(invalidReason(rule))).length;
  const pausedCount=rules.length-activeCount;

  const startCreate=()=>clearEditor(true);
  const editRule=(rule:TransactionRule)=>{
    setEditingRuleId(rule.id);
    setRuleName(rule.name);
    setRuleDescription(rule.match.description??'');
    setRuleMerchant(rule.match.merchant??'');
    setRuleAccount(rule.match.accountId??'');
    setRuleMode(rule.match.mode??'contains');
    setRuleCategory(rule.action.category??expenseFallback);
    setRuleSubcategory(rule.action.subcategory??'');
    setRuleDefaultNote(rule.action.note??'');
    setRuleScope(rule.scopes.length===3?'all':rule.scopes[0]??'manual');
    setRuleError('');
    setEditorOpen(true);
  };
  const saveRule=()=>{
    try{
      const existing=rules.find(item=>item.id===editingRuleId);
      const timestamp=now();
      const next=normalizeTransactionRule({...draftRule,id:existing?.id??ruleId(),enabled:existing?.enabled??true,createdAt:existing?.createdAt??timestamp,updatedAt:timestamp});
      onUpsertRule(next);
      clearEditor(false);
    }catch(error){
      setRuleError(error instanceof Error?error.message:'Δεν μπορέσαμε να αποθηκεύσουμε τον κανόνα. Έλεγξε τις συνθήκες και την ενέργεια και δοκίμασε ξανά.');
    }
  };
  const moveRule=(index:number,direction:-1|1)=>{
    const target=index+direction;
    if(target<0||target>=rules.length)return;
    if(direction===1){
      const afterTarget=rules[index+2];
      const floor=rules[target].priority;
      onUpsertRule({...rules[index],priority:afterTarget?(floor+afterTarget.priority)/2:floor+100,updatedAt:now()});
      return;
    }
    const afterCurrent=rules[index+1];
    const floor=rules[index].priority;
    onUpsertRule({...rules[target],priority:afterCurrent?(floor+afterCurrent.priority)/2:floor+100,updatedAt:now()});
  };
  const conditionLabel=(rule:TransactionRule)=>{
    const parts:string[]=[];
    if(rule.match.description)parts.push(`η περιγραφή ${rule.match.mode==='equals'?'είναι ακριβώς':'περιέχει'} «${rule.match.description}»`);
    if(rule.match.merchant)parts.push(`περιέχει επίσης «${rule.match.merchant}»`);
    if(rule.match.accountId)parts.push(`ο λογαριασμός είναι ${accountDisplayName(data,rule.match.accountId)}`);
    return parts.join(' και ')||'λείπει συνθήκη';
  };
  const actionLabel=(rule:TransactionRule)=>{
    const parts=[rule.action.category?`κατηγορία ${rule.action.category}`:'',rule.action.subcategory?`υποκατηγορία ${rule.action.subcategory}`:'',rule.action.note?`σχόλιο «${rule.action.note}» αν είναι κενό`:''].filter(Boolean);
    return parts.join(' · ')||'λείπει ενέργεια';
  };
  const changeCategory=(category:string)=>{
    setRuleCategory(category);
    const next=expenseTree.find(item=>item.name===category)?.subcategories??[];
    if(ruleSubcategory&&!next.includes(ruleSubcategory))setRuleSubcategory('');
  };

  return <section className="panel neo-raised transaction-rules-workspace rule-settings-panel" data-advanced-automations data-rules-workspace>
    <header className="rules-workspace-head">
      <div>
        <span className="rules-workspace-kicker">ΑΥΤΟΜΑΤΗ ΤΑΞΙΝΟΜΗΣΗ</span>
        <h2>Κανόνες νέων κινήσεων</h2>
        <p>Όρισε απλούς κανόνες «όταν → τότε». Εφαρμόζονται μόνο σε νέες κινήσεις και δεν αλλάζουν το ιστορικό.</p>
      </div>
      <button type="button" className="save-button rules-new-button" onClick={startCreate}><Plus size={17}/> Νέος κανόνας</button>
    </header>

    {rules.length?<div className="rules-status-strip" aria-label="Κατάσταση κανόνων">
      <div><b>{rules.length}</b><span>Σύνολο</span></div>
      <div><b>{activeCount}</b><span>Ενεργοί</span></div>
      <div><b>{pausedCount}</b><span>Σε παύση</span></div>
      <div className={invalidCount?'attention':''}><b>{invalidCount}</b><span>Χρειάζονται έλεγχο</span></div>
      <p><ListFilter size={16}/><span>Η σειρά έχει σημασία: χρησιμοποιείται ο πρώτος ενεργός κανόνας που ταιριάζει.</span></p>
    </div>:null}

    <section className="rules-list-section" aria-labelledby="rules-order-title">
      {rules.length?<header><div><b id="rules-order-title">Σειρά κανόνων</b><small>Μετακίνησέ τους πάνω ή κάτω για να αλλάξεις ποιος ελέγχεται πρώτος.</small></div></header>:null}
      {rules.length?<div className="rule-settings-list" aria-label="Σειρά αυτοματισμών">{rules.map((rule,index)=>{const invalid=invalidReason(rule);const state=invalid?'invalid':rule.enabled?'active':'paused';return <article key={rule.id} className={state==='paused'?'disabled':state} data-rule-invalid={invalid?'true':'false'}>
        <div className="rules-order-controls" aria-label={`Θέση ${index+1}`}><span>{index+1}</span><div><button type="button" className="icon-button" aria-label={`Μετακίνηση αυτοματισμού ${rule.name} προς τα πάνω`} disabled={index===0} onClick={()=>moveRule(index,-1)}><ChevronUp size={15}/></button><button type="button" className="icon-button" aria-label={`Μετακίνηση αυτοματισμού ${rule.name} προς τα κάτω`} disabled={index===rules.length-1} onClick={()=>moveRule(index,1)}><ChevronDown size={15}/></button></div></div>
        <div className="rules-row-copy"><div className="rules-row-title"><b>{rule.name}</b><span className={`rules-state ${state}`}>{invalid?<><AlertTriangle size={13}/> Χρειάζεται έλεγχο</>:rule.enabled?<><Check size={13}/> Ενεργός</>:<><CirclePause size={13}/> Σε παύση</>}</span></div><small><strong>Όταν</strong> {conditionLabel(rule)}</small><small><strong>Τότε</strong> {actionLabel(rule)} · {rule.scopes.length===3?'κάθε νέα υποστηριζόμενη κίνηση':rule.scopes.map(scopeLabel).join(', ')}</small>{invalid?<small className="rules-row-warning" role="alert">{invalid}</small>:null}</div>
        <div className="rule-row-actions"><button type="button" className="secondary" onClick={()=>onUpsertRule({...rule,enabled:!rule.enabled,updatedAt:now()})}>{rule.enabled?'Παύση':'Ενεργοποίηση'}</button><button type="button" className="icon-button" aria-label={`Επεξεργασία αυτοματισμού ${rule.name}`} title="Επεξεργασία" onClick={()=>editRule(rule)}><Pencil size={17}/></button><button type="button" className="icon-button" aria-label={`Διαγραφή αυτοματισμού ${rule.name}`} title="Διαγραφή" onClick={()=>onDeleteRule(rule.id)}><Trash2 size={17}/></button></div>
      </article>})}</div>:<div className="rules-empty-state"><ListFilter size={22}/><div><b>Δεν υπάρχουν ακόμη κανόνες</b><small>Οι νέες κινήσεις παραμένουν χειροκίνητες μέχρι να προσθέσεις έναν κανόνα.</small></div><button type="button" className="secondary" onClick={startCreate}><Plus size={16}/> Δημιουργία κανόνα</button></div>}
    </section>

    {editorOpen?<div className="editor-backdrop rules-editor-backdrop" onMouseDown={()=>clearEditor(false)}>
      <section ref={editorRef} className="panel neo-raised editor-dialog rules-editor" data-rule-editor role="dialog" aria-modal="true" aria-labelledby="rule-editor-title" tabIndex={-1} onMouseDown={event=>event.stopPropagation()}>
        <header className="panel-head rules-editor-head">
          <div><span id="rule-editor-title">{editingRuleId?'Επεξεργασία κανόνα':'Νέος κανόνας'}</span><small>{editingRuleId?'Οι αλλαγές θα ισχύουν μόνο στις επόμενες υποστηριζόμενες κινήσεις.':'Συμπλήρωσε τουλάχιστον μία συνθήκη και μία ενέργεια.'}</small></div>
          <button type="button" className="icon-button" aria-label="Κλείσιμο επεξεργασίας κανόνα" title="Κλείσιμο" onClick={()=>clearEditor(false)}><X size={17}/></button>
        </header>

        <label className="rules-name-field"><span>Όνομα αυτοματισμού</span><input value={ruleName} placeholder="π.χ. Supermarket → Τρόφιμα" onChange={event=>setRuleName(event.target.value)}/></label>

        <div className="rules-builder-columns rule-editor-grid">
          <fieldset className="rules-builder-section">
            <legend><span>1</span> Όταν</legend>
            <div className="rules-builder-fields">
              <label><span>Όταν η περιγραφή</span><AppSelectInput aria-label="Τρόπος αντιστοίχισης περιγραφής" value={ruleMode} onChange={event=>setRuleMode(event.target.value as 'contains'|'equals')}><option value="contains">περιέχει</option><option value="equals">είναι ακριβώς</option></AppSelectInput></label>
              <label><span>Κείμενο περιγραφής</span><input value={ruleDescription} placeholder="π.χ. supermarket" onChange={event=>setRuleDescription(event.target.value)}/></label>
              <label><span>Επιπλέον λέξη <em>προαιρετικό</em></span><input value={ruleMerchant} placeholder="π.χ. market" onChange={event=>setRuleMerchant(event.target.value)}/></label>
              <label><span>Λογαριασμός <em>προαιρετικό</em></span><AppSelectInput aria-label="Λογαριασμός κανόνα" value={ruleAccount} onChange={event=>setRuleAccount(event.target.value)}>{ruleAccount&&!accountIds.has(ruleAccount)?<option value={ruleAccount} disabled>Μη διαθέσιμος · {ruleAccount}</option>:null}<option value="">Οποιοσδήποτε λογαριασμός</option>{accounts.map(account=><option key={account.id} value={account.id}>{accountDisplayName(data,account.id)}</option>)}</AppSelectInput></label>
            </div>
          </fieldset>

          <fieldset className="rules-builder-section">
            <legend><span>2</span> Τότε</legend>
            <div className="rules-builder-fields">
              <label><span>Κατηγορία</span><AppSelectInput aria-label="Κατηγορία κανόνα" value={ruleCategory} onChange={event=>changeCategory(event.target.value)}>{ruleCategory&&!categoryNames.has(ruleCategory)?<option value={ruleCategory} disabled>Μη διαθέσιμη · {ruleCategory}</option>:null}<option value="">Χωρίς αλλαγή κατηγορίας</option>{data.state.settings.expenseCategories.map(category=><option key={category} value={category}>{category}</option>)}</AppSelectInput></label>
              <label><span>Υποκατηγορία <em>προαιρετικό</em></span><AppSelectInput aria-label="Υποκατηγορία κανόνα" value={ruleSubcategory} onChange={event=>setRuleSubcategory(event.target.value)}>{ruleSubcategory&&!availableSubcategories.includes(ruleSubcategory)?<option value={ruleSubcategory} disabled>Μη διαθέσιμη · {ruleSubcategory}</option>:null}<option value="">Χωρίς αλλαγή υποκατηγορίας</option>{availableSubcategories.map(subcategory=><option key={subcategory} value={subcategory}>{subcategory}</option>)}</AppSelectInput></label>
              <label className="rules-builder-note"><span>Σχόλιο αν είναι κενό <em>προαιρετικό</em></span><input value={ruleDefaultNote} placeholder="Δεν αντικαθιστά υπάρχον σχόλιο" onChange={event=>setRuleDefaultNote(event.target.value)}/></label>
              <label><span>Πότε να λειτουργεί</span><AppSelectInput aria-label="Πεδίο εφαρμογής κανόνα" value={ruleScope} onChange={event=>setRuleScope(event.target.value as 'all'|TransactionRuleScope)}><option value="manual">Όταν την καταχωρίζω εγώ</option><option value="imported">Όταν έρχεται από εισαγωγή</option><option value="review">Όταν επιβεβαιώνεται από έλεγχο</option><option value="all">Σε κάθε νέα υποστηριζόμενη κίνηση</option></AppSelectInput></label>
            </div>
          </fieldset>
        </div>

        <div className="rule-preview" role="status" aria-live="polite">
          <div className="rules-preview-summary"><ListFilter size={17}/><span><b>Προεπισκόπηση μόνο</b> · {previewMatches.length} υπάρχουσες κινήσεις θα ταίριαζαν. Δεν αλλάζει καμία από αυτές.</span></div>
          {previewMatches.length?<ul>{previewMatches.slice(0,3).map(event=><li key={event.id}><span>{event.note}</span><b>{money.format(event.amount)}</b></li>)}</ul>:<small>Δεν βρέθηκαν παραδείγματα στο υπάρχον ιστορικό.</small>}
        </div>
        {ruleError?<FormError id="rule-editor-error">{ruleError}</FormError>:null}
        <div className="editor-actions rules-editor-actions"><button type="button" className="secondary" onClick={()=>clearEditor(false)}>Ακύρωση</button><button type="button" className="save-button" onClick={saveRule}>{editingRuleId?'Αποθήκευση αλλαγών':'Δημιουργία κανόνα'}</button></div>
      </section>
    </div>:null}
  </section>;
}
