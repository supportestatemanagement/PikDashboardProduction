import { fetchNowcasting, normalizeNowcasting, nowcastingDate, visibleNowcasting, nowcastingStyle } from './bmkgNowcasting';

// Synthetic contract fixtures; no active official polygon was available at verification.
const feature = (id = 1, properties = {}) => ({ type: 'Feature', id,
  geometry: { type: 'Polygon', coordinates: [[[105, -6], [106, -6], [106, -5], [105, -6]]] },
  properties: { tipearea: 'Area Terjadi', namakecamatan: 'Wilayah Uji', waktupembuatan: 1790211600000, ...properties },
});
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
const response = features => ({ type: 'FeatureCollection', features });
const mockFetch = (...payloads) => { global.fetch = jest.fn(); payloads.forEach(payload => global.fetch.mockResolvedValueOnce({ ok: true, json: async () => payload })); };

test('normalizes only source fields and rejects malformed polygon coordinates', () => {
  const result = normalizeNowcasting(feature());
  expect(result.properties).toMatchObject({ region: 'Wilayah Uji', areaType: 'Area Terjadi', validFrom: null, validUntil: null, impactCategory: null });
  expect(result.properties).not.toHaveProperty('potential');
  expect(nowcastingDate(null)).toBeNull();
  expect(nowcastingDate('2026-09-24')).toBeNull();
  expect(nowcastingDate(0)).toBe('1970-01-01T00:00:00.000Z');
  expect(normalizeNowcasting({ ...feature(), geometry: { type: 'Point', coordinates: [105, -6] } })).toBeNull();
  expect(normalizeNowcasting({ ...feature(), geometry: { type: 'Polygon', coordinates: [[[181, 0], [105, 0], [106, 1], [181, 0]]] } })).toBeNull();
  const multi = { ...feature(), geometry: { type: 'MultiPolygon', coordinates: [feature().geometry.coordinates] } };
  expect(normalizeNowcasting(multi).geometry.type).toBe('MultiPolygon');
});

test('known validity hides expired and future warnings; missing dates are not fabricated', () => {
  const features = [feature(1, { waktuberlaku: 1000, waktuberakhir: 3000 }), feature(2, { waktuberlaku: 3000, waktuberakhir: 5000 }), feature(3)].map(normalizeNowcasting);
  expect(visibleNowcasting(features, 2000).map(v => v.id)).toEqual(['1', '3']);
  expect(visibleNowcasting(features, 3000).map(v => v.id)).toEqual(['2', '3']);
  expect(normalizeNowcasting(feature(4, { waktuberlaku: 5000, waktuberakhir: 4000 }))).toBeNull();
  expect(nowcastingStyle(features[0]).color).toBe('#a855f7');
  expect(nowcastingStyle({ properties: { areaType: 'Area Meluas' } }).color).toBe('#6366f1');
});

test('uses verified MapServer GeoJSON query and treats empty source as valid without official update timestamp', async () => {
  mockFetch(response([]));
  const result = await fetchNowcasting();
  expect(result).toMatchObject({ features: [], rawCount: 0, latestIssuedAt: null, invalidCount: 0 });
  const url = new URL(global.fetch.mock.calls[0][0]);
  expect(url.pathname).toContain('/nowcasting_public/MapServer/2/query');
  expect(url.searchParams.get('f')).toBe('geojson');
  expect(url.searchParams.get('outSR')).toBe('4326');
  expect(url.searchParams.get('returnZ')).toBe('false');
});

test('paginates full responses and refuses service errors or duplicate pages', async () => {
  const page = Array.from({ length: 2000 }, (_, index) => feature(index));
  mockFetch(response(page), response([feature(2000)]));
  expect((await fetchNowcasting()).features).toHaveLength(2001);
  expect(new URL(global.fetch.mock.calls[1][0]).searchParams.get('resultOffset')).toBe('2000');
  mockFetch(response(page), response([feature(0)]));
  await expect(fetchNowcasting()).rejects.toThrow('Unstable');
  mockFetch({ error: { code: 500 } });
  await expect(fetchNowcasting()).rejects.toThrow();
  mockFetch({ features: [] });
  await expect(fetchNowcasting()).rejects.toThrow('Invalid');
});

test('counts invalid records separately and fails when all polygons are unusable', async () => {
  mockFetch(response([feature(), { ...feature(2), geometry: null }]));
  expect(await fetchNowcasting()).toMatchObject({ rawCount: 2, invalidCount: 1 });
  mockFetch(response([{ ...feature(2), geometry: null }]));
  await expect(fetchNowcasting()).rejects.toThrow('No usable');
});
