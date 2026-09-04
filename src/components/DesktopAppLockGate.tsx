import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, getSession } from '../lib/api';
import './DesktopAppLockGate.css';

type AppLockState={supported:boolean;enabled:boolean;failedAttempts:number;retryAfterMs:number};
type VerifyResult=AppLockState&{ok:boolean};
type AppLockBridge={
  getAppLockState:()=>Promise<AppLockState>;
  verifyAppPin:(pin:string)=>Promise<VerifyResult>;
};
type Phase='checking'|'unlocked'|'locked'|'error';
const digits=(value:string)=>value.replace(/\D/g,'').slice(0,6);

export function DesktopAppLockGate({children}:{children:ReactNode}){
  const bridge=typeof window==='undefined'?undefined:(window as unknown as {myFinHubDesktop?:AppLockBridge}).myFinHubDesktop;
  const[phase,setPhase]=useState<Phase>(bridge?'checking':'unlocked');
  const[pin,setPin]=useState('');
  const[message,setMessage]=useState('');
  const[busy,setBusy]=useState(false);
  const[blockedUntil,setBlockedUntil]=useState(0);
  const[tick,setTick]=useState(Date.now());
  const retrySeconds=useMemo(()=>Math.max(0,Math.ceil((blockedUntil-tick)/1000)),[blockedUntil,tick]);

  useEffect(()=>{
    if(!bridge){setPhase('unlocked');return;}
    let alive=true;
    const inspect=async()=>{
      setPhase('checking');setMessage('');
      try{
        const state=await bridge.getAppLockState();
        if(!alive)return;
        if(!state.supported||!state.enabled){setPhase('unlocked');return;}
        setBlockedUntil(Date.now()+Math.max(0,state.retryAfterMs));
        try{
          const session=await getSession();
          if(!alive)return;
          setPhase(session.authenticated?'locked':'unlocked');
        }catch(error){
          if(!alive)return;
          if(error instanceof ApiError&&error.status===401)setPhase('unlocked');
          else{setMessage('Δεν ήταν δυνατός ο ασφαλής έλεγχος της συνεδρίας. Το τοπικό κλείδωμα παραμένει ενεργό.');setPhase('locked')}
        }
      }catch{
        if(!alive)return;
        setMessage('Δεν ήταν δυνατή η ανάγνωση του ασφαλούς PIN από τα Windows.');setPhase('error');
      }
    };
    void inspect();
    const lockNow=async()=>{
      try{
        const state=await bridge.getAppLockState();
        if(!alive||!state.supported||!state.enabled)return;
        setPin('');setMessage('');setBlockedUntil(Date.now()+Math.max(0,state.retryAfterMs));setPhase('locked');
      }catch{if(alive){setMessage('Δεν ήταν δυνατή η ενεργοποίηση του τοπικού κλειδώματος.');setPhase('error')}}
    };
    window.addEventListener('myfinhub:app-lock-now',lockNow);
    return()=>{alive=false;window.removeEventListener('myfinhub:app-lock-now',lockNow)};
  },[bridge]);

  useEffect(()=>{
    if(retrySeconds<=0)return;
    const timer=window.setInterval(()=>setTick(Date.now()),500);
    return()=>window.clearInterval(timer);
  },[retrySeconds]);

  const unlock=async()=>{
    if(!bridge||busy||retrySeconds>0)return;
    if(pin.length!==6){setMessage('Συμπλήρωσε το 6ψήφιο PIN.');return;}
    setBusy(true);setMessage('');
    try{
      const result=await bridge.verifyAppPin(pin);
      setBlockedUntil(Date.now()+Math.max(0,result.retryAfterMs));setTick(Date.now());
      if(result.ok){setPin('');setPhase('unlocked');return;}
      setPin('');
      setMessage(result.retryAfterMs>0?'Πολλές λανθασμένες προσπάθειες. Το PIN έχει προσωρινά κλειδωθεί.':'Το PIN δεν είναι σωστό.');
    }catch{setPin('');setMessage('Η επαλήθευση PIN δεν ολοκληρώθηκε.')}
    finally{setBusy(false)}
  };

  if(phase==='unlocked')return <>{children}</>;
  if(phase==='checking')return <div className="desktop-app-lock-screen"><section className="desktop-app-lock-card neo-raised" aria-live="polite"><img src="/brand/icon-192.png" alt="MyFinHub"/><b>MyFinHub</b><span>Έλεγχος τοπικού κλειδώματος…</span></section></div>;
  if(phase==='error')return <div className="desktop-app-lock-screen"><section className="desktop-app-lock-card neo-raised" role="alert"><div className="desktop-app-lock-icon"><ShieldCheck/></div><h1>Το ασφαλές κλείδωμα δεν είναι διαθέσιμο</h1><p>{message||'Το MyFinHub δεν μπορεί να επαληθεύσει την ασφαλή αποθήκευση της συσκευής.'}</p><button type="button" className="secondary" onClick={()=>location.reload()}>Δοκιμή ξανά</button></section></div>;

  return <div className="desktop-app-lock-screen">
    <section className="desktop-app-lock-card neo-raised" aria-labelledby="app-lock-title">
      <div className="desktop-app-lock-icon"><LockKeyhole/></div>
      <span className="eyebrow">ΤΟΠΙΚΟ ΚΛΕΙΔΩΜΑ</span>
      <h1 id="app-lock-title">Ξεκλείδωσε το MyFinHub</h1>
      <p>Η συνεδρία σου είναι ακόμη ενεργή. Πληκτρολόγησε το 6ψήφιο PIN αυτής της συσκευής για να ανοίξεις τα οικονομικά σου στοιχεία.</p>
      <form onSubmit={event=>{event.preventDefault();void unlock()}}>
        <label><span>PIN εφαρμογής</span><input autoFocus type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} disabled={busy||retrySeconds>0} onChange={event=>setPin(digits(event.target.value))}/></label>
        {retrySeconds>0?<div className="desktop-app-lock-status" role="status">Νέα προσπάθεια σε {retrySeconds} δευτ.</div>:message?<div className="desktop-app-lock-status" role="alert">{message}</div>:null}
        <button type="submit" className="save-button" disabled={busy||pin.length!==6||retrySeconds>0}>{busy?'Έλεγχος…':'Ξεκλείδωμα'}</button>
      </form>
      <small><ShieldCheck size={14}/> Το PIN είναι τοπικό στη συσκευή και δεν αντικαθιστά τον κωδικό σύνδεσης ή το Authenticator.</small>
    </section>
  </div>;
}
