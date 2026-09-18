import { signInWithCustomToken, signOut } from 'firebase/auth';
import { getFirebaseServices, getInitializedFirebaseAuth } from '../config/firebase';
import { dashboardRequest } from './dashboardSession';
import { connectFirebase, disconnectFirebase } from './firebaseAuth';
jest.mock('firebase/auth', () => ({ signInWithCustomToken: jest.fn(), signOut: jest.fn() }));
jest.mock('../config/firebase', () => ({ getFirebaseServices: jest.fn(), getInitializedFirebaseAuth: jest.fn() }));
jest.mock('./dashboardSession', () => ({ dashboardRequest: jest.fn() }));
let auth;
beforeEach(() => {
  jest.clearAllMocks();
  auth = { authStateReady: jest.fn().mockResolvedValue(), currentUser: null };
  getFirebaseServices.mockReturnValue({ auth });
  getInitializedFirebaseAuth.mockReturnValue(auth);
  signOut.mockResolvedValue();
  dashboardRequest.mockImplementation(async path => path === '/api/session' ? { user: { username: 'ADMIN01' } } : { firebaseToken: 'custom', firebaseUid: 'dashboard_ADMIN01' });
  signInWithCustomToken.mockResolvedValue({ user: { uid: 'dashboard_ADMIN01' } });
});
test('exchanges only backend custom token after validating dashboard session', async () => {
  await connectFirebase({ sessionToken: 'signed-session' }, new AbortController().signal);
  expect(signInWithCustomToken).toHaveBeenCalledWith(auth, 'custom');
  expect(dashboardRequest.mock.calls.map(call => call[0])).toEqual(['/api/session', '/api/firebase-token']);
});
test('reuses a valid matching persisted Firebase session', async () => {
  auth.currentUser = { uid: 'dashboard_ADMIN01', getIdTokenResult: jest.fn().mockResolvedValue({ claims: { role: 'dashboard', username: 'ADMIN01' } }) };
  expect(await connectFirebase({}, new AbortController().signal)).toBe(auth.currentUser);
  expect(signInWithCustomToken).not.toHaveBeenCalled();
  expect(dashboardRequest).toHaveBeenCalledTimes(1);
});
test('expired dashboard session cannot sign in to Firebase', async () => {
  dashboardRequest.mockRejectedValue(Object.assign(new Error('expired'), { code: 'session-expired' }));
  await expect(connectFirebase({}, new AbortController().signal)).rejects.toMatchObject({ code: 'session-expired' });
  expect(signInWithCustomToken).not.toHaveBeenCalled();
});
test('late sign-in is signed out when dashboard logs out', async () => {
  const controller = new AbortController();
  signInWithCustomToken.mockImplementation(async () => { controller.abort(); return { user: { uid: 'dashboard_ADMIN01' } }; });
  await expect(connectFirebase({}, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  await disconnectFirebase();
  expect(signOut).toHaveBeenCalledWith(auth);
});
test('a different persisted user is signed out before custom login', async () => {
  auth.currentUser = { uid: 'old-email-user', getIdTokenResult: jest.fn().mockResolvedValue({ claims: {} }) };
  await connectFirebase({}, new AbortController().signal);
  expect(signOut).toHaveBeenCalledWith(auth);
  expect(signInWithCustomToken).toHaveBeenCalledTimes(1);
});
