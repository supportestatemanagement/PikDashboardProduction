import { onValue } from 'firebase/database';
import { getFirebaseServices } from '../config/firebase';
import { getVehicles, subscribeVehicles } from './vehicleTrackingService';
jest.mock('firebase/database', () => ({ onValue: jest.fn(), ref: (_, path) => path }));
jest.mock('../config/firebase', () => ({ getFirebaseServices: jest.fn() }));

beforeEach(() => { jest.clearAllMocks(); });
test('rejects invalid GPS coordinates and keeps valid zero coordinates', () => {
  expect(getVehicles({ a: { latitude: null, longitude: 106 }, b: { latitude: 91, longitude: 106 }, c: { latitude: 0, longitude: 0 } })).toEqual([{ id: 'c', latitude: 0, longitude: 0, position: [0, 0] }]);
});
test('does not subscribe before authentication', () => {
  getFirebaseServices.mockReturnValue({ auth: { currentUser: null }, database: {} });
  expect(() => subscribeVehicles(jest.fn(), jest.fn(), null)).toThrow('authentication required');
  expect(onValue).not.toHaveBeenCalled();
});
test('updates positions, handles deletes/denial and unsubscribes both listeners', () => {
  const user = { uid: 'dashboard_ADMIN01' };
  getFirebaseServices.mockReturnValue({ auth: { currentUser: user }, database: {} });
  const listeners = {};
  const cleanup = jest.fn();
  onValue.mockImplementation((path, receive, error) => { listeners[path] = { receive, error }; return cleanup; });
  const vehicles = jest.fn(), status = jest.fn();
  const stop = subscribeVehicles(vehicles, status, user);
  listeners['.info/connected'].receive({ val: () => true });
  listeners.vehicle_locations.receive({ val: () => ({ A: { latitude: -6, longitude: 106 } }) });
  expect(vehicles).toHaveBeenLastCalledWith([expect.objectContaining({ position: [-6, 106] })]);
  expect(status).toHaveBeenLastCalledWith('Terhubung');
  listeners.vehicle_locations.receive({ val: () => null });
  expect(vehicles).toHaveBeenLastCalledWith([]);
  listeners.vehicle_locations.error(new Error('Permission denied'));
  expect(status).toHaveBeenLastCalledWith('Unable to connect to realtime vehicle data.');
  stop();
  expect(cleanup).toHaveBeenCalledTimes(2);
});
