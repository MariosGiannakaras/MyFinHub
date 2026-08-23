import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useId } from 'react';
import { useModalFocus } from '../hooks/useModalFocus';
import { MoneyInput } from './MoneyInput';
import '../styles/money-edit-dialog.css';

export function MoneyEditDialog({
  open,
  title,
  description,
  label,
  value,
  error='',
  confirmLabel='Αποθήκευση',
  cancelLabel='Ακύρωση',
  busy=false,
  motionMode='system',
  onValueChange,
  onConfirm,
  onCancel,
}:{
  open:boolean;
  title:string;
  description:string;
  label:string;
  value:string;
  error?:string;
  confirmLabel?:string;
  cancelLabel?:string;
  busy?:boolean;
  motionMode?:'system'|'reduced'|'full';
  onValueChange:(value:string)=>void;
  onConfirm:()=>void;
  onCancel:()=>void;
}){
  const systemReduced=useReducedMotion();
  const reduce=Boolean(systemReduced)||motionMode==='reduced';
  const titleId=useId();
  const descriptionId=useId();
  const errorId=useId();
  const modalRef=useModalFocus<HTMLElement>(open,'[data-autofocus="true"]',()=>{if(!busy)onCancel()});
  const cancel=()=>{if(!busy)onCancel()};
  const confirm=()=>{if(!busy)onConfirm()};
  const describedBy=error?`${descriptionId} ${errorId}`:descriptionId;

  return <AnimatePresence>{open?<motion.div className="modal-backdrop" initial={reduce?false:{opacity:0}} animate={{opacity:1}} exit={reduce?undefined:{opacity:0}} onMouseDown={cancel}>
    <motion.section
      ref={modalRef}
      className="quick-modal app-money-edit-dialog neo-raised"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      aria-busy={busy||undefined}
      tabIndex={-1}
      initial={reduce?false:{opacity:0,scale:.97,y:12}}
      animate={{opacity:1,scale:1,y:0}}
      exit={reduce?undefined:{opacity:0,scale:.98,y:8}}
      transition={{duration:reduce?0:.18}}
      onMouseDown={event=>event.stopPropagation()}
    >
      <header><div><small>ΕΠΕΞΕΡΓΑΣΙΑ ΠΟΣΟΥ</small><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div><button type="button" className="icon-button" aria-label="Κλείσιμο επεξεργασίας ποσού" disabled={busy} onClick={cancel}><X aria-hidden="true"/></button></header>
      <div className="settings-form app-money-edit-dialog-body">
        <label><span>{label}</span><MoneyInput data-autofocus="true" value={value} onValueChange={onValueChange} invalid={Boolean(error)} aria-describedby={error?errorId:undefined}/></label>
        {error?<div id={errorId} className="form-error" role="alert" aria-live="assertive">{error}</div>:null}
      </div>
      <footer>
        <button type="button" className="secondary" disabled={busy} onClick={cancel}>{cancelLabel}</button>
        <button type="button" className="save-button" disabled={busy} onClick={confirm}>{confirmLabel}</button>
      </footer>
    </motion.section>
  </motion.div>:null}</AnimatePresence>;
}
