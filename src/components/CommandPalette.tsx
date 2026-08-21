import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Clock3, CornerDownLeft, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useModalFocus } from '../hooks/useModalFocus';
import { searchCommandItems, type CommandSearchItem, type RankedCommandSearchItem } from '../lib/commandSearch';
import type { FinanceData } from '../types';

const RECENTS_KEY='myfinhub-command-recents-v1';
const kindLabel:Record<CommandSearchItem['kind'],string>={command:'Εντολή',transaction:'Συναλλαγή',account:'Λογαριασμός',card:'Κάρτα',loan:'Δάνειο / δόση',lending:'Δανεικά',recurring:'Πάγιο',scheduled:'Προγραμματισμένο',budget:'Budget'};
function readRecentIds(){try{const raw=sessionStorage.getItem(RECENTS_KEY);const parsed=raw?JSON.parse(raw):[];return Array.isArray(parsed)?parsed.filter(value=>typeof value==='string').slice(0,8):[]}catch{return []}}
function saveRecentIds(ids:string[]){try{sessionStorage.setItem(RECENTS_KEY,JSON.stringify(ids.slice(0,8)))}catch{/* storage can be unavailable in hardened/private contexts */}}

export function CommandPalette({open,data,motionMode='system',onClose,onExecute}:{open:boolean;data:FinanceData;motionMode?:'system'|'reduced'|'full';onClose:()=>void;onExecute:(item:RankedCommandSearchItem)=>void}){
 const systemReduced=useReducedMotion();const reduce=Boolean(systemReduced)||motionMode==='reduced';
 const[query,setQuery]=useState('');const[active,setActive]=useState(0);const[recentIds,setRecentIds]=useState<string[]>(readRecentIds);
 const results=useMemo(()=>searchCommandItems(data,query,{recentIds,limit:14}),[data,query,recentIds]);
 const modalRef=useModalFocus<HTMLElement>(open,'[data-command-input="true"]',onClose);
 useEffect(()=>{if(!open)return;setQuery('');setActive(0)},[open]);
 useEffect(()=>{if(active>=results.length)setActive(Math.max(0,results.length-1))},[active,results.length]);
 const run=(row:RankedCommandSearchItem|undefined)=>{if(!row)return;const next=[row.id,...recentIds.filter(id=>id!==row.id)].slice(0,8);setRecentIds(next);saveRecentIds(next);onExecute(row)};
 const onKeyDown=(event:React.KeyboardEvent<HTMLInputElement>)=>{
  if(event.key==='ArrowDown'){event.preventDefault();setActive(index=>results.length?(index+1)%results.length:0);return}
  if(event.key==='ArrowUp'){event.preventDefault();setActive(index=>results.length?(index-1+results.length)%results.length:0);return}
  if(event.key==='Home'){event.preventDefault();setActive(0);return}
  if(event.key==='End'){event.preventDefault();setActive(Math.max(0,results.length-1));return}
  if(event.key==='Enter'){event.preventDefault();run(results[active]);}
 };
 const activeId=results[active]?`command-option-${results[active].id.replace(/[^a-zA-Z0-9_-]/g,'-')}`:undefined;
 return <AnimatePresence>{open?<motion.div className="command-backdrop" initial={reduce?false:{opacity:0}} animate={{opacity:1}} exit={reduce?undefined:{opacity:0}} onMouseDown={onClose}>
  <motion.section ref={modalRef} className="command-palette neo-raised" role="dialog" aria-modal="true" aria-labelledby="command-palette-title" aria-describedby="command-palette-description" tabIndex={-1} initial={reduce?false:{opacity:0,scale:.98,y:-8}} animate={{opacity:1,scale:1,y:0}} exit={reduce?undefined:{opacity:0,scale:.985,y:-5}} transition={{duration:reduce?0:.16}} onMouseDown={event=>event.stopPropagation()}>
   <header><div><span className="eyebrow">COMMAND / SEARCH</span><h2 id="command-palette-title">Αναζήτηση & εντολές</h2><p id="command-palette-description">Βρες ενότητα ή εγγραφή και εκτέλεσε ασφαλείς ενέργειες. Ποσά και ευαίσθητα στοιχεία δεν εμφανίζονται στα αποτελέσματα.</p></div><button type="button" className="icon-button" aria-label="Κλείσιμο αναζήτησης" onClick={onClose}><X/></button></header>
   <div className="command-searchbox"><Search aria-hidden="true"/><input data-command-input="true" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="command-results" aria-activedescendant={activeId} aria-label="Αναζήτηση στο MyFinHub" placeholder="π.χ. μεταφορά, Netflix, Νίκος, δόση…" value={query} onChange={event=>{setQuery(event.target.value);setActive(0)}} onKeyDown={onKeyDown}/><kbd>Ctrl K</kbd></div>
   <div className="command-result-meta" aria-live="polite"><span>{query.trim()?`${results.length} αποτελέσματα`:'Γρήγορες και πρόσφατες ενέργειες'}</span><small>↑ ↓ επιλογή · Enter εκτέλεση</small></div>
   {results.length?<div id="command-results" className="command-results" role="listbox" aria-label="Αποτελέσματα αναζήτησης">{results.map((row,index)=>{const optionId=`command-option-${row.id.replace(/[^a-zA-Z0-9_-]/g,'-')}`;const recent=recentIds.includes(row.id);return <button id={optionId} role="option" aria-selected={index===active} tabIndex={-1} type="button" className={index===active?'active':''} key={row.id} onMouseEnter={()=>setActive(index)} onClick={()=>run(row)}><span className="command-result-icon" aria-hidden="true">{recent?<Clock3/>:<Search/>}</span><span className="command-result-copy"><b>{row.title}</b><small>{row.subtitle}</small></span><span className="command-result-kind">{kindLabel[row.kind]}</span><ArrowRight className="command-result-arrow" aria-hidden="true"/></button>})}</div>:<div className="command-empty" role="status"><Search/><div><b>Δεν βρέθηκε κάτι για «{query}».</b><span>Δοκίμασε όνομα, περιγραφή, λογαριασμό ή ενότητα. Για νέα κίνηση γράψε «νέα».</span></div></div>}
   <footer><span><CornerDownLeft/> Enter</span><span>Esc κλείσιμο</span><span>Δεν εμφανίζονται ποσά</span></footer>
  </motion.section>
 </motion.div>:null}</AnimatePresence>;
}
