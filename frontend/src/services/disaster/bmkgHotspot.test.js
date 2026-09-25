import { normalizeHotspot, hotspotConfidence } from './bmkgHotspot';

test.each([['low', 'low'], ['medium', 'medium'], ['high', 'high'], ['Rendah', 'low'], ['Sedang', 'medium'], ['Tinggi', 'high'], [undefined, 'unknown'], [80, 'unknown']])('preserves confidence %s without guessing missing or numeric scales', (value, expected) => {
  expect(hotspotConfidence(value)).toBe(expected);
});
test('current public hotspot schema stays unclassified when no confidence is provided', () => {
  expect(normalizeHotspot({ id: 1, geometry: { type: 'Point', coordinates: [106, -6] }, properties: { date: '2026-09-25' } })).toMatchObject({ coordinates: [-6, 106], confidence: 'unknown' });
});
