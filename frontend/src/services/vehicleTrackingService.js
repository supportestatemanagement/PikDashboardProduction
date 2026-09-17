export const VEHICLE_DATABASE_URL = process.env.REACT_APP_VEHICLE_DATABASE_URL ||
  'https://track-vehicle-234cb-default-rtdb.asia-southeast1.firebasedatabase.app';

// Firebase stream paths are relative to vehicle_locations, including nested patches.
export function applyVehicleEvent(current, type, { path, data }) {
  const replace = (root, segments, value) => {
    if (!segments.length) return value;
    const [key, ...rest] = segments;
    const next = { ...(root && typeof root === 'object' ? root : {}) };
    const child = replace(next[key], rest, value);
    if (child === null) delete next[key];
    else Object.defineProperty(next, key, { value: child, enumerable: true, writable: true, configurable: true });
    return next;
  };
  const parts = path.split('/').filter(Boolean);
  if (type === 'put') return replace(current, parts, data);
  return Object.entries(data || {}).reduce((state, [key, value]) =>
    replace(state, [...parts, ...key.split('/')], value), current);
}

export function getVehicles(snapshot) {
  return Object.entries(snapshot || {}).flatMap(([id, vehicle]) => {
    if (!vehicle || typeof vehicle !== 'object') return [];
    const { latitude, longitude } = vehicle;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return [];
    return [{ ...vehicle, id, position: [latitude, longitude] }];
  });
}

export function subscribeVehicles(onVehicles, onStatus, idToken) {
  let snapshot = null;
  const auth = idToken ? `?auth=${encodeURIComponent(idToken)}` : '';
  const source = new EventSource(`${VEHICLE_DATABASE_URL.replace(/\/$/, '')}/vehicle_locations.json${auth}`);
  onStatus('Menghubungkan GPS…');
  const receive = (type) => (event) => {
    try {
      snapshot = applyVehicleEvent(snapshot, type, JSON.parse(event.data));
      onVehicles(getVehicles(snapshot));
      onStatus('Terhubung');
    } catch {
      onStatus('Data GPS tidak valid');
    }
  };
  source.addEventListener('put', receive('put'));
  source.addEventListener('patch', receive('patch'));
  source.onerror = () => onStatus('GPS terputus; mencoba kembali. Jika berlanjut, periksa akses Firebase.');
  const denied = () => {
    source.close();
    onVehicles([]);
    onStatus('Akses GPS ditolak. Periksa autentikasi dan rules Firebase.');
  };
  source.addEventListener('cancel', denied);
  source.addEventListener('auth_revoked', denied);
  return () => source.close();
}
