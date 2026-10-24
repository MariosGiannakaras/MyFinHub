import { Check, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, getSession, getSharedAppLockState, recoverSharedAppLock, updateSharedAppLock } from '../lib/api';
import { setAppUnlockToken, getAppUnlockToken, clearAppUnlockToken } from '../lib/appUnlockToken';
import { AppTextInput } from './AppTextInput';
import { Button } from './Button';

type AppLockState={supported:boolean;enabled:boolean;idleMinutes:number;failedAttempts:number;retryAfterMs:number};
type VerifyResult=AppLockState&{ok:boolean;unlockToken?:string};
type AppLockBridge={
  getAppLockState:()=>Promise<AppLockState>;
  verifyAppPin:(pin:string)=>Promise<VerifyResult>;
};
type Phase='checking'|'unlocked'|'locked'|'error';
const PIN_LENGTH=4;
const digits=(value:string)=>value.replace(/\D/g,'').slice(0,PIN_LENGTH);

export function DesktopAppLockGate({children}:{children:ReactNode}){
  const bridge=typeof window==='undefined'?undefined:(window as unknown as {myFinHubDesktop?:AppLockBridge}).myFinHubDesktop;
  const[phase,setPhase]=useState<Phase>('checking');
  const[shared,setShared]=useState(false);
  const[lockState,setLockState]=useState<AppLockState>({supported:Boolean(bridge),enabled:false,idleMinutes:5,failedAttempts:0,retryAfterMs:0});
  const[everUnlocked,setEverUnlocked]=useState(false);
  const[pin,setPin]=useState('');
  const[recovering,setRecovering]=useState(false);
  const[recoveryEmail,setRecoveryEmail]=useState('');
  const[recoveryPassword,setRecoveryPassword]=useState('');
  const[recoveryTotp,setRecoveryTotp]=useState('');
  const[recoveryNewPin,setRecoveryNewPin]=useState('');
  const[recoveryConfirmPin,setRecoveryConfirmPin]=useState('');
  const[message,setMessage]=useState('');
  const[busy,setBusy]=useState(false);
  const[shake,setShake]=useState(false);
  const[success,setSuccess]=useState(false);
  const[blockedUntil,setBlockedUntil]=useState(0);
  const[tick,setTick]=useState(Date.now());
  const inputRef=useRef<HTMLInputElement|null>(null);
  const activeStateRef=useRef(lockState);
  activeStateRef.current=lockState;
  const retrySeconds=useMemo(()=>Math.max(0,Math.ceil((blockedUntil-tick)/1000)),[blockedUntil,tick]);

  const enterLockedState=useCallback((state?:AppLockState)=>{
    const stale=clearAppUnlockToken();
    if(stale)void updateSharedAppLock({action:'lock',unlockToken:stale}).catch(()=>{});
    if(state)setLockState(state);
    setPin('');setMessage('');setSuccess(false);setShake(false);
    setRecovering(false);setRecoveryPassword('');setRecoveryTotp('');setRecoveryNewPin('');setRecoveryConfirmPin('');
    setBlockedUntil(Date.now()+Math.max(0,state?.retryAfterMs??0));
    setTick(Date.now());setPhase('locked');
  },[]);

  useEffect(()=>{
    let alive=true;
    const inspect=async()=>{
      setPhase('checking');setMessage('');
      let verificationStage:'session'|'app-lock'='session';
      try{
        const session=await getSession();
        if(!alive)return;
        if(!session.authenticated){setPhase('unlocked');setEverUnlocked(true);return;}
        setRecoveryEmail(session.email||'');
        verificationStage='app-lock';
        const global=await getSharedAppLockState();
        if(!alive)return;
        if(global.enabled){
          setShared(true);
          const state={supported:true,enabled:true,idleMinutes:global.idleMinutes,failedAttempts:0,retryAfterMs:global.retryAfterMs};
          enterLockedState(state);
          return;
        }
        if(!bridge){setLockState({supported:true,enabled:false,idleMinutes:5,failedAttempts:0,retryAfterMs:0});setPhase('unlocked');setEverUnlocked(true);return;}
        const legacy=await bridge.getAppLockState();
        if(!alive)return;
        setShared(false);setLockState(legacy);
        if(legacy.supported&&legacy.enabled)enterLockedState(legacy);
        else{setPhase('unlocked');setEverUnlocked(true)}
      }catch(error){
        if(!alive)return;
        if(error instanceof ApiError&&error.status===401){setPhase('unlocked');setEverUnlocked(true);return;}
        setMessage(verificationStage==='session'
          ?'Δεν ήταν δυνατός ο έλεγχος της συνεδρίας. Η σύνδεση δεν είναι προσωρινά διαθέσιμη. Δεν εμφανίζονται οικονομικά δεδομένα.'
          :'Δεν ήταν δυνατός ο ασφαλής έλεγχος PIN. Δεν εμφανίζονται οικονομικά δεδομένα.');
        setPhase('error');
      }
    };
    void inspect();
    const lockNow=()=>{if(alive&&activeStateRef.current.enabled)enterLockedState(activeStateRef.current)};
    const lockStateChanged=(event:Event)=>{
      const state=(event as CustomEvent<AppLockState>).detail;
      if(!alive||!state)return;
      setLockState(state);
      if(state.enabled){
        setShared(true);
        // Changing the global PIN/timeout invalidates existing server tickets.
        // Never leave an already-mounted finance workspace visible after it.
        enterLockedState(state);
      }
    };
    const authenticated=()=>{if(alive)void inspect()};
    window.addEventListener('myfinhub:app-lock-now',lockNow);
    window.addEventListener('myfinhub:app-lock-state-changed',lockStateChanged);
    window.addEventListener('myfinhub:auth-completed',authenticated);
    return()=>{alive=false;window.removeEventListener('myfinhub:app-lock-now',lockNow);window.removeEventListener('myfinhub:app-lock-state-changed',lockStateChanged);window.removeEventListener('myfinhub:auth-completed',authenticated)};
  },[bridge,enterLockedState]);

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
    if(phase!=='unlocked'||!lockState.enabled||!everUnlocked)return;
    const delay=Math.max(1,lockState.idleMinutes)*60_000;
    let timer=0;
    let lastRefreshAt=0;
    const schedule=()=>{
      window.clearTimeout(timer);
      lastActivity=Date.now();
      timer=window.setTimeout(()=>enterLockedState(lockState),delay);
      const token=shared?getAppUnlockToken():'';
      if(token&&Date.now()-lastRefreshAt>=15000){
        lastRefreshAt=Date.now();
        void updateSharedAppLock({action:'touch',unlockToken:token}).catch(()=>window.dispatchEvent(new Event('myfinhub:app-lock-now')));
      }
    };
    const events:Array<keyof WindowEventMap>=['pointerdown','pointermove','keydown','touchstart','wheel'];
    const resume=()=>{if(document.visibilityState==='visible'&&Date.now()-lastActivity>=delay)enterLockedState(lockState)};
    let lastActivity=Date.now();
    for(const name of events)window.addEventListener(name,schedule,{passive:true});
    const pageHidden=()=>enterLockedState(lockState);
    document.addEventListener('visibilitychange',resume);
    window.addEventListener('pagehide',pageHidden);
    schedule();
    return()=>{window.clearTimeout(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('pagehide',pageHidden);for(const name of events)window.removeEventListener(name,schedule)};
  },[bridge,phase,lockState,shared,everUnlocked,enterLockedState]);

  const unlock=useCallback(async(candidate:string)=>{
    if((!bridge&&!shared)||busy||retrySeconds>0||candidate.length!==PIN_LENGTH)return;
    setBusy(true);setMessage('');setShake(false);
    try{
      const result=shared?await updateSharedAppLock({action:'verify',pin:candidate}):await bridge!.verifyAppPin(candidate);
      setLockState({...result,supported:true,failedAttempts:0});setBlockedUntil(Date.now()+Math.max(0,result.retryAfterMs));setTick(Date.now());
      if(result.ok){
        if(shared){
          if(!result.unlockToken||!(/^[a-zA-Z0-9_-]{43}$/.test(result.unlockToken)))throw new Error('INVALID_APP_UNLOCK_RECEIPT');
          setAppUnlockToken(result.unlockToken);
        }
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
  },[bridge,shared,busy,retrySeconds]);

  const recover=useCallback(async()=>{
    if(busy)return;
    if(recoveryNewPin.length!==PIN_LENGTH||recoveryNewPin!==recoveryConfirmPin||!/^[0-9]{6}$/.test(recoveryTotp)){
      setMessage('Συμπλήρωσε τον κωδικό TOTP και επιβεβαίωσε το νέο 4ψήφιο PIN.');return;
    }
    if(!recoveryEmail.trim()||!recoveryPassword){setMessage('Συμπλήρωσε το email και τον κωδικό πρόσβασης.');return}
    setBusy(true);setMessage('');
    try{
      const result=await recoverSharedAppLock({email:recoveryEmail.trim(),password:recoveryPassword,code:recoveryTotp,newPin:recoveryNewPin});
      if(!result.ok||!result.enabled)throw new Error('APP_LOCK_RECOVERY_NOT_CONFIRMED');
      // The recovery proof does not unlock the current tab. The new PIN
      // must be verified by the regular backend ticket-granting flow.
      setRecovering(false);setRecoveryPassword('');setRecoveryTotp('');setRecoveryNewPin('');setRecoveryConfirmPin('');
      setLockState({...result,supported:true,failedAttempts:0});
      setBlockedUntil(0);setTick(Date.now());
      setMessage('Το PIN άλλαξε. Πληκτρολόγησε το νέο PIN για να ξεκλειδώσεις.');
    }catch(error){
      setMessage(error instanceof ApiError&&error.status===429?'Πολλές προσπάθειες επαλήθευσης. Δοκίμασε αργότερα.':'Δεν ολοκληρώθηκε η ανάκτηση. Έλεγξε password, TOTP και νέα στοιχεία.');
    }finally{setBusy(false)}
  },[busy,recoveryEmail,recoveryPassword,recoveryTotp,recoveryNewPin,recoveryConfirmPin]);

  useEffect(()=>{
    if(pin.length!==PIN_LENGTH||busy||retrySeconds>0||phase!=='locked')return;
    const timer=window.setTimeout(()=>void unlock(pin),90);
    return()=>window.clearTimeout(timer);
  },[pin,busy,retrySeconds,phase,unlock]);

  // Unmount the financial workspace when locked; a blurred, mounted DOM is not a privacy boundary.
  const underlay=phase==='unlocked'
    ? <div className="desktop-app-lock-underlay">{children}</div>
    : <div className="desktop-app-lock-preview" aria-hidden="true"><div/><div/><div/></div>;

  if(phase==='unlocked')return <>{underlay}</>;

  return <div className="desktop-app-lock-root">
    {underlay}
    <div className="desktop-app-lock-screen" data-phase={phase}>
      {phase==='checking'?<section className="desktop-app-lock-card is-loading" aria-live="polite"><img src="/brand/icon-192.png" alt="MyFinHub"/><b>MyFinHub</b><span>Έλεγχος ασφαλούς κλειδώματος…</span><i className="desktop-app-lock-loader"/></section>:null}
      {phase==='error'?<section className="desktop-app-lock-card" role="alert"><div className="desktop-app-lock-icon"><ShieldCheck/></div><h1>Το κλείδωμα δεν είναι διαθέσιμο</h1><p>{message||'Το MyFinHub δεν μπορεί να επαληθεύσει την ασφαλή αποθήκευση της συσκευής.'}</p><Button type="button" variant="secondary" onClick={()=>location.reload()}>Δοκιμή ξανά</Button></section>:null}
      {phase==='locked'?<section className={`desktop-app-lock-card ${shake?'is-shaking':''} ${success?'is-success':''} ${message?'is-error':''}`} aria-labelledby="app-lock-title" data-entered-digits={pin.length}>
        <div className="desktop-app-lock-icon">{success?<Check/>:<LockKeyhole/>}</div>
        <span className="eyebrow">MYFINHUB LOCK</span>
        <h1 id="app-lock-title">Καλώς ήρθες ξανά</h1>
        <p>Η πρόσβαση στο MyFinHub είναι κλειδωμένη. Πληκτρολόγησε το 4ψήφιο PIN σου.</p>
        {recovering?<form className="desktop-app-lock-recovery" aria-busy={busy} onSubmit={event=>{event.preventDefault();void recover()}}>
          <p>Για νέο PIN απαιτείται νέα επαλήθευση κωδικού λογαριασμού και Authenticator (TOTP).</p>
          <label>Email<AppTextInput type="email" autoComplete="username" required maxLength={254} value={recoveryEmail} onChange={event=>setRecoveryEmail(event.target.value)} disabled={busy}/></label>
          <label>Κωδικός λογαριασμού<AppTextInput type="password" autoComplete="current-password" required value={recoveryPassword} onChange={event=>setRecoveryPassword(event.target.value)} disabled={busy}/></label>
          <label>Κωδικός Authenticator<AppTextInput type="text" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={recoveryTotp} onChange={event=>setRecoveryTotp(event.target.value.replace(/[^0-9]/g,'').slice(0,6))} disabled={busy}/></label>
          <div className="desktop-app-lock-recovery-pin-grid">
            <label>Νέο PIN<AppTextInput type="password" inputMode="numeric" autoComplete="off" required maxLength={4} value={recoveryNewPin} onChange={event=>setRecoveryNewPin(digits(event.target.value))} disabled={busy}/></label>
            <label>Επιβεβαίωση PIN<AppTextInput type="password" inputMode="numeric" autoComplete="off" required maxLength={4} value={recoveryConfirmPin} onChange={event=>setRecoveryConfirmPin(digits(event.target.value))} disabled={busy}/></label>
          </div>
          <div className="desktop-app-lock-feedback" role={message?'alert':'status'} aria-live="polite">{busy?'Έλεγχος νέας ταυτοποίησης…':message||'Ο παλιός κωδικός PIN δεν χρειάζεται.'}</div>
          <Button type="submit" variant="primary" disabled={busy}>Επαναφορά PIN</Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={()=>{setRecovering(false);setMessage('');setRecoveryPassword('');setRecoveryTotp('');setRecoveryNewPin('');setRecoveryConfirmPin('')}}>Πίσω στο ξεκλείδωμα</Button>
        </form>:<form aria-busy={busy} onSubmit={event=>{event.preventDefault();void unlock(pin)}}>
          <AppTextInput ref={inputRef} className="desktop-app-lock-input" aria-label="4ψήφιο PIN εφαρμογής" aria-describedby="app-lock-feedback" invalid={Boolean(message)} type="password" inputMode="numeric" autoComplete="off" autoFocus={false} maxLength={PIN_LENGTH} value={pin} disabled={busy||retrySeconds>0||success} onKeyDown={event=>{if(event.key==='Escape'){setPin('');setMessage('')}}} onChange={event=>{setPin(digits(event.target.value));if(message)setMessage('')}}/>
          <button type="button" className="desktop-app-lock-digits" aria-label="Εισαγωγή PIN" aria-describedby="app-lock-feedback" onClick={()=>inputRef.current?.focus()} disabled={retrySeconds>0||success}>
            {Array.from({length:PIN_LENGTH},(_,index)=><span key={index} className={index<pin.length?'is-filled':''}><i/></span>)}
          </button>
          <div className="desktop-app-lock-feedback" id="app-lock-feedback" role={message?'alert':'status'} aria-live={message?'assertive':'polite'}>
            {success?<span className="is-good">Ξεκλειδώθηκε</span>:retrySeconds>0?<span>Νέα προσπάθεια σε {retrySeconds} δευτ.</span>:busy?<span>Έλεγχος PIN…</span>:message?<span className="is-error">{message}</span>:<span>Το PIN επαληθεύεται στον λογαριασμό σου</span>}
          </div>
          {pin.length>0&&!busy&&!success?<button type="button" className="desktop-app-lock-clear" onClick={()=>{setPin('');setMessage('');inputRef.current?.focus()}}>Καθαρισμός PIN</button>:null}
          {shared&&!busy?<button type="button" className="desktop-app-lock-clear" onClick={()=>{setPin('');setMessage('');setRecovering(true)}}>Ξέχασα το PIN</button>:null}
        </form>}
        <small><ShieldCheck size={14}/> Κλείδωμα μετά από {lockState.idleMinutes} {lockState.idleMinutes===1?'λεπτό':'λεπτά'} αδράνειας.</small>
      </section>:null}
    </div>
  </div>;
}
