import { act, renderHook, waitFor } from '@testing-library/react';
import useDashboardSession from './useDashboardSession';
import { dashboardRequest, SESSION_KEY } from './dashboardSession';
import { disconnectFirebase } from './firebaseAuth';
jest.mock('./dashboardSession', () => ({ ...jest.requireActual('./dashboardSession'), dashboardRequest: jest.fn() }));
jest.mock('./firebaseAuth', () => ({ disconnectFirebase: jest.fn().mockResolvedValue() }));
const saved = () => ({ sessionToken: 'signed', expiresAt: Date.now() + 600000, user: { username: 'ADMIN01' } });
beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); disconnectFirebase.mockResolvedValue(); });
test('old boolean login flag cannot restore an authenticated session', async () => {
  localStorage.setItem('cc_isLoggedIn', 'true');
  const { result } = renderHook(useDashboardSession);
  await waitFor(() => expect(result.current.checking).toBe(false));
  expect(result.current.session).toBeNull();
  expect(dashboardRequest).not.toHaveBeenCalled();
});
test('restores a signed session only after backend validation and logs out Firebase', async () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(saved()));
  dashboardRequest.mockResolvedValue({ user: { username: 'ADMIN01' } });
  const { result } = renderHook(useDashboardSession);
  await waitFor(() => expect(result.current.session?.user.username).toBe('ADMIN01'));
  expect(dashboardRequest).toHaveBeenCalledWith('/api/session', expect.any(Object), expect.any(AbortSignal));
  act(() => result.current.logout());
  expect(result.current.session).toBeNull();
  expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  expect(disconnectFirebase).toHaveBeenCalled();
});
test('expired server session returns to dashboard login', async () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(saved()));
  dashboardRequest.mockRejectedValue(Object.assign(new Error('expired'), { code: 'session-expired' }));
  const { result } = renderHook(useDashboardSession);
  await waitFor(() => expect(result.current.checking).toBe(false));
  expect(result.current.session).toBeNull();
  expect(localStorage.getItem(SESSION_KEY)).toBeNull();
});
test('network failure exposes retry without trusting saved identity', async () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(saved()));
  dashboardRequest.mockRejectedValue(new Error('network'));
  const { result } = renderHook(useDashboardSession);
  await waitFor(() => expect(result.current.restoreError).toBe(true));
  expect(result.current.session).toBeNull();
  expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
});

test('Astina stays logged in beyond 24 hours during a network outage and can logout manually', async () => {
  jest.useFakeTimers();
  try {
    const user = { username: 'Astina', role: 'crisis_broadcaster' };
    const original = { sessionToken: 'original', expiresAt: null, user };
    localStorage.setItem(SESSION_KEY, JSON.stringify(original));
    dashboardRequest.mockResolvedValueOnce({ user }).mockRejectedValue(new Error('network'));
    const { result } = renderHook(useDashboardSession);
    await act(async () => {});
    expect(result.current.session.sessionToken).toBe('original');
    await act(async () => { jest.advanceTimersByTime(48 * 3600000); });
    expect(result.current.session.sessionToken).toBe('original');
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)).sessionToken).toBe('original');
    act(() => result.current.logout());
    expect(result.current.session).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  } finally { jest.useRealTimers(); }
});
