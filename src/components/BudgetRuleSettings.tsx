import { useRef, useState } from 'react';
import { Gauge, Pencil, Plus, Trash2 } from 'lucide-react';
import { AppSelectInput } from './AppSelectInput';
import { AppTextInput } from './AppTextInput';
import { Button } from './Button';
import { CategorySelectInput } from './CategorySelectInput';
import { FormError } from './FormError';
import { IconButton } from './IconButton';
import { MoneyInput } from './MoneyInput';
import { budgetProgress, budgetStableId, normalizeBudget } from '../lib/budgets';
import { categoryPath, categoryTree } from '../lib/categories';
import { resolveCategoryIdentity, resolveSubcategoryIdentity } from '../lib/categoryIdentity';
import { money } from '../lib/format';
import { userErrorMessage } from '../lib/userMessage';
import type { FinanceData, MonthlyBudget } from '../types';

// Only Reports budgets; transaction automation CRUD is owned by Settings Rules.
const now=()=>new Date().toISOString();
export function BudgetRuleSettings({data,asOf,budgetMonth,budgetRows,onUpsertBudget,onDeleteBudget}:{
  data:FinanceData;asOf:string;budgetMonth?:string;
  budgetRows?:ReturnType<typeof budgetProgress>;
  onUpsertBudget:(budget:MonthlyBudget)=>Promise<void>;onDeleteBudget:(id:string)=>Promise<void>;
}){
  const expenseTree=categoryTree(data.state.settings,'expense');
  const expenseFallback=expenseTree[0]?.name||data.state.settings.expenseCategories[0]||'Άλλο';
  const [internalMonth,setInternalMonth]=useState(asOf.slice(0,7));
  const month=budgetMonth??internalMonth;
  const [budgetScope,setBudgetScope]=useState<MonthlyBudget['scope']>('category');
  const [budgetCategory,setBudgetCategory]=useState(expenseFallback);
  const [budgetSubcategory,setBudgetSubcategory]=useState('');
  const [budgetCarryover,setBudgetCarryover]=useState(false);
  const [editingBudgetId,setEditingBudgetId]=useState<string|null>(null);
  const [budgetAmount,setBudgetAmount]=useState('');
  const [budgetAlert,setBudgetAlert]=useState('80');
  const [budgetError,setBudgetError]=useState('');
  const [busy,setBusy]=useState(false);
  const busyRef=useRef(false);
  const [budgetListLimit,setBudgetListLimit]=useState(24);
  // The Reports overview owns this canonical snapshot. Reuse it across this
  // editor's busy/error renders; preserve standalone behavior when not supplied.
  const budgets=budgetRows??budgetProgress(data,month,asOf);
  const visibleBudgets=budgets.slice(0,budgetListLimit);
  const editBudget=(id:string)=>{
    const current=(data.state.budgets??[]).find(item=>item.id===id);
    if(!current||busyRef.current)return;
    setEditingBudgetId(current.id);
    setInternalMonth(current.month);
    setBudgetScope(current.scope);
    setBudgetCategory(current.category??expenseFallback);
    setBudgetSubcategory(current.subcategory??'');
    setBudgetAmount(String(current.amount));
    setBudgetAlert(String(Math.round((current.alertThreshold??.8)*100)));
    setBudgetCarryover(current.carryover===true);
    setBudgetError('');
  };
  const saveBudget=async()=>{
    if(busyRef.current)return;
    try{
      const category=budgetScope==='overall'?undefined:budgetCategory;
      const subcategory=budgetScope==='subcategory'?budgetSubcategory:undefined;
      const knownIdentities=data.state.settings.categoryIdentities??{};
      const resolvedCategoryId=category?resolveCategoryIdentity(data.state.settings,'expense',category)?.id:undefined;
      const resolvedSubcategoryId=category&&subcategory?resolveSubcategoryIdentity(data.state.settings,'expense',category,subcategory)?.id:undefined;
      // Identity lookups may synthesize provisional IDs for legacy category
      // trees; persist IDs only when the same identity is in canonical state.
      const categoryIdentityId=resolvedCategoryId&&knownIdentities[resolvedCategoryId]?resolvedCategoryId:undefined;
      const subcategoryIdentityId=resolvedSubcategoryId&&knownIdentities[resolvedSubcategoryId]?resolvedSubcategoryId:undefined;
      const id=budgetStableId(month,budgetScope,category,subcategory,categoryIdentityId,subcategoryIdentityId);
      const existing=(data.state.budgets??[]).find(item=>item.id===id||
        (item.month===month&&item.scope===budgetScope&&
          (item.categoryIdentityId&&categoryIdentityId?item.categoryIdentityId===categoryIdentityId:item.category===category)&&
          (budgetScope!=='subcategory'||(item.subcategoryIdentityId&&subcategoryIdentityId
            ?item.subcategoryIdentityId===subcategoryIdentityId:item.subcategory===subcategory))));
      const timestamp=now();
      const next=normalizeBudget({id:existing?.id??id,month,scope:budgetScope,category,subcategory,
        categoryIdentityId,subcategoryIdentityId,carryover:budgetCarryover,
        amount:Number(budgetAmount.replace(',','.')),alertThreshold:Number(budgetAlert.replace(',','.'))/100,
        createdAt:existing?.createdAt??timestamp,updatedAt:timestamp});
      busyRef.current=true;setBusy(true);setBudgetError('');
      await onUpsertBudget(next);
      setBudgetAmount('');
      setEditingBudgetId(null);
    }catch(error){setBudgetError(userErrorMessage(error,'Δεν μπορέσαμε να αποθηκεύσουμε τον προϋπολογισμό. Έλεγξε τα στοιχεία και δοκίμασε ξανά.'))}
    finally{busyRef.current=false;setBusy(false)}
  };
  const deleteBudget=async(id:string)=>{
    if(busyRef.current)return;
    busyRef.current=true;setBusy(true);setBudgetError('');
    try{await onDeleteBudget(id);if(editingBudgetId===id)setEditingBudgetId(null)}
    catch(error){setBudgetError(userErrorMessage(error,'Δεν μπορέσαμε να διαγράψουμε τον προϋπολογισμό. Δοκίμασε ξανά.'))}
    finally{busyRef.current=false;setBusy(false)}
  };
  return <div className="budget-rule-settings">
    <section className="panel surface-raised budget-settings-panel" data-budget-management><div className="panel-head"><div><span>Προϋπολογισμοί περιόδου</span><small>Όρισε συνολικό όριο, ανά κατηγορία ή υποκατηγορία. Η μεταφορά ορίου και οι γνωστές εκκρεμείς υποχρεώσεις εμφανίζονται χωριστά από τις πραγματικές δαπάνες.</small></div><Gauge/></div>
      <div className="settings-form budget-editor-grid">
        {budgetMonth?null:<label><span>Μήνας</span><AppTextInput disabled={busy} type="month" value={month} onChange={event=>setInternalMonth(event.target.value)}/></label>}
        <label><span>Τύπος ορίου</span><AppSelectInput disabled={busy} value={budgetScope} onChange={event=>setBudgetScope(event.target.value as MonthlyBudget['scope'])}>
          <option value="category">Κατηγορία</option><option value="subcategory">Υποκατηγορία</option><option value="overall">Συνολικό όριο</option>
        </AppSelectInput></label>
        {budgetScope!=='overall'?<label><span>{budgetScope==='subcategory'?'Κατηγορία / υποκατηγορία':'Κατηγορία'}</span>
          <CategorySelectInput disabled={busy} settings={data.state.settings} kind="expense"
            category={budgetCategory} subcategory={budgetScope==='subcategory'?budgetSubcategory:''}
            includeSubcategories={budgetScope==='subcategory'}
            onChange={selection=>{setBudgetCategory(selection.category);setBudgetSubcategory(selection.subcategory)}}/>
        </label>:null}
        <label><span>Όριο €</span><MoneyInput disabled={busy} value={budgetAmount} onValueChange={setBudgetAmount} placeholder="0,00" invalid={Boolean(budgetError)}/></label>
        <label><span>Προειδοποίηση %</span><AppTextInput disabled={busy} inputMode="decimal" value={budgetAlert} onChange={event=>setBudgetAlert(event.target.value.replace(',','.'))}/></label>
        <label className="budget-carryover-toggle"><input type="checkbox" disabled={busy} checked={budgetCarryover} onChange={event=>setBudgetCarryover(event.target.checked)}/>
          <span>Προαιρετική μεταφορά αχρησιμοποίητου ορίου από τον προηγούμενο μήνα</span>
        </label>
      </div>
      {editingBudgetId?<p className="logic-note compact" role="status">Επεξεργασία υπάρχοντος προϋπολογισμού · οι αλλαγές αποθηκεύονται μία φορά με δυνατότητα αναίρεσης.</p>:null}
      {budgetError?<FormError id="budget-editor-error">{budgetError}</FormError>:null}<Button type="button" variant="primary" disabled={busy} onClick={()=>void saveBudget()}><Plus size={16}/> {editingBudgetId?'Αποθήκευση αλλαγών':'Αποθήκευση προϋπολογισμού'}</Button>
      {budgets.length?<><div className="budget-settings-list">{visibleBudgets.map(row=><article key={row.id} className={`budget-setting-row ${row.status}`}><div><b>{row.scope==='overall'?'Συνολικό όριο':row.scope==='subcategory'?categoryPath(row.category,row.subcategory):row.category}</b>
        <small>Πραγματική χρήση: {money.format(row.used)} από {money.format(row.limit)} · {Math.round(row.ratio*100)}%</small>
        {row.carryover?<small>Βασικό όριο {money.format(row.baseLimit)} + μεταφορά {money.format(row.carried)}</small>:null}
        {row.projectedDue>0?<small className="budget-forecast-note">Γνωστές εκκρεμείς υποχρεώσεις: {money.format(row.projectedDue)} · προβλεπόμενη χρήση {money.format(row.projectedUsed)} ({row.projectedStatus==='exceeded'?'πιθανή υπέρβαση':row.projectedStatus==='near'?'πλησιάζει το όριο':'εντός ορίου'}). Δεν έχουν καταχωριστεί ως δαπάνες.</small>:null}</div><div className="budget-meter" role="progressbar" aria-label={`Χρήση προϋπολογισμού ${row.scope==='overall'?'συνολικά':categoryPath(row.category,row.subcategory)}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.round(row.ratio*100))} aria-valuetext={`${Math.round(row.ratio*100)}%`}><i style={{width:`${Math.min(100,row.ratio*100)}%`}}/></div><IconButton aria-label={`Επεξεργασία προϋπολογισμού ${row.scope==='overall'?'συνολικά':categoryPath(row.category,row.subcategory)}`} disabled={busy} onClick={()=>editBudget(row.id)}><Pencil/></IconButton><IconButton aria-label={`Διαγραφή προϋπολογισμού ${row.scope==='overall'?'συνολικά':categoryPath(row.category,row.subcategory)}`} disabled={busy} onClick={()=>void deleteBudget(row.id)}><Trash2/></IconButton></article>)}</div>{budgets.length>visibleBudgets.length?<Button type="button" variant="secondary" className="budget-settings-more" disabled={busy} onClick={()=>setBudgetListLimit(limit=>limit+24)}>Προβολή περισσότερων · {budgets.length-visibleBudgets.length} ακόμη</Button>:null}</>:<div className="empty-inline">Δεν υπάρχουν προϋπολογισμοί για την επιλεγμένη περίοδο.</div>}
    </section>
  </div>;
}
