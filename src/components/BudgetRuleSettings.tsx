import { useMemo, useState } from 'react';
import { Gauge, ListFilter, Pencil, Plus, Trash2 } from 'lucide-react';
import { AppSelectInput } from './AppSelectInput';
import { budgetProgress, budgetStableId, normalizeBudget } from '../lib/budgets';
import { allAccounts } from '../lib/domain';
import { normalizeTransactionRule, transactionRuleMatchCount } from '../lib/transactionRules';
import { accountDisplayName } from '../lib/ui';
import { money } from '../lib/format';
import type { FinanceData, MonthlyBudget, TransactionRule, TransactionRuleScope } from '../types';

const now=()=>new Date().toISOString();
const ruleId=()=>`rule-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

export function BudgetRuleSettings({data,asOf,onUpsertBudget,onDeleteBudget,onUpsertRule,onDeleteRule}:{data:FinanceData;asOf:string;onUpsertBudget:(budget:MonthlyBudget)=>void;onDeleteBudget:(id:string)=>void;onUpsertRule:(rule:TransactionRule)=>void;onDeleteRule:(id:string)=>void}){
  const expenseFallback=data.state.settings.expenseCategories[0]||'Άλλο';
  const [month,setMonth]=useState(asOf.slice(0,7));
  const [budgetScope,setBudgetScope]=useState<'category'|'overall'>('category');
  const [budgetCategory,setBudgetCategory]=useState(expenseFallback);
  const [budgetAmount,setBudgetAmount]=useState('');
  const [budgetAlert,setBudgetAlert]=useState('80');
  const [budgetError,setBudgetError]=useState('');
  const budgets=budgetProgress(data,month);

  const [editingRuleId,setEditingRuleId]=useState<string|null>(null);
  const [ruleName,setRuleName]=useState('');
  const [rulePriority,setRulePriority]=useState('100');
  const [ruleDescription,setRuleDescription]=useState('');
  const [ruleMerchant,setRuleMerchant]=useState('');
  const [ruleAccount,setRuleAccount]=useState('');
  const [ruleMode,setRuleMode]=useState<'contains'|'equals'>('contains');
  const [ruleCategory,setRuleCategory]=useState(expenseFallback);
  const [ruleScope,setRuleScope]=useState<'all'|TransactionRuleScope>('manual');
  const [ruleError,setRuleError]=useState('');
  const accounts=allAccounts(data).filter(account=>account.kind!=='credit');
  const rules=(data.state.transactionRules??[]).slice().sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));

  const draftRule=useMemo<TransactionRule>(()=>({
    id:editingRuleId||'preview',name:ruleName||'Προεπισκόπηση',enabled:true,priority:Number(rulePriority)||0,
    scopes:ruleScope==='all'?['manual','imported','review']:[ruleScope],
    match:{description:ruleDescription,merchant:ruleMerchant,accountId:ruleAccount||undefined,mode:ruleMode},
    action:{category:ruleCategory},createdAt:now(),updatedAt:now(),
  }),[editingRuleId,ruleName,rulePriority,ruleScope,ruleDescription,ruleMerchant,ruleAccount,ruleMode,ruleCategory]);
  const previewCount=useMemo(()=>transactionRuleMatchCount(data,draftRule),[data,draftRule]);

  const saveBudget=()=>{
    try{
      const id=budgetStableId(month,budgetScope,budgetScope==='category'?budgetCategory:undefined);
      const existing=(data.state.budgets??[]).find(item=>item.id===id);const timestamp=now();
      const next=normalizeBudget({id,month,scope:budgetScope,category:budgetScope==='category'?budgetCategory:undefined,amount:Number(budgetAmount.replace(',','.')),alertThreshold:Number(budgetAlert.replace(',','.'))/100,createdAt:existing?.createdAt??timestamp,updatedAt:timestamp});
      onUpsertBudget(next);setBudgetAmount('');setBudgetError('');
    }catch(error){setBudgetError(error instanceof Error?error.message:'Δεν μπορέσαμε να αποθηκεύσουμε το budget. Έλεγξε τα στοιχεία και δοκίμασε ξανά.')}
  };

  const resetRule=()=>{setEditingRuleId(null);setRuleName('');setRulePriority('100');setRuleDescription('');setRuleMerchant('');setRuleAccount('');setRuleMode('contains');setRuleCategory(expenseFallback);setRuleScope('manual');setRuleError('')};
  const editRule=(rule:TransactionRule)=>{setEditingRuleId(rule.id);setRuleName(rule.name);setRulePriority(String(rule.priority));setRuleDescription(rule.match.description??'');setRuleMerchant(rule.match.merchant??'');setRuleAccount(rule.match.accountId??'');setRuleMode(rule.match.mode??'contains');setRuleCategory(rule.action.category??expenseFallback);setRuleScope(rule.scopes.length===3?'all':rule.scopes[0]??'manual');setRuleError('')};
  const saveRule=()=>{
    try{
      const existing=(data.state.transactionRules??[]).find(item=>item.id===editingRuleId);const timestamp=now();
      const next=normalizeTransactionRule({...draftRule,id:existing?.id??ruleId(),enabled:existing?.enabled??true,createdAt:existing?.createdAt??timestamp,updatedAt:timestamp});
      onUpsertRule(next);resetRule();
    }catch(error){setRuleError(error instanceof Error?error.message:'Δεν μπορέσαμε να αποθηκεύσουμε τον κανόνα. Έλεγξε τα στοιχεία και δοκίμασε ξανά.')}
  };

  return <div className="budget-rule-settings">
    <section className="panel neo-raised budget-settings-panel"><div className="panel-head"><div><span>Budgets ανά κατηγορία</span><small>Τα refunds μειώνουν τη χρήση, τα split portions μετρώνται μία φορά και οι εσωτερικές μεταφορές εξαιρούνται.</small></div><Gauge/></div>
      <div className="settings-form budget-editor-grid"><label><span>Μήνας</span><input type="month" value={month} onChange={event=>setMonth(event.target.value)}/></label><label><span>Τύπος ορίου</span><AppSelectInput value={budgetScope} onChange={event=>setBudgetScope(event.target.value as 'category'|'overall')}><option value="category">Κατηγορία</option><option value="overall">Συνολικό discretionary</option></AppSelectInput></label>{budgetScope==='category'?<label><span>Κατηγορία</span><AppSelectInput value={budgetCategory} onChange={event=>setBudgetCategory(event.target.value)}>{data.state.settings.expenseCategories.map(category=><option key={category} value={category}>{category}</option>)}</AppSelectInput></label>:null}<label><span>Όριο €</span><input inputMode="decimal" value={budgetAmount} onChange={event=>setBudgetAmount(event.target.value.replace(',','.'))}/></label><label><span>Προειδοποίηση %</span><input inputMode="decimal" value={budgetAlert} onChange={event=>setBudgetAlert(event.target.value.replace(',','.'))}/></label></div>
      {budgetError?<div className="form-error" role="alert">{budgetError}</div>:null}<button type="button" className="save-button" onClick={saveBudget}><Plus size={16}/> Αποθήκευση budget</button>
      {budgets.length?<div className="budget-settings-list">{budgets.map(row=><article key={row.id} className={`budget-setting-row ${row.status}`}><div><b>{row.scope==='overall'?'Συνολικό discretionary':row.category}</b><small>{money.format(row.used)} από {money.format(row.limit)} · {Math.round(row.ratio*100)}%</small></div><div className="budget-meter" role="progressbar" aria-label={`Χρήση budget ${row.scope==='overall'?'συνολικά':row.category}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.round(row.ratio*100))} aria-valuetext={`${Math.round(row.ratio*100)}%`}><i style={{width:`${Math.min(100,row.ratio*100)}%`}}/></div><button type="button" className="icon-button" aria-label={`Διαγραφή budget ${row.scope==='overall'?'συνολικά':row.category}`} onClick={()=>onDeleteBudget(row.id)}><Trash2/></button></article>)}</div>:<div className="empty-inline">Δεν υπάρχουν budgets για τον επιλεγμένο μήνα.</div>}
    </section>

    <section className="panel neo-raised rule-settings-panel"><div className="panel-head"><div><span>Κανόνες συναλλαγών</span><small>First match wins: μικρότερη προτεραιότητα πρώτα, μετά σταθερό id. Οι κανόνες εφαρμόζονται μόνο σε νέες κινήσεις και δεν ξαναγράφουν ιστορικό.</small></div><ListFilter/></div>
      <div className="settings-form rule-editor-grid"><label><span>Όνομα</span><input value={ruleName} onChange={event=>setRuleName(event.target.value)}/></label><label><span>Προτεραιότητα</span><input inputMode="numeric" value={rulePriority} onChange={event=>setRulePriority(event.target.value)}/></label><label><span>Περιγραφή</span><input value={ruleDescription} placeholder="π.χ. supermarket" onChange={event=>setRuleDescription(event.target.value)}/></label><label><span>Merchant / λέξη</span><input value={ruleMerchant} placeholder="προαιρετικό" onChange={event=>setRuleMerchant(event.target.value)}/></label><label><span>Τρόπος κειμένου</span><AppSelectInput value={ruleMode} onChange={event=>setRuleMode(event.target.value as 'contains'|'equals')}><option value="contains">Περιέχει</option><option value="equals">Ακριβώς</option></AppSelectInput></label><label><span>Λογαριασμός match</span><AppSelectInput value={ruleAccount} onChange={event=>setRuleAccount(event.target.value)}><option value="">Οποιοσδήποτε</option>{accounts.map(account=><option key={account.id} value={account.id}>{accountDisplayName(data,account.id)}</option>)}</AppSelectInput></label><label><span>Κατηγορία ενέργειας</span><AppSelectInput value={ruleCategory} onChange={event=>setRuleCategory(event.target.value)}>{data.state.settings.expenseCategories.map(category=><option key={category} value={category}>{category}</option>)}</AppSelectInput></label><label><span>Πεδίο εφαρμογής</span><AppSelectInput value={ruleScope} onChange={event=>setRuleScope(event.target.value as 'all'|TransactionRuleScope)}><option value="manual">Νέες χειροκίνητες</option><option value="imported">Νέες imported</option><option value="review">Review-confirmed</option><option value="all">Όλα τα νέα scopes</option></AppSelectInput></label></div>
      <div className="logic-note compact" role="status"><ListFilter/><span>Προεπισκόπηση μόνο: {previewCount} υπάρχουσες καταγεγραμμένες κινήσεις ταιριάζουν στις συνθήκες. Δεν αλλάζει καμία από αυτές.</span></div>{ruleError?<div className="form-error" role="alert">{ruleError}</div>:null}<div className="editor-actions">{editingRuleId?<button type="button" className="secondary" onClick={resetRule}>Ακύρωση επεξεργασίας</button>:null}<button type="button" className="save-button" onClick={saveRule}>{editingRuleId?'Ενημέρωση κανόνα':'Προσθήκη κανόνα'}</button></div>
      {rules.length?<div className="rule-settings-list">{rules.map(rule=><article key={rule.id} className={rule.enabled?'':'disabled'}><div><b>{rule.name}</b><small>#{rule.priority} · {rule.match.description||rule.match.merchant||rule.match.accountId} → {rule.action.category||rule.action.subcategory||'metadata'} · {rule.scopes.join(', ')}</small></div><div className="rule-row-actions"><button type="button" className="secondary" onClick={()=>onUpsertRule({...rule,enabled:!rule.enabled,updatedAt:now()})}>{rule.enabled?'Απενεργοποίηση':'Ενεργοποίηση'}</button><button type="button" className="icon-button" aria-label={`Επεξεργασία κανόνα ${rule.name}`} onClick={()=>editRule(rule)}><Pencil/></button><button type="button" className="icon-button" aria-label={`Διαγραφή κανόνα ${rule.name}`} onClick={()=>onDeleteRule(rule.id)}><Trash2/></button></div></article>)}</div>:<div className="empty-inline">Δεν υπάρχουν κανόνες συναλλαγών. Οι νέες κινήσεις παραμένουν χειροκίνητες.</div>}
    </section>
  </div>;
}