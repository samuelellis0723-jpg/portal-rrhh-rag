import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as auth from '../services/auth';
import { onUnauthenticated, setCsrfToken } from '../services/http';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);

  const clear = useCallback((message = '') => {
    setCsrfToken(null);
    setSession(null);
    setStatus('ready');
    setNotice(message);
  }, []);
  const accept = useCallback((data) => {
    setCsrfToken(data.csrf_token);
    setSession(data);
    setError('');
    setNotice('');
    setStatus('ready');
  }, []);

  useEffect(() => onUnauthenticated(() => clear('Tu sesión terminó. Inicia sesión de nuevo.')), [clear]);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setError('');
    auth.getSession(controller.signal).then((data) => {
      if (!controller.signal.aborted) accept(data);
    }).catch((failure) => {
      if (failure.name === 'AbortError') return;
      if (failure.status === 401) clear();
      else { setError(failure.message); setStatus('error'); }
    });
    return () => controller.abort();
  }, [attempt, accept, clear]);

  useEffect(() => {
    if (!session) return;
    const expires = Date.parse(session.expires_at);
    const expire = () => clear('Tu sesión venció. Inicia sesión de nuevo.');
    const timer = setTimeout(expire, Math.max(0, expires - Date.now()));
    // Comprobar la sesión al volver de otra pestaña: detecta logout o revocación externos.
    let pending = null;
    const check = () => {
      if (document.visibilityState !== 'visible' || pending) return;
      const controller = new AbortController();
      pending = controller;
      auth.getSession(controller.signal).then((data) => {
        if (!controller.signal.aborted) accept(data);
      }).catch(() => {
        // Un 401 activa el listener; una caída temporal no equivale a logout.
      }).finally(() => { pending = null; });
    };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearTimeout(timer);
      pending?.abort();
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [session, accept, clear]);

  async function signIn(email, password) { accept(await auth.login(email, password)); }
  async function signOut() {
    try { await auth.logout(); }
    catch (failure) { if (failure.status !== 401) throw failure; }
    clear('Cerraste sesión correctamente.');
  }

  return <SessionContext.Provider value={{ session, status, error, notice, signIn, signOut, retry: () => setAttempt((n) => n + 1) }}>
    {children}
  </SessionContext.Provider>;
}

export function useSession() { return useContext(SessionContext); }
