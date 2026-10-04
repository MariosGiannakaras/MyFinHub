import { Clock3, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError, changeAccountEmail, changeAccountPassword, getSession } from '../lib/api';
import { userErrorMessage } from '../lib/userMessage';
import { ACCOUNT_PASSWORD_MIN_LENGTH, accountPasswordPolicyError } from '../lib/passwordPolicy';
import { AppSelectInput } from './AppSelectInput';
import { AppTextInput } from './AppTextInput';
import { Button } from './Button';
import { DeviceAccessSettings } from './DeviceAccessSettings';
import './AccountSecuritySettings.css';

type AppLockState={supported:boolean;enabled:boolean;idleMinutes:number;failedAttempts:number;retryAfterMs:number};
type AppLockResult=AppLockState&{ok:boolean;error?:string};
type AppLockBridge={
  getAppLockState:()=>Promise<AppLockState>;
  setAppPin:(value:{pin:string})=>Promise<AppLockResult>;
  setAppLockTimeout:(minutes:number)=>Promise<AppLockResult>;
  disableAppPin:()=>Promise<AppLockResult>;
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
  const[newPin,setNewPin]=useState('');
  const[confirmPin,setConfirmPin]=useState('');
  const[displayEmail,setDisplayEmail]=useState(currentEmail||'');
  const[pendingEmail,setPendingEmail]=useState('');
  const[authMessage,setAuthMessage]=useState('');
  const[authMessageTone,setAuthMessageTone]=useState<'status'|'error'>('status');
  const[pinMessage,setPinMessage]=useState('');
  const[pinMessageTone,setPinMessageTone]=useState<'status'|'error'>('status');
  const[authBusy,setAuthBusy]=useState<'email'|'password'|null>(null);
  const[pinBusy,setPinBusy]=useState(false);
  const[lockState,setLockState]=useState<AppLockState>({supported:Boolean(bridge),enabled:false,idleMinutes:5,failedAttempts:0,retryAfterMs:0});
  const publishLockState=(next:AppLockState)=>{setLockState(next);window.dispatchEvent(new CustomEvent<AppLockState>('myfinhub:app-lock-state-changed',{detail:next}))};

  useEffect(()=>{
    if(currentEmail!==undefined){setDisplayEmail(currentEmail||'');return;}
    let alive=true;
    void getSession().then(session=>{if(alive)setDisplayEmail(session.email||'')}).catch(()=>{});
    return()=>{alive=false};
  },[currentEmail]);
  useEffect(()=>{
    if(!bridge){setLockState({supported:false,enabled:false,idleMinutes:5,failedAttempts:0,retryAfterMs:0});return;}
    let alive=true;
    void bridge.getAppLockState().then(state=>{if(alive)setLockState(state)}).catch(()=>{if(alive){setLockState({supported:false,enabled:false,idleMinutes:5,failedAttempts:0,retryAfterMs:0});setPinMessageTone('error');setPinMessage('Δεν ήταν δυνατή η ανάγνωση της ασφαλούς αποθήκευσης Windows.')}});
    return()=>{alive=false};
  },[bridge]);

  const submitEmail=async()=>{
    const email=newEmail.trim().toLowerCase();
    if(!email||!email.includes('@')){setAuthMessageTone('error');setAuthMessage('Συμπλήρωσε έγκυρο νέο email.');return;}
    setAuthBusy('email');setAuthMessageTone('status');setAuthMessage('');
    try{
      const result=await changeAccountEmail(email);
      if(result.pendingEmail){
        setPendingEmail(result.pendingEmail);
        setAuthMessageTone('status');setAuthMessage(`Η αλλαγή προς ${result.pendingEmail} καταχωρίστηκε. Ολοκλήρωσε τα email επιβεβαίωσης που θα σταλούν από την υπηρεσία σύνδεσης.`);
      }else{
        setDisplayEmail(result.email||email);setPendingEmail('');
        setAuthMessageTone('status');setAuthMessage('Το email πρόσβασης ενημερώθηκε.');
      }
      setNewEmail('');
    }catch(error){setAuthMessageTone('error');setAuthMessage(authError(error,'Δεν ήταν δυνατή η αλλαγή email. Δοκίμασε ξανά.'))}
    finally{setAuthBusy(null)}
  };

  const submitPassword=async()=>{
    if(!currentPassword){setAuthMessageTone('error');setAuthMessage('Συμπλήρωσε τον τρέχοντα κωδικό.');return;}
    const passwordError=accountPasswordPolicyError(newPassword);if(passwordError){setAuthMessageTone('error');setAuthMessage(passwordError);return;}
    if(newPassword!==confirmPassword){setAuthMessageTone('error');setAuthMessage('Η επιβεβαίωση του νέου κωδικού δεν ταιριάζει.');return;}
    if(newPassword===currentPassword){setAuthMessageTone('error');setAuthMessage('Ο νέος κωδικός πρέπει να είναι διαφορετικός από τον τρέχοντα.');return;}
    setAuthBusy('password');setAuthMessageTone('status');setAuthMessage('');
    try{
      await changeAccountPassword(currentPassword,newPassword);
      setAuthMessageTone('status');setAuthMessage('Ο κωδικός πρόσβασης ενημερώθηκε.');
      setCurrentPassword('');setNewPassword('');setConfirmPassword('');
    }catch(error){setAuthMessageTone('error');setAuthMessage(authError(error,'Δεν ήταν δυνατή η αλλαγή κωδικού. Δοκίμασε ξανά.'));setCurrentPassword('');}
    finally{setAuthBusy(null)}
  };

  const submitPin=async()=>{
    if(!bridge||!lockState.supported)return;
    if(newPin.length!==PIN_LENGTH||confirmPin.length!==PIN_LENGTH){setPinMessageTone('error');setPinMessage('Το PIN πρέπει να έχει ακριβώς 4 ψηφία.');return;}
    if(newPin!==confirmPin){setPinMessageTone('error');setPinMessage('Η επιβεβαίωση του PIN δεν ταιριάζει.');return;}
    setPinBusy(true);setPinMessageTone('status');setPinMessage('');
    try{
      const result=await bridge.setAppPin({pin:newPin});
      publishLockState(result);
      if(!result.ok){setPinMessageTone('error');setPinMessage(pinError(result));return;}
      setNewPin('');setConfirmPin('');
      setPinMessageTone('status');setPinMessage(lockState.enabled?'Το PIN της εφαρμογής άλλαξε.':`Το PIN ενεργοποιήθηκε. Το MyFinHub θα κλειδώνει μετά από ${idleLabel(result.idleMinutes)} αδράνειας.`);
    }catch{setPinMessageTone('error');setPinMessage('Η ασφαλής αποθήκευση του PIN δεν ολοκληρώθηκε.')}
    finally{setPinBusy(false)}
  };

  const setIdleTimeout=async(minutes:number)=>{
    if(!bridge||!lockState.enabled||pinBusy)return;
    setPinBusy(true);setPinMessageTone('status');setPinMessage('');
    try{
      const result=await bridge.setAppLockTimeout(minutes);publishLockState(result);
      setPinMessageTone(result.ok?'status':'error');setPinMessage(result.ok?`Το αυτόματο κλείδωμα ορίστηκε σε ${idleLabel(result.idleMinutes)}.`:pinError(result));
    }catch{setPinMessageTone('error');setPinMessage('Δεν ήταν δυνατή η αλλαγή του αυτόματου κλειδώματος.')}
    finally{setPinBusy(false)}
  };

  const disablePin=async()=>{
    if(!bridge||!lockState.supported||!lockState.enabled)return;
    setPinBusy(true);setPinMessageTone('status');setPinMessage('');
    try{
      const result=await bridge.disableAppPin();publishLockState(result);
      if(!result.ok){setPinMessageTone('error');setPinMessage(pinError(result));return;}
      setNewPin('');setConfirmPin('');setPinMessageTone('status');setPinMessage('Το PIN της εφαρμογής απενεργοποιήθηκε.');
    }catch{setPinMessageTone('error');setPinMessage('Η απενεργοποίηση του PIN δεν ολοκληρώθηκε.')}
    finally{setPinBusy(false)}
  };

  const lockNow=()=>{if(lockState.enabled)window.dispatchEvent(new Event('myfinhub:app-lock-now'))};

  return <div className="account-security-settings settings-tab-stack">
    <div className="account-security-heading">
      <h3>Χρήστης & Πρόσβαση</h3>
      <p>Διαχειρίσου την πρόσβαση και την ασφάλεια του λογαριασμού σου στο MyFinHub.</p>
    </div>

    <div className="account-security-grid">
      <section className="panel surface-raised account-security-card account-security-email-card">
        <div className="panel-head"><div><span>Αλλαγή email</span></div><Mail/></div>
        <div className="account-security-current-email"><span>Τρέχον email:</span><b>{displayEmail||'—'}</b></div>
        <label className="account-security-field"><span>Νέο email</span><AppTextInput type="email" autoComplete="email" value={newEmail} placeholder="neo@example.com" onChange={event=>setNewEmail(event.target.value)}/></label>
        {pendingEmail?<div className="account-security-pending"><Mail size={16}/><span>Εκκρεμεί επιβεβαίωση προς <b>{pendingEmail}</b>.</span></div>:null}
        <div className="account-security-actions"><Button type="button" variant="primary" disabled={Boolean(authBusy)} onClick={()=>void submitEmail()}>{authBusy==='email'?'Αποθήκευση…':'Αλλαγή email'}</Button></div>
      </section>

      <section className="panel surface-raised account-security-card account-security-password-card">
        <div className="panel-head"><div><span>Αλλαγή κωδικού</span></div><KeyRound/></div>
        <div className="account-security-password-grid">
          <label className="account-security-field"><span>Τρέχων κωδικός</span><AppTextInput type="password" autoComplete="current-password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)}/></label>
          <label className="account-security-field"><span>Νέος κωδικός</span><AppTextInput type="password" autoComplete="new-password" value={newPassword} onChange={event=>setNewPassword(event.target.value)}/><small>Τουλάχιστον {ACCOUNT_PASSWORD_MIN_LENGTH} χαρακτήρες με πεζό, κεφαλαίο, αριθμό και σύμβολο.</small></label>
          <label className="account-security-field account-security-password-confirm"><span>Επιβεβαίωση νέου κωδικού</span><AppTextInput type="password" autoComplete="new-password" value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)}/></label>
        </div>
        <div className="account-security-actions"><Button type="button" variant="primary" disabled={Boolean(authBusy)} onClick={()=>void submitPassword()}>{authBusy==='password'?'Αποθήκευση…':'Αλλαγή κωδικού'}</Button></div>
      </section>
    </div>

    {authMessage?<div className="logic-note compact account-security-message" role={authMessageTone==='error'?'alert':'status'} aria-live={authMessageTone==='error'?'assertive':'polite'}><ShieldCheck/><span>{authMessage}</span></div>:null}

    <section className="panel surface-raised account-security-card account-security-pin-card">
      <div className="panel-head"><div><span>PIN & αυτόματο κλείδωμα</span></div><LockKeyhole/></div>
      <div className="account-security-pin-status-compact">
        <ShieldCheck size={17}/>
        <b>{lockState.supported?(lockState.enabled?'Το PIN είναι ενεργό':'Το PIN είναι ανενεργό'):'Διαθέσιμο στην εφαρμογή Windows'}</b>
        <PinDots value={lockState.enabled?'1234':''}/>
      </div>
      <div className="account-security-pin-grid">
        <label className="account-security-field"><span>Νέο PIN</span><div className="account-security-pin-input"><AppTextInput aria-label="Νέο 4ψήφιο PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={PIN_LENGTH} value={newPin} disabled={!lockState.supported} onChange={event=>setNewPin(digits(event.target.value))}/><PinDots value={newPin}/></div></label>
        <label className="account-security-field"><span>Επιβεβαίωση PIN</span><div className="account-security-pin-input"><AppTextInput aria-label="Επιβεβαίωση 4ψήφιου PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={PIN_LENGTH} value={confirmPin} disabled={!lockState.supported} onChange={event=>setConfirmPin(digits(event.target.value))}/><PinDots value={confirmPin}/></div></label>
      </div>
      {lockState.enabled?<div className="account-security-idle-control"><div><Clock3 size={17}/><b>Κλείδωμα μετά από αδράνεια</b></div><AppSelectInput className="account-security-idle-select" aria-label="Χρόνος αυτόματου κλειδώματος" disabled={pinBusy} value={String(lockState.idleMinutes)} onChange={event=>void setIdleTimeout(Number(event.target.value))}>{IDLE_OPTIONS.map(minutes=><option key={minutes} value={String(minutes)}>{idleLabel(minutes)}</option>)}</AppSelectInput></div>:null}
      <div className="account-security-actions pin-actions">
        <Button type="button" variant="primary" disabled={pinBusy||!lockState.supported} onClick={()=>void submitPin()}>{pinBusy?'Αποθήκευση…':lockState.enabled?'Αλλαγή PIN':'Ενεργοποίηση PIN'}</Button>
        {lockState.enabled?<><Button type="button" variant="secondary" disabled={pinBusy} onClick={lockNow}>Κλείδωμα τώρα</Button><Button type="button" variant="secondary" className="danger-text" disabled={pinBusy} onClick={()=>void disablePin()}>Απενεργοποίηση PIN</Button></>:null}
      </div>
      {pinMessage?<div className="account-security-inline-message" role={pinMessageTone==='error'?'alert':'status'} aria-live={pinMessageTone==='error'?'assertive':'polite'}>{pinMessage}</div>:null}
    </section>

    <DeviceAccessSettings/>
  </div>;
}