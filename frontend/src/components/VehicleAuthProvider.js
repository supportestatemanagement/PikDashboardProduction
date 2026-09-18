import { createContext, useContext, useEffect, useState } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { connectFirebase, disconnectFirebase } from '../services/firebaseAuth';
import { getFirebaseServices } from '../config/firebase';

const VehicleAuth = createContext({ status: 'connecting', user: null });
export const useVehicleAuth = () => useContext(VehicleAuth);

export default function VehicleAuthProvider({ session, onSessionExpired, children }) {
  const [state, setState] = useState({ status: 'connecting', user: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let unsubscribe;
    setState({ status: 'connecting', user: null });
    connectFirebase(session, controller.signal).then(user => {
      if (controller.signal.aborted) return;
      setState({ status: 'ready', user });
      unsubscribe = onIdTokenChanged(getFirebaseServices().auth, async current => {
        try {
          const token = current ? await current.getIdTokenResult() : null;
          const matches = token?.claims.role === 'dashboard' && token?.claims.username === session.user.username;
          if (!controller.signal.aborted && getFirebaseServices().auth.currentUser === current) {
            setState({ status: matches ? 'ready' : 'error', user: matches ? current : null });
          }
        } catch {
          if (!controller.signal.aborted) setState({ status: 'error', user: null });
        }
      });
    }).catch(error => {
      if (controller.signal.aborted) return;
      setState({ status: 'error', user: null });
      if (error.code === 'session-expired') onSessionExpired();
    });
    return () => {
      controller.abort();
      unsubscribe?.();
      void disconnectFirebase().catch(() => {});
    };
  }, [session, onSessionExpired, attempt]);
  return <VehicleAuth.Provider value={{ ...state, retry: () => setAttempt(value => value + 1) }}>{children}</VehicleAuth.Provider>;
}
