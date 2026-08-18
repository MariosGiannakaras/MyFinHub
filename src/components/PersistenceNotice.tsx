import { useEffect, useRef, useState } from 'react';
import type { SaveState } from '../hooks/useFinance';

export function PersistenceNotice({saveState,onRecover}:{saveState:SaveState;onRecover:()=>void}){
  const previous=useRef<SaveState>(saveState);
  const [showSaved,setShowSaved]=useState(false);

  useEffect(()=>{
    let timer:number|undefined;
    if(saveState==='saved'&&previous.current!=='saved'){
      setShowSaved(true);
      timer=window.setTimeout(()=>setShowSaved(false),1400);
    }else if(saveState!=='saved')setShowSaved(false);
    previous.current=saveState;
    return()=>{if(timer)window.clearTimeout(timer)};
  },[saveState]);

  if(saveState==='error'||saveState==='conflict'){
    const conflict=saveState==='conflict';
    return <div className={`persistence-notice ${saveState}`} role="alert" aria-live="assertive"><div><b>{conflict?'Σύγκρουση έκδοσης':'Η αποθήκευση απέτυχε'}</b><small>{conflict?'Υπάρχει νεότερη έκδοση στη βάση. Οι νέες αλλαγές έχουν μπλοκαριστεί μέχρι να φορτώσεις την τελευταία έκδοση.':'Η ορατή αλλαγή μπορεί να υπάρχει μόνο τοπικά. Φόρτωσε ξανά τη βάση πριν συνεχίσεις.'}</small></div><button type="button" className="secondary" onClick={onRecover}>Φόρτωση τελευταίας έκδοσης</button></div>;
  }
  if(saveState==='loading')return <div className="persistence-toast loading" role="status" aria-live="polite">Ανανέωση δεδομένων…</div>;
  if(saveState==='saving')return <div className="persistence-toast saving" role="status" aria-live="polite">Αποθήκευση…</div>;
  if(showSaved)return <div className="persistence-toast persistence-notice saved" role="status" aria-live="polite">Αποθηκεύτηκε</div>;
  return null;
}
