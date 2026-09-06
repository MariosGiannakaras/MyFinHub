import { Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { categoryIconKeySupportedByPack } from '../lib/categoryIconPackSupport';
import {
  CATEGORY_ICON_PACKS,
  decodeCategoryIconValue,
  encodeCategoryIconValue,
  searchCategoryIcons,
  type CategoryIconPack,
} from '../lib/categoryIconRegistry';
import { CategoryIconGlyph } from './CategoryIconGlyph';
import './CategoryIconPicker.css';

export function CategoryIconPicker({
  value,
  onChange,
  inheritedLabel,
  automaticLabel,
  selectedPack,
  onPackChange,
  showPackSwitcher=true,
}:{
  value:string|null;
  onChange:(iconKey:string|null)=>void;
  inheritedLabel?:string;
  automaticLabel?:string;
  selectedPack?:CategoryIconPack;
  onPackChange?:(pack:CategoryIconPack)=>void;
  showPackSwitcher?:boolean;
}){
  const decoded=decodeCategoryIconValue(value);
  const[localPack,setLocalPack]=useState<CategoryIconPack>(decoded.pack);
  const[query,setQuery]=useState('');
  const pack=selectedPack??localPack;
  const options=useMemo(()=>searchCategoryIcons(query,120).filter(option=>categoryIconKeySupportedByPack(pack,option.key)),[query,pack]);
  useEffect(()=>{if(selectedPack===undefined&&value)setLocalPack(decodeCategoryIconValue(value).pack)},[selectedPack,value]);
  const choosePack=(next:CategoryIconPack)=>{
    if(selectedPack===undefined)setLocalPack(next);
    onPackChange?.(next);
    if(value&&categoryIconKeySupportedByPack(next,decoded.key))onChange(encodeCategoryIconValue(next,decoded.key));
  };
  return <div className="category-icon-picker">
    {showPackSwitcher?<div className="category-icon-pack-switcher" role="group" aria-label="Πακέτο εικονιδίων">
      {CATEGORY_ICON_PACKS.map(item=><button type="button" key={item.id} className={pack===item.id?'active':''} aria-pressed={pack===item.id} onClick={()=>choosePack(item.id)} title={item.description}><span><b>{item.label}</b><small>{item.license}</small></span></button>)}
    </div>:null}
    <div className="category-icon-picker-mode">
      <button type="button" className={!value?'category-icon-option active':'category-icon-option'} aria-pressed={!value} onClick={()=>onChange(null)}><Sparkles size={17} aria-hidden="true"/><span><b>Αυτόματο</b><small>{automaticLabel??inheritedLabel??'Σημασιολογική αντιστοίχιση'}</small></span></button>
    </div>
    <label className="category-icon-search"><Search size={16} aria-hidden="true"/><span className="sr-only">Αναζήτηση εικονιδίου</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Αναζήτηση εικονιδίου…"/></label>
    <div className="category-icon-options" role="group" aria-label={`Εικονίδια ${CATEGORY_ICON_PACKS.find(item=>item.id===pack)?.label??pack}`}>
      {options.map(option=>{
        const iconValue=encodeCategoryIconValue(pack,option.key);
        return <button type="button" aria-pressed={value===iconValue} className={value===iconValue?'category-icon-option active':'category-icon-option'} key={option.key} onClick={()=>onChange(iconValue)}><CategoryIconGlyph iconKey={iconValue} size={18}/><span>{option.label}</span></button>;
      })}
    </div>
    {!options.length?<p className="empty-inline" role="status">Δεν υπάρχει ξεχωριστό εικονίδιο σε αυτό το pack για την αναζήτηση.</p>:null}
  </div>;
}
