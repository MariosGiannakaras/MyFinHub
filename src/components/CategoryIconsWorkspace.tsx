import { useState } from 'react';
import { categoryTree } from '../lib/categories';
import {
  explicitCategoryIcon,
  explicitSubcategoryIcon,
  resolvedCategoryIcon,
  withCategoryIcon,
  withSubcategoryIconOverride,
  type CategoryKind,
} from '../lib/categoryIconPreferences';
import type { FinanceSettings } from '../types';
import { CategoryIconGlyph } from './CategoryIconGlyph';
import { CategoryIconPicker } from './CategoryIconPicker';

export function CategoryIconsWorkspace({settings,onChange}:{settings:FinanceSettings;onChange:(settings:FinanceSettings)=>void}){
  const[kind,setKind]=useState<CategoryKind>('expense');
  const tree=categoryTree(settings,kind);
  const noun=kind==='expense'?'εξόδων':'εσόδων';

  return <section className="panel neo-raised category-icons-workspace" aria-labelledby="category-icons-title">
    <div className="panel-head">
      <div><span id="category-icons-title">Κατηγορίες & εικονίδια</span><small>Τα εικονίδια είναι τοπικά στη συσκευή. Οι υποκατηγορίες κληρονομούν το εικονίδιο της κατηγορίας εκτός αν ορίσεις διαφορετικό.</small></div>
    </div>
    <div className="segmented-control" role="group" aria-label="Τύπος κατηγοριών">
      <button type="button" className={kind==='expense'?'active':''} aria-pressed={kind==='expense'} onClick={()=>setKind('expense')}>Έξοδα</button>
      <button type="button" className={kind==='income'?'active':''} aria-pressed={kind==='income'} onClick={()=>setKind('income')}>Έσοδα</button>
    </div>
    <div className="category-icon-category-list">
      {tree.map(category=>{
        const parentKey=explicitCategoryIcon(settings,kind,category.name);
        const resolvedParent=resolvedCategoryIcon(settings,kind,category.name)||'other';
        return <details className="category-icon-editor" key={`${kind}:${category.name}`}>
          <summary>
            <CategoryIconGlyph iconKey={resolvedParent} size={19}/>
            <span><b>{category.name}</b><small>{parentKey?'Προσαρμοσμένο εικονίδιο':'Χωρίς ρητή επιλογή'}</small></span>
          </summary>
          <div className="category-icon-editor-body">
            <div className="category-icon-picker-block">
              <h3>Εικονίδιο κατηγορίας</h3>
              <CategoryIconPicker value={parentKey} onChange={iconKey=>onChange(withCategoryIcon(settings,kind,category.name,iconKey))}/>
            </div>
            {category.subcategories.length?<div className="subcategory-icon-list" aria-label={`Υποκατηγορίες ${category.name}`}>
              <h3>Υποκατηγορίες</h3>
              {category.subcategories.map(subcategory=>{
                const override=explicitSubcategoryIcon(settings,kind,category.name,subcategory);
                const resolved=resolvedCategoryIcon(settings,kind,category.name,subcategory)||'other';
                return <details className="subcategory-icon-editor" key={`${kind}:${category.name}:${subcategory}`}>
                  <summary>
                    <CategoryIconGlyph iconKey={resolved} size={17}/>
                    <span><b>{subcategory}</b><small>{override?'Δικό της εικονίδιο':`Κληρονομεί από «${category.name}»`}</small></span>
                  </summary>
                  <CategoryIconPicker
                    value={override}
                    inheritedLabel={`Από «${category.name}»`}
                    onChange={iconKey=>onChange(withSubcategoryIconOverride(settings,kind,category.name,subcategory,iconKey))}
                  />
                </details>;
              })}
            </div>:<p className="empty-inline">Η κατηγορία δεν έχει υποκατηγορίες.</p>}
          </div>
        </details>;
      })}
    </div>
    {!tree.length?<p className="empty-inline">Δεν υπάρχουν κατηγορίες {noun}.</p>:null}
  </section>;
}
