export const SESSION_KEY = 'cc_dashboardSession';
export const API_URL = process.env.REACT_APP_API_URL || '';
export const isCrisisBroadcaster = user => user?.username === 'Astina' && user?.role === 'crisis_broadcaster';

export async function dashboardRequest(path, session, signal) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', cancel);
  const timer = setTimeout(cancel, 60000);
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${session.sessionToken}` },
      cache: 'no-store', signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
  if (response.status === 401) {
    const error = new Error('Dashboard session expired');
    error.code = 'session-expired';
    throw error;
  }
  if (!response.ok) throw new Error('Dashboard service unavailable');
  return response.json();
}

export function readDashboardSession() {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY));
    return value?.sessionToken && (isCrisisBroadcaster(value.user) || value?.expiresAt > Date.now()) ? value : null;
  } catch { return null; }
}
