import { useEffect, useState, useSyncExternalStore } from 'react';
import type { SaveState } from '../hooks/useFinance';
import { getDatabaseSaveSnapshot, subscribeDatabaseSaves } from '../lib/databaseSaveActivity';
import { resolveSaveProgressStatus, transitionSaveProgress, type SaveProgressPhase } from '../lib/saveProgressModel';

/** Real receipt-backed finance writes plus the app's independent DB write clients. */
export function SaveProgressBar({saveState,reducedMotion=false}:{saveState:SaveState;reducedMotion?:boolean}){
  const requests=useSyncExternalStore(subscribeDatabaseSaves,getDatabaseSaveSnapshot,getDatabaseSaveSnapshot);
  const status=resolveSaveProgressStatus(saveState,requests);
  const [phase,setPhase]=useState<SaveProgressPhase>(status==='saving'?'saving':status==='error'?'error':'idle');

  useEffect(()=>{setPhase(previous=>transitionSaveProgress(previous,status))},[status,requests.completion]);
  useEffect(()=>{
    if(phase!=='success')return;
    // Only the confirmed receipt's visual acknowledgement fades; never advance
    // or complete the bar on a timer while any write is still pending.
    const id=window.setTimeout(()=>setPhase(current=>current==='success'?'idle':current),1450);
    return()=>window.clearTimeout(id);
  },[phase,requests.completion]);

  if(phase==='idle')return null;
  const label=phase==='saving'?'Αποθήκευση σε εξέλιξη':phase==='success'?'Αποθηκεύτηκε στη βάση':saveState==='conflict'?'Σύγκρουση αλλαγών — δεν αποθηκεύτηκε':'Η αποθήκευση απέτυχε';
  return <div className={`save-progress-bar ${phase}${reducedMotion?' reduced':''}`} data-save-progress={phase} role={phase==='error'?'alert':'status'} aria-label={label} aria-live={phase==='error'?'assertive':'polite'}>
    <div className="save-progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={phase==='success'?100:undefined} aria-valuetext={label}><span className="save-progress-fill"/></div>
  </div>;
}
