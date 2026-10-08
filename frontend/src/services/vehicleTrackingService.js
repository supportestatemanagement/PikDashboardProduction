import { onValue, ref } from 'firebase/database';
import { getFirebaseServices } from '../config/firebase';

export function getVehicles(snapshot) {
  return Object.entries(snapshot || {}).flatMap(([id, vehicle]) => {
    if (!vehicle || typeof vehicle !== 'object') return [];
    const { latitude, longitude } = vehicle;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return [];
    let timestamp = vehicle.timestamp;
    if (typeof timestamp === 'string' && timestamp.trim()) timestamp = Number(timestamp);
    if (Number.isFinite(timestamp) && timestamp > 0 && timestamp < 1e11) timestamp *= 1000;
    return [{ ...vehicle, ...(timestamp !== undefined ? { timestamp } : {}), id, position: [latitude, longitude] }];
  });
}

export function subscribeVehicles(onVehicles, onStatus, user) {
  const { auth, database } = getFirebaseServices();
  if (!user || auth.currentUser?.uid !== user.uid) throw new Error('Firebase authentication required');
  onStatus('Connecting to realtime service...');
  let hasData = false;
  let connected = false;
  let denied = false;
  let previous = new Map();
  const stopConnection = onValue(ref(database, '.info/connected'), snapshot => {
    connected = snapshot.val() === true;
    if (!denied) onStatus(connected && hasData ? 'Terhubung' : 'Connecting to realtime service...');
  });
  const stopVehicles = onValue(ref(database, 'vehicle_locations'), snapshot => {
    hasData = true;
    const vehicles = getVehicles(snapshot.val()).map(vehicle => {
      const last = previous.get(vehicle.id);
      if (last && Number.isFinite(last.timestamp) && (!Number.isFinite(vehicle.timestamp) || vehicle.timestamp < last.timestamp)) {
        return { ...vehicle, latitude: last.latitude, longitude: last.longitude, position: last.position, timestamp: last.timestamp, accuracy: last.accuracy };
      }
      return vehicle;
    });
    previous = new Map(vehicles.map(vehicle => [vehicle.id, vehicle]));
    onVehicles(vehicles);
    onStatus(connected ? 'Terhubung' : 'Connecting to realtime service...');
  }, () => {
    denied = true;
    previous.clear();
    onVehicles([]);
    onStatus('Unable to connect to realtime vehicle data.');
  });
  return () => { stopVehicles(); stopConnection(); };
}
