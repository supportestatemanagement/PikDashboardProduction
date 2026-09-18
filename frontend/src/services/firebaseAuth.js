import { signInWithCustomToken, signOut } from 'firebase/auth';
import { getFirebaseServices, getInitializedFirebaseAuth } from '../config/firebase';
import { dashboardRequest } from './dashboardSession';

// Serialize auth mutations so a late login cannot restore Firebase after logout.
let queue = Promise.resolve();
function serialize(operation) {
  const result = queue.then(operation, operation);
  queue = result.catch(() => {});
  return result;
}

export function connectFirebase(session, signal) {
  return serialize(async () => {
    const { auth } = getFirebaseServices();
    const checkCancelled = async () => {
      if (signal.aborted) {
        await signOut(auth);
        throw new DOMException('Cancelled', 'AbortError');
      }
    };
    await auth.authStateReady();
    await checkCancelled();
    // Validate the dashboard session even when a Firebase user is persisted.
    const { user } = await dashboardRequest('/api/session', session, signal);
    if (auth.currentUser) {
      try {
        const result = await auth.currentUser.getIdTokenResult();
        if (result.claims.role === 'dashboard' && result.claims.username === user.username) {
          await checkCancelled();
          return auth.currentUser;
        }
      } catch (error) { if (error.name === 'AbortError') throw error; }
      await signOut(auth);
    }
    const { firebaseToken, firebaseUid } = await dashboardRequest('/api/firebase-token', session, signal);
    await checkCancelled();
    const credential = await signInWithCustomToken(auth, firebaseToken);
    await checkCancelled();
    if (credential.user.uid !== firebaseUid) {
      await signOut(auth);
      throw new Error('Firebase identity mismatch');
    }
    return credential.user;
  });
}

export function disconnectFirebase() {
  return serialize(async () => {
    let auth = getInitializedFirebaseAuth();
    if (!auth) {
      try { auth = getFirebaseServices().auth; }
      catch { return; }
    }
    if (auth) { await auth.authStateReady(); await signOut(auth); }
  });
}
