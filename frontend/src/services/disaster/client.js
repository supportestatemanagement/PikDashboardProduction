export async function fetchJson(url, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort);
  const timeout = setTimeout(abort, 20000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`BMKG HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error('BMKG service error');
    return data;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
export function numberValue(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
export function validCoordinates(lat, lng) {
  return lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null;
}
export function sourceDate(value, offset = 'Z') {
  if (!value) return null;
  const text = String(value).trim().replace(' ', 'T');
  const time = Date.parse(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(text) ? text : text + offset);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
export function formatWib(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) + ' WIB';
}
