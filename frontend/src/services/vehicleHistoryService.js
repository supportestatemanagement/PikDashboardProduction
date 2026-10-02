import { get, ref } from 'firebase/database';
import { getFirebaseServices } from '../config/firebase';

export const HISTORY_VEHICLES = [
  { id: 'JAGUAR_BGM', name: 'JAGUAR BGM', area: 'BGM' },
  { id: 'MACAN_BGM', name: 'MACAN BGM', area: 'BGM' },
  { id: 'MACAN_GI', name: 'MACAN GI', area: 'GI' },
  { id: 'JAGUAR_RWI', name: 'JAGUAR RWI', area: 'RWI' },
  { id: 'PATROL_01', name: 'PATROL_01', area: 'Other' },
  { id: 'JAGUAR_1', name: 'JAGUAR 1', area: 'Other' },
  { id: 'TRITON_1', name: 'TRITON 1', area: 'Other' },
];

export async function readHistoryVehicles(user) {
  const { auth, database } = getFirebaseServices();
  if (!user || auth.currentUser?.uid !== user.uid) throw new Error('Firebase authentication required');
  const snapshot = await get(ref(database, 'vehicle_locations'));
  const knownIds = new Set(HISTORY_VEHICLES.map(item => item.id));
  return [...HISTORY_VEHICLES, ...Object.keys(snapshot.val() || {}).sort()
    .filter(id => !knownIds.has(id))
    .map(id => ({ id, name: id, area: 'Other' }))];
}
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
  if (typeof vehicle !== 'string' || !vehicle || /[.#$\[\]/\u0000-\u001f\u007f]/.test(vehicle) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid history filter');
  // Never read the history root: one vehicle and one selected day per request.
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

// Keep geometric distance separate: checkpoint radii must use raw coordinates.
export function estimatedHistoryDistance(points) {
  const speedBetween = (from, to) => {
    const hours = (to.timestamp - from.timestamp) / 3600000;
    return hours > 0 ? historyDistance([from, to]) / hours : NaN;
  };
  const filtered = [];
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index], previous = filtered[filtered.length - 1], next = points[index + 1];
    // Remove only isolated spikes with an implausible outward AND return leg.
    // Do not interpret missing GPS coverage as an outlier or erase real turns.
    if (previous && next && next.timestamp - previous.timestamp <= 120000 &&
      speedBetween(previous, point) > 180 && speedBetween(point, next) > 180 &&
      speedBetween(previous, next) <= 180) continue;
    filtered.push(point);
  }
  const stops = historyCheckpoints(filtered);
  const corrected = [...filtered];
  let index = 0;
  for (const stop of stops) {
    while (index < filtered.length && filtered[index].timestamp < stop.start) index += 1;
    let stationaryStart = null;
    const finishStationary = endIndex => {
      if (stationaryStart === null) return;
      const anchor = filtered[stationaryStart];
      if (filtered[endIndex].timestamp - anchor.timestamp >= 5 * 60000) {
        for (let cursor = stationaryStart; cursor <= endIndex; cursor += 1) {
          corrected[cursor] = { ...filtered[cursor], position: anchor.position };
        }
      }
      stationaryStart = null;
    };
    // Correct only sustained stationary portions. Movement at the end of a
    // checkpoint must not restore GPS drift from the entire preceding stop.
    while (index < filtered.length && filtered[index].timestamp <= stop.end) {
      if (Number.isFinite(filtered[index].speed) && filtered[index].speed > 3) {
        finishStationary(index - 1);
      } else if (stationaryStart === null) {
        stationaryStart = index;
      }
      index += 1;
    }
    finishStationary(index - 1);
  }
  return historyDistance(corrected);
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
