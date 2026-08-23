import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { searchCategoryIcons } from '../lib/categoryIconRegistry';
import { CategoryIconGlyph } from './CategoryIconGlyph';

export function CategoryIconPicker({value,onChange,inheritedLabel}:{value:string|null;onChange:(iconKey:string|null)=>void;inheritedLabel?:string}){
  const[query,setQuery]=useState('');
  const options=useMemo(()=>searchCategoryIcons(query,120),[query]);
  return <div className="category-icon-picker">
    <label className="category-icon-search"><Search size={16}/><span className="sr-only">Αναζήτηση εικονιδίου</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Αναζήτηση εικονιδίου…"/></label>
    {inheritedLabel?<button type="button" className={!value?'category-icon-option active':'category-icon-option'} aria-pressed={!value} onClick={()=>onChange(null)}><X size={17}/><span><b>Κληρονομεί</b><small>{inheritedLabel}</small></span></button>:null}
    <div className="category-icon-options" role="listbox" aria-label="Εικονίδια κατηγορίας">
      {options.map(option=><button type="button" role="option" aria-selected={value===option.key} className={value===option.key?'category-icon-option active':'category-icon-option'} key={option.key} onClick={()=>onChange(option.key)}><CategoryIconGlyph iconKey={option.key} size={18}/><span>{option.label}</span></button>)}
    </div>
    {!options.length?<p className="empty-inline">Δεν βρέθηκε εικονίδιο με αυτή την αναζήτηση.</p>:null}
  </div>;
}
