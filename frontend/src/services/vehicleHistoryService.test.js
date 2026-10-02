import { get } from 'firebase/database';
import { getFirebaseServices } from '../config/firebase';
import { readHistoryVehicles, normalizeHistory, readVehicleHistory, historyDistance, estimatedHistoryDistance, renderHistoryPoints, historyCheckpoints } from './vehicleHistoryService';
jest.mock('firebase/database', () => ({ get: jest.fn(), ref: (_, path) => path }));
jest.mock('../config/firebase', () => ({ getFirebaseServices: jest.fn() }));
const user = { uid: 'dashboard' };
test('reads each history request independently using the selected path', async () => {
  get.mockResolvedValue({ val: () => null });
  const first = readVehicleHistory('JAGUAR_BGM', '2026-10-01', user);
  const duplicate = readVehicleHistory('JAGUAR_BGM', '2026-10-01', user);
  expect(get).toHaveBeenCalledTimes(2);
  expect(get).toHaveBeenCalledWith('vehicle_history/JAGUAR_BGM/2026-10-01');
  await Promise.all([first, duplicate]);
  get.mockResolvedValue({ val: () => null });
  await readVehicleHistory('JAGUAR_BGM', '2026-10-01', user);
  expect(get).toHaveBeenCalledTimes(3);
});

test('keeps distinct vehicle/date requests separate and allows retry after failure', async () => {
  get.mockRejectedValueOnce(new Error('offline'));
  await expect(readVehicleHistory('JAGUAR_BGM', '2026-10-01', user)).rejects.toThrow('offline');
  get.mockResolvedValue({ val: () => null });
  await Promise.all([
    readVehicleHistory('JAGUAR_BGM', '2026-10-01', user),
    readVehicleHistory('MACAN_BGM', '2026-10-01', user),
    readVehicleHistory('JAGUAR_BGM', '2026-09-30', user),
  ]);
  expect(get.mock.calls.map(([path]) => path)).toEqual([
    'vehicle_history/JAGUAR_BGM/2026-10-01',
    'vehicle_history/JAGUAR_BGM/2026-10-01',
    'vehicle_history/MACAN_BGM/2026-10-01',
    'vehicle_history/JAGUAR_BGM/2026-09-30',
  ]);
});
test('groups exact vehicle IDs and discovers other vehicles without duplicating known IDs', async () => {
  get.mockResolvedValue({ val: () => ({ JAGUAR_BGM: {}, MACAN_BGM: {}, NEW_VEHICLE: {}, MACAN_OTHER: {} }) });
  const vehicles = await readHistoryVehicles(user);
  expect(vehicles.filter(item => item.area === 'BGM').map(item => item.id)).toEqual(['JAGUAR_BGM', 'MACAN_BGM']);
  expect(vehicles.filter(item => item.area === 'GI').map(item => item.id)).toEqual(['MACAN_GI']);
  expect(vehicles.filter(item => item.area === 'RWI').map(item => item.id)).toEqual(['JAGUAR_RWI']);
  expect(vehicles.filter(item => item.area === 'Other').map(item => item.id)).toEqual(expect.arrayContaining(['PATROL_01', 'JAGUAR_1', 'TRITON_1', 'NEW_VEHICLE', 'MACAN_OTHER']));
  expect(get).toHaveBeenCalledWith('vehicle_locations');
});

test('reads additional vehicle IDs but rejects invalid Firebase path segments', async () => {
  get.mockResolvedValue({ val: () => null });
  await expect(readVehicleHistory('NEW_VEHICLE', '2026-10-01', user)).resolves.toEqual([]);
  expect(get).toHaveBeenCalledWith('vehicle_history/NEW_VEHICLE/2026-10-01');
  for (const id of ['', 'bad/id', 'bad.id', 'bad#id', 'bad$id', 'bad[id]']) {
    await expect(readVehicleHistory(id, '2026-10-01', user)).rejects.toThrow('Invalid history filter');
  }
});
const stopPoints = (count, offset = 0) => Array.from({ length: count }, (_, index) => ({ position: [0, 0], timestamp: 1790300000000 + offset + index * 60000, accuracy: 5 }));

test('distance excludes stationary drift while preserving entry and departure travel', () => {
  const stopped = stopPoints(7).map((point, index) => ({ ...point, position: [0, index % 2 * 0.0001], speed: 0 }));
  const before = { position: [0, -0.001], timestamp: stopped[0].timestamp - 60000 };
  const after = { position: [0, 0.001], timestamp: stopped[6].timestamp + 60000 };
  const points = [before, ...stopped, after];
  const original = JSON.stringify(points);
  expect(estimatedHistoryDistance(points)).toBeCloseTo(historyDistance([before, stopped[0], after]), 8);
  expect(estimatedHistoryDistance(points)).toBeLessThan(historyDistance(points));
  expect(JSON.stringify(points)).toBe(original);
  expect(estimatedHistoryDistance([])).toBe(0);
  expect(estimatedHistoryDistance([before])).toBe(0);
});

test('distance removes an isolated impossible jump but preserves real corners and sparse records', () => {
  const points = [
    { position: [0, 0], timestamp: 1790300000000 },
    { position: [1, 1], timestamp: 1790300005000 },
    { position: [0, 0.001], timestamp: 1790300010000 },
    { position: [0.001, 0.001], timestamp: 1790300020000 },
  ];
  expect(estimatedHistoryDistance(points)).toBeCloseTo(historyDistance([points[0], points[2], points[3]]), 8);
  const sparse = points.map((point, index) => ({ ...point, timestamp: 1790300000000 + index * 3600000 }));
  expect(estimatedHistoryDistance(sparse)).toBe(historyDistance(sparse));
});

test('distance preserves local movement when reported speed contradicts a stationary checkpoint', () => {
  const moving = stopPoints(7).map((point, index) => ({ ...point, position: [0, index % 2 * 0.0001], speed: 5 }));
  expect(estimatedHistoryDistance(moving)).toBe(historyDistance(moving));
});

test('movement at the end of a checkpoint does not undo correction of preceding stationary drift', () => {
  const stationary = stopPoints(7).map((point, index) => ({ ...point, position: [0, index % 2 * 0.0001], speed: 0 }));
  const moving = [
    { ...stationary[6], timestamp: stationary[6].timestamp + 5000, position: [0.0001, 0], speed: 4.7 },
    { ...stationary[6], timestamp: stationary[6].timestamp + 10000, position: [0.0001, 0.0001], speed: 4.3 },
  ];
  const points = [...stationary, ...moving];
  expect(historyCheckpoints(points)).toHaveLength(1);
  expect(estimatedHistoryDistance(points)).toBeCloseTo(historyDistance([stationary[0], ...moving]), 8);
  expect(estimatedHistoryDistance(points)).toBeLessThan(historyDistance(points));
});

test('detects five-minute stops including GPS jitter and the final stop', () => {
  expect(historyCheckpoints([])).toEqual([]);
  expect(historyCheckpoints(stopPoints(1))).toEqual([]);
  expect(historyCheckpoints(stopPoints(5))).toEqual([]);
  const points = stopPoints(6);
  points[2].position = [0.00005, 0];
  expect(historyCheckpoints(points)).toEqual([{ position: [0, 0], start: points[0].timestamp, end: points[5].timestamp, duration: 300000 }]);
  const later = stopPoints(7, 600000).map(point => ({ ...point, position: [0.01, 0] }));
  expect(historyCheckpoints([...points, ...later])).toHaveLength(2);
});

test('does not infer stops across missing records, poor accuracy or continuous movement', () => {
  expect(historyCheckpoints([stopPoints(1)[0], stopPoints(1, 600000)[0]])).toEqual([]);
  const inaccurate = stopPoints(9);
  inaccurate[4].accuracy = 100;
  expect(historyCheckpoints(inaccurate)).toEqual([]);
  const moving = stopPoints(12).map((point, index) => ({ ...point, position: [index * 0.0001, 0] }));
  expect(historyCheckpoints(moving)).toEqual([]);
});
beforeEach(() => { jest.clearAllMocks(); getFirebaseServices.mockReturnValue({ auth: { currentUser: user }, database: {} }); });

test('bridges an isolated GPS jump or brief accuracy loss without splitting a stop', () => {
  const points = Array.from({ length: 145 }, (_, index) => ({ position: [0, 0], timestamp: 1790300000000 + index * 5000, accuracy: 5 }));
  for (const anomaly of [{ position: [0.001, 0] }, { accuracy: 100 }]) {
    const noisy = points.map((point, index) => index === 72 ? { ...point, ...anomaly } : point);
    const checkpoints = historyCheckpoints(noisy);
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0].duration).toBe(720000);
  }
});

test('keeps separate visits when reliable fixes confirm departure, even at the same location', () => {
  const points = Array.from({ length: 145 }, (_, index) => ({ position: [0, 0], timestamp: 1790300000000 + index * 5000, accuracy: 5 }));
  points[72].position = [0.001, 0];
  points[73].position = [0.001, 0];
  expect(historyCheckpoints(points)).toHaveLength(2);
});

test('does not bridge prolonged accuracy loss or extend a stop through a final GPS jump', () => {
  const points = Array.from({ length: 153 }, (_, index) => ({ position: [0, 0], timestamp: 1790300000000 + index * 5000, accuracy: index >= 72 && index <= 80 ? 100 : 5 }));
  expect(historyCheckpoints(points)).toHaveLength(2);
  const stopped = stopPoints(6);
  const result = historyCheckpoints([...stopped, { ...stopped[5], timestamp: stopped[5].timestamp + 5000, position: [0.001, 0] }]);
  expect(result).toHaveLength(1);
  expect(result[0].end).toBe(stopped[5].timestamp);
});

test('sorts timestamps explicitly, accepts timestamp keys and rejects corrupt records', () => {
  const points = normalizeHistory({ later: { latitude: -6, longitude: 106, timestamp: 1790300005000 },
    1790300000000: { latitude: '0', longitude: '0' },
    seconds: { latitude: 1, longitude: 1, timestamp: 1790300002 },
    bad: { latitude: 100, longitude: 0, timestamp: 1790300000000 },
    missing: { latitude: null, longitude: 0, timestamp: 1790300000000 },
    invalidTime: { latitude: 0, longitude: 0, timestamp: 'invalid' }, empty: null });
  expect(points.map(point => point.timestamp)).toEqual([1790300000000, 1790300002000, 1790300005000]);
  expect(points[0].position).toEqual([0, 0]);
  expect(normalizeHistory(null)).toEqual([]);
});
test('reads only selected vehicle/date using existing Firebase identity', async () => {
  get.mockResolvedValue({ val: () => null });
  await expect(readVehicleHistory('MACAN_GI', '2026-09-25', user)).resolves.toEqual([]);
  expect(get).toHaveBeenCalledWith('vehicle_history/MACAN_GI/2026-09-25');
  await expect(readVehicleHistory('MACAN_GI', '2026-09-25', { uid: 'other' })).rejects.toThrow('authentication');
  expect(get).toHaveBeenCalledTimes(1);
});
test('Haversine uses full data and skips nonfinite segments; rendering preserves endpoints', () => {
  expect(historyDistance([{ position: [0, 0] }, { position: [0, 1] }])).toBeCloseTo(111.195, 2);
  expect(historyDistance([{ position: [NaN, 0] }, { position: [0, 1] }])).toBe(0);
  expect(historyDistance([])).toBe(0);
  const points = Array.from({ length: 17000 }, (_, i) => ({ position: [0, i / 10000] }));
  const rendered = renderHistoryPoints(points);
  expect(rendered.length).toBeLessThanOrEqual(5001);
  expect(rendered[0]).toEqual(points[0].position);
  expect(rendered[rendered.length - 1]).toEqual(points[16999].position);
  expect(points).toHaveLength(17000);
});
