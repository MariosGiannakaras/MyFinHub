import type { SaveState } from '../hooks/useFinance';
import { Button } from './Button';

export function PersistenceNotice({saveState,errorMessage,onRecover,cleanupPending=0,cleanupBusy=false,cleanupError,onRetryCleanup}:{saveState:SaveState;errorMessage?:string|null;onRecover:()=>void;cleanupPending?:number;cleanupBusy?:boolean;cleanupError?:string|null;onRetryCleanup?:()=>void}){
  if(saveState==='error'||saveState==='conflict'){
    const conflict=saveState==='conflict';
    return <div className={`persistence-notice ${saveState}`} role="alert" aria-live="assertive"><div><b>{conflict?'Υπάρχουν νεότερα δεδομένα':'Η αποθήκευση δεν ολοκληρώθηκε'}</b><small>{conflict?'Υπάρχει νεότερη αποθηκευμένη έκδοση. Η αποθήκευση σταμάτησε για να μη γραφτεί πάνω της κατά λάθος. Φόρτωσε την τελευταία έκδοση πριν συνεχίσεις.':errorMessage||'Η τελευταία αλλαγή δεν έχει επιβεβαιωθεί ως αποθηκευμένη. Φόρτωσε την τελευταία αποθηκευμένη έκδοση πριν συνεχίσεις.'}</small></div><Button variant="secondary" type="button" onClick={onRecover}>Φόρτωση τελευταίας έκδοσης</Button></div>;
  }
  if(cleanupPending>0&&saveState==='saved')return <div className="persistence-notice conflict card-cleanup-notice" role={cleanupError?'alert':'status'} aria-live={cleanupError?'assertive':'polite'}><div><b>{cleanupBusy?'Καθαρισμός ασφαλών στοιχείων…':'Εκκρεμεί καθαρισμός ασφαλών στοιχείων κάρτας'}</b><small>{cleanupError||'Η διαγραφή του προφίλ έχει αποθηκευτεί. Ο καθαρισμός του κρυπτογραφημένου vault εκτελείται ξεχωριστά και μπορεί να επαναληφθεί με ασφάλεια.'}</small></div><Button variant="secondary" type="button" disabled={cleanupBusy||!onRetryCleanup} onClick={onRetryCleanup}>{cleanupBusy?'Καθαρισμός…':'Επανάληψη καθαρισμού'}</Button></div>;
  if(saveState==='loading')return <div className="persistence-toast loading" role="status" aria-live="polite">Ανανέωση δεδομένων…</div>;
  return null;
}