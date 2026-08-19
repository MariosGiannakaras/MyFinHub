import { AlertCircle, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent, type KeyboardEvent } from 'react';

export function LoginScreen({ onLogin, error }:{ onLogin:(email:string,password:string)=>Promise<boolean>; error:string }) {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const [capsLock,setCapsLock]=useState(false);
  const ready=Boolean(email.trim())&&password.length>=8;

  const trackCaps=(event:KeyboardEvent<HTMLInputElement>)=>setCapsLock(event.getModifierState('CapsLock'));
  const submit=async(e:FormEvent)=>{
    e.preventDefault();
    if(busy||!ready)return;
    setBusy(true);
    try{await onLogin(email.trim(),password)}finally{setBusy(false)}
  };

  return <main className="login-screen">
    <section className="login-card neo-raised" aria-labelledby="login-title" data-busy={busy?'true':'false'}>
      <div className="login-brand"><img src="/brand/icon-192.png" alt=""/><div><div className="brand-word">MyFin<span>Hub</span></div><small>Private finance workspace</small></div></div>
      <div className="login-shield"><ShieldCheck size={24}/><span>Προστατευμένη συνεδρία μοναδικού ιδιοκτήτη</span></div>
      <div><h1 id="login-title">Σύνδεση</h1><p>Τα οικονομικά δεδομένα είναι διαθέσιμα μόνο στον εξουσιοδοτημένο ιδιοκτήτη.</p></div>
      <form onSubmit={submit} className="login-form" noValidate={false}>
        <div className="login-field">
          <label htmlFor="login-email">Email</label>
          <div className="login-input neo-inset"><KeyRound size={17}/><input id="login-email" type="email" autoComplete="username" inputMode="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={busy} aria-invalid={Boolean(error)}/></div>
        </div>
        <div className="login-field">
          <label htmlFor="login-password">Κωδικός</label>
          <div className="login-input neo-inset"><LockKeyhole size={17}/><input id="login-password" type={showPassword?'text':'password'} autoComplete="current-password" required minLength={8} maxLength={512} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={trackCaps} onKeyUp={trackCaps} onBlur={()=>setCapsLock(false)} disabled={busy} aria-invalid={Boolean(error)} aria-describedby={capsLock?'login-caps-hint':undefined}/><button type="button" className="login-password-toggle" aria-label={showPassword?'Απόκρυψη κωδικού':'Εμφάνιση κωδικού'} aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)} disabled={busy}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
          {capsLock?<small id="login-caps-hint" className="login-field-hint" role="status">Το Caps Lock είναι ενεργό.</small>:null}
        </div>
        {error?<div id="login-error" className="login-error" role="alert"><AlertCircle size={16}/><span>{error}</span></div>:null}
        <button className="primary-action login-submit" type="submit" disabled={busy||!ready} aria-busy={busy} data-state={busy?'loading':ready?'ready':'idle'}>{busy?<LoaderCircle className="login-spinner" size={17} aria-hidden="true"/>:null}<span className="login-submit-label">{busy?'Έλεγχος…':'Σύνδεση'}</span></button>
      </form>
      <small className="login-footnote">Η συνεδρία προστατεύεται με HttpOnly, Secure και SameSite cookie. Τα οικονομικά δεδομένα απαιτούν επιπλέον επαλήθευση MFA.</small>
    </section>
  </main>;
}
