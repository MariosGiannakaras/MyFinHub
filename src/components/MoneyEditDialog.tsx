import { X } from 'lucide-react';
import { useId } from 'react';
import { Button } from './Button';
import { DialogShell } from './DialogShell';
import { IconButton } from './IconButton';
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
  const titleId=useId();
  const descriptionId=useId();
  const errorId=useId();
  const cancel=()=>{if(!busy)onCancel()};
  const confirm=()=>{if(!busy)onConfirm()};
  const describedBy=error?`${descriptionId} ${errorId}`:descriptionId;

  return <DialogShell
    open={open}
    className="app-money-edit-dialog"
    role="dialog"
    ariaLabelledBy={titleId}
    ariaDescribedBy={describedBy}
    busy={busy}
    motionMode={motionMode}
    preferredFocus='[data-autofocus="true"]'
    onRequestClose={cancel}
  >
    <header><div><small>ΕΠΕΞΕΡΓΑΣΙΑ ΠΟΣΟΥ</small><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div><IconButton aria-label="Κλείσιμο επεξεργασίας ποσού" disabled={busy} onClick={cancel}><X aria-hidden="true"/></IconButton></header>
    <div className="settings-form app-money-edit-dialog-body">
      <label><span>{label}</span><MoneyInput data-autofocus="true" aria-label={label} value={value} onValueChange={onValueChange} invalid={Boolean(error)} aria-describedby={error?errorId:undefined}/></label>
      {error?<div id={errorId} className="form-error" role="alert" aria-live="assertive">{error}</div>:null}
    </div>
    <footer>
      <Button variant="secondary" disabled={busy} onClick={cancel}>{cancelLabel}</Button>
      <Button variant="primary" disabled={busy} onClick={confirm}>{confirmLabel}</Button>
    </footer>
  </DialogShell>;
}
