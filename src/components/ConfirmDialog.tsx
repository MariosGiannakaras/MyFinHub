import { X } from 'lucide-react';
import { useId } from 'react';
import { Button } from './Button';
import { DialogShell } from './DialogShell';
import { IconButton } from './IconButton';
import '../styles/confirm-dialog.css';

export type ConfirmDialogTone='default'|'destructive';

export function ConfirmDialog({
  open,title,description,confirmLabel='Επιβεβαίωση',cancelLabel='Ακύρωση',tone='default',busy=false,motionMode='system',onConfirm,onCancel,
}:{
  open:boolean;title:string;description:string;confirmLabel?:string;cancelLabel?:string;tone?:ConfirmDialogTone;busy?:boolean;motionMode?:'system'|'reduced'|'full';onConfirm:()=>void;onCancel:()=>void;
}){
  const titleId=useId();
  const descriptionId=useId();
  const cancel=()=>{if(!busy)onCancel()};
  const confirm=()=>{if(!busy)onConfirm()};
  return <DialogShell
    open={open}
    className="app-confirm-dialog"
    role="alertdialog"
    ariaLabelledBy={titleId}
    ariaDescribedBy={descriptionId}
    busy={busy}
    motionMode={motionMode}
    preferredFocus='[data-autofocus="true"]'
    onRequestClose={cancel}
    dataAttributes={{'data-tone':tone}}
  >
    <header><div><small>{tone==='destructive'?'ΕΠΙΒΕΒΑΙΩΣΗ ΕΝΕΡΓΕΙΑΣ':'ΕΠΙΒΕΒΑΙΩΣΗ'}</small><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div><IconButton aria-label="Κλείσιμο επιβεβαίωσης" disabled={busy} onClick={cancel}><X aria-hidden="true"/></IconButton></header>
    <footer>
      <Button variant="secondary" data-autofocus="true" disabled={busy} onClick={cancel}>{cancelLabel}</Button>
      <Button variant={tone==='destructive'?'danger':'primary'} data-action-tone={tone} disabled={busy} onClick={confirm}>{confirmLabel}</Button>
    </footer>
  </DialogShell>;
}
