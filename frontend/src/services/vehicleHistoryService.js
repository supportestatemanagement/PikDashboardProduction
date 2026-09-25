import { get, ref } from 'firebase/database';
import { getFirebaseServices } from '../config/firebase';

export const HISTORY_VEHICLES = [
  { id: 'PATROL_01', name: 'PATROL_01', area: 'Uji Coba' },
  { id: 'JAGUAR_1', name: 'JAGUAR 1', area: 'BGM' },
  { id: 'TRITON_1', name: 'TRITON 1', area: 'BGM' },
  { id: 'MACAN_GI', name: 'MACAN GI', area: 'GI' },
  { id: 'JAGUAR_RWI', name: 'JAGUAR RWI', area: 'RWI' },
];
export const todayWib = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const historyTime = timestamp => new Date(timestamp).toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' });

function numeric(value) {
  return typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN;
}

export function normalizeHistory(data) {
  return Object.entries(data || {}).flatMap(([key, point]) => {
    if (!point || typeof point !== 'object') return [];
    const latitude = numeric(point.latitude), longitude = numeric(point.longitude);
    // Android epoch milliseconds are standard; also accept epoch seconds and timestamp keys.
    let timestamp = numeric(point.timestamp ?? key);
    if (timestamp > 0 && timestamp < 1e11) timestamp *= 1000;
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180 ||
      !Number.isFinite(timestamp) || timestamp <= 0 || !Number.isFinite(new Date(timestamp).getTime())) return [];
    return [{ id: key, position: [latitude, longitude], timestamp, speed: numeric(point.speed), accuracy: numeric(point.accuracy) }];
  }).sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
}

export async function readVehicleHistory(vehicle, date, user) {
  const { auth, database } = getFirebaseServices();
  if (!user || auth.currentUser?.uid !== user.uid) throw new Error('Firebase authentication required');
  if (!HISTORY_VEHICLES.some(item => item.id === vehicle) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid history filter');
  const snapshot = await get(ref(database, `vehicle_history/${vehicle}/${date}`));
  return normalizeHistory(snapshot.val());
}

export function historyDistance(points) {
  const radians = value => value * Math.PI / 180;
  let distance = 0;
  for (let index = 1; index < points.length; index += 1) {
    const [lat1, lon1] = points[index - 1].position;
    const [lat2, lon2] = points[index].position;
    const a = Math.sin(radians(lat2 - lat1) / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(radians(lon2 - lon1) / 2) ** 2;
    const segment = 6371 * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, a))));
    if (Number.isFinite(segment)) distance += segment;
  }
  return distance;
}

export function renderHistoryPoints(points, limit = 5000) {
  const stride = Math.max(1, Math.ceil(points.length / limit));
  return points.filter((point, index) => index % stride === 0 || index === points.length - 1).map(point => point.position);
}
