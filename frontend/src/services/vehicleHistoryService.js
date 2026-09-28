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

// Use a fixed anchor so slow movement cannot accumulate into a false stop.
// A gap in GPS records is not evidence that the vehicle remained stationary.
export function historyCheckpoints(points) {
  const checkpoints = [];
  let start = null, end = null;
  const finish = () => {
    if (start && end.timestamp - start.timestamp >= 5 * 60000) {
      checkpoints.push({ position: start.position, start: start.timestamp, end: end.timestamp, duration: end.timestamp - start.timestamp });
    }
  };
  const reliable = point => !Number.isFinite(point.accuracy) || point.accuracy <= 25;
  const nearby = (anchor, point) => historyDistance([anchor, point]) * 1000 <= 25;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    // Bridge a brief accuracy loss or one isolated jump only when a reliable
    // fix returns to the original stop within 30 seconds of the last good fix.
    // Two reliable fixes outside the radius confirm departure, even nearby.
    if (start && (!reliable(point) || !nearby(start, point))) {
      let outside = 0, resume = -1;
      for (let next = index; next < points.length && points[next].timestamp - end.timestamp <= 30000; next += 1) {
        if (!reliable(points[next])) continue;
        if (nearby(start, points[next])) { resume = next; break; }
        outside += 1;
        if (outside >= 2) break;
      }
      if (resume !== -1) {
        index = resume - 1;
        continue;
      }
    }
    if (!reliable(point)) {
      finish();
      start = end = null;
      continue;
    }
    if (!start || point.timestamp - end.timestamp > 120000 || !nearby(start, point)) {
      finish();
      start = point;
    }
    end = point;
  }
  finish();
  return checkpoints;
}
