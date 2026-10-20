import {motion} from 'framer-motion';
import {History,X} from 'lucide-react';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useModalFocus} from '../hooks/useModalFocus';
import type {ChangeHistoryEntry,SaveState} from '../hooks/useFinance';
import {classifyHistoryPoints,historyAvailabilityMessage,reachableHistoryNavigation} from '../lib/historyView';
import {shortcutDisplay} from '../lib/shortcuts';
import {Button} from './Button';
import {IconButton} from './IconButton';

const historyPositionLabel=(position:'current'|'redo'|'stored')=>position==='current'?'Τρέχουσα κατάσταση':position==='redo'?'Αναιρεμένη · διαθέσιμη για επαναφορά':'Αποθηκευμένο σημείο';
const historyTime=(at:string)=>{if(!at)return 'Πρόσφατα';const date=new Date(at);return Number.isNaN(date.getTime())?'Πρόσφατα':date.toLocaleString('el-GR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});};

export default function HistoryDialog({onClose,reduce,history,saveState,savePending,historyAvailable,undoDepth,redoDepth,canUndo,canRedo,onUndo,onRedo,onNavigate}:{ 
  onClose:()=>void;reduce:boolean;history:ChangeHistoryEntry[];saveState:SaveState;savePending:boolean;historyAvailable:boolean;
  undoDepth:number;redoDepth:number;canUndo:boolean;canRedo:boolean;onUndo?:()=>void;onRedo?:()=>void;
  onNavigate?:(pointId:string)=>Promise<boolean>;
}){
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [navigating,setNavigating]=useState(false);
  const cancelRef=useRef<HTMLButtonElement|null>(null);
  const historyRef=useModalFocus<HTMLElement>(true,'button',()=>{if(!navigating)onClose()});
  const visibleHistory=classifyHistoryPoints(history.slice(0,100));
  const routes=useMemo(()=>reachableHistoryNavigation(visibleHistory,undoDepth,redoDepth),[history,undoDepth,redoDepth]);
  const canSelect=Boolean(onNavigate&&historyAvailable&&saveState==='saved'&&!savePending&&!navigating);
  const selected=selectedId&&canSelect?routes.get(selectedId):undefined;
  const target=selected?visibleHistory.find(item=>item.id===selectedId):undefined;
  const historyStatus=historyAvailabilityMessage({state:saveState,pending:savePending,available:historyAvailable,undoDepth,redoDepth});
  const dismissShortcut=shortcutDisplay('dismiss');
  useEffect(()=>{if(selectedId&&!navigating&&!routes.has(selectedId))setSelectedId(null)},[selectedId,navigating,routes]);
  useEffect(()=>{if(selected)cancelRef.current?.focus({preventScroll:true})},[selectedId,selected]);
  const performNavigation=async()=>{
    if(!selectedId||!selected||!onNavigate||navigating)return;
    setNavigating(true);
    try{await onNavigate(selectedId)}
    finally{setSelectedId(null);setNavigating(false)}
  };
  const close=()=>{if(!navigating)onClose()};
  return <motion.div className="command-backdrop" initial={reduce?false:{opacity:0}} animate={{opacity:1}} exit={reduce?undefined:{opacity:0}} onMouseDown={close}><motion.section ref={historyRef} className="command-palette surface-raised change-history-dialog" role="dialog" aria-modal="true" aria-labelledby="change-history-title" tabIndex={-1} initial={reduce?false:{opacity:0,y:14}} animate={{opacity:1,y:0}} exit={reduce?undefined:{opacity:0,y:10}} transition={{duration:reduce?0:.16}} onMouseDown={event=>event.stopPropagation()}>
    <header><div><span className="eyebrow">UNDO / REDO</span><h2 id="change-history-title">Ιστορικό αλλαγών</h2><p>Αποθηκευμένες οικονομικές καταστάσεις, συγχρονισμένες μεταξύ συσκευών. Μπορείς να επιλέξεις μόνο προσβάσιμο σημείο για ασφαλή μετακίνηση μετά από επιβεβαίωση. Το τρέχον σημείο και οι αναιρεμένες αλλαγές σημειώνονται χωριστά. Οι νέες περιγραφές της εφαρμογής παραλείπουν ονομασίες κατηγοριών. Παλαιότερα αποθηκευμένα σημεία μπορεί να τις περιλαμβάνουν, ενώ τα ποσά ενδέχεται να εμφανίζονται.</p></div><IconButton type="button" aria-label="Κλείσιμο ιστορικού" title={'Κλείσιμο · '+dismissShortcut} disabled={navigating} onClick={close}><X size={17}/></IconButton></header>
    <div className="command-result-meta"><span>{visibleHistory.length?visibleHistory.length+' αποθηκευμένα σημεία':'Δεν υπάρχουν διαθέσιμα σημεία'}</span><small>Έως 100 σημεία · 10 ημέρες</small></div>
    <p className="history-status" role="status" aria-live="polite">{navigating?'Μετακίνηση σε εξέλιξη. Κάθε βήμα επιβεβαιώνεται από τη βάση.':historyStatus}</p>
    <div className="command-results" role="list" aria-label="Πρόσφατες αλλαγές">{visibleHistory.length?visibleHistory.map(entry=>{
      const plan=routes.get(entry.id);
      const selectable=Boolean(plan&&onNavigate);
      const stateLabel=entry.position==='redo'&&!plan?'Αναιρεμένη · μη διαθέσιμη από την τρέχουσα κατάσταση':historyPositionLabel(entry.position);
      const label=<><div className="command-result-copy"><b>{entry.label}</b><small>{stateLabel}</small></div><small>{historyTime(entry.at)}</small></>;
      return <div role="listitem" key={entry.id} className="surface-inset history-row" data-history-state={entry.position} data-history-selectable={selectable?'true':'false'}>{selectable?<button type="button" className="history-row-choice" disabled={!canSelect} aria-label={'Μετάβαση: '+entry.label+' · '+plan!.pointIds.length+' βήματα'} onClick={()=>setSelectedId(entry.id)}>{label}</button>:<div className="history-row-static">{label}</div>}</div>;
    }):<div className="command-empty"><History size={20}/><div><b>Δεν υπάρχει ιστορικό ακόμη</b><span>Όταν επιβεβαιωθεί η πρώτη οικονομική αλλαγή από τη βάση, θα εμφανιστεί εδώ.</span></div></div>}</div>
    <footer className={selected?"history-footer-confirm":undefined}><span>Έως 100 σημεία για 10 ημέρες. Η εισαγωγή αρχείου δεν αναιρείται μέσω Undo/Redo. Η αρχειοθέτηση κάρτας διατηρεί τα στοιχεία της· μόνο η ξεχωριστή οριστική διαγραφή είναι μη αναστρέψιμη.</span>
      {selected&&target?<div className="history-jump-confirm" role="group" aria-label="Επιβεβαίωση μετακίνησης ιστορικού"><b>Μετάβαση στο επιλεγμένο σημείο;</b><p>{target.label} · {selected.pointIds.length} {selected.pointIds.length===1?'βήμα':'βήματα'} {selected.direction==='undo'?'πίσω':'μπροστά'}. Κάθε βήμα αποθηκεύεται χωριστά στη βάση. Αν διακοπεί, παραμένει η τελευταία επιβεβαιωμένη κατάσταση.</p><div className="history-jump-actions"><Button ref={cancelRef} type="button" variant="secondary" disabled={navigating} onClick={()=>setSelectedId(null)}>Ακύρωση</Button><Button type="button" variant="primary" disabled={navigating} onClick={()=>{void performNavigation()}}>Επιβεβαίωση μετάβασης</Button></div></div>:null}
      {!selected?<div className="history-actions">{onUndo?<Button type="button" variant="secondary" disabled={!canUndo||Boolean(selected)||navigating} onClick={onUndo}>Αναίρεση</Button>:null}{onRedo?<Button type="button" variant="secondary" disabled={!canRedo||Boolean(selected)||navigating} onClick={onRedo}>Επαναφορά</Button>:null}</div>:null}
    </footer>
  </motion.section></motion.div>;
}
