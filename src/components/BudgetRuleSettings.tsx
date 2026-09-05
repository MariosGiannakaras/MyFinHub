import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Gauge, ListFilter, Pencil, Plus, Trash2 } from 'lucide-react';
import { AppSelectInput } from './AppSelectInput';
import { FormError } from './FormError';
import { MoneyInput } from './MoneyInput';
import { budgetProgress, budgetStableId, normalizeBudget } from '../lib/budgets';
import { allAccounts } from '../lib/domain';
import { normalizeTransactionRule, transactionRuleMatchingEvents } from '../lib/transactionRules';
import { accountDisplayName } from '../lib/ui';
import { money } from '../lib/format';
import type { FinanceData, MonthlyBudget, TransactionRule, TransactionRuleScope } from '../types';

const now=()=>new Date().toISOString();
const ruleId=()=>`rule-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const scopeLabel=(scope:TransactionRuleScope)=>scope==='manual'?'χειροκίνητη καταχώριση':scope==='imported'?'εισαγωγή':'επιβεβαίωση από έλεγχο';
type BudgetRuleSettingsView='all'|'budgets'|'rules';

export function BudgetRuleSettings({data,asOf,budgetMonth,onUpsertBudget,onDeleteBudget,onUpsertRule,onDeleteRule,view='all'}:{data:FinanceData;asOf:string;budgetMonth?:string;onUpsertBudget:(budget:MonthlyBudget)=>void;onDeleteBudget:(id:string)=>void;onUpsertRule:(rule:TransactionRule)=>void;onDeleteRule:(id:string)=>void;view?:BudgetRuleSettingsView}){
  const expenseFallback=data.state.settings.expenseCategories[0]||'Άλλο';
  const [internalMonth,setInternalMonth]=useState(asOf.slice(0,7));
  const month=budgetMonth??internalMonth;
  const [budgetScope,setBudgetScope]=useState<'category'|'overall'>('category');
  const [budgetCategory,setBudgetCategory]=useState(expenseFallback);
  const [budgetAmount,setBudgetAmount]=useState('');
  const [budgetAlert,setBudgetAlert]=useState('80');
  const [budgetError,setBudgetError]=useState('');
  const budgets=budgetProgress(data,month);

  const [editingRuleId,setEditingRuleId]=useState<string|null>(null);
  const [ruleName,setRuleName]=useState('');
  const [ruleDescription,setRuleDescription]=useState('');
  const [ruleMerchant,setRuleMerchant]=useState('');
  const [ruleAccount,setRuleAccount]=useState('');
  const [ruleMode,setRuleMode]=useState<'contains'|'equals'>('contains');
  const [ruleCategory,setRuleCategory]=useState(expenseFallback);
  const [ruleSubcategory,setRuleSubcategory]=useState('');
  const [ruleDefaultNote,setRuleDefaultNote]=useState('');
  const [ruleScope,setRuleScope]=useState<'all'|TransactionRuleScope>('manual');
  const [ruleError,setRuleError]=useState('');
  const accounts=allAccounts(data).filter(account=>account.kind!=='credit');
  const accountIds=new Set(accounts.map(account=>account.id));
  const categoryNames=new Set(data.state.settings.expenseCategories);
  const rules=(data.state.transactionRules??[]).slice().sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
  const editingRule=rules.find(rule=>rule.id===editingRuleId);
  const nextPriority=rules.reduce((max,rule)=>Math.max(max,rule.priority),0)+100;

  const draftRule=useMemo<TransactionRule>(()=>({
    id:editingRuleId||'preview',name:ruleName||'Προεπισκόπηση',enabled:true,priority:editingRule?.priority??nextPriority,
    scopes:ruleScope==='all'?['manual','imported','review']:[ruleScope],
    match:{description:ruleDescription,merchant:ruleMerchant,accountId:ruleAccount||undefined,mode:ruleMode},
    action:{category:ruleCategory||undefined,subcategory:ruleSubcategory||undefined,note:ruleDefaultNote||undefined},createdAt:editingRule?.createdAt??now(),updatedAt:now(),
  }),[editingRuleId,editingRule?.priority,editingRule?.createdAt,nextPriority,ruleName,ruleScope,ruleDescription,ruleMerchant,ruleAccount,ruleMode,ruleCategory,ruleSubcategory,ruleDefaultNote]);
  const previewMatches=useMemo(()=>transactionRuleMatchingEvents(data,draftRule),[data,draftRule]);

  const saveBudget=()=>{
    try{
      const id=budgetStableId(month,budgetScope,budgetScope==='category'?budgetCategory:undefined);
      const existing=(data.state.budgets??[]).find(item=>item.id===id);const timestamp=now();
      const next=normalizeBudget({id,month,scope:budgetScope,category:budgetScope==='category'?budgetCategory:undefined,amount:Number(budgetAmount.replace(',','.')),alertThreshold:Number(budgetAlert.replace(',','.'))/100,createdAt:existing?.createdAt??timestamp,updatedAt:timestamp});
      onUpsertBudget(next);setBudgetAmount('');setBudgetError('');
    }catch(error){setBudgetError(error instanceof Error?error.message:'Δεν μπορέσαμε να αποθηκεύσουμε τον προϋπολογισμό. Έλεγξε τα στοιχεία και δοκίμασε ξανά.')}
  };

  const resetRule=()=>{setEditingRuleId(null);setRuleName('');setRuleDescription('');setRuleMerchant('');setRuleAccount('');setRuleMode('contains');setRuleCategory(expenseFallback);setRuleSubcategory('');setRuleDefaultNote('');setRuleScope('manual');setRuleError('')};
  const editRule=(rule:TransactionRule)=>{setEditingRuleId(rule.id);setRuleName(rule.name);setRuleDescription(rule.match.description??'');setRuleMerchant(rule.match.merchant??'');setRuleAccount(rule.match.accountId??'');setRuleMode(rule.match.mode??'contains');setRuleCategory(rule.action.category??expenseFallback);setRuleSubcategory(rule.action.subcategory??'');setRuleDefaultNote(rule.action.note??'');setRuleScope(rule.scopes.length===3?'all':rule.scopes[0]??'manual');setRuleError('')};
  const saveRule=()=>{
    try{
      const existing=(data.state.transactionRules??[]).find(item=>item.id===editingRuleId);const timestamp=now();
      const next=normalizeTransactionRule({...draftRule,id:existing?.id??ruleId(),enabled:existing?.enabled??true,createdAt:existing?.createdAt??timestamp,updatedAt:timestamp});
      onUpsertRule(next);resetRule();
    }catch(error){setRuleError(error instanceof Error?error.message:'Δεν μπορέσαμε να αποθηκεύσουμε τον αυτοματισμό. Έλεγξε τις συνθήκες και την ενέργεια και δοκίμασε ξανά.')}
  };
  const moveRule=(index:number,direction:-1|1)=>{
    const target=index+direction;if(target<0||target>=rules.length)return;
    if(direction===1){
      const afterTarget=rules[index+2];const floor=rules[target].priority;const priority=afterTarget?(floor+afterTarget.priority)/2:floor+100;
      onUpsertRule({...rules[index],priority,updatedAt:now()});return;
    }
    const afterCurrent=rules[index+1];const floor=rules[index].priority;const priority=afterCurrent?(floor+afterCurrent.priority)/2:floor+100;
    onUpsertRule({...rules[target],priority,updatedAt:now()});
  };
  const conditionLabel=(rule:TransactionRule)=>{
    const parts:string[]=[];
    if(rule.match.description)parts.push(`η περιγραφή ${rule.match.mode==='equals'?'είναι ακριβώς':'περιέχει'} «${rule.match.description}»`);
    if(rule.match.merchant)parts.push(`η περιγραφή περιέχει επίσης «${rule.match.merchant}»`);
    if(rule.match.accountId)parts.push(`ο λογαριασμός είναι ${accountDisplayName(data,rule.match.accountId)}`);
    return parts.join(' και ')||'λείπει συνθήκη';
  };
  const actionLabel=(rule:TransactionRule)=>{
    const parts=[rule.action.category?`κατηγορία ${rule.action.category}`:'',rule.action.subcategory?`υποκατηγορία ${rule.action.subcategory}`:'',rule.action.note?`σχόλιο «${rule.action.note}» αν είναι κενό`:''].filter(Boolean);
    return parts.join(' · ')||'λείπει ενέργεια';
  };
  const invalidReason=(rule:TransactionRule)=>{
    if(rule.match.accountId&&!accountIds.has(rule.match.accountId))return 'Ο λογαριασμός της συνθήκης δεν είναι πλέον διαθέσιμος.';
    if(rule.action.category&&!categoryNames.has(rule.action.category))return 'Η κατηγορία της ενέργειας δεν είναι πλέον διαθέσιμη.';
    return '';
  };

  return <div className="budget-rule-settings">
    {view!=='rules'?<section className="panel neo-raised budget-settings-panel" data-budget-management><div className="panel-head"><div><span>Προϋπολογισμοί περιόδου</span><small>Όρισε συνολικό ή ανά κατηγορία όριο. Οι επιστροφές μειώνουν τη χρήση, τα split portions μετρώνται μία φορά και οι εσωτερικές μεταφορές εξαιρούνται.</small></div><Gauge/></div>
      <div className="settings-form budget-editor-grid">{budgetMonth?null:<label><span>Μήνας</span><input type="month" value={month} onChange={event=>setInternalMonth(event.target.value)}/></label>}<label><span>Τύπος ορίου</span><AppSelectInput value={budgetScope} onChange={event=>setBudgetScope(event.target.value as 'category'|'overall')}><option value="category">Κατηγορία</option><option value="overall">Συνολικό όριο</option></AppSelectInput></label>{budgetScope==='category'?<label><span>Κατηγορία</span><AppSelectInput value={budgetCategory} onChange={event=>setBudgetCategory(event.target.value)}>{data.state.settings.expenseCategories.map(category=><option key={category} value={category}>{category}</option>)}</AppSelectInput></label>:null}<label><span>Όριο €</span><MoneyInput value={budgetAmount} onValueChange={setBudgetAmount} placeholder="0,00" invalid={Boolean(budgetError)}/></label><label><span>Προειδοποίηση %</span><input inputMode="decimal" value={budgetAlert} onChange={event=>setBudgetAlert(event.target.value.replace(',','.'))}/></label></div>
      {budgetError?<FormError id="budget-editor-error">{budgetError}</FormError>:null}<button type="button" className="save-button" onClick={saveBudget}><Plus size={16}/> Αποθήκευση προϋπολογισμού</button>
      {budgets.length?<div className="budget-settings-list">{budgets.map(row=><article key={row.id} className={`budget-setting-row ${row.status}`}><div><b>{row.scope==='overall'?'Συνολικό όριο':row.category}</b><small>{money.format(row.used)} από {money.format(row.limit)} · {Math.round(row.ratio*100)}%</small></div><div className="budget-meter" role="progressbar" aria-label={`Χρήση προϋπολογισμού ${row.scope==='overall'?'συνολικά':row.category}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.round(row.ratio*100))} aria-valuetext={`${Math.round(row.ratio*100)}%`}><i style={{width:`${Math.min(100,row.ratio*100)}%`}}/></div><button type="button" className="icon-button" aria-label={`Διαγραφή προϋπολογισμού ${row.scope==='overall'?'συνολικά':row.category}`} onClick={()=>onDeleteBudget(row.id)}><Trash2/></button></article>)}</div>:<div className="empty-inline">Δεν υπάρχουν προϋπολογισμοί για την επιλεγμένη περίοδο.</div>}
    </section>:null}

    {view!=='budgets'?<details open={view==='rules'?true:undefined} className="panel neo-raised technical-settings rule-settings-panel" data-advanced-automations>
      <summary className={view==='rules'?'sr-only':undefined}><ListFilter size={16}/> Προχωρημένα · Αυτοματισμοί</summary>
      <div className="panel-head"><div><span>Αυτόματη ταξινόμηση νέων κινήσεων</span><small>Οι ενεργοί αυτοματισμοί ελέγχονται με τη σειρά που φαίνονται. Ο πρώτος που ταιριάζει εφαρμόζεται μόνο στη νέα κίνηση· το ιστορικό δεν αλλάζει.</small></div><ListFilter/></div>
      <div className="settings-form rule-editor-grid" aria-label="Δημιουργία αυτοματισμού συναλλαγών">
        <label><span>Όνομα αυτοματισμού</span><input value={ruleName} placeholder="π.χ. Supermarket → Τρόφιμα" onChange={event=>setRuleName(event.target.value)}/></label>
        <label><span>Όταν η περιγραφή</span><AppSelectInput value={ruleMode} onChange={event=>setRuleMode(event.target.value as 'contains'|'equals')}><option value="contains">περιέχει</option><option value="equals">είναι ακριβώς</option></AppSelectInput></label>
        <label><span>Κείμενο περιγραφής</span><input value={ruleDescription} placeholder="π.χ. supermarket" onChange={event=>setRuleDescription(event.target.value)}/></label>
        <label><span>Και περιέχει επίσης <em>προαιρετικό</em></span><input value={ruleMerchant} placeholder="δεύτερη λέξη ή merchant" onChange={event=>setRuleMerchant(event.target.value)}/></label>
        <label><span>Και ο λογαριασμός είναι <em>προαιρετικό</em></span><AppSelectInput value={ruleAccount} onChange={event=>setRuleAccount(event.target.value)}>{ruleAccount&&!accountIds.has(ruleAccount)?<option value={ruleAccount} disabled>Μη διαθέσιμος · {ruleAccount}</option>:null}<option value="">Οποιοσδήποτε λογαριασμός</option>{accounts.map(account=><option key={account.id} value={account.id}>{accountDisplayName(data,account.id)}</option>)}</AppSelectInput></label>
        <label><span>Τότε βάλε κατηγορία</span><AppSelectInput value={ruleCategory} onChange={event=>setRuleCategory(event.target.value)}>{ruleCategory&&!categoryNames.has(ruleCategory)?<option value={ruleCategory} disabled>Μη διαθέσιμη · {ruleCategory}</option>:null}<option value="">Χωρίς αλλαγή κατηγορίας</option>{data.state.settings.expenseCategories.map(category=><option key={category} value={category}>{category}</option>)}</AppSelectInput></label>
        <label><span>Και υποκατηγορία <em>προαιρετικό</em></span><input value={ruleSubcategory} placeholder="μόνο για νέα κίνηση" onChange={event=>setRuleSubcategory(event.target.value)}/></label>
        <label><span>Και σχόλιο αν είναι κενό <em>προαιρετικό</em></span><input value={ruleDefaultNote} placeholder="δεν αντικαθιστά σχόλιο χρήστη" onChange={event=>setRuleDefaultNote(event.target.value)}/></label>
        <label><span>Πότε να λειτουργεί</span><AppSelectInput value={ruleScope} onChange={event=>setRuleScope(event.target.value as 'all'|TransactionRuleScope)}><option value="manual">Όταν την καταχωρίζω εγώ</option><option value="imported">Όταν έρχεται από εισαγωγή</option><option value="review">Όταν επιβεβαιώνεται από έλεγχο</option><option value="all">Σε κάθε νέα υποστηριζόμενη κίνηση</option></AppSelectInput></label>
      </div>
      <div className="rule-preview" role="status" aria-live="polite"><div className="logic-note compact"><ListFilter/><span>Μόνο προεπισκόπηση: {previewMatches.length} υπάρχουσες κινήσεις θα ταίριαζαν με αυτές τις συνθήκες. Δεν αλλάζει καμία από αυτές.</span></div>{previewMatches.length?<ul>{previewMatches.slice(0,3).map(event=><li key={event.id}><span>{event.note}</span><b>{money.format(event.amount)}</b></li>)}</ul>:null}</div>
      {ruleError?<FormError id="rule-editor-error">{ruleError}</FormError>:null}
      <div className="editor-actions">{editingRuleId?<button type="button" className="secondary" onClick={resetRule}>Ακύρωση επεξεργασίας</button>:null}<button type="button" className="save-button" onClick={saveRule}>{editingRuleId?'Ενημέρωση αυτοματισμού':'Προσθήκη αυτοματισμού'}</button></div>
      {rules.length?<div className="rule-settings-list" aria-label="Σειρά αυτοματισμών">{rules.map((rule,index)=>{const invalid=invalidReason(rule);return <article key={rule.id} className={rule.enabled?'':'disabled'} data-rule-invalid={invalid?'true':'false'}><div><b>{index+1}. {rule.name}</b><small><strong>Όταν</strong> {conditionLabel(rule)} · <strong>τότε</strong> {actionLabel(rule)} · {rule.scopes.length===3?'κάθε νέα υποστηριζόμενη κίνηση':rule.scopes.map(scopeLabel).join(', ')}</small>{invalid?<small role="alert">Χρειάζεται έλεγχο: {invalid}</small>:null}</div><div className="rule-row-actions"><button type="button" className="icon-button" aria-label={`Μετακίνηση αυτοματισμού ${rule.name} προς τα πάνω`} disabled={index===0} onClick={()=>moveRule(index,-1)}><ChevronUp/></button><button type="button" className="icon-button" aria-label={`Μετακίνηση αυτοματισμού ${rule.name} προς τα κάτω`} disabled={index===rules.length-1} onClick={()=>moveRule(index,1)}><ChevronDown/></button><button type="button" className="secondary" onClick={()=>onUpsertRule({...rule,enabled:!rule.enabled,updatedAt:now()})}>{rule.enabled?'Παύση':'Ενεργοποίηση'}</button><button type="button" className="icon-button" aria-label={`Επεξεργασία αυτοματισμού ${rule.name}`} onClick={()=>editRule(rule)}><Pencil/></button><button type="button" className="icon-button" aria-label={`Διαγραφή αυτοματισμού ${rule.name}`} onClick={()=>onDeleteRule(rule.id)}><Trash2/></button></div></article>})}</div>:<div className="empty-inline">Δεν υπάρχουν αυτοματισμοί. Οι νέες κινήσεις παραμένουν χειροκίνητες.</div>}
    </details>:null}
  </div>;
}