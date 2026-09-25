import { act, renderHook, waitFor } from '@testing-library/react';
import { normalizeEarthquake, parseCoordinates, fetchEarthquakeHistory } from './bmkgEarthquake';
import { fetchWeather, normalizeWeather, WEATHER_LOCATIONS, weatherLoaders, WEATHER_REFRESH_INTERVAL } from './bmkgWeather';
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
test('weather locations request their own ADM4 and keep updating when another location fails', async () => {
  jest.useFakeTimers();
  let failFirst = false;
  global.fetch = jest.fn().mockImplementation(async url => {
    const adm4 = new URL(url).searchParams.get('adm4');
    const first = adm4 === WEATHER_LOCATIONS[0].adm4;
    if (first && failFirst) throw new Error('Offline');
    return { ok: true, json: async () => ({ data: [{ cuaca: [[{ utc_datetime: '2026-09-24 00:00:00', t: first ? 29 : 31 }]] }] }) };
  });
  const { result, unmount } = renderHook(() => [
    useDisasterSource(weatherLoaders[0], WEATHER_REFRESH_INTERVAL),
    useDisasterSource(weatherLoaders[1], WEATHER_REFRESH_INTERVAL),
  ]);
  await waitFor(() => expect(result.current.every(source => source.data)).toBe(true));
  expect(global.fetch.mock.calls.map(([url]) => new URL(url).searchParams.get('adm4'))).toEqual(WEATHER_LOCATIONS.map(location => location.adm4));
  expect(result.current.map(source => source.data.temperature)).toEqual([29, 31]);
  failFirst = true;
  await act(async () => { jest.advanceTimersByTime(WEATHER_REFRESH_INTERVAL); });
  expect(result.current[0]).toMatchObject({ error: true, data: { temperature: 29 } });
  expect(result.current[1]).toMatchObject({ error: false, data: { temperature: 31 } });
  unmount();
});

test('weather rejects missing ADM4 without fetching a fallback location', async () => {
  global.fetch = jest.fn();
  await expect(fetchWeather('')).rejects.toThrow('ADM4');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('source retains successful data on refresh failure and cleans up polling on unmount', async () => {
  jest.useFakeTimers();
  const loader = jest.fn().mockResolvedValueOnce({ value: 1 }).mockRejectedValue(new Error('Offline'));
  const { result, unmount } = renderHook(() => useDisasterSource(loader, 60000));
  await waitFor(() => expect(result.current.data).toEqual({ value: 1 }));
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
