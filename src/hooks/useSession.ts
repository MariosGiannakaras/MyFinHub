import { useCallback, useEffect, useState } from 'react';
import { ApiError, enrollMfa as enrollMfaApi, getSession, login as loginApi, logout as logoutApi, verifyMfa as verifyMfaApi, type MfaEnrollment, type SessionInfo } from '../lib/api';

export type SessionState = 'loading' | 'authenticated' | 'anonymous' | 'mfa' | 'mfa-enroll';

export function useSession() {
  const [state, setState] = useState<SessionState>('loading');
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState('');

  const applySession = useCallback((session: SessionInfo) => {
    setEmail(session.email || null);
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
    } catch {
      setEmail(null);
      setState('anonymous');
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
        : 'Δεν ήταν δυνατή η ασφαλής σύνδεση. Δοκίμασε ξανά.';
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
    } catch {
      setError('Δεν ήταν δυνατή η ρύθμιση του Authenticator. Δοκίμασε ξανά.');
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
        : 'Δεν ήταν δυνατή η επαλήθευση. Δοκίμασε ξανά.');
      return false;
    }
  }, [applySession]);

  const logout = useCallback(async () => {
    try { await logoutApi(); } catch { /* Local session is cleared by the server whenever possible. */ }
    setEmail(null);
    setError('');
    setState('anonymous');
  }, []);

  return { state, email, error, login, enrollMfa, verifyMfa, logout, refresh };
}
