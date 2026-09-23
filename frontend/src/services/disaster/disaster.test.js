import { act, renderHook, waitFor } from '@testing-library/react';
import { normalizeEarthquake, parseCoordinates, fetchEarthquakeHistory } from './bmkgEarthquake';
import { normalizeWeather } from './bmkgWeather';
import { fetchHotspots, normalizeHotspot } from './bmkgHotspot';
import { formatWib } from './client';
import useDisasterSource from './useDisasterSource';

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });
test('earthquake coordinates are validated and directional coordinates are supported', () => {
  expect(parseCoordinates('-8.11,120.44')).toEqual([-8.11, 120.44]);
  ['', 'a,b', ',120', '91,120', '8,181', '1,2,3'].forEach(value => expect(parseCoordinates(value)).toBeNull());
  const quake = normalizeEarthquake({ DateTime: '2026-09-23T02:02:44+00:00', Magnitude: '4.7', Kedalaman: '9 km', Lintang: '8.21 LS', Bujur: '120.61 BT', Dirasakan: 'II Manggarai' });
  expect(quake.coordinates).toEqual([-8.21, 120.61]);
  expect(quake.depth).toBe(9);
  expect(quake.felt).toBe('II Manggarai');
  expect(formatWib(quake.datetime)).toContain('09.02');
});
test('M5 history filters and deduplicates records independently of the latest feed', async () => {
  const row = { DateTime: '2026-09-22T00:00:00Z', Magnitude: '5.2', Coordinates: '1,120' };
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ Infogempa: { gempa: [row, row, { ...row, Magnitude: '4.5' }] } }) });
  expect((await fetchEarthquakeHistory()).history).toHaveLength(1);
});
test('weather chooses nearest forecast, not the first, and interprets source times in UTC/WIB', () => {
  const payload = { data: [{ lokasi: { desa: 'Village', kotkab: 'Tangerang' }, cuaca: [[
    { local_datetime: '2026-09-23 08:00:00', t: 20 },
    { local_datetime: '2026-09-23 14:00:00', analysis_date: '2026-09-23T00:00:00', t: 32, hu: 75, ws: 12, wd: 'SE', weather_desc: 'Cerah' },
  ]] }] };
  const result = normalizeWeather(payload, Date.parse('2026-09-23T06:30:00Z'));
  expect(result.temperature).toBe(32);
  expect(result.localDatetime).toBe('2026-09-23T07:00:00.000Z');
  expect(result.updatedAt).toBe('2026-09-23T00:00:00.000Z');
  expect(result.windDirection).toBe('Tenggara');
  expect(() => normalizeWeather({ data: [] })).toThrow();
});
test('hotspots page through the latest observation date and skip invalid points', async () => {
  const feature = id => ({ id, geometry: { type: 'Point', coordinates: [120, -8] }, properties: { date: '2026-09-01', system_date: 1788268500000 } });
  const responses = [{ features: [{ attributes: { date: '2026-09-01' } }] }, { count: 2002 }, { features: Array.from({ length: 2000 }, (_, index) => feature(index)), exceededTransferLimit: true }, { features: [feature(2000), { id: 2001, geometry: null }] }];
  global.fetch = jest.fn().mockImplementation(async () => ({ ok: true, json: async () => responses.shift() }));
  const result = await fetchHotspots();
  expect(result.hotspots).toHaveLength(2001);
  expect(new URL(global.fetch.mock.calls[3][0]).searchParams.get('resultOffset')).toBe('2000');
  expect(new URL(global.fetch.mock.calls[2][0]).searchParams.get('where')).toBe("date='2026-09-01'");
  expect(normalizeHotspot({ geometry: { type: 'Point', coordinates: [500, -8] } }).coordinates).toBeNull();
});
test('source retains successful data on refresh failure and cleans up polling on unmount', async () => {
  jest.useFakeTimers();
  const loader = jest.fn().mockResolvedValueOnce({ value: 1 }).mockRejectedValue(new Error('Offline'));
  const { result, unmount } = renderHook(() => useDisasterSource(loader, 60000));
  await act(async () => {});
  expect(result.current.data).toEqual({ value: 1 });
  await act(async () => { jest.advanceTimersByTime(60000); });
  expect(result.current.error).toBe(true);
  expect(result.current.data).toEqual({ value: 1 });
  unmount();
  jest.advanceTimersByTime(60000);
  expect(loader).toHaveBeenCalledTimes(2);
  expect(loader.mock.calls[0][0].aborted).toBe(true);
});
test('disabled sources never fetch until enabled', async () => {
  const loader = jest.fn().mockResolvedValue({ value: 1 });
  const { rerender } = renderHook(({ enabled }) => useDisasterSource(loader, 60000, enabled), { initialProps: { enabled: false } });
  expect(loader).not.toHaveBeenCalled();
  rerender({ enabled: true });
  await waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
});
