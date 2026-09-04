import { Check, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, getSession } from '../lib/api';
import './DesktopAppLockGate.css';

type AppLockState={supported:boolean;enabled:boolean;idleMinutes:number;failedAttempts:number;retryAfterMs:number};
type VerifyResult=AppLockState&{ok:boolean};
type AppLockBridge={
  getAppLockState:()=>Promise<AppLockState>;
  verifyAppPin:(pin:string)=>Promise<VerifyResult>;
};
type Phase='checking'|'unlocked'|'locked'|'error';
const PIN_LENGTH=4;
const digits=(value:string)=>value.replace(/\D/g,'').slice(0,PIN_LENGTH);

export function DesktopAppLockGate({children}:{children:ReactNode}){
  const bridge=typeof window==='undefined'?undefined:(window as unknown as {myFinHubDesktop?:AppLockBridge}).myFinHubDesktop;
  const[phase,setPhase]=useState<Phase>(bridge?'checking':'unlocked');
  const[lockState,setLockState]=useState<AppLockState>({supported:Boolean(bridge),enabled:false,idleMinutes:5,failedAttempts:0,retryAfterMs:0});
  const[everUnlocked,setEverUnlocked]=useState(!bridge);
  const[pin,setPin]=useState('');
  const[message,setMessage]=useState('');
  const[busy,setBusy]=useState(false);
  const[shake,setShake]=useState(false);
  const[success,setSuccess]=useState(false);
  const[blockedUntil,setBlockedUntil]=useState(0);
  const[tick,setTick]=useState(Date.now());
  const inputRef=useRef<HTMLInputElement|null>(null);
  const retrySeconds=useMemo(()=>Math.max(0,Math.ceil((blockedUntil-tick)/1000)),[blockedUntil,tick]);

  const enterLockedState=useCallback((state?:AppLockState)=>{
    if(state)setLockState(state);
    setPin('');setMessage('');setSuccess(false);setShake(false);
    setBlockedUntil(Date.now()+Math.max(0,state?.retryAfterMs??0));
    setTick(Date.now());setPhase('locked');
  },[]);

  useEffect(()=>{
    if(!bridge){setPhase('unlocked');setEverUnlocked(true);return;}
    let alive=true;
    const inspect=async()=>{
      setPhase('checking');setMessage('');
      try{
        const state=await bridge.getAppLockState();
        if(!alive)return;
        setLockState(state);
        if(!state.supported||!state.enabled){setPhase('unlocked');setEverUnlocked(true);return;}
        setBlockedUntil(Date.now()+Math.max(0,state.retryAfterMs));
        try{
          const session=await getSession();
          if(!alive)return;
          if(session.authenticated)enterLockedState(state);
          else{setPhase('unlocked');setEverUnlocked(true)}
        }catch(error){
          if(!alive)return;
          if(error instanceof ApiError&&error.status===401){setPhase('unlocked');setEverUnlocked(true)}
          else{setMessage('Δεν ήταν δυνατός ο ασφαλής έλεγχος της συνεδρίας. Το τοπικό κλείδωμα παραμένει ενεργό.');enterLockedState(state)}
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
        enterLockedState(state);
      }catch{if(alive){setMessage('Δεν ήταν δυνατή η ενεργοποίηση του τοπικού κλειδώματος.');setPhase('error')}}
    };
    const stateChanged=(event:Event)=>{
      const next=(event as CustomEvent<AppLockState>).detail;
      if(!alive||!next||typeof next.enabled!=='boolean')return;
      setLockState(next);
      setBlockedUntil(Date.now()+Math.max(0,next.retryAfterMs||0));
      if(!next.enabled&&phase==='locked'){setPin('');setPhase('unlocked');setEverUnlocked(true)}
    };
    window.addEventListener('myfinhub:app-lock-now',lockNow);
    window.addEventListener('myfinhub:app-lock-state-changed',stateChanged);
    return()=>{alive=false;window.removeEventListener('myfinhub:app-lock-now',lockNow);window.removeEventListener('myfinhub:app-lock-state-changed',stateChanged)};
  },[bridge,enterLockedState,phase]);

  useEffect(()=>{
    if(retrySeconds<=0)return;
    const timer=window.setInterval(()=>setTick(Date.now()),500);
    return()=>window.clearInterval(timer);
  },[retrySeconds]);

  useEffect(()=>{
    if(phase!=='locked'||retrySeconds>0)return;
    const frame=requestAnimationFrame(()=>inputRef.current?.focus());
    return()=>cancelAnimationFrame(frame);
  },[phase,retrySeconds]);

  useEffect(()=>{
    if(!bridge||phase!=='unlocked'||!lockState.enabled||!everUnlocked)return;
    const delay=Math.max(1,lockState.idleMinutes)*60_000;
    let timer=0;
    const schedule=()=>{
      window.clearTimeout(timer);
      timer=window.setTimeout(()=>enterLockedState(lockState),delay);
    };
    const events:Array<keyof WindowEventMap>=['pointerdown','pointermove','keydown','touchstart','wheel'];
    for(const name of events)window.addEventListener(name,schedule,{passive:true});
    schedule();
    return()=>{window.clearTimeout(timer);for(const name of events)window.removeEventListener(name,schedule)};
  },[bridge,phase,lockState,everUnlocked,enterLockedState]);

  const unlock=useCallback(async(candidate:string)=>{
    if(!bridge||busy||retrySeconds>0||candidate.length!==PIN_LENGTH)return;
    setBusy(true);setMessage('');setShake(false);
    try{
      const result=await bridge.verifyAppPin(candidate);
      setLockState(result);setBlockedUntil(Date.now()+Math.max(0,result.retryAfterMs));setTick(Date.now());
      if(result.ok){
        setSuccess(true);
        window.setTimeout(()=>{setPin('');setSuccess(false);setEverUnlocked(true);setPhase('unlocked')},190);
        return;
      }
      setPin('');setShake(true);
      window.setTimeout(()=>setShake(false),420);
      setMessage(result.retryAfterMs>0?'Πολλές λανθασμένες προσπάθειες. Το PIN κλειδώθηκε προσωρινά.':'Το PIN δεν είναι σωστό.');
    }catch{
      setPin('');setShake(true);window.setTimeout(()=>setShake(false),420);
      setMessage('Η επαλήθευση PIN δεν ολοκληρώθηκε.');
    }finally{setBusy(false)}
  },[bridge,busy,retrySeconds]);

  useEffect(()=>{
    if(pin.length!==PIN_LENGTH||busy||retrySeconds>0||phase!=='locked')return;
    const timer=window.setTimeout(()=>void unlock(pin),90);
    return()=>window.clearTimeout(timer);
  },[pin,busy,retrySeconds,phase,unlock]);

  const underlay=everUnlocked
    ? <div className={phase==='locked'?'desktop-app-lock-underlay is-obscured':'desktop-app-lock-underlay'} aria-hidden={phase==='locked'?true:undefined}>{children}</div>
    : <div className="desktop-app-lock-preview" aria-hidden="true"><div/><div/><div/></div>;

  if(phase==='unlocked')return <>{underlay}</>;

  return <div className="desktop-app-lock-root">
    {underlay}
    <div className="desktop-app-lock-screen" data-phase={phase}>
      {phase==='checking'?<section className="desktop-app-lock-card is-loading" aria-live="polite"><img src="/brand/icon-192.png" alt="MyFinHub"/><b>MyFinHub</b><span>Έλεγχος ασφαλούς κλειδώματος…</span><i className="desktop-app-lock-loader"/></section>:null}
      {phase==='error'?<section className="desktop-app-lock-card" role="alert"><div className="desktop-app-lock-icon"><ShieldCheck/></div><h1>Το κλείδωμα δεν είναι διαθέσιμο</h1><p>{message||'Το MyFinHub δεν μπορεί να επαληθεύσει την ασφαλή αποθήκευση της συσκευής.'}</p><button type="button" className="secondary" onClick={()=>location.reload()}>Δοκιμή ξανά</button></section>:null}
      {phase==='locked'?<section className={`desktop-app-lock-card ${shake?'is-shaking':''} ${success?'is-success':''}`} aria-labelledby="app-lock-title">
        <div className="desktop-app-lock-icon">{success?<Check/>:<LockKeyhole/>}</div>
        <span className="eyebrow">MYFINHUB LOCK</span>
        <h1 id="app-lock-title">Καλώς ήρθες ξανά</h1>
        <p>Βάλε το 4ψήφιο PIN για να συνεχίσεις.</p>
        <form onSubmit={event=>{event.preventDefault();void unlock(pin)}}>
          <input ref={inputRef} className="desktop-app-lock-input" aria-label="4ψήφιο PIN εφαρμογής" type="password" inputMode="numeric" autoComplete="off" maxLength={PIN_LENGTH} value={pin} disabled={busy||retrySeconds>0||success} onChange={event=>setPin(digits(event.target.value))}/>
          <button type="button" className="desktop-app-lock-digits" aria-label="Εισαγωγή PIN" onClick={()=>inputRef.current?.focus()} disabled={retrySeconds>0||success}>
            {Array.from({length:PIN_LENGTH},(_,index)=><span key={index} className={index<pin.length?'is-filled':''}><i/></span>)}
          </button>
          <div className="desktop-app-lock-feedback" aria-live="polite">
            {success?<span className="is-good">Ξεκλειδώθηκε</span>:retrySeconds>0?<span>Νέα προσπάθεια σε {retrySeconds} δευτ.</span>:busy?<span>Έλεγχος PIN…</span>:message?<span className="is-error">{message}</span>:<span>Το PIN μένει μόνο σε αυτή τη συσκευή</span>}
          </div>
        </form>
        <small><ShieldCheck size={14}/> Κλείδωμα μετά από {lockState.idleMinutes} {lockState.idleMinutes===1?'λεπτό':'λεπτά'} αδράνειας.</small>
      </section>:null}
    </div>
  </div>;
}
