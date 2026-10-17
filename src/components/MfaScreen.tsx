import { AlertCircle, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useRef, useState } from 'react';
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
  const [localError, setLocalError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const verificationInFlight = useRef(false);

  const startEnrollment = async () => {
    if (busy) return;
    setBusy(true);
    try { setEnrollment(await onEnroll()); }
    finally { setBusy(false); }
  };

  const changeCode = (value: string) => {
    if (verificationInFlight.current) return;
    const next = value.replace(/\D/g, '').slice(0, 6);
    setCode(next);
    setLocalError('');
    if (next.length !== 6) return;
    // The actual input event initiates verification; re-renders cannot retry a code.
    verificationInFlight.current = true;
    setBusy(true);
    void (async () => {
      let verified = false;
      try {
        verified = await onVerify(next, enrollment?.factorId);
      } catch {
        setLocalError('Η επαλήθευση δεν ολοκληρώθηκε. Πληκτρολόγησε νέο κωδικό.');
      } finally {
        verificationInFlight.current = false;
        setBusy(false);
        if (!verified) {
          setCode('');
          requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
        }
      }
    })();
  };
  const visibleError = localError || error;

  return <main className="login-screen">
    <section className="login-card surface-raised" aria-labelledby="mfa-title" data-busy={busy?'true':'false'}>
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

      {enrollment ? <div className="mfa-setup surface-inset">
        <img className="mfa-qr" src={enrollment.qrCode} alt="QR κωδικός για το MyFinHub Authenticator"/>
        <div><b>Αν δεν μπορείς να σκανάρεις το QR:</b><code className="mfa-secret">{enrollment.secret}</code></div>
      </div> : null}

      {(mode === 'challenge' || enrollment) ? <form onSubmit={event=>event.preventDefault()} className="login-form" aria-busy={busy}>
        <div className="login-field">
          <label htmlFor="mfa-code">6ψήφιος κωδικός</label>
          <AppInputShell className="login-input mfa-code-shell" leading={<KeyRound size={17}/>} invalid={Boolean(visibleError)}><AppTextInput
            id="mfa-code"
            ref={inputRef}
            className="mfa-code-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={e=>changeCode(e.target.value)}
            readOnly={busy}
            aria-busy={busy}
            required
            autoFocus
            invalid={Boolean(visibleError)}
            aria-describedby={visibleError?'mfa-error':'mfa-auto-hint'}
          /></AppInputShell>
          <div className="mfa-code-progress" aria-hidden="true">{Array.from({length:6},(_,index)=><i key={index} className={index<code.length?'filled':''}/>)}</div>
        </div>
        <small id="mfa-auto-hint" className="mfa-auto-status" role="status" aria-live="polite">
          {busy?<><LoaderCircle className="login-spinner" size={15} aria-hidden="true"/>Έλεγχος κωδικού…</>:'Ο έλεγχος γίνεται αυτόματα με το 6ο ψηφίο.'}
        </small>
        {visibleError ? <div id="mfa-error" className="login-error" role="alert"><AlertCircle size={16}/><span>{visibleError}</span></div> : null}
      </form> : error ? <div id="mfa-error" className="login-error" role="alert"><AlertCircle size={16}/><span>{error}</span></div> : null}

      <Button variant="ghost" className="ghost-button login-logout" type="button" disabled={busy} onClick={()=>void onLogout()}>Αποσύνδεση</Button>
      <small className="login-footnote">Τα οικονομικά δεδομένα παραμένουν κλειδωμένα μέχρι να ολοκληρωθεί η δεύτερη επαλήθευση ασφαλείας.</small>
    </section>
  </main>;
}
