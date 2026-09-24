import { getEnsoCategory, ensoImpact } from './bmkgEnso';
import { maritimeDate, normalizeMaritime, MARITIME_LOCATIONS } from './bmkgMaritime';
import { fetchRdca, normalizeRdca } from './bmkgRdca';
import { haversineKm, countNearby, sourceStatus, combinedStatus } from './monitoring';
import { normalizeWeather } from './bmkgWeather';
import { fetchFeltEarthquakes } from './bmkgEarthquake';

test('ENSO honors official classification, handles boundaries and never turns missing data into neutral', () => {
  expect(getEnsoCategory(null)).toBeNull();
  expect(getEnsoCategory(NaN)).toBeNull();
  expect(getEnsoCategory(0.5)).toBe('El Niño');
  expect(getEnsoCategory(-0.5)).toBe('La Niña');
  expect(getEnsoCategory(0)).toBe('Netral');
  expect(getEnsoCategory(0.9, 'Netral')).toBe('Netral');
  expect(ensoImpact('El Nino kuat').attention).toContain('Kekeringan');
  expect(ensoImpact(null)).toBeNull();
});

test('Haversine counts only valid points within configured radius', () => {
  expect(haversineKm([0, 0], [0, 1])).toBeCloseTo(111.195, 2);
  expect(haversineKm([null, 0], [0, 1])).toBeNull();
  expect(countNearby([{ coordinates: [0, 0.1] }, { coordinates: [0, 1] }, { coordinates: null }], [0, 0], 50)).toBe(1);
  expect(countNearby([], null)).toBeNull();
});

test('source state distinguishes error, empty and partial success', () => {
  expect(sourceStatus({ data: { points: [] } }, [])).toBe('No data');
  expect(sourceStatus({ error: true, data: { points: [] } }, [])).toBe('Error');
  expect(combinedStatus([{ data: {} }, { error: true }])).toBe('Partial');
  expect(sourceStatus({ unavailable: true })).toBe('Unavailable');
});

const portPayload = { code: 'XJ003', name: 'Pelabuhan Muara Angke', issued: '2026-09-23 12:00 UTC', valid_from: '2026-09-24 00:00 UTC', valid_to: '2026-09-27 00:00 UTC', forecast_day1: [
  { time: '2026-09-24 00:00 UTC', tides: -0.3 }, { time: '2026-09-24 01:00 UTC', tides: 0, wave_height: 0 },
] };
test('maritime selects nearest forecast, preserves zero/negative values and rejects wrong port', () => {
  const result = normalizeMaritime(portPayload, MARITIME_LOCATIONS[0], Date.parse('2026-09-24T00:50Z'));
  expect(result.tides).toBe(0);
  expect(result.waveHeight).toBe(0);
  expect(result.windSpeed).toBeNull();
  expect(result.validAt).toBe('2026-09-24T01:00:00.000Z');
  expect(result.updatedAt).toBe('2026-09-23T12:00:00.000Z');
  expect(() => normalizeMaritime(portPayload, MARITIME_LOCATIONS[1])).toThrow();
  expect(maritimeDate('2026-09-24 00:00')).toBeNull();
});

test('weather preserves cloud cover and documented visibility text', () => {
  const data = normalizeWeather({ data: [{ cuaca: [[{ utc_datetime: '2026-09-24 00:00:00', tcc: 0, vs_text: '> 10 km' }]] }] });
  expect(data.cloudCover).toBe(0);
  expect(data.visibility).toBe('> 10 km');
});

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
test('RDCA accepts verified point schema and successful empty feed without inventing observation time', async () => {
  expect(normalizeRdca({ id: 1, geometry: { type: 'Point', coordinates: [106, -6] }, properties: {} })).toMatchObject({ coordinates: [-6, 106], updatedAt: null });
  expect(normalizeRdca({ id: 1, geometry: { type: 'Point', coordinates: [200, -6] } })).toBeNull();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ type: 'FeatureCollection', features: [] }) });
  expect(await fetchRdca()).toMatchObject({ points: [], updatedAt: null });
  expect(global.fetch.mock.calls[0][0]).toContain('/rdca/FeatureServer/1/query');
});

test('felt earthquake feed preserves potential and directional coordinates', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ Infogempa: { gempa: [{ Coordinates: '-6,106', Magnitude: '4.1', Potensi: 'Informasi uji' }] } }) });
  expect((await fetchFeltEarthquakes()).history[0]).toMatchObject({ coordinates: [-6, 106], magnitude: 4.1, potential: 'Informasi uji' });
  expect(global.fetch.mock.calls[0][0]).toContain('gempadirasakan.json');
});
