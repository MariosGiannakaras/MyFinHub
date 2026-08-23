import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useModalFocus } from '../hooks/useModalFocus';

export type ConfirmDialogTone='default'|'destructive';

export function ConfirmDialog({
  open,title,description,confirmLabel='Επιβεβαίωση',cancelLabel='Ακύρωση',tone='default',busy=false,motionMode='system',onConfirm,onCancel,
}:{
  open:boolean;title:string;description:string;confirmLabel?:string;cancelLabel?:string;tone?:ConfirmDialogTone;busy?:boolean;motionMode?:'system'|'reduced'|'full';onConfirm:()=>void;onCancel:()=>void;
}){
  const systemReduced=useReducedMotion();
  const reduce=Boolean(systemReduced)||motionMode==='reduced';
  const modalRef=useModalFocus<HTMLElement>(open,'[data-autofocus="true"]',()=>{if(!busy)onCancel()});
  const cancel=()=>{if(!busy)onCancel()};
  const confirm=()=>{if(!busy)onConfirm()};
  return <AnimatePresence>{open?<motion.div className="modal-backdrop" initial={reduce?false:{opacity:0}} animate={{opacity:1}} exit={reduce?undefined:{opacity:0}} onMouseDown={cancel}>
    <motion.section
      ref={modalRef}
      className="quick-modal app-confirm-dialog neo-raised"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="app-confirm-title"
      aria-describedby="app-confirm-description"
      aria-busy={busy||undefined}
      data-tone={tone}
      tabIndex={-1}
      initial={reduce?false:{opacity:0,scale:.97,y:12}}
      animate={{opacity:1,scale:1,y:0}}
      exit={reduce?undefined:{opacity:0,scale:.98,y:8}}
      transition={{duration:reduce?0:.18}}
      onMouseDown={event=>event.stopPropagation()}
    >
      <header><div><small>{tone==='destructive'?'ΕΠΙΒΕΒΑΙΩΣΗ ΕΝΕΡΓΕΙΑΣ':'ΕΠΙΒΕΒΑΙΩΣΗ'}</small><h2 id="app-confirm-title">{title}</h2><p id="app-confirm-description">{description}</p></div><button type="button" className="icon-button" aria-label="Κλείσιμο επιβεβαίωσης" disabled={busy} onClick={cancel}><X/></button></header>
      <footer>
        <button type="button" className="secondary" data-autofocus="true" disabled={busy} onClick={cancel}>{cancelLabel}</button>
        <button type="button" className={`save-button ${tone==='destructive'?'destructive-action':''}`.trim()} data-action-tone={tone} disabled={busy} onClick={confirm}>{confirmLabel}</button>
      </footer>
    </motion.section>
  </motion.div>:null}</AnimatePresence>;
}
