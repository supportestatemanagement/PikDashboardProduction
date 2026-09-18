import { onValue, ref } from 'firebase/database';
import { getFirebaseServices } from '../config/firebase';

export function getVehicles(snapshot) {
  return Object.entries(snapshot || {}).flatMap(([id, vehicle]) => {
    if (!vehicle || typeof vehicle !== 'object') return [];
    const { latitude, longitude } = vehicle;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return [];
    return [{ ...vehicle, id, position: [latitude, longitude] }];
  });
}

export function subscribeVehicles(onVehicles, onStatus, user) {
  const { auth, database } = getFirebaseServices();
  if (!user || auth.currentUser?.uid !== user.uid) throw new Error('Firebase authentication required');
  onStatus('Connecting to realtime service...');
  let hasData = false;
  let connected = false;
  let denied = false;
  const stopConnection = onValue(ref(database, '.info/connected'), snapshot => {
    connected = snapshot.val() === true;
    if (!denied) onStatus(connected && hasData ? 'Terhubung' : 'Connecting to realtime service...');
  });
  const stopVehicles = onValue(ref(database, 'vehicle_locations'), snapshot => {
    hasData = true;
    onVehicles(getVehicles(snapshot.val()));
    onStatus(connected ? 'Terhubung' : 'Connecting to realtime service...');
  }, () => {
    denied = true;
    onVehicles([]);
    onStatus('Unable to connect to realtime vehicle data.');
  });
  return () => { stopVehicles(); stopConnection(); };
}
