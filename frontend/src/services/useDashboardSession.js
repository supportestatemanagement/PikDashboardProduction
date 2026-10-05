import { useCallback, useEffect, useState } from 'react';
import { dashboardRequest, readDashboardSession, SESSION_KEY } from './dashboardSession';
import { disconnectFirebase } from './firebaseAuth';
import { isCrisisBroadcaster } from './crisisRoom';

export default function useDashboardSession() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [restoreError, setRestoreError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('cc_isLoggedIn');
    setSession(null);
    void disconnectFirebase().catch(() => {});
  }, []);
  const login = useCallback(data => {
    if (!data.sessionToken || !data.user || !(Number.isFinite(data.expiresAt) || (isCrisisBroadcaster(data.user) && data.expiresAt === null))) throw new Error('Missing dashboard session');
    const next = { sessionToken: data.sessionToken, expiresAt: data.expiresAt, user: data.user };
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    localStorage.removeItem('cc_isLoggedIn');
    setSession(next);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const saved = readDashboardSession();
    setChecking(true);
    setRestoreError(false);
    if (!saved) { logout(); setChecking(false); return () => controller.abort(); }
    dashboardRequest('/api/session', saved, controller.signal)
      .then(({ user }) => { if (!controller.signal.aborted) setSession({ ...saved, user }); })
      .catch(error => {
        if (controller.signal.aborted) return;
        if (error.code === 'session-expired') logout();
        else setRestoreError(true);
      })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [logout, attempt]);
  useEffect(() => {
    if (!session) return undefined;
    const controller = new AbortController();
    const persistent = isCrisisBroadcaster(session.user);
    const check = () => {
      if (!persistent && Date.now() >= session.expiresAt) { logout(); return; }
      dashboardRequest('/api/session', session, controller.signal).catch(error => {
        if (!controller.signal.aborted && error.code === 'session-expired') logout();
      });
    };
    const interval = setInterval(check, 60000);
    const expiry = persistent ? null : setTimeout(logout, Math.max(0, session.expiresAt - Date.now()));
    window.addEventListener('focus', check);
    return () => { controller.abort(); clearInterval(interval); clearTimeout(expiry); window.removeEventListener('focus', check); };
  }, [session, logout, login]);
  useEffect(() => {
    const changed = event => {
      if (event.key === SESSION_KEY) { setSession(null); setAttempt(value => value + 1); }
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);
  return { session, checking, restoreError, retry: () => setAttempt(value => value + 1), login, logout };
}
