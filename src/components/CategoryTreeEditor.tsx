import { CheckCircle2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { categoryTree, formatCategoryTree, parseCategoryTree } from '../lib/categories';
import type { CategoryDefinition, FinanceSettings } from '../types';

type CategoryKind='expense'|'income';

export function CategoryTreeEditor({kind,settings,onSave}:{kind:CategoryKind;settings:FinanceSettings;onSave:(tree:CategoryDefinition[])=>void}){
  const noun=kind==='expense'?'εξόδων':'εσόδων';
  const title=`Κατηγορίες & υποκατηγορίες ${noun}`;
  const [text,setText]=useState(()=>formatCategoryTree(categoryTree(settings,kind)));
  const [dirty,setDirty]=useState(false);
  const [feedback,setFeedback]=useState<{kind:'success'|'error';text:string}|null>(null);

  useEffect(()=>{
    if(dirty)return;
    setText(formatCategoryTree(categoryTree(settings,kind)));
  },[settings,kind,dirty]);

  const save=()=>{
    const tree=parseCategoryTree(text);
    if(!tree.length){
      setFeedback({kind:'error',text:'Χρειάζεται τουλάχιστον μία έγκυρη κατηγορία. Η τελευταία αποθηκευμένη λίστα παραμένει αμετάβλητη.'});
      return;
    }
    onSave(tree);
    setText(formatCategoryTree(tree));
    setDirty(false);
    setFeedback({kind:'success',text:`Οι κατηγορίες ${noun} αποθηκεύτηκαν και είναι ήδη διαθέσιμες σε όλη την εφαρμογή.`});
  };

  return <article className="panel neo-raised category-editor">
    <div className="panel-head"><div><span>{title}</span><small>Μία κατηγορία ανά γραμμή. Προαιρετικές υποκατηγορίες μετά από &gt;, χωρισμένες με κόμμα. Τα διπλότυπα ενοποιούνται χωρίς να αλλάζουν ιστορικές συναλλαγές.</small></div></div>
    <textarea aria-label={title} aria-describedby={`category-help-${kind}`} value={text} onChange={event=>{setText(event.target.value);setDirty(true);setFeedback(null)}}/>
    <div className="category-editor-footer" id={`category-help-${kind}`}>
      <span className={`category-save-state ${dirty?'dirty':'saved'}`}>{dirty?'Μη αποθηκευμένες αλλαγές':'Αποθηκευμένο'}</span>
      <button type="button" className="save-button category-save-button" disabled={!dirty} onClick={save}><Save size={16}/> Αποθήκευση {noun}</button>
    </div>
    {feedback?<div className={`category-save-feedback ${feedback.kind}`} role="status" aria-live="polite">{feedback.kind==='success'?<CheckCircle2 size={17}/>:null}<span>{feedback.text}</span></div>:null}
  </article>;
}
