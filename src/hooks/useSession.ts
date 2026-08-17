import { useCallback, useEffect, useState } from 'react';
import { ApiError, getSession, login as loginApi, logout as logoutApi } from '../lib/api';

export type SessionState = 'loading' | 'authenticated' | 'anonymous';

export function useSession() {
  const [state, setState] = useState<SessionState>('loading');
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const session = await getSession();
      setEmail(session.email);
      setState('authenticated');
    } catch {
      setEmail(null);
      setState('anonymous');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const expired = () => { setEmail(null); setState('anonymous'); };
    window.addEventListener('rheomiq:auth-expired', expired);
    return () => window.removeEventListener('rheomiq:auth-expired', expired);
  }, []);

  const login = useCallback(async (nextEmail: string, password: string) => {
    setError('');
    try {
      const session = await loginApi(nextEmail, password);
      setEmail(session.email);
      setState('authenticated');
      return true;
    } catch (e) {
      const message = e instanceof ApiError && (e.status === 401 || e.status === 403)
        ? e.message
        : 'Δεν ήταν δυνατή η ασφαλής σύνδεση. Δοκίμασε ξανά.';
      setError(message);
      setState('anonymous');
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try { await logoutApi(); } catch { /* Local session is cleared by the server whenever possible. */ }
    setEmail(null);
    setState('anonymous');
  }, []);

  return { state, email, error, login, logout, refresh };
}
