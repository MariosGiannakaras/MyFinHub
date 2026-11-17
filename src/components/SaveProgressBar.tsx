import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { SaveState } from '../hooks/useFinance';
import { getDatabaseSaveSnapshot, subscribeDatabaseSaves } from '../lib/databaseSaveActivity';
import { resolveSaveProgressStatus, transitionSaveProgress, type SaveProgressPhase } from '../lib/saveProgressModel';

/** One shared app-wide indicator: never equate elapsed time or optimistic UI with a committed revision. */
export function SaveProgressBar({saveState,savePending=false,saveReceiptCount=0,reducedMotion=false}:{saveState:SaveState;savePending?:boolean;saveReceiptCount?:number;reducedMotion?:boolean}){
  const requests=useSyncExternalStore(subscribeDatabaseSaves,getDatabaseSaveSnapshot,getDatabaseSaveSnapshot);
  const status=resolveSaveProgressStatus(saveState,requests,savePending);
  const confirmedReceipts=saveReceiptCount+requests.completion;
  const [phase,setPhase]=useState<SaveProgressPhase>(status==='saving'?'saving':status==='error'?'error':'idle');
  const phaseRef=useRef<SaveProgressPhase>(phase);
  const startedAtReceipt=useRef(confirmedReceipts);

  useEffect(()=>{
    const previous=phaseRef.current;
    if(status==='saving'&&previous!=='saving')startedAtReceipt.current=confirmedReceipts;
    const newlyConfirmed=confirmedReceipts>startedAtReceipt.current;
    const next=transitionSaveProgress(previous,status,newlyConfirmed);
    if(status==='idle'&&next==='idle')startedAtReceipt.current=confirmedReceipts;
    phaseRef.current=next;
    setPhase(next);
  },[status,confirmedReceipts]);
  useEffect(()=>{
    if(phase!=='success')return;
    // Hide only the AFTER-receipt acknowledgement; never time a pending write.
    const id=window.setTimeout(()=>{
      if(phaseRef.current==='success'){phaseRef.current='idle';setPhase('idle')}
    },1450);
    return()=>window.clearTimeout(id);
  },[phase,confirmedReceipts]);

  if(phase==='idle')return null;
  const label=phase==='saving'?'Αποθήκευση σε εξέλιξη':phase==='success'?'Αποθηκεύτηκε στη βάση':saveState==='conflict'?'Σύγκρουση αλλαγών — δεν αποθηκεύτηκε':'Η αποθήκευση απέτυχε';
  return <div className={`save-progress-bar ${phase}${reducedMotion?' reduced':''}`} data-save-progress={phase} role={phase==='error'?'alert':'status'} aria-label={label} aria-live={phase==='error'?'assertive':'polite'}>
    <div className="save-progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={phase==='success'?100:undefined} aria-valuetext={label}><span className="save-progress-fill"/></div>
  </div>;
}
