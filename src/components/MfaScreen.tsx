import { AlertCircle, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { MfaEnrollment } from '../lib/api';
import { AppInputShell } from './AppInputShell';
import { AppTextInput } from './AppTextInput';
import { BrandMark } from './BrandMark';
import { Button } from './Button';

export function MfaScreen({
  mode,
  email,
  error,
  onEnroll,
  onVerify,
  onLogout,
}: {
  mode: 'enroll' | 'challenge';
  email: string | null;
  error: string;
  onEnroll: () => Promise<MfaEnrollment | null>;
  onVerify: (code: string, factorId?: string) => Promise<boolean>;
  onLogout: () => Promise<void>;
}) {
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const startEnrollment = async () => {
    if (busy) return;
    setBusy(true);
    try { setEnrollment(await onEnroll()); }
    finally { setBusy(false); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    try { await onVerify(code, enrollment?.factorId); }
    finally { setBusy(false); }
  };

  return <main className="login-screen">
    <section className="login-card neo-raised" aria-labelledby="mfa-title" data-busy={busy?'true':'false'}>
      <div className="login-brand"><BrandMark mode="lockup" size="lg" subtitle="Προσωπικός οικονομικός χώρος"/></div>
      <div className="login-shield"><ShieldCheck size={24}/><span>Δεύτερη επαλήθευση ασφαλείας</span></div>
      <div>
        <h1 id="mfa-title">{mode === 'enroll' ? 'Ρύθμιση Authenticator' : 'Επαλήθευση'}</h1>
        <p>{mode === 'enroll'
          ? 'Μία φορά μόνο: σύνδεσε το MyFinHub με την εφαρμογή Authenticator στο κινητό σου.'
          : `Άνοιξε το Authenticator και βάλε τον 6ψήφιο κωδικό${email ? ` για ${email}` : ''}.`}</p>
      </div>

      {mode === 'enroll' && !enrollment ? <Button variant="primary" className="login-submit" type="button" disabled={busy} aria-busy={busy} onClick={startEnrollment}>
        {busy?<LoaderCircle className="login-spinner" size={17} aria-hidden="true"/>:null}<span className="login-submit-label">{busy ? 'Προετοιμασία…' : 'Εμφάνιση QR κωδικού'}</span>
      </Button> : null}

      {enrollment ? <div className="mfa-setup neo-inset">
        <img className="mfa-qr" src={enrollment.qrCode} alt="QR κωδικός για το MyFinHub Authenticator"/>
        <div><b>Αν δεν μπορείς να σκανάρεις το QR:</b><code className="mfa-secret">{enrollment.secret}</code></div>
      </div> : null}

      {(mode === 'challenge' || enrollment) ? <form onSubmit={submit} className="login-form">
        <div className="login-field">
          <label htmlFor="mfa-code">6ψήφιος κωδικός</label>
          <AppInputShell className="login-input mfa-code-shell" leading={<KeyRound size={17}/>} invalid={Boolean(error)}><AppTextInput
            id="mfa-code"
            className="mfa-code-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
            disabled={busy}
            required
            autoFocus
            invalid={Boolean(error)}
            aria-describedby={error?'mfa-error':undefined}
          /></AppInputShell>
          <div className="mfa-code-progress" aria-hidden="true">{Array.from({length:6},(_,index)=><i key={index} className={index<code.length?'filled':''}/>)}</div>
        </div>
        {error ? <div id="mfa-error" className="login-error" role="alert"><AlertCircle size={16}/><span>{error}</span></div> : null}
        <Button variant="primary" className="login-submit" type="submit" disabled={busy || code.length !== 6} aria-busy={busy} data-state={busy?'loading':code.length===6?'ready':'idle'}>{busy?<LoaderCircle className="login-spinner" size={17} aria-hidden="true"/>:null}<span className="login-submit-label">{busy ? 'Επαλήθευση…' : 'Επαλήθευση'}</span></Button>
      </form> : error ? <div id="mfa-error" className="login-error" role="alert"><AlertCircle size={16}/><span>{error}</span></div> : null}

      <button className="ghost-button login-logout" type="button" disabled={busy} onClick={()=>void onLogout()}>Αποσύνδεση</button>
      <small className="login-footnote">Τα οικονομικά δεδομένα παραμένουν κλειδωμένα μέχρι να ολοκληρωθεί η δεύτερη επαλήθευση ασφαλείας.</small>
    </section>
  </main>;
}
