import { useState, type FormEvent } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import type { MfaEnrollment } from '../lib/api';

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
    <section className="login-card neo-raised" aria-labelledby="mfa-title">
      <div className="login-brand"><img src="/brand/icon-192.png" alt=""/><div><div className="brand-word">Rheom<span>IQ</span></div><small>Private finance workspace</small></div></div>
      <div className="login-shield"><ShieldCheck size={24}/><span>Δεύτερος παράγοντας ασφαλείας</span></div>
      <div>
        <h1 id="mfa-title">{mode === 'enroll' ? 'Ρύθμιση Authenticator' : 'Επαλήθευση'}</h1>
        <p>{mode === 'enroll'
          ? 'Μία φορά μόνο: σύνδεσε το RheomIQ με την εφαρμογή Authenticator στο κινητό σου.'
          : `Άνοιξε το Authenticator και βάλε τον 6ψήφιο κωδικό${email ? ` για ${email}` : ''}.`}</p>
      </div>

      {mode === 'enroll' && !enrollment ? <button className="primary-action login-submit" type="button" disabled={busy} onClick={startEnrollment}>
        {busy ? 'Προετοιμασία…' : 'Εμφάνιση QR κωδικού'}
      </button> : null}

      {enrollment ? <div className="mfa-setup neo-inset">
        <img className="mfa-qr" src={enrollment.qrCode} alt="QR κωδικός για το RheomIQ Authenticator"/>
        <div><b>Αν δεν μπορείς να σκανάρεις το QR:</b><code className="mfa-secret">{enrollment.secret}</code></div>
      </div> : null}

      {(mode === 'challenge' || enrollment) ? <form onSubmit={submit} className="login-form">
        <label><span>6ψήφιος κωδικός</span><div className="login-input neo-inset"><KeyRound size={17}/><input
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
        /></div></label>
        {error ? <div className="login-error" role="alert">{error}</div> : null}
        <button className="primary-action login-submit" type="submit" disabled={busy || code.length !== 6}>{busy ? 'Επαλήθευση…' : 'Επαλήθευση'}</button>
      </form> : error ? <div className="login-error" role="alert">{error}</div> : null}

      <button className="ghost-button" type="button" disabled={busy} onClick={()=>void onLogout()}>Αποσύνδεση</button>
      <small className="login-footnote">Τα οικονομικά δεδομένα παραμένουν κλειδωμένα μέχρι να ολοκληρωθεί η επαλήθευση.</small>
    </section>
  </main>;
}
