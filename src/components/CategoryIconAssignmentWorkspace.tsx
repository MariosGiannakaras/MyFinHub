import { useMemo, useState } from 'react';
import { categoryTree } from '../lib/categories';
import { CATEGORY_ICON_PACKS, decodeCategoryIconValue, encodeCategoryIconValue, type CategoryIconPack } from '../lib/categoryIconRegistry';
import { categoryIconKeySupportedByPack } from '../lib/categoryIconPackSupport';
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
import './CategoryIconAssignmentWorkspace.css';

type Row={kind:CategoryKind;name:string;subcategories:string[]};

export function CategoryIconAssignmentWorkspace({settings,onChange}:{settings:FinanceSettings;onChange:(settings:FinanceSettings)=>void}){
  const[iconPack,setIconPack]=useState<CategoryIconPack>('lucide');
  const[openKey,setOpenKey]=useState<string|null>(null);
  const rows=useMemo<Row[]>(()=>[
    ...categoryTree(settings,'expense').map(item=>({kind:'expense' as const,...item})),
    ...categoryTree(settings,'income').map(item=>({kind:'income' as const,...item})),
  ],[settings]);
  const duplicateNames=useMemo(()=>{
    const counts=new Map<string,number>();
    for(const row of rows)counts.set(row.name,(counts.get(row.name)??0)+1);
    return new Set([...counts].filter(([,count])=>count>1).map(([name])=>name));
  },[rows]);
  const rowKey=(kind:CategoryKind,name:string)=>`${kind}:${name}`;
  const compatibleValue=(value:string|null)=>{
    if(!value)return null;
    const decoded=decodeCategoryIconValue(value);
    return decoded.pack===iconPack&&categoryIconKeySupportedByPack(iconPack,decoded.key as never)?value:null;
  };

  return <section className="panel neo-raised category-icons-workspace category-icon-assignment-workspace" aria-labelledby="category-icons-title">
    <div className="panel-head"><div><span id="category-icons-title">Εικονίδια κατηγοριών</span><small>Ένα εικονίδιο ανά κατηγορία ή υποκατηγορία. Η αλλαγή χρησιμοποιείται σε όλη την εφαρμογή όπου εμφανίζεται η ίδια taxonomy identity.</small></div></div>

    <div className="category-icon-library" aria-label="Βιβλιοθήκες εικονιδίων">
      <div className="category-icon-library-head"><b>Βιβλιοθήκη εικονιδίων</b><small>Διάλεξε pack και μετά άλλαξε μόνο ό,τι χρειάζεται από την ενιαία λίστα.</small></div>
      <div className="category-icon-pack-switcher category-icon-pack-switcher-global" role="group" aria-label="Πακέτο εικονιδίων">
        {CATEGORY_ICON_PACKS.map(item=><button type="button" key={item.id} className={iconPack===item.id?'active':''} aria-pressed={iconPack===item.id} onClick={()=>setIconPack(item.id)} title={item.description}>
          <span className="category-icon-pack-preview" aria-hidden="true"><CategoryIconGlyph iconKey={encodeCategoryIconValue(item.id,'coffee')} size={16}/><CategoryIconGlyph iconKey={encodeCategoryIconValue(item.id,'home')} size={16}/><CategoryIconGlyph iconKey={encodeCategoryIconValue(item.id,'wallet')} size={16}/></span>
          <span><b>{item.label}</b><small>{item.license}</small></span>
        </button>)}
      </div>
    </div>

    <div className="category-icon-unified-list" role="list" aria-label="Κατηγορίες και υποκατηγορίες">
      {rows.map(row=>{
        const key=rowKey(row.kind,row.name);
        const explicit=explicitCategoryIcon(settings,row.kind,row.name);
        const resolved=resolvedCategoryIcon(settings,row.kind,row.name)||'other';
        const isOpen=openKey===key;
        return <article className="category-icon-unified-category" role="listitem" key={key}>
          <button type="button" className="category-icon-unified-main" aria-expanded={isOpen} onClick={()=>setOpenKey(isOpen?null:key)}>
            <span className="category-taxonomy-glyph"><CategoryIconGlyph iconKey={resolved} size={20}/></span>
            <span className="category-icon-unified-copy"><b>{row.name}</b><small>{row.subcategories.length?`${row.subcategories.length} ${row.subcategories.length===1?'υποκατηγορία':'υποκατηγορίες'}`:'Χωρίς υποκατηγορίες'}{duplicateNames.has(row.name)?` · ${row.kind==='expense'?'Έξοδο':'Έσοδο'}`:''}</small></span>
            <span className="category-icon-unified-state">{explicit?'Προσαρμοσμένο':'Αυτόματο'}</span>
          </button>
          {isOpen?<div className="category-icon-unified-editor">
            <CategoryIconPicker value={compatibleValue(explicit)} selectedPack={iconPack} showPackSwitcher={false} automaticLabel="Χρήση σημασιολογικής αντιστοίχισης" onChange={iconKey=>onChange(withCategoryIcon(settings,row.kind,row.name,iconKey))}/>
          </div>:null}

          {row.subcategories.length?<div className="category-icon-unified-sublist" role="list" aria-label={`Υποκατηγορίες ${row.name}`}>
            {row.subcategories.map(subcategory=>{
              const subKey=`${key}:${subcategory}`;
              const override=explicitSubcategoryIcon(settings,row.kind,row.name,subcategory);
              const subResolved=resolvedCategoryIcon(settings,row.kind,row.name,subcategory)||resolved;
              const subOpen=openKey===subKey;
              return <div className="category-icon-unified-subrow" role="listitem" key={subKey}>
                <button type="button" className="category-icon-unified-main category-icon-unified-submain" aria-expanded={subOpen} onClick={()=>setOpenKey(subOpen?null:subKey)}>
                  <CategoryIconGlyph iconKey={subResolved} size={17}/><span className="category-icon-unified-copy"><b>{subcategory}</b></span><span className="category-icon-unified-state">{override?'Προσαρμοσμένο':'Αυτόματο'}</span>
                </button>
                {subOpen?<div className="category-icon-unified-editor category-icon-unified-subeditor"><CategoryIconPicker value={compatibleValue(override)} selectedPack={iconPack} showPackSwitcher={false} automaticLabel="Χρήση σημασιολογικής αντιστοίχισης" onChange={iconKey=>onChange(withSubcategoryIconOverride(settings,row.kind,row.name,subcategory,iconKey))}/></div>:null}
              </div>;
            })}
          </div>:null}
        </article>;
      })}
    </div>
  </section>;
}
