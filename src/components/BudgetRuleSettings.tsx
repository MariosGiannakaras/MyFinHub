import { useState } from 'react';
import { Gauge, Plus, Trash2 } from 'lucide-react';
import { AppSelectInput } from './AppSelectInput';
import { AppTextInput } from './AppTextInput';
import { Button } from './Button';
import { CategorySelectInput } from './CategorySelectInput';
import { FormError } from './FormError';
import { IconButton } from './IconButton';
import { MoneyInput } from './MoneyInput';
import { budgetProgress, budgetStableId, normalizeBudget } from '../lib/budgets';
import { categoryTree } from '../lib/categories';
import { money } from '../lib/format';
import { userErrorMessage } from '../lib/userMessage';
import type { FinanceData, MonthlyBudget } from '../types';

// Only Reports budgets; transaction automation CRUD is owned by Settings Rules.
const now=()=>new Date().toISOString();
export function BudgetRuleSettings({data,asOf,budgetMonth,onUpsertBudget,onDeleteBudget}:{
  data:FinanceData;asOf:string;budgetMonth?:string;
  onUpsertBudget:(budget:MonthlyBudget)=>void;onDeleteBudget:(id:string)=>void;
}){
  const expenseTree=categoryTree(data.state.settings,'expense');
  const expenseFallback=expenseTree[0]?.name||data.state.settings.expenseCategories[0]||'Άλλο';
  const [internalMonth,setInternalMonth]=useState(asOf.slice(0,7));
  const month=budgetMonth??internalMonth;
  const [budgetScope,setBudgetScope]=useState<'category'|'overall'>('category');
  const [budgetCategory,setBudgetCategory]=useState(expenseFallback);
  const [budgetAmount,setBudgetAmount]=useState('');
  const [budgetAlert,setBudgetAlert]=useState('80');
  const [budgetError,setBudgetError]=useState('');
  const [budgetListLimit,setBudgetListLimit]=useState(24);
  const budgets=budgetProgress(data,month,asOf);
  const visibleBudgets=budgets.slice(0,budgetListLimit);
  const saveBudget=()=>{
    try{
      const id=budgetStableId(month,budgetScope,budgetScope==='category'?budgetCategory:undefined);
      const existing=(data.state.budgets??[]).find(item=>item.id===id);const timestamp=now();
      const next=normalizeBudget({id,month,scope:budgetScope,category:budgetScope==='category'?budgetCategory:undefined,amount:Number(budgetAmount.replace(',','.')),alertThreshold:Number(budgetAlert.replace(',','.'))/100,createdAt:existing?.createdAt??timestamp,updatedAt:timestamp});
      onUpsertBudget(next);setBudgetAmount('');setBudgetError('');
    }catch(error){setBudgetError(userErrorMessage(error,'Δεν μπορέσαμε να αποθηκεύσουμε τον προϋπολογισμό. Έλεγξε τα στοιχεία και δοκίμασε ξανά.'))}
  };
  return <div className="budget-rule-settings">
    <section className="panel surface-raised budget-settings-panel" data-budget-management><div className="panel-head"><div><span>Προϋπολογισμοί περιόδου</span><small>Όρισε συνολικό ή ανά κατηγορία όριο. Οι επιστροφές μειώνουν τη χρήση, τα split portions μετρώνται μία φορά και οι εσωτερικές μεταφορές εξαιρούνται.</small></div><Gauge/></div>
      <div className="settings-form budget-editor-grid">{budgetMonth?null:<label><span>Μήνας</span><AppTextInput type="month" value={month} onChange={event=>setInternalMonth(event.target.value)}/></label>}<label><span>Τύπος ορίου</span><AppSelectInput value={budgetScope} onChange={event=>setBudgetScope(event.target.value as 'category'|'overall')}><option value="category">Κατηγορία</option><option value="overall">Συνολικό όριο</option></AppSelectInput></label>{budgetScope==='category'?<label><span>Κατηγορία</span><CategorySelectInput settings={data.state.settings} kind="expense" category={budgetCategory} includeSubcategories={false} onChange={selection=>setBudgetCategory(selection.category)}/></label>:null}<label><span>Όριο €</span><MoneyInput value={budgetAmount} onValueChange={setBudgetAmount} placeholder="0,00" invalid={Boolean(budgetError)}/></label><label><span>Προειδοποίηση %</span><AppTextInput inputMode="decimal" value={budgetAlert} onChange={event=>setBudgetAlert(event.target.value.replace(',','.'))}/></label></div>
      {budgetError?<FormError id="budget-editor-error">{budgetError}</FormError>:null}<Button type="button" variant="primary" onClick={saveBudget}><Plus size={16}/> Αποθήκευση προϋπολογισμού</Button>
      {budgets.length?<><div className="budget-settings-list">{visibleBudgets.map(row=><article key={row.id} className={`budget-setting-row ${row.status}`}><div><b>{row.scope==='overall'?'Συνολικό όριο':row.category}</b><small>{money.format(row.used)} από {money.format(row.limit)} · {Math.round(row.ratio*100)}%</small></div><div className="budget-meter" role="progressbar" aria-label={`Χρήση προϋπολογισμού ${row.scope==='overall'?'συνολικά':row.category}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.round(row.ratio*100))} aria-valuetext={`${Math.round(row.ratio*100)}%`}><i style={{width:`${Math.min(100,row.ratio*100)}%`}}/></div><IconButton aria-label={`Διαγραφή προϋπολογισμού ${row.scope==='overall'?'συνολικά':row.category}`} onClick={()=>onDeleteBudget(row.id)}><Trash2/></IconButton></article>)}</div>{budgets.length>visibleBudgets.length?<Button type="button" variant="secondary" className="budget-settings-more" onClick={()=>setBudgetListLimit(limit=>limit+24)}>Προβολή περισσότερων · {budgets.length-visibleBudgets.length} ακόμη</Button>:null}</>:<div className="empty-inline">Δεν υπάρχουν προϋπολογισμοί για την επιλεγμένη περίοδο.</div>}
    </section>
  </div>;
}
