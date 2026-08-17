import type { SaveState } from '../hooks/useFinance';

export function PersistenceNotice({saveState,onRecover}:{saveState:SaveState;onRecover:()=>void}){
  const label=saveState==='saved'?'Αποθηκεύτηκε':saveState==='saving'?'Αποθήκευση σε εξέλιξη':saveState==='conflict'?'Σύγκρουση έκδοσης':saveState==='error'?'Η αποθήκευση απέτυχε':'Φόρτωση';
  const help=saveState==='saved'?'Η ορατή κατάσταση έχει συγχρονιστεί με τη βάση.':saveState==='saving'?'Η αλλαγή φαίνεται άμεσα και αποθηκεύεται με ασφαλή revision check.':saveState==='conflict'?'Υπάρχει νεότερη έκδοση στη βάση. Οι νέες αλλαγές έχουν μπλοκαριστεί μέχρι να φορτώσεις την τελευταία έκδοση.':saveState==='error'?'Η ορατή αλλαγή μπορεί να υπάρχει μόνο τοπικά. Φόρτωσε ξανά τη βάση πριν συνεχίσεις.':'Έλεγχος κατάστασης.';
  return <div className={`persistence-notice ${saveState}`} role={saveState==='error'||saveState==='conflict'?'alert':'status'} aria-live="polite"><div><b>{label}</b><small>{help}</small></div>{saveState==='error'||saveState==='conflict'?<button type="button" className="secondary" onClick={onRecover}>Φόρτωση τελευταίας έκδοσης</button>:null}</div>;
}
