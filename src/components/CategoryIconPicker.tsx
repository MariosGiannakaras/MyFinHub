import { Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { categoryIconKeySupportedByPack } from '../lib/categoryIconPackSupport';
import { iconCatalogAsset, isCatalogIconKey } from '../lib/categoryIconCatalog';
import {
  CATEGORY_ICON_PACKS,
  decodeCategoryIconValue,
  encodeCategoryIconValue,
  searchCategoryIcons,
  type CategoryIconPack,
} from '../lib/categoryIconRegistry';
import { AppInputShell } from './AppInputShell';
import { AppTextInput } from './AppTextInput';
import { CategoryIconGlyph } from './CategoryIconGlyph';
import './CategoryIconPicker.css';

const PAGE_SIZE=96;
const catalogCache=new Map<CategoryIconPack,readonly string[]>();
const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('el-GR').trim();

async function getCatalog(pack:CategoryIconPack):Promise<readonly string[]>{
  const cached=catalogCache.get(pack);
  if(cached)return cached;
  const response=await fetch(iconCatalogAsset(pack,'json'),{cache:'force-cache'});
  if(!response.ok)throw new Error(`Catalog ${pack}: HTTP ${response.status}`);
  const payload:unknown=await response.json();
  if(!payload||typeof payload!=='object'||!('pack' in payload)||!('icons' in payload))throw new Error('Invalid icon catalog.');
  const data=payload as {pack:unknown;icons:unknown};
  if(data.pack!==pack||!Array.isArray(data.icons)||!data.icons.every((name:unknown)=>typeof name==='string'&&isCatalogIconKey(`icon/${name}`)))throw new Error('Invalid icon catalog.');
  const names=data.icons as string[];
  if(new Set(names).size!==names.length)throw new Error('Duplicate catalog names.');
  catalogCache.set(pack,names);
  return names;
}

export function CategoryIconPicker({
  value,
  onChange,
  inheritedLabel,
  automaticLabel,
  selectedPack,
  onPackChange,
  showPackSwitcher=true,
  color,
}:{
  value:string|null;
  onChange:(iconKey:string|null)=>void;
  inheritedLabel?:string;
  automaticLabel?:string;
  selectedPack?:CategoryIconPack;
  onPackChange?:(pack:CategoryIconPack)=>void;
  showPackSwitcher?:boolean;
  color?:string|null;
}){
  const decoded=decodeCategoryIconValue(value);
  const[localPack,setLocalPack]=useState<CategoryIconPack>(decoded.pack);
  const[query,setQuery]=useState('');
  const[visibleCount,setVisibleCount]=useState(PAGE_SIZE);
  const[catalog,setCatalog]=useState<{pack:CategoryIconPack;names:readonly string[]}|null>(null);
  const[error,setError]=useState('');
  const[retry,setRetry]=useState(0);
  const pack=selectedPack??localPack;

  useEffect(()=>{
    let active=true;
    const cached=catalogCache.get(pack);
    if(cached){setCatalog({pack,names:cached});setError('');return;}
    setCatalog(null);setError('');
    void getCatalog(pack).then(names=>{if(active){setCatalog({pack,names});setError('');}}).catch(()=>{if(active)setError('Δεν ήταν δυνατή η φόρτωση των τοπικών εικονιδίων.');});
    return()=>{active=false;};
  },[pack,retry]);
  useEffect(()=>setVisibleCount(PAGE_SIZE),[pack,query]);
  useEffect(()=>{if(selectedPack===undefined&&value)setLocalPack(decodeCategoryIconValue(value).pack)},[selectedPack,value]);

  // Greek terms are mapped to English icon names by the existing semantic taxonomy.
  const searchTerms=useMemo(()=>{
    const needle=normalize(query);
    if(!needle)return [];
    const synonyms=searchCategoryIcons(query,120).flatMap(item=>[item.key,...item.keywords]);
    return [...new Set([needle,...synonyms.map(normalize)])].filter(Boolean);
  },[query]);

  const matches=useMemo(()=>{
    if(catalog?.pack!==pack)return [];
    if(!query.trim())return catalog.names;
    return catalog.names.filter(name=>{
      const text=name.replaceAll('-',' ');
      return searchTerms.some(term=>name.includes(term.replaceAll(' ','-'))||text.includes(term));
    });
  },[catalog,pack,query,searchTerms]);
  const shown=matches.slice(0,visibleCount);
  const choosePack=(next:CategoryIconPack)=>{
    if(selectedPack===undefined)setLocalPack(next);
    onPackChange?.(next);
    // Native catalog names are family-specific: never silently carry a foreign name to another family.
    if(value&&!isCatalogIconKey(decoded.key)&&categoryIconKeySupportedByPack(next,decoded.key))onChange(encodeCategoryIconValue(next,decoded.key));
  };
  const legacySelection=Boolean(value&&!isCatalogIconKey(decoded.key)&&decoded.pack===pack);

  return <div className="category-icon-picker">
    {showPackSwitcher?<div className="category-icon-pack-switcher" role="group" aria-label="Πακέτο εικονιδίων">
      {CATEGORY_ICON_PACKS.map(item=><button type="button" key={item.id} className={pack===item.id?'active':''} aria-pressed={pack===item.id} onClick={()=>choosePack(item.id)} title={item.description}><span><b>{item.label}</b><small>{item.license}</small></span></button>)}
    </div>:null}
    <div className="category-icon-picker-mode">
      <button type="button" className={!value?'category-icon-option active':'category-icon-option'} aria-pressed={!value} onClick={()=>onChange(null)}><Sparkles size={17} aria-hidden="true"/><span><b>Αυτόματο</b><small>{automaticLabel??inheritedLabel??'Σημασιολογική αντιστοίχιση'}</small></span></button>
    </div>
    {legacySelection?<div className="category-icon-legacy-choice" aria-label="Αποθηκευμένο παλαιότερο εικονίδιο"><CategoryIconGlyph iconKey={value!} color={color} size={18}/><span>Η υπάρχουσα επιλογή διατηρείται. Οι νέες επιλογές παρακάτω είναι διαφορετικά σχέδια από την πλήρη βιβλιοθήκη.</span></div>:null}
    <label className="category-icon-search"><span className="sr-only">Αναζήτηση εικονιδίου</span><AppInputShell leading={<Search size={16}/>}><AppTextInput value={query} onChange={event=>setQuery(event.target.value)} placeholder="Αναζήτηση εικονιδίου (ελληνικά ή αγγλικά)…" aria-label="Αναζήτηση εικονιδίου"/></AppInputShell></label>
    <div className="category-icon-catalog-count" role="status" aria-live="polite">
      {error||((catalog?.pack===pack)?`${matches.length.toLocaleString('el-GR')} διαφορετικά εικονίδια · εμφανίζονται ${shown.length.toLocaleString('el-GR')}`:'Φόρτωση τοπικών εικονιδίων…')}
    </div>
    {error?<button type="button" className="category-icon-catalog-more" onClick={()=>{setError('');setRetry(value=>value+1);}}>Επανάληψη φόρτωσης</button>:null}
    <div className="category-icon-options" role="group" aria-label={`Εικονίδια ${CATEGORY_ICON_PACKS.find(item=>item.id===pack)?.label??pack}`}>
      {shown.map(name=>{
        const iconValue=encodeCategoryIconValue(pack,`icon/${name}`);
        return <button type="button" aria-pressed={value===iconValue} className={value===iconValue?'category-icon-option active':'category-icon-option'} key={name} onClick={()=>onChange(iconValue)} title={name.replaceAll('-',' ')}><CategoryIconGlyph iconKey={iconValue} color={color} size={18}/><span>{name.replaceAll('-',' ')}</span></button>;
      })}
    </div>
    {(catalog?.pack===pack)&&matches.length>shown.length?<button type="button" className="category-icon-catalog-more" onClick={()=>setVisibleCount(count=>count+PAGE_SIZE)}>Περισσότερα εικονίδια ({(matches.length-shown.length).toLocaleString('el-GR')} ακόμη)</button>:null}
    {(catalog?.pack===pack)&&matches.length===0?<p className="empty-inline" role="status">Δεν βρέθηκαν εικονίδια για αυτή την αναζήτηση.</p>:null}
  </div>;
}
