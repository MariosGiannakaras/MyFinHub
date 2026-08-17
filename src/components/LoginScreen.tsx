import { useState, type FormEvent } from 'react';
import { KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';

export function LoginScreen({ onLogin, error }:{ onLogin:(email:string,password:string)=>Promise<boolean>; error:string }) {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);

  const submit=async(e:FormEvent)=>{
    e.preventDefault();
    if(busy)return;
    setBusy(true);
    try{await onLogin(email,password)}finally{setBusy(false)}
  };

  return <main className="login-screen">
    <section className="login-card neo-raised" aria-labelledby="login-title">
      <div className="login-brand"><img src="/brand/icon-192.png" alt=""/><div><div className="brand-word">Rheom<span>IQ</span></div><small>Private finance workspace</small></div></div>
      <div className="login-shield"><ShieldCheck size={24}/><span>Προστατευμένη συνεδρία μοναδικού ιδιοκτήτη</span></div>
      <div><h1 id="login-title">Σύνδεση</h1><p>Τα οικονομικά δεδομένα είναι διαθέσιμα μόνο στον εξουσιοδοτημένο ιδιοκτήτη.</p></div>
      <form onSubmit={submit} className="login-form">
        <label><span>Email</span><div className="login-input neo-inset"><KeyRound size={17}/><input type="email" autoComplete="username" inputMode="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></div></label>
        <label><span>Κωδικός</span><div className="login-input neo-inset"><LockKeyhole size={17}/><input type="password" autoComplete="current-password" required minLength={8} maxLength={512} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></div></label>
        {error?<div className="login-error" role="alert">{error}</div>:null}
        <button className="primary-action login-submit" type="submit" disabled={busy} aria-busy={busy}><span className="login-submit-label">{busy?'Έλεγχος…':'Σύνδεση'}</span></button>
      </form>
      <small className="login-footnote">Η συνεδρία προστατεύεται με HttpOnly, Secure και SameSite cookie. Τα οικονομικά δεδομένα απαιτούν επιπλέον επαλήθευση MFA.</small>
    </section>
  </main>;
}
