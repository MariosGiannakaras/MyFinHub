import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, enrollMfa as enrollMfaApi, getSession, login as loginApi, logout as logoutApi, verifyMfa as verifyMfaApi, type MfaEnrollment, type SessionInfo } from '../lib/api';
import { clearAppUnlockToken } from '../lib/appUnlockToken';

type SessionState = 'loading' | 'authenticated' | 'anonymous' | 'mfa' | 'mfa-enroll' | 'error';

function operationalMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  if (error.status === 429) return 'Έγιναν πολλές προσπάθειες. Περίμενε λίγο και δοκίμασε ξανά.';
  if (error.status === 503 || error.status === 504) return 'Η υπηρεσία σύνδεσης δεν είναι προσωρινά διαθέσιμη. Η συνεδρία σου δεν διαγράφηκε· δοκίμασε ξανά.';
  return fallback;
}

export function useSession() {
  const [state, setState] = useState<SessionState>('loading');
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState('');
  // Invalidate superseded AAL2 reads before they can reopen an expired workspace.
  const transitionEpoch = useRef(0);

  const applySession = useCallback((session: SessionInfo) => {
    if (!session.authenticated) clearAppUnlockToken();
    setEmail(session.email || null);
    setError('');
    if (session.authenticated) setState('authenticated');
    else if (session.mfaEnrollmentRequired) setState('mfa-enroll');
    else if (session.mfaRequired) setState('mfa');
    else setState('anonymous');
  }, []);

  const refresh = useCallback(async () => {
    const epoch = ++transitionEpoch.current;
    setState('loading');
    setError('');
    try {
      const next = await getSession();
      if (epoch !== transitionEpoch.current) return false;
      applySession(next);
      return true;
    } catch (e) {
      if (epoch !== transitionEpoch.current) return false;
      if (e instanceof ApiError && e.status === 401) {
        setEmail(null);
        setState('anonymous');
      } else {
        setError(operationalMessage(e, 'Δεν ήταν δυνατός ο έλεγχος της συνεδρίας. Δοκίμασε ξανά.'));
        setState('error');
      }
      return false;
    }
  }, [applySession]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const expired = () => {
      ++transitionEpoch.current;
      clearAppUnlockToken();
      setEmail(null); setError(''); setState('anonymous');
    };
    const mfaRequired = () => { void refresh(); };
    window.addEventListener('rheomiq:auth-expired', expired);
    window.addEventListener('rheomiq:mfa-required', mfaRequired);
    return () => {
      window.removeEventListener('rheomiq:auth-expired', expired);
      window.removeEventListener('rheomiq:mfa-required', mfaRequired);
    };
  }, [refresh]);

  const login = useCallback(async (nextEmail: string, password: string) => {
    const epoch = ++transitionEpoch.current;
    setError('');
    try {
      const session = await loginApi(nextEmail, password);
      if (epoch !== transitionEpoch.current) return false;
      applySession(session);
      if(session.authenticated)window.dispatchEvent(new Event('myfinhub:auth-completed'));
      return true;
    } catch (e) {
      if (epoch !== transitionEpoch.current) return false;
      const message = e instanceof ApiError && e.status === 401
        ? 'Λάθος στοιχεία σύνδεσης.'
        : operationalMessage(e, 'Δεν ήταν δυνατή η ασφαλής σύνδεση. Δοκίμασε ξανά.');
      setError(message);
      setEmail(null);
      setState('anonymous');
      return false;
    }
  }, [applySession]);

  const enrollMfa = useCallback(async (): Promise<MfaEnrollment | null> => {
    const epoch = transitionEpoch.current;
    setError('');
    try {
      const result = await enrollMfaApi();
      return epoch === transitionEpoch.current ? result : null;
    } catch (e) {
      if (epoch !== transitionEpoch.current) return null;
      setError(operationalMessage(e, 'Δεν ήταν δυνατή η ρύθμιση του Authenticator. Δοκίμασε ξανά.'));
      return null;
    }
  }, []);

  const verifyMfa = useCallback(async (code: string, factorId?: string) => {
    const epoch = ++transitionEpoch.current;
    setError('');
    try {
      const session = await verifyMfaApi(code, factorId);
      if (epoch !== transitionEpoch.current) return false;
      applySession(session);
      if(session.authenticated)window.dispatchEvent(new Event('myfinhub:auth-completed'));
      return session.authenticated;
    } catch (e) {
      if (epoch !== transitionEpoch.current) return false;
      setError(e instanceof ApiError && e.code === 'INVALID_MFA_CODE'
        ? 'Ο κωδικός επαλήθευσης δεν είναι σωστός.'
        : operationalMessage(e, 'Δεν ήταν δυνατή η επαλήθευση. Δοκίμασε ξανά.'));
      return false;
    }
  }, [applySession]);

  const logout = useCallback(async () => {
    const epoch = ++transitionEpoch.current;
    setError('');
    try {
      await logoutApi();
      if (epoch !== transitionEpoch.current) return false;
      setEmail(null);
      setState('anonymous');
      return true;
    } catch (e) {
      if (epoch !== transitionEpoch.current) return false;
      setError(operationalMessage(e, 'Η αποσύνδεση δεν ολοκληρώθηκε. Η τρέχουσα συνεδρία παραμένει ενεργή. Δοκίμασε ξανά.'));
      return false;
    }
  }, []);

  return { state, email, error, login, enrollMfa, verifyMfa, logout, refresh };
}
