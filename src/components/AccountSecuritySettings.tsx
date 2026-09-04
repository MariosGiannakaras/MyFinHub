import { KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError, changeAccountEmail, changeAccountPassword, getSession } from '../lib/api';
import { userErrorMessage } from '../lib/userMessage';
import './AccountSecuritySettings.css';

type AppLockState={supported:boolean;enabled:boolean;failedAttempts:number;retryAfterMs:number};
type AppLockResult=AppLockState&{ok:boolean;error?:string};
type AppLockBridge={
  getAppLockState:()=>Promise<AppLockState>;
  setAppPin:(value:{pin:string;currentPin?:string})=>Promise<AppLockResult>;
  disableAppPin:(pin:string)=>Promise<AppLockResult>;
};

const digits=(value:string)=>value.replace(/\D/g,'').slice(0,6);

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
  if(result.error==='INVALID_PIN_FORMAT')return 'Το PIN πρέπει να έχει ακριβώς 6 ψηφία.';
  return 'Η αλλαγή PIN δεν ολοκληρώθηκε.';
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
  const[lockState,setLockState]=useState<AppLockState>({supported:Boolean(bridge),enabled:false,failedAttempts:0,retryAfterMs:0});

  useEffect(()=>{
    if(currentEmail!==undefined){setDisplayEmail(currentEmail||'');return;}
    let alive=true;
    void getSession().then(session=>{if(alive)setDisplayEmail(session.email||'')}).catch(()=>{});
    return()=>{alive=false};
  },[currentEmail]);
  useEffect(()=>{
    if(!bridge){setLockState({supported:false,enabled:false,failedAttempts:0,retryAfterMs:0});return;}
    let alive=true;
    void bridge.getAppLockState().then(state=>{if(alive)setLockState(state)}).catch(()=>{if(alive){setLockState({supported:false,enabled:false,failedAttempts:0,retryAfterMs:0});setPinMessage('Δεν ήταν δυνατή η ανάγνωση της ασφαλούς αποθήκευσης Windows.')}});
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
        setAuthMessage('Το email του λογαριασμού ενημερώθηκε.');
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
      setAuthMessage('Ο κωδικός σύνδεσης ενημερώθηκε.');
      setCurrentPassword('');setNewPassword('');setConfirmPassword('');
    }catch(error){setAuthMessage(authError(error,'Δεν ήταν δυνατή η αλλαγή κωδικού. Δοκίμασε ξανά.'));setCurrentPassword('');}
    finally{setAuthBusy(null)}
  };

  const submitPin=async()=>{
    if(!bridge||!lockState.supported)return;
    if(newPin.length!==6||confirmPin.length!==6){setPinMessage('Το PIN πρέπει να έχει ακριβώς 6 ψηφία.');return;}
    if(newPin!==confirmPin){setPinMessage('Η επιβεβαίωση του PIN δεν ταιριάζει.');return;}
    if(lockState.enabled&&currentPin.length!==6){setPinMessage('Συμπλήρωσε το τρέχον PIN πριν το αλλάξεις.');return;}
    setPinBusy(true);setPinMessage('');
    try{
      const result=await bridge.setAppPin({pin:newPin,...(lockState.enabled?{currentPin}: {})});
      setLockState(result);
      if(!result.ok){setPinMessage(pinError(result));return;}
      setCurrentPin('');setNewPin('');setConfirmPin('');
      setPinMessage(lockState.enabled?'Το PIN της εφαρμογής άλλαξε.':'Το PIN της εφαρμογής ενεργοποιήθηκε. Θα ζητείται στην εκκίνηση όταν υπάρχει ήδη ενεργή συνεδρία.');
    }catch{setPinMessage('Η ασφαλής αποθήκευση του PIN δεν ολοκληρώθηκε.')}
    finally{setPinBusy(false)}
  };

  const disablePin=async()=>{
    if(!bridge||!lockState.supported||!lockState.enabled)return;
    if(currentPin.length!==6){setPinMessage('Συμπλήρωσε το τρέχον PIN για απενεργοποίηση.');return;}
    setPinBusy(true);setPinMessage('');
    try{
      const result=await bridge.disableAppPin(currentPin);setLockState(result);
      if(!result.ok){setPinMessage(pinError(result));return;}
      setCurrentPin('');setNewPin('');setConfirmPin('');setPinMessage('Το PIN της εφαρμογής απενεργοποιήθηκε.');
    }catch{setPinMessage('Η απενεργοποίηση του PIN δεν ολοκληρώθηκε.')}
    finally{setPinBusy(false)}
  };

  const lockNow=()=>{
    if(!lockState.enabled)return;
    window.dispatchEvent(new Event('myfinhub:app-lock-now'));
  };

  return <div className="account-security-settings settings-tab-stack">
    <section className="panel neo-raised account-security-overview">
      <div className="panel-head"><div><span>Λογαριασμός & ασφάλεια</span><small>Διαχειρίσου τα στοιχεία σύνδεσης και το τοπικό κλείδωμα της εφαρμογής χωρίς να αλλάζει η προστασία MFA.</small></div><ShieldCheck/></div>
      <div className="account-security-summary">
        <div><span>Email σύνδεσης</span><b>{displayEmail||'Συνδεδεμένος λογαριασμός'}</b></div>
        <div><span>Επαλήθευση</span><b>Authenticator · TOTP / MFA</b></div>
        <div><span>PIN εφαρμογής</span><b>{lockState.supported?(lockState.enabled?'Ενεργό σε αυτή τη συσκευή':'Ανενεργό'):'Windows Desktop'}</b></div>
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
        <div className="panel-head"><div><span>Αλλαγή κωδικού</span><small>Απαιτείται ο τρέχων κωδικός. Η υπάρχουσα συνεδρία παραμένει προστατευμένη και με MFA.</small></div><KeyRound/></div>
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
      <div className="panel-head"><div><span>PIN εφαρμογής</span><small>Τοπικό 6ψήφιο κλείδωμα για την εγκατεστημένη εφαρμογή Windows όταν παραμένεις συνδεδεμένος.</small></div><LockKeyhole/></div>
      <div className="account-security-pin-status">
        <div><span>Κατάσταση</span><b>{lockState.supported?(lockState.enabled?'Ενεργό':'Ανενεργό'):'Διαθέσιμο στην εφαρμογή Windows'}</b></div>
        <p>Το PIN δεν συγχρονίζεται και δεν αντικαθιστά τον κωδικό ή το Authenticator. Η συσκευή αποθηκεύει μόνο έναν scrypt verifier προστατευμένο με Windows DPAPI.</p>
      </div>
      <div className="account-security-pin-grid">
        {lockState.enabled?<label className="account-security-field"><span>Τρέχον PIN</span><input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={currentPin} onChange={event=>setCurrentPin(digits(event.target.value))}/></label>:null}
        <label className="account-security-field"><span>{lockState.enabled?'Νέο PIN':'Νέο PIN 6 ψηφίων'}</span><input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={newPin} disabled={!lockState.supported} onChange={event=>setNewPin(digits(event.target.value))}/></label>
        <label className="account-security-field"><span>Επιβεβαίωση PIN</span><input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={confirmPin} disabled={!lockState.supported} onChange={event=>setConfirmPin(digits(event.target.value))}/></label>
      </div>
      <div className="account-security-actions pin-actions">
        <button type="button" className="save-button" disabled={pinBusy||!lockState.supported} onClick={()=>void submitPin()}>{pinBusy?'Αποθήκευση…':lockState.enabled?'Αλλαγή PIN':'Ενεργοποίηση PIN'}</button>
        {lockState.enabled?<><button type="button" className="secondary" disabled={pinBusy} onClick={lockNow}>Κλείδωμα τώρα</button><button type="button" className="secondary danger-text" disabled={pinBusy} onClick={()=>void disablePin()}>Απενεργοποίηση PIN</button></>:null}
      </div>
      {pinMessage?<div className="account-security-inline-message" role="status" aria-live="polite">{pinMessage}</div>:null}
    </section>
  </div>;
}
