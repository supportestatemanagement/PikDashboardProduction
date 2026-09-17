import { applyVehicleEvent, getVehicles, subscribeVehicles } from './vehicleTrackingService';

test('handles initial snapshots, nested patches, deletion and clearing', () => {
  let state = applyVehicleEvent(null, 'put', { path: '/', data: { PATROL_01: { latitude: -6, longitude: 106, tracking: true } } });
  state = applyVehicleEvent(state, 'patch', { path: '/', data: { 'PATROL_01/latitude': -6.1, 'PATROL_01/officer_name': 'Rohmat' } });
  expect(getVehicles(state)[0]).toMatchObject({ position: [-6.1, 106], officer_name: 'Rohmat' });
  state = applyVehicleEvent(state, 'put', { path: '/PATROL_01/tracking', data: false });
  expect(getVehicles(state)[0].tracking).toBe(false);
  expect(applyVehicleEvent(state, 'put', { path: '/PATROL_01', data: null })).toEqual({});
  expect(getVehicles(applyVehicleEvent(state, 'put', { path: '/', data: null }))).toEqual([]);
});

test('rejects invalid GPS coordinates without losing valid zero coordinates', () => {
  expect(getVehicles({ a: { latitude: null, longitude: 106 }, b: { latitude: 91, longitude: 106 }, c: { latitude: 0, longitude: 0 } })).toEqual([{ id: 'c', latitude: 0, longitude: 0, position: [0, 0] }]);
});

test('streams updates, reports disconnection and closes rejected subscriptions', () => {
  const listeners = {};
  const source = { addEventListener: jest.fn((name, callback) => { listeners[name] = callback; }), close: jest.fn() };
  const original = global.EventSource;
  global.EventSource = jest.fn(() => source);
  try {
    const onVehicles = jest.fn();
    const onStatus = jest.fn();
    const stop = subscribeVehicles(onVehicles, onStatus, 'test-token');
    expect(global.EventSource).toHaveBeenCalledWith(expect.stringContaining('?auth=test-token'));
    listeners.put({ data: JSON.stringify({ path: '/', data: { A: { latitude: -6, longitude: 106 } } }) });
    expect(onVehicles.mock.calls[0][0]).toHaveLength(1);
    expect(onStatus).toHaveBeenLastCalledWith('Terhubung');
    source.onerror();
    expect(onStatus.mock.calls.at(-1)[0]).toContain('terputus');
    listeners.cancel();
    expect(source.close).toHaveBeenCalled();
    expect(onVehicles).toHaveBeenLastCalledWith([]);
    stop();
  } finally { global.EventSource = original; }
});
