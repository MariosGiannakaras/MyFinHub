import { Palette, RotateCcw, X } from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';
import { categoryTree } from '../lib/categories';
import { CATEGORY_ICON_PACKS, decodeCategoryIconValue, encodeCategoryIconValue } from '../lib/categoryIconRegistry';
import { categoryIconPackOptionCount, categoryIconPackPreviewKeys } from '../lib/categoryIconPackSupport';
import {
  activeCategoryIconPack,
  explicitCategoryIconColor,
  explicitCategoryIconForPack,
  explicitSubcategoryIconColor,
  explicitSubcategoryIconForPack,
  resolvedCategoryIcon,
  resolvedCategoryIconColor,
  withCategoryIcon,
  withCategoryIconColor,
  withCategoryIconPack,
  withSubcategoryIconColor,
  withSubcategoryIconOverride,
  type CategoryKind,
} from '../lib/categoryIconPreferences';
import type { FinanceSettings } from '../types';
import { CategoryIconGlyph } from './CategoryIconGlyph';
import { CategoryIconPicker } from './CategoryIconPicker';
import './CategoryIconAssignmentWorkspace.css';

type Row={kind:CategoryKind;name:string;subcategories:string[]};
type EditorTarget={kind:CategoryKind;category:string;subcategory?:string}|null;

const COLOR_PRESETS=[
  '#2F6FED','#0F8A72','#25A244','#D28A0B','#D14C5A','#8B5CF6','#C45AA0','#52627D',
] as const;

const packLabel=(value:string|null|undefined)=>{
  const pack=decodeCategoryIconValue(value).pack;
  return CATEGORY_ICON_PACKS.find(item=>item.id===pack)?.label??pack;
};

export function CategoryIconAssignmentWorkspace({settings,onChange}:{settings:FinanceSettings;onChange:(settings:FinanceSettings)=>void}){
  const[editor,setEditor]=useState<EditorTarget>(null);
  const iconPack=activeCategoryIconPack(settings);
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
  const targetKey=(target:EditorTarget)=>target?`${target.kind}:${target.category}${target.subcategory?`:${target.subcategory}`:''}`:'';
  const editorValue=editor
    ?editor.subcategory
      ?explicitSubcategoryIconForPack(settings,editor.kind,editor.category,editor.subcategory,iconPack)
      :explicitCategoryIconForPack(settings,editor.kind,editor.category,iconPack)
    :null;
  const editorResolved=editor
    ?resolvedCategoryIcon(settings,editor.kind,editor.category,editor.subcategory)||encodeCategoryIconValue(iconPack,'other')
    :encodeCategoryIconValue(iconPack,'other');
  const editorColorOverride=editor
    ?editor.subcategory
      ?explicitSubcategoryIconColor(settings,editor.kind,editor.category,editor.subcategory)
      :explicitCategoryIconColor(settings,editor.kind,editor.category)
    :null;
  const editorResolvedColor=editor
    ?resolvedCategoryIconColor(settings,editor.kind,editor.category,editor.subcategory)
    :null;

  const updateEditorIcon=(iconKey:string|null)=>{
    if(!editor)return;
    onChange(editor.subcategory
      ?withSubcategoryIconOverride(settings,editor.kind,editor.category,editor.subcategory,iconKey)
      :withCategoryIcon(settings,editor.kind,editor.category,iconKey));
  };
  const updateEditorColor=(color:string|null)=>{
    if(!editor)return;
    onChange(editor.subcategory
      ?withSubcategoryIconColor(settings,editor.kind,editor.category,editor.subcategory,color)
      :withCategoryIconColor(settings,editor.kind,editor.category,color));
  };

  return <section className="panel surface-raised category-icons-workspace category-icon-assignment-workspace" aria-labelledby="category-icons-title">
    <div className="panel-head"><div><span id="category-icons-title">Εικονίδια κατηγοριών</span><small>Διάλεξε οικογένεια και δες αμέσως όλες τις κατηγορίες με αυτό το ύφος. Το MyFinHub θυμάται ξεχωριστή επιλογή εικονιδίου για κάθε βιβλιοθήκη και μπορείς να ορίσεις χρώμα ανά κατηγορία ή υποκατηγορία.</small></div></div>

    <div className="category-icon-library" aria-label="Βιβλιοθήκες εικονιδίων">
      <div className="category-icon-library-head"><b>Οικογένεια εικονιδίων</b><small>Η επιλογή αποθηκεύεται και ενημερώνει αμέσως την προεπισκόπηση παρακάτω. Επιστρέφοντας σε άλλη βιβλιοθήκη επανέρχεται η τελευταία επιλογή που είχες κάνει σε αυτή.</small></div>
      <div className="category-icon-pack-switcher category-icon-pack-switcher-global" role="group" aria-label="Οικογένεια εικονιδίων">
        {CATEGORY_ICON_PACKS.map(item=><button type="button" key={item.id} className={iconPack===item.id?'active':''} aria-pressed={iconPack===item.id} onClick={()=>onChange(withCategoryIconPack(settings,item.id))} title={item.description}>
          <span className="category-icon-pack-preview" aria-hidden="true">{categoryIconPackPreviewKeys(item.id).map(key=><CategoryIconGlyph key={key} iconKey={encodeCategoryIconValue(item.id,key)} size={16}/>)}</span>
          <span><b>{item.label}</b><small>{item.license}{categoryIconPackOptionCount(item.id)!==null?` · ${categoryIconPackOptionCount(item.id)} διαθέσιμα`:' · πλήρες semantic set'}</small></span>
        </button>)}
      </div>
      <div className="category-icon-pack-status" role="status" aria-live="polite"><b>{CATEGORY_ICON_PACKS.find(item=>item.id===iconPack)?.label}</b><span>ενεργή οικογένεια · {categoryIconPackOptionCount(iconPack)===null?'πλήρες semantic set':`${categoryIconPackOptionCount(iconPack)} διακριτά local glyphs`} · οι επιλογές της αποθηκεύονται ανεξάρτητα από τις υπόλοιπες.</span></div>
    </div>

    {editor?<section className="category-icon-selection-panel" aria-label={`Επιλογή εικονιδίου για ${editor.subcategory??editor.category}`} data-icon-selection-panel>
      <header className="category-icon-selection-head">
        <span className="category-icon-selection-current"><CategoryIconGlyph iconKey={editorResolved} color={editorResolvedColor} size={20}/></span>
        <div><b>Επιλογή εικονιδίου</b><small>{editor.subcategory?`${editor.category} › ${editor.subcategory}`:editor.category}{duplicateNames.has(editor.category)?` · ${editor.kind==='expense'?'Έξοδο':'Έσοδο'}`:''} · {CATEGORY_ICON_PACKS.find(item=>item.id===iconPack)?.label} · {editorValue?'Αποθηκευμένη επιλογή':'Αυτόματη αντιστοίχιση'}</small></div>
        <button type="button" className="icon-button category-icon-selection-close" aria-label="Κλείσιμο επιλογής εικονιδίου" title="Κλείσιμο" onClick={()=>setEditor(null)}><X size={17}/></button>
      </header>

      <div className="category-icon-color-editor" aria-label="Χρώμα εικονιδίου">
        <div className="category-icon-color-heading"><Palette size={16} aria-hidden="true"/><div><b>Χρώμα</b><small>{editorColorOverride?'Προσαρμοσμένο χρώμα':'Αυτόματο / κληρονομημένο χρώμα'}</small></div></div>
        <div className="category-icon-color-controls">
          <button type="button" className={!editorColorOverride?'active':''} aria-pressed={!editorColorOverride} onClick={()=>updateEditorColor(null)}><RotateCcw size={14} aria-hidden="true"/> Αυτόματο</button>
          {COLOR_PRESETS.map(color=><button type="button" key={color} className={editorColorOverride===color?'active color-swatch':'color-swatch'} aria-label={`Χρώμα ${color}`} aria-pressed={editorColorOverride===color} style={{'--icon-swatch':color} as CSSProperties} onClick={()=>updateEditorColor(color)}/>)}
          <label className="category-icon-custom-color"><span>Προσαρμοσμένο</span><input type="color" value={editorColorOverride??editorResolvedColor??'#2F6FED'} aria-label="Προσαρμοσμένο χρώμα εικονιδίου" onChange={event=>updateEditorColor(event.target.value)}/></label>
        </div>
      </div>

      <CategoryIconPicker value={editorValue} color={editorResolvedColor} selectedPack={iconPack} showPackSwitcher={false} automaticLabel="Χρήση σημασιολογικής αντιστοίχισης" onChange={updateEditorIcon}/>
    </section>:null}

    <div className="category-icon-unified-list taxonomy-icon-disclosure" data-icon-assignment-surface role="list" aria-label={`Κατηγορίες και υποκατηγορίες · προεπισκόπηση ${CATEGORY_ICON_PACKS.find(item=>item.id===iconPack)?.label}`}>
      {rows.map(row=>{
        const key=rowKey(row.kind,row.name);
        const explicit=explicitCategoryIconForPack(settings,row.kind,row.name,iconPack);
        const resolved=resolvedCategoryIcon(settings,row.kind,row.name)||encodeCategoryIconValue(iconPack,'other');
        const color=resolvedCategoryIconColor(settings,row.kind,row.name);
        const isOpen=targetKey(editor)===key;
        return <article className="category-icon-unified-category" role="listitem" key={key}>
          <button type="button" className="category-icon-unified-main" aria-expanded={isOpen} onClick={()=>setEditor(isOpen?null:{kind:row.kind,category:row.name})}>
            <span className="category-taxonomy-glyph"><CategoryIconGlyph iconKey={resolved} color={color} size={20}/></span>
            <span className="category-icon-unified-copy"><b>{row.name}</b><small>{row.subcategories.length?`${row.subcategories.length} ${row.subcategories.length===1?'υποκατηγορία':'υποκατηγορίες'}`:'Χωρίς υποκατηγορίες'}{duplicateNames.has(row.name)?` · ${row.kind==='expense'?'Έξοδο':'Έσοδο'}`:''}</small></span>
            <span className="category-icon-unified-state">{packLabel(resolved)} · {explicit?'Προσαρμοσμένο':'Αυτόματο'}{color?' · χρώμα':''}</span>
          </button>

          {row.subcategories.length?<div className="category-icon-unified-sublist" role="list" aria-label={`Υποκατηγορίες ${row.name}`}>
            {row.subcategories.map(subcategory=>{
              const subKey=`${key}:${subcategory}`;
              const override=explicitSubcategoryIconForPack(settings,row.kind,row.name,subcategory,iconPack);
              const subResolved=resolvedCategoryIcon(settings,row.kind,row.name,subcategory)||resolved;
              const subColor=resolvedCategoryIconColor(settings,row.kind,row.name,subcategory);
              const subOpen=targetKey(editor)===subKey;
              return <div className="category-icon-unified-subrow" role="listitem" key={subKey}>
                <button type="button" className="category-icon-unified-main category-icon-unified-submain" aria-expanded={subOpen} onClick={()=>setEditor(subOpen?null:{kind:row.kind,category:row.name,subcategory})}>
                  <CategoryIconGlyph iconKey={subResolved} color={subColor} size={17}/><span className="category-icon-unified-copy"><b>{subcategory}</b></span><span className="category-icon-unified-state">{packLabel(subResolved)} · {override?'Προσαρμοσμένο':'Αυτόματο'}{subColor?' · χρώμα':''}</span>
                </button>
              </div>;
            })}
          </div>:null}
        </article>;
      })}
    </div>
  </section>;
}
