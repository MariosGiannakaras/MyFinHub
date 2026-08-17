import { useCallback, useEffect, useState } from 'react';
import { ApiError, enrollMfa as enrollMfaApi, getSession, login as loginApi, logout as logoutApi, verifyMfa as verifyMfaApi, type MfaEnrollment, type SessionInfo } from '../lib/api';

export type SessionState = 'loading' | 'authenticated' | 'anonymous' | 'mfa' | 'mfa-enroll' | 'error';

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

  const applySession = useCallback((session: SessionInfo) => {
    setEmail(session.email || null);
    setError('');
    if (session.authenticated) setState('authenticated');
    else if (session.mfaEnrollmentRequired) setState('mfa-enroll');
    else if (session.mfaRequired) setState('mfa');
    else setState('anonymous');
  }, []);

  const refresh = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      applySession(await getSession());
      return true;
    } catch (e) {
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
    const expired = () => { setEmail(null); setError(''); setState('anonymous'); };
    window.addEventListener('rheomiq:auth-expired', expired);
    return () => window.removeEventListener('rheomiq:auth-expired', expired);
  }, []);

  const login = useCallback(async (nextEmail: string, password: string) => {
    setError('');
    try {
      const session = await loginApi(nextEmail, password);
      applySession(session);
      return true;
    } catch (e) {
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
    setError('');
    try {
      return await enrollMfaApi();
    } catch (e) {
      setError(operationalMessage(e, 'Δεν ήταν δυνατή η ρύθμιση του Authenticator. Δοκίμασε ξανά.'));
      return null;
    }
  }, []);

  const verifyMfa = useCallback(async (code: string, factorId?: string) => {
    setError('');
    try {
      const session = await verifyMfaApi(code, factorId);
      applySession(session);
      return session.authenticated;
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'INVALID_MFA_CODE'
        ? 'Ο κωδικός επαλήθευσης δεν είναι σωστός.'
        : operationalMessage(e, 'Δεν ήταν δυνατή η επαλήθευση. Δοκίμασε ξανά.'));
      return false;
    }
  }, [applySession]);

  const logout = useCallback(async () => {
    setError('');
    try {
      await logoutApi();
      setEmail(null);
      setState('anonymous');
      return true;
    } catch (e) {
      setError(operationalMessage(e, 'Η αποσύνδεση δεν ολοκληρώθηκε. Η τρέχουσα συνεδρία παραμένει ενεργή. Δοκίμασε ξανά.'));
      return false;
    }
  }, []);

  return { state, email, error, login, enrollMfa, verifyMfa, logout, refresh };
}
