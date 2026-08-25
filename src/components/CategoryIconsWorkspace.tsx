import { Archive, ArrowDown, ArrowUp, MoveRight, Pencil, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { categoryTree } from '../lib/categories';
import {
  explicitCategoryIcon,
  explicitSubcategoryIcon,
  resolvedCategoryIcon,
  withCategoryIcon,
  withSubcategoryIconOverride,
  type CategoryKind,
} from '../lib/categoryIconPreferences';
import { ensureCategoryIdentities } from '../lib/categoryIdentity';
import {
  taxonomyCategoryId,
  taxonomyOperationPreview,
  taxonomyRetirementDependencies,
  taxonomySubcategoryId,
  type TaxonomyOperation,
  type TaxonomyRetirementDependency,
} from '../lib/taxonomyManagement';
import type { FinanceData, FinanceSettings } from '../types';
import { AppSelectInput } from './AppSelectInput';
import { CategoryIconGlyph } from './CategoryIconGlyph';
import { CategoryIconPicker } from './CategoryIconPicker';
import { ConfirmDialog } from './ConfirmDialog';

const errorMessage=(reason:unknown)=>reason instanceof Error?reason.message:'Η αλλαγή κατηγορίας δεν μπορεί να ολοκληρωθεί.';

type EditingState={type:'category'|'subcategory';id:string;value:string}|null;
type MovingState={id:string;targetCategoryId:string}|null;
type RetirementOperation=Extract<TaxonomyOperation,{type:'retire-category'|'retire-subcategory'}>;
type RetirementState={operation:RetirementOperation;label:string;dependencies:TaxonomyRetirementDependency[]}|null;

export function CategoryIconsWorkspace({data,asOf,settings,onChange,onTaxonomyOperation}:{data:FinanceData;asOf:string;settings:FinanceSettings;onChange:(settings:FinanceSettings)=>void;onTaxonomyOperation:(operation:TaxonomyOperation)=>void}){
  const[kind,setKind]=useState<CategoryKind>('expense');
  const[categoryDraft,setCategoryDraft]=useState('');
  const[subcategoryDrafts,setSubcategoryDrafts]=useState<Record<string,string>>({});
  const[editing,setEditing]=useState<EditingState>(null);
  const[moving,setMoving]=useState<MovingState>(null);
  const[retirement,setRetirement]=useState<RetirementState>(null);
  const[error,setError]=useState('');
  const normalized=useMemo(()=>ensureCategoryIdentities(settings),[settings]);
  const tree=categoryTree(normalized,kind);
  const noun=kind==='expense'?'εξόδων':'εσόδων';

  const perform=(operation:TaxonomyOperation)=>{
    try{
      taxonomyOperationPreview(normalized,operation);
      onTaxonomyOperation(operation);
      setError('');
      return true;
    }catch(reason){setError(errorMessage(reason));return false}
  };
  const changeKind=(next:CategoryKind)=>{setKind(next);setEditing(null);setMoving(null);setRetirement(null);setError('')};
  const addCategory=()=>{if(perform({type:'add-category',kind,label:categoryDraft}))setCategoryDraft('')};
  const addSubcategory=(parentId:string)=>{const value=subcategoryDrafts[parentId]??'';if(perform({type:'add-subcategory',kind,parentId,label:value}))setSubcategoryDrafts(current=>({...current,[parentId]:''}))};
  const saveEdit=()=>{
    if(!editing)return;
    const operation:TaxonomyOperation=editing.type==='category'
      ?{type:'rename-category',kind,identityId:editing.id,label:editing.value}
      :{type:'rename-subcategory',kind,identityId:editing.id,label:editing.value};
    if(perform(operation))setEditing(null);
  };
  const saveMove=()=>{if(moving&&perform({type:'move-subcategory',kind,identityId:moving.id,targetCategoryId:moving.targetCategoryId}))setMoving(null)};
  const requestRetirement=(operation:RetirementOperation,label:string)=>{
    try{
      const snapshot:FinanceData={...data,state:{...data.state,settings:normalized}};
      const dependencies=taxonomyRetirementDependencies(snapshot,operation,asOf);
      setRetirement({operation,label,dependencies});
      setError('');
    }catch(reason){setRetirement(null);setError(errorMessage(reason))}
  };
  const confirmRetirement=()=>{
    if(!retirement||retirement.dependencies.length)return;
    if(perform(retirement.operation))setRetirement(null);
  };

  return <section className="panel neo-raised category-icons-workspace" aria-labelledby="category-icons-title">
    <div className="panel-head">
      <div><span id="category-icons-title">Κατηγορίες & εικονίδια</span><small>Πρόσθεσε, μετονόμασε, ταξινόμησε ή μετέφερε κατηγορίες με stable ταυτότητα. Η «Απόσυρση» τις αφαιρεί μόνο από τις νέες επιλογές, αφού τακτοποιήσεις ρητά κάθε ενεργή ή μελλοντική εξάρτηση· το ιστορικό δεν διαγράφεται.</small></div>
    </div>
    <div className="segmented-control" role="group" aria-label="Τύπος κατηγοριών">
      <button type="button" className={kind==='expense'?'active':''} aria-pressed={kind==='expense'} onClick={()=>changeKind('expense')}>Έξοδα</button>
      <button type="button" className={kind==='income'?'active':''} aria-pressed={kind==='income'} onClick={()=>changeKind('income')}>Έσοδα</button>
    </div>

    <div className="taxonomy-add-row" role="group" aria-label={`Νέα κατηγορία ${noun}`}>
      <label><span>Νέα κατηγορία</span><input value={categoryDraft} onChange={event=>setCategoryDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();addCategory()}}} placeholder="Όνομα κατηγορίας"/></label>
      <button type="button" className="save-button" onClick={addCategory}><Plus size={16} aria-hidden="true"/> Προσθήκη</button>
    </div>
    {error?<div className="form-error taxonomy-error" role="alert">{error}</div>:null}
    {retirement?.dependencies.length?<div className="logic-note compact taxonomy-retirement-blockers" role="status" aria-live="polite" data-taxonomy-retirement-blockers>
      <Archive size={18} aria-hidden="true"/>
      <div><b>Η «{retirement.label}» δεν μπορεί ακόμη να αποσυρθεί.</b><p>Τακτοποίησε εσύ τις παρακάτω ενεργές ή μελλοντικές αναφορές. Δεν θα γίνει αυτόματη μεταφορά, διαγραφή ή αλλαγή σε «Άλλο».</p><ul>{retirement.dependencies.map(item=><li key={`${item.kind}:${item.id}`}>{item.label}</li>)}</ul><button type="button" className="secondary" onClick={()=>setRetirement(null)}>Κλείσιμο</button></div>
    </div>:null}

    <div className="category-icon-category-list taxonomy-category-list">
      {tree.map((category,categoryIndex)=>{
        const categoryId=taxonomyCategoryId(normalized,kind,category.name);
        if(!categoryId)return null;
        const parentKey=explicitCategoryIcon(normalized,kind,category.name);
        const resolvedParent=resolvedCategoryIcon(normalized,kind,category.name)||'other';
        const otherCategories=tree.map(item=>({id:taxonomyCategoryId(normalized,kind,item.name),name:item.name})).filter((item):item is {id:string;name:string}=>Boolean(item.id&&item.id!==categoryId));
        const categoryUpLabel=`Μετακίνηση ${category.name} προς τα πάνω`;
        const categoryDownLabel=`Μετακίνηση ${category.name} προς τα κάτω`;
        const categoryRenameLabel=`Μετονομασία ${category.name}`;
        const categoryRetireLabel=`Απόσυρση κατηγορίας ${category.name}`;
        return <article className="category-taxonomy-card" key={categoryId} data-category-id={categoryId}>
          <div className="category-taxonomy-head">
            <span className="category-taxonomy-glyph"><CategoryIconGlyph iconKey={resolvedParent} size={20}/></span>
            <div className="category-taxonomy-title"><b>{category.name}</b><small>{category.subcategories.length} {category.subcategories.length===1?'υποκατηγορία':'υποκατηγορίες'} · {parentKey?'προσαρμοσμένο εικονίδιο':'χωρίς ρητή επιλογή'}</small></div>
            <div className="taxonomy-row-actions" aria-label={`Ενέργειες κατηγορίας ${category.name}`}>
              <button type="button" disabled={categoryIndex===0} aria-label={categoryUpLabel} title={categoryUpLabel} onClick={()=>perform({type:'reorder-category',kind,identityId:categoryId,direction:'up'})}><ArrowUp size={15} aria-hidden="true"/></button>
              <button type="button" disabled={categoryIndex===tree.length-1} aria-label={categoryDownLabel} title={categoryDownLabel} onClick={()=>perform({type:'reorder-category',kind,identityId:categoryId,direction:'down'})}><ArrowDown size={15} aria-hidden="true"/></button>
              <button type="button" aria-label={categoryRenameLabel} title={categoryRenameLabel} onClick={()=>setEditing({type:'category',id:categoryId,value:category.name})}><Pencil size={15} aria-hidden="true"/></button>
              <button type="button" aria-label={categoryRetireLabel} title={categoryRetireLabel} onClick={()=>requestRetirement({type:'retire-category',kind,identityId:categoryId},category.name)}><Archive size={15} aria-hidden="true"/></button>
            </div>
          </div>

          {editing?.type==='category'&&editing.id===categoryId?<div className="taxonomy-inline-editor" role="group" aria-label={`Μετονομασία κατηγορίας ${category.name}`}><input autoFocus value={editing.value} onChange={event=>setEditing({...editing,value:event.target.value})} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();saveEdit()}if(event.key==='Escape')setEditing(null)}}/><button type="button" className="save-button" onClick={saveEdit}>Αποθήκευση</button><button type="button" className="secondary" aria-label="Ακύρωση μετονομασίας" title="Ακύρωση μετονομασίας" onClick={()=>setEditing(null)}><X size={15} aria-hidden="true"/></button></div>:null}

          <details className="taxonomy-icon-disclosure">
            <summary>Εικονίδιο κατηγορίας</summary>
            <div className="category-icon-picker-block"><CategoryIconPicker value={parentKey} onChange={iconKey=>onChange(withCategoryIcon(normalized,kind,category.name,iconKey))}/></div>
          </details>

          <div className="taxonomy-subcategory-section">
            <div className="taxonomy-subcategory-heading"><div><b>Υποκατηγορίες</b><small>Κληρονομούν το εικονίδιο της κατηγορίας εκτός αν ορίσεις override.</small></div></div>
            <div className="taxonomy-add-row taxonomy-add-subcategory" role="group" aria-label={`Νέα υποκατηγορία στην ${category.name}`}>
              <label><span className="sr-only">Νέα υποκατηγορία στην {category.name}</span><input value={subcategoryDrafts[categoryId]??''} onChange={event=>setSubcategoryDrafts(current=>({...current,[categoryId]:event.target.value}))} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();addSubcategory(categoryId)}}} placeholder={`Νέα υποκατηγορία στην «${category.name}»`}/></label>
              <button type="button" className="secondary" onClick={()=>addSubcategory(categoryId)}><Plus size={15} aria-hidden="true"/> Προσθήκη</button>
            </div>

            {category.subcategories.length?<div className="taxonomy-subcategory-list" role="list" aria-label={`Υποκατηγορίες ${category.name}`}>
              {category.subcategories.map((subcategory,subcategoryIndex)=>{
                const subcategoryId=taxonomySubcategoryId(normalized,kind,category.name,subcategory);
                if(!subcategoryId)return null;
                const override=explicitSubcategoryIcon(normalized,kind,category.name,subcategory);
                const resolved=resolvedCategoryIcon(normalized,kind,category.name,subcategory)||'other';
                const subcategoryUpLabel=`Μετακίνηση ${subcategory} προς τα πάνω`;
                const subcategoryDownLabel=`Μετακίνηση ${subcategory} προς τα κάτω`;
                const subcategoryRenameLabel=`Μετονομασία ${subcategory}`;
                const subcategoryMoveLabel=`Μεταφορά ${subcategory} σε άλλη κατηγορία`;
                const subcategoryRetireLabel=`Απόσυρση υποκατηγορίας ${subcategory}`;
                return <article className="taxonomy-subcategory-row" role="listitem" key={subcategoryId} data-subcategory-id={subcategoryId}>
                  <div className="taxonomy-subcategory-main"><CategoryIconGlyph iconKey={resolved} size={17}/><div><b>{subcategory}</b><small>{override?'Δικό της εικονίδιο':`Κληρονομεί από «${category.name}»`}</small></div></div>
                  <div className="taxonomy-row-actions" aria-label={`Ενέργειες υποκατηγορίας ${subcategory}`}>
                    <button type="button" disabled={subcategoryIndex===0} aria-label={subcategoryUpLabel} title={subcategoryUpLabel} onClick={()=>perform({type:'reorder-subcategory',kind,identityId:subcategoryId,direction:'up'})}><ArrowUp size={14} aria-hidden="true"/></button>
                    <button type="button" disabled={subcategoryIndex===category.subcategories.length-1} aria-label={subcategoryDownLabel} title={subcategoryDownLabel} onClick={()=>perform({type:'reorder-subcategory',kind,identityId:subcategoryId,direction:'down'})}><ArrowDown size={14} aria-hidden="true"/></button>
                    <button type="button" aria-label={subcategoryRenameLabel} title={subcategoryRenameLabel} onClick={()=>setEditing({type:'subcategory',id:subcategoryId,value:subcategory})}><Pencil size={14} aria-hidden="true"/></button>
                    {otherCategories.length?<button type="button" aria-label={subcategoryMoveLabel} title={subcategoryMoveLabel} onClick={()=>setMoving({id:subcategoryId,targetCategoryId:otherCategories[0].id})}><MoveRight size={14} aria-hidden="true"/></button>:null}
                    <button type="button" aria-label={subcategoryRetireLabel} title={subcategoryRetireLabel} onClick={()=>requestRetirement({type:'retire-subcategory',kind,identityId:subcategoryId},subcategory)}><Archive size={14} aria-hidden="true"/></button>
                  </div>

                  {editing?.type==='subcategory'&&editing.id===subcategoryId?<div className="taxonomy-inline-editor taxonomy-subcategory-editor" role="group" aria-label={`Μετονομασία υποκατηγορίας ${subcategory}`}><input autoFocus value={editing.value} onChange={event=>setEditing({...editing,value:event.target.value})} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();saveEdit()}if(event.key==='Escape')setEditing(null)}}/><button type="button" className="save-button" onClick={saveEdit}>Αποθήκευση</button><button type="button" className="secondary" aria-label="Ακύρωση μετονομασίας" title="Ακύρωση μετονομασίας" onClick={()=>setEditing(null)}><X size={14} aria-hidden="true"/></button></div>:null}

                  {moving?.id===subcategoryId?<div className="taxonomy-move-editor" role="group" aria-label={`Μεταφορά υποκατηγορίας ${subcategory}`}><label><span>Μεταφορά σε</span><AppSelectInput value={moving.targetCategoryId} onChange={event=>setMoving({...moving,targetCategoryId:event.target.value})}>{otherCategories.map(target=><option key={target.id} value={target.id}>{target.name}</option>)}</AppSelectInput></label><button type="button" className="save-button" onClick={saveMove}>Μεταφορά</button><button type="button" className="secondary" aria-label="Ακύρωση μεταφοράς" title="Ακύρωση μεταφοράς" onClick={()=>setMoving(null)}><X size={14} aria-hidden="true"/></button></div>:null}

                  <details className="taxonomy-icon-disclosure taxonomy-subcategory-icon"><summary>Εικονίδιο</summary><CategoryIconPicker value={override} inheritedLabel={`Από «${category.name}»`} onChange={iconKey=>onChange(withSubcategoryIconOverride(normalized,kind,category.name,subcategory,iconKey))}/></details>
                </article>;
              })}
            </div>:<p className="empty-inline">Η κατηγορία δεν έχει υποκατηγορίες.</p>}
          </div>
        </article>;
      })}
    </div>
    {!tree.length?<p className="empty-inline">Δεν υπάρχουν κατηγορίες {noun}.</p>:null}
    <ConfirmDialog
      open={Boolean(retirement&&!retirement.dependencies.length)}
      title={`Απόσυρση «${retirement?.label??''}»`}
      description="Θα αφαιρεθεί από τις ενεργές επιλογές για νέες κινήσεις. Η stable ταυτότητα, τα παλιά ονόματα και όλες οι ιστορικές οικονομικές αναφορές θα παραμείνουν ανέπαφα."
      confirmLabel="Απόσυρση"
      onConfirm={confirmRetirement}
      onCancel={()=>setRetirement(null)}
    />
  </section>;
}
