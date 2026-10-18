import {motion} from 'framer-motion';
import {History,X} from 'lucide-react';
import {useModalFocus} from '../hooks/useModalFocus';
import type {ChangeHistoryEntry,SaveState} from '../hooks/useFinance';
import {classifyHistoryPoints,historyAvailabilityMessage} from '../lib/historyView';
import {shortcutDisplay} from '../lib/shortcuts';
import {Button} from './Button';
import {IconButton} from './IconButton';

const historyPositionLabel=(position:'current'|'redo'|'stored')=>position==='current'?'Τρέχουσα κατάσταση':position==='redo'?'Αναιρεμένη · διαθέσιμη για επαναφορά':'Αποθηκευμένο σημείο';
const historyTime=(at:string)=>{if(!at)return 'Πρόσφατα';const date=new Date(at);return Number.isNaN(date.getTime())?'Πρόσφατα':date.toLocaleString('el-GR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});};

export default function HistoryDialog({onClose,reduce,history,saveState,savePending,historyAvailable,undoDepth,redoDepth,canUndo,canRedo,onUndo,onRedo}:{
  onClose:()=>void;reduce:boolean;history:ChangeHistoryEntry[];saveState:SaveState;savePending:boolean;historyAvailable:boolean;
  undoDepth:number;redoDepth:number;canUndo:boolean;canRedo:boolean;onUndo?:()=>void;onRedo?:()=>void;
}){
  const historyRef=useModalFocus<HTMLElement>(true,'button',onClose);
  const visibleHistory=classifyHistoryPoints(history.slice(0,100));
  const historyStatus=historyAvailabilityMessage({state:saveState,pending:savePending,available:historyAvailable,undoDepth,redoDepth});
  const dismissShortcut=shortcutDisplay('dismiss');
  return <motion.div className="command-backdrop" initial={reduce?false:{opacity:0}} animate={{opacity:1}} exit={reduce?undefined:{opacity:0}} onMouseDown={()=>onClose()}><motion.section ref={historyRef} className="command-palette surface-raised change-history-dialog" role="dialog" aria-modal="true" aria-labelledby="change-history-title" tabIndex={-1} initial={reduce?false:{opacity:0,y:14}} animate={{opacity:1,y:0}} exit={reduce?undefined:{opacity:0,y:10}} transition={{duration:reduce?0:.16}} onMouseDown={event=>event.stopPropagation()}><header><div><span className="eyebrow">UNDO / REDO</span><h2 id="change-history-title">Ιστορικό αλλαγών</h2><p>Αποθηκευμένες οικονομικές καταστάσεις, συγχρονισμένες μεταξύ συσκευών. Το τρέχον σημείο και οι αναιρεμένες αλλαγές σημειώνονται χωριστά. Οι περιγραφές μπορεί να περιλαμβάνουν ποσά ή ονομασίες κατηγοριών.</p></div><IconButton type="button" aria-label="Κλείσιμο ιστορικού" title={`Κλείσιμο · ${dismissShortcut}`} onClick={()=>onClose()}><X size={17}/></IconButton></header><div className="command-result-meta"><span>{visibleHistory.length?`${visibleHistory.length} αποθηκευμένα σημεία`:'Δεν υπάρχουν διαθέσιμα σημεία'}</span><small>Έως 100 σημεία · 10 ημέρες</small></div><p className="history-status" role="status" aria-live="polite">{historyStatus}</p><div className="command-results" role="list" aria-label="Πρόσφατες αλλαγές">{visibleHistory.length?visibleHistory.map(entry=><div role="listitem" key={entry.id} className="surface-inset history-row" data-history-state={entry.position}><div className="command-result-copy"><b>{entry.label}</b><small>{historyPositionLabel(entry.position)}</small></div><small>{historyTime(entry.at)}</small></div>):<div className="command-empty"><History size={20}/><div><b>Δεν υπάρχει ιστορικό ακόμη</b><span>Όταν επιβεβαιωθεί η πρώτη οικονομική αλλαγή από τη βάση, θα εμφανιστεί εδώ.</span></div></div>}</div><footer><span>Έως 100 σημεία για 10 ημέρες. Η εισαγωγή αρχείου δεν έχει ακόμη εγγυημένη πλήρη αναίρεση. Η οριστική διαγραφή κωδικών κάρτας δεν μπορεί να ανακληθεί από το οικονομικό ιστορικό.</span><div className="history-actions">{onUndo?<Button type="button" variant="secondary" disabled={!canUndo} onClick={onUndo}>Αναίρεση</Button>:null}{onRedo?<Button type="button" variant="secondary" disabled={!canRedo} onClick={onRedo}>Επαναφορά</Button>:null}</div></footer></motion.section></motion.div>;
}
