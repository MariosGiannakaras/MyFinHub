import { Clock3, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError, changeAccountEmail, changeAccountPassword, getSession } from '../lib/api';
import { userErrorMessage } from '../lib/userMessage';
import { DeviceAccessSettings } from './DeviceAccessSettings';
import './AccountSecuritySettings.css';

type AppLockState={supported:boolean;enabled:boolean;idleMinutes:number;failedAttempts:number;retryAfterMs:number};
type AppLockResult=AppLockState&{ok:boolean;error?:string};
type AppLockBridge={
  getAppLockState:()=>Promise<AppLockState>;
  setAppPin:(value:{pin:string;currentPin?:string})=>Promise<AppLockResult>;
  setAppLockTimeout:(minutes:number)=>Promise<AppLockResult>;
  disableAppPin:(pin:string)=>Promise<AppLockResult>;
};

const PIN_LENGTH=4;
const digits=(value:string)=>value.replace(/\D/g,'').slice(0,PIN_LENGTH);
const IDLE_OPTIONS=[1,5,15,30,60] as const;

function authError(error:unknown,fallback:string){
  if(error instanceof ApiError){
    if(error.status===429)return 'Έγιναν πολλές προσπάθειες. Δοκίμασε ξανά αργότερα.';
    if(error.status===503||error.status===504)return 'Η υπηρεσία σύνδεσης δεν είναι προσωρινά διαθέσιμη. Δοκίμασε ξανά.';
    if(error.code==='EMAIL_UNCHANGED')return 'Το νέο email είναι ίδιο με το τρέχον.';
    if(error.code==='INVALID_EMAIL')return 'Έλεγξε τη μορφή του νέου email.';
    if(error.code==='PASSWORD_UNCHANGED')return 'Ο νέος κωδικός πρέπει να είναι διαφορετικός από τον τρέχοντα.';
    if(error.code==='INVALID_CURRENT_PASSWORD'||error.code==='ACCOUNT_CHANGE_REJECTED')return 'Η αλλαγή απορρίφθηκε. Έλεγξε τον τρέχοντα κωδικό και τις απαιτήσεις ασφαλείας.';
    if(error.code==='INVALID_NEW_PASSWORD')return 'Ο νέος κωδικός δεν καλύπτει τις απαιτήσεις ασφαλείας.';
  }
  return userErrorMessage(error,fallback);
}

function pinError(result:AppLockResult){
  if(result.error==='INVALID_CURRENT_PIN')return 'Το τρέχον PIN δεν είναι σωστό.';
  if(result.error==='PIN_RATE_LIMITED')return 'Έγιναν πολλές λανθασμένες προσπάθειες PIN. Δοκίμασε ξανά όταν λήξει η προσωρινή καθυστέρηση.';
  if(result.error==='PIN_UNCHANGED')return 'Το νέο PIN πρέπει να είναι διαφορετικό από το τρέχον.';
  if(result.error==='INVALID_PIN_FORMAT')return 'Το PIN πρέπει να έχει ακριβώς 4 ψηφία.';
  if(result.error==='INVALID_IDLE_TIMEOUT')return 'Το διάστημα αυτόματου κλειδώματος δεν είναι έγκυρο.';
  return 'Η αλλαγή PIN δεν ολοκληρώθηκε.';
}

function idleLabel(minutes:number){return minutes===1?'1 λεπτό':`${minutes} λεπτά`}

function PinDots({value}:{value:string}){
  return <div className="account-security-pin-dots" aria-hidden="true">{Array.from({length:PIN_LENGTH},(_,index)=><i key={index} className={index<value.length?'is-filled':''}/>)}</div>;
}

export function AccountSecuritySettings({currentEmail}:{currentEmail?:string|null}){
  const bridge=typeof window==='undefined'?undefined:(window as unknown as {myFinHubDesktop?:AppLockBridge}).myFinHubDesktop;
  const[newEmail,setNewEmail]=useState('');
  const[currentPassword,setCurrentPassword]=useState('');
  const[newPassword,setNewPassword]=useState('');
  const[confirmPassword,setConfirmPassword]=useState('');
  const[currentPin,setCurrentPin]=useState('');
  const[newPin,setNewPin]=useState('');
  const[confirmPin,setConfirmPin]=useState('');
  const[displayEmail,setDisplayEmail]=useState(currentEmail||'');
  const[pendingEmail,setPendingEmail]=useState('');
  const[authMessage,setAuthMessage]=useState('');
  const[pinMessage,setPinMessage]=useState('');
  const[authBusy,setAuthBusy]=useState<'email'|'password'|null>(null);
  const[pinBusy,setPinBusy]=useState(false);
  const[lockState,setLockState]=useState<AppLockState>({supported:Boolean(bridge),enabled:false,idleMinutes:5,failedAttempts:0,retryAfterMs:0});

  useEffect(()=>{
    if(currentEmail!==undefined){setDisplayEmail(currentEmail||'');return;}
    let alive=true;
    void getSession().then(session=>{if(alive)setDisplayEmail(session.email||'')}).catch(()=>{});
    return()=>{alive=false};
  },[currentEmail]);
  useEffect(()=>{
    if(!bridge){setLockState({supported:false,enabled:false,idleMinutes:5,failedAttempts:0,retryAfterMs:0});return;}
    let alive=true;
    void bridge.getAppLockState().then(state=>{if(alive)setLockState(state)}).catch(()=>{if(alive){setLockState({supported:false,enabled:false,idleMinutes:5,failedAttempts:0,retryAfterMs:0});setPinMessage('Δεν ήταν δυνατή η ανάγνωση της ασφαλούς αποθήκευσης Windows.')}});
    return()=>{alive=false};
  },[bridge]);

  const submitEmail=async()=>{
    const email=newEmail.trim().toLowerCase();
    if(!email||!email.includes('@')){setAuthMessage('Συμπλήρωσε έγκυρο νέο email.');return;}
    setAuthBusy('email');setAuthMessage('');
    try{
      const result=await changeAccountEmail(email);
      if(result.pendingEmail){
        setPendingEmail(result.pendingEmail);
        setAuthMessage(`Η αλλαγή προς ${result.pendingEmail} καταχωρίστηκε. Ολοκλήρωσε τα email επιβεβαίωσης που θα σταλούν από την υπηρεσία σύνδεσης.`);
      }else{
        setDisplayEmail(result.email||email);setPendingEmail('');
        setAuthMessage('Το email πρόσβασης ενημερώθηκε.');
      }
      setNewEmail('');
    }catch(error){setAuthMessage(authError(error,'Δεν ήταν δυνατή η αλλαγή email. Δοκίμασε ξανά.'))}
    finally{setAuthBusy(null)}
  };

  const submitPassword=async()=>{
    if(currentPassword.length<8){setAuthMessage('Συμπλήρωσε τον τρέχοντα κωδικό.');return;}
    if(newPassword.length<8){setAuthMessage('Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.');return;}
    if(newPassword!==confirmPassword){setAuthMessage('Η επιβεβαίωση του νέου κωδικού δεν ταιριάζει.');return;}
    if(newPassword===currentPassword){setAuthMessage('Ο νέος κωδικός πρέπει να είναι διαφορετικός από τον τρέχοντα.');return;}
    setAuthBusy('password');setAuthMessage('');
    try{
      await changeAccountPassword(currentPassword,newPassword);
      setAuthMessage('Ο κωδικός πρόσβασης ενημερώθηκε.');
      setCurrentPassword('');setNewPassword('');setConfirmPassword('');
    }catch(error){setAuthMessage(authError(error,'Δεν ήταν δυνατή η αλλαγή κωδικού. Δοκίμασε ξανά.'));setCurrentPassword('');}
    finally{setAuthBusy(null)}
  };

  const submitPin=async()=>{
    if(!bridge||!lockState.supported)return;
    if(newPin.length!==PIN_LENGTH||confirmPin.length!==PIN_LENGTH){setPinMessage('Το PIN πρέπει να έχει ακριβώς 4 ψηφία.');return;}
    if(newPin!==confirmPin){setPinMessage('Η επιβεβαίωση του PIN δεν ταιριάζει.');return;}
    if(lockState.enabled&&currentPin.length!==PIN_LENGTH){setPinMessage('Συμπλήρωσε το τρέχον 4ψήφιο PIN πριν το αλλάξεις.');return;}
    setPinBusy(true);setPinMessage('');
    try{
      const result=await bridge.setAppPin({pin:newPin,...(lockState.enabled?{currentPin}:{})});
      setLockState(result);
      if(!result.ok){setPinMessage(pinError(result));return;}
      setCurrentPin('');setNewPin('');setConfirmPin('');
      setPinMessage(lockState.enabled?'Το PIN της εφαρμογής άλλαξε.':`Το PIN ενεργοποιήθηκε. Το MyFinHub θα κλειδώνει μετά από ${idleLabel(result.idleMinutes)} αδράνειας.`);
    }catch{setPinMessage('Η ασφαλής αποθήκευση του PIN δεν ολοκληρώθηκε.')}
    finally{setPinBusy(false)}
  };

  const setIdleTimeout=async(minutes:number)=>{
    if(!bridge||!lockState.enabled||pinBusy)return;
    setPinBusy(true);setPinMessage('');
    try{
      const result=await bridge.setAppLockTimeout(minutes);setLockState(result);
      setPinMessage(result.ok?`Το αυτόματο κλείδωμα ορίστηκε σε ${idleLabel(result.idleMinutes)}.`:pinError(result));
    }catch{setPinMessage('Δεν ήταν δυνατή η αλλαγή του αυτόματου κλειδώματος.')}
    finally{setPinBusy(false)}
  };

  const disablePin=async()=>{
    if(!bridge||!lockState.supported||!lockState.enabled)return;
    if(currentPin.length!==PIN_LENGTH){setPinMessage('Συμπλήρωσε το τρέχον 4ψήφιο PIN για απενεργοποίηση.');return;}
    setPinBusy(true);setPinMessage('');
    try{
      const result=await bridge.disableAppPin(currentPin);setLockState(result);
      if(!result.ok){setPinMessage(pinError(result));return;}
      setCurrentPin('');setNewPin('');setConfirmPin('');setPinMessage('Το PIN της εφαρμογής απενεργοποιήθηκε.');
    }catch{setPinMessage('Η απενεργοποίηση του PIN δεν ολοκληρώθηκε.')}
    finally{setPinBusy(false)}
  };

  const lockNow=()=>{if(lockState.enabled)window.dispatchEvent(new Event('myfinhub:app-lock-now'))};

  return <div className="account-security-settings settings-tab-stack">
    <section className="panel neo-raised account-security-overview">
      <div className="panel-head"><div><span>Πρόσβαση & ασφάλεια</span><small>Διαχειρίσου την ταυτότητα, τον κωδικό, το τοπικό κλείδωμα και τις συσκευές που έχουν πρόσβαση στο MyFinHub.</small></div><ShieldCheck/></div>
      <div className="account-security-summary">
        <div><span>Email πρόσβασης</span><b>{displayEmail||'Συνδεδεμένος χρήστης'}</b></div>
        <div><span>Επαλήθευση</span><b>Authenticator · MFA</b></div>
        <div><span>PIN εφαρμογής</span><b>{lockState.supported?(lockState.enabled?'Ενεργό · 4 ψηφία':'Ανενεργό'):'Windows Desktop'}</b></div>
        <div><span>Αυτόματο κλείδωμα</span><b>{lockState.enabled?idleLabel(lockState.idleMinutes):'—'}</b></div>
      </div>
      {pendingEmail?<div className="account-security-pending"><Mail size={16}/><span>Εκκρεμεί επιβεβαίωση αλλαγής email προς <b>{pendingEmail}</b>.</span></div>:null}
    </section>

    <div className="account-security-grid">
      <section className="panel neo-raised account-security-card">
        <div className="panel-head"><div><span>Αλλαγή email</span><small>Το νέο email γίνεται ενεργό μόνο αφού ολοκληρωθεί η ασφαλής διαδικασία επιβεβαίωσης.</small></div><Mail/></div>
        <label className="account-security-field"><span>Νέο email</span><input type="email" autoComplete="email" value={newEmail} placeholder="neo@example.com" onChange={event=>setNewEmail(event.target.value)}/></label>
        <div className="account-security-actions"><button type="button" className="save-button" disabled={Boolean(authBusy)} onClick={()=>void submitEmail()}>{authBusy==='email'?'Αποθήκευση…':'Αλλαγή email'}</button></div>
      </section>

      <section className="panel neo-raised account-security-card">
        <div className="panel-head"><div><span>Αλλαγή κωδικού</span><small>Απαιτείται ο τρέχων κωδικός. Η επαλήθευση MFA παραμένει ενεργή.</small></div><KeyRound/></div>
        <div className="account-security-password-grid">
          <label className="account-security-field"><span>Τρέχων κωδικός</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)}/></label>
          <label className="account-security-field"><span>Νέος κωδικός</span><input type="password" autoComplete="new-password" value={newPassword} onChange={event=>setNewPassword(event.target.value)}/></label>
          <label className="account-security-field"><span>Επιβεβαίωση νέου κωδικού</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)}/></label>
        </div>
        <small className="account-security-hint">Ελάχιστο 8 χαρακτήρες· προτείνεται μοναδικός κωδικός 12+ χαρακτήρων από password manager.</small>
        <div className="account-security-actions"><button type="button" className="save-button" disabled={Boolean(authBusy)} onClick={()=>void submitPassword()}>{authBusy==='password'?'Αποθήκευση…':'Αλλαγή κωδικού'}</button></div>
      </section>
    </div>

    {authMessage?<div className="logic-note compact account-security-message" role="status" aria-live="polite"><ShieldCheck/><span>{authMessage}</span></div>:null}

    <section className="panel neo-raised account-security-card account-security-pin-card">
      <div className="panel-head"><div><span>PIN & αυτόματο κλείδωμα</span><small>Γρήγορο 4ψήφιο κλείδωμα της εφαρμογής Windows όταν παραμένεις συνδεδεμένος.</small></div><LockKeyhole/></div>
      <div className="account-security-pin-status">
        <div><span>Κατάσταση</span><b>{lockState.supported?(lockState.enabled?'Ενεργό':'Ανενεργό'):'Διαθέσιμο στην εφαρμογή Windows'}</b></div>
        <div className="account-security-pin-preview"><PinDots value={lockState.enabled?'1234':''}/><p>Το πραγματικό PIN δεν εμφανίζεται και δεν συγχρονίζεται. Αποθηκεύεται μόνο scrypt verifier προστατευμένος με Windows DPAPI.</p></div>
      </div>
      <div className="account-security-pin-grid">
        {lockState.enabled?<label className="account-security-field"><span>Τρέχον PIN</span><div className="account-security-pin-input"><input aria-label="Τρέχον 4ψήφιο PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={PIN_LENGTH} value={currentPin} onChange={event=>setCurrentPin(digits(event.target.value))}/><PinDots value={currentPin}/></div></label>:null}
        <label className="account-security-field"><span>{lockState.enabled?'Νέο PIN':'Νέο PIN 4 ψηφίων'}</span><div className="account-security-pin-input"><input aria-label="Νέο 4ψήφιο PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={PIN_LENGTH} value={newPin} disabled={!lockState.supported} onChange={event=>setNewPin(digits(event.target.value))}/><PinDots value={newPin}/></div></label>
        <label className="account-security-field"><span>Επιβεβαίωση PIN</span><div className="account-security-pin-input"><input aria-label="Επιβεβαίωση 4ψήφιου PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={PIN_LENGTH} value={confirmPin} disabled={!lockState.supported} onChange={event=>setConfirmPin(digits(event.target.value))}/><PinDots value={confirmPin}/></div></label>
      </div>
      {lockState.enabled?<div className="account-security-idle-control"><div><Clock3 size={17}/><span><b>Κλείδωμα μετά από αδράνεια</b><small>Προεπιλογή 5 λεπτά. Η αλλαγή ισχύει μόνο σε αυτή τη συσκευή.</small></span></div><select aria-label="Χρόνος αυτόματου κλειδώματος" disabled={pinBusy} value={lockState.idleMinutes} onChange={event=>void setIdleTimeout(Number(event.target.value))}>{IDLE_OPTIONS.map(minutes=><option key={minutes} value={minutes}>{idleLabel(minutes)}</option>)}</select></div>:null}
      <div className="account-security-actions pin-actions">
        <button type="button" className="save-button" disabled={pinBusy||!lockState.supported} onClick={()=>void submitPin()}>{pinBusy?'Αποθήκευση…':lockState.enabled?'Αλλαγή PIN':'Ενεργοποίηση PIN'}</button>
        {lockState.enabled?<><button type="button" className="secondary" disabled={pinBusy} onClick={lockNow}>Κλείδωμα τώρα</button><button type="button" className="secondary danger-text" disabled={pinBusy} onClick={()=>void disablePin()}>Απενεργοποίηση PIN</button></>:null}
      </div>
      {pinMessage?<div className="account-security-inline-message" role="status" aria-live="polite">{pinMessage}</div>:null}
    </section>

    <DeviceAccessSettings/>
  </div>;
}
