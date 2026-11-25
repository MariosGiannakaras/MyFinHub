import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { OperationFeedback } from './OperationFeedback';
import { authScopeEpoch, assertCurrentAuthScope, subscribeAuthScopeReset } from '../lib/authScopedCache';
import { trackDatabaseWrite } from '../lib/databaseSaveActivity';
import type { ArtworkIntentTarget, PendingArtworkIntent } from '../lib/artworkIntentClient';

export default function ArtworkIntentReview({target,disabled,prepareRecovered}:{target:ArtworkIntentTarget;disabled?:boolean;
  prepareRecovered:(assetKey:string,scope:number)=>Promise<()=>void>}){
  const [pending,setPending]=useState<PendingArtworkIntent|null>(null);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const latch=useRef(false);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;const unsubscribe=subscribeAuthScopeReset(()=>{setPending(null);setMessage('')});
    return()=>{mounted.current=false;unsubscribe()}},[]);
  const run=async(action?:'acknowledge'|'cancel'|'retire')=>{
    if(disabled||latch.current)return;
    const scope=authScopeEpoch();
    latch.current=true;setBusy(true);setMessage('');
    try{
      const api=await import('../lib/artworkIntentClient.js');
      assertCurrentAuthScope(scope);
      if(!mounted.current)return;
      if(action&&pending){
        const identity={intentId:pending.intentId,assetKey:pending.assetKey};
        const apply=action==='acknowledge'?await prepareRecovered(identity.assetKey,scope):null;
        assertCurrentAuthScope(scope);
        if(!mounted.current)return;
        await trackDatabaseWrite(()=>api.resolveArtworkIntent(target,identity,action,scope));
        assertCurrentAuthScope(scope);
        if(!mounted.current)return;
        setPending(null);
        if(apply)apply();
        else setMessage('Η κράτηση έκλεισε χωρίς διαγραφή αρχείων. Αν η παλιά συνεδρία κρατά ακόμη τη θέση, επανασυνδέσου πριν επιλέξεις νέο αρχείο.');
      }else{
        const result=await api.readArtworkIntent(target,scope);
        if(!mounted.current||scope!==authScopeEpoch())return;
        setPending(result);
        if(!result)setMessage('Δεν βρέθηκε εκκρεμής μεταφόρτωση για αυτή τη θέση.');
      }
    }catch{
      if(mounted.current&&scope===authScopeEpoch())setMessage('Ο έλεγχος δεν επιβεβαιώθηκε. Έλεγξε ξανά πριν από νέα μεταφόρτωση.');
    }finally{
      latch.current=false;
      if(mounted.current)setBusy(false);
    }
  };
  return <div>
    <Button type="button" variant="ghost" disabled={disabled||busy} onClick={()=>void run()}>Έλεγχος εκκρεμούς εικόνας</Button>
    {message?<OperationFeedback tone="warning">{message}</OperationFeedback>:null}
    {pending?<OperationFeedback tone="warning">
      <div><strong>{pending.fileName}</strong></div>
      {pending.verifiedAsset?<><p>Η καταχώριση και τα bytes επιβεβαιώθηκαν. Η επιλογή δεν αποθηκεύει οικονομική εγγραφή.</p><Button disabled={disabled||busy} onClick={()=>void run('acknowledge')}>Χρήση καταχωρισμένης εικόνας</Button></>:
        !pending.dispatchClaimed?<><p>Η αποστολή δεν είχε δεσμευτεί. Μπορείς να ακυρώσεις την κράτηση.</p><Button disabled={disabled||busy} onClick={()=>void run('cancel')}>Ακύρωση κράτησης</Button></>:
        !pending.registrationRecorded?<><p>Η αποστολή ενδέχεται να εκκρεμεί. Η απόσυρση εμποδίζει μεταγενέστερη καταχώριση του ίδιου κλειδιού, χωρίς διαγραφή τυχόν αρχείου.</p><Button disabled={disabled||busy} onClick={()=>void run('retire')}>Απόσυρση εκκρεμούς κλειδιού</Button></>:
        <p>Υπάρχει καταγεγραμμένη εγγραφή αλλά η εικόνα δεν επιβεβαιώθηκε. Απαιτείται έλεγχος· δεν επιτρέπεται απόσυρση.</p>}
    </OperationFeedback>:null}
  </div>;
}
