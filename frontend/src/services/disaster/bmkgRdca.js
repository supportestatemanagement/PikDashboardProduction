import { fetchJson, numberValue, validCoordinates } from './client';
export const RDCA_REFRESH_INTERVAL = 5 * 60 * 1000;
export const RDCA_LAYER_NAME = 'RDCA - Pertumbuhan Awan Cepat';
export const RDCA_URL = 'https://datacuaca.bmkg.go.id/arcgis/rest/services/production/rdca/FeatureServer/1';
export function normalizeRdca(feature) {
  const p = feature.properties || {};
  const xy = feature.geometry?.type === 'Point' ? feature.geometry.coordinates : [];
  const coordinates = validCoordinates(numberValue(xy?.[1]), numberValue(xy?.[0]));
  const time = typeof p.system_date === 'number' ? new Date(p.system_date) : null;
  const id = feature.id ?? p.objectid;
  if (!coordinates || id == null) return null;
  return { id: String(id), coordinates, updatedAt: time && Number.isFinite(time.getTime()) ? time.toISOString() : null };
}
export async function fetchRdca(signal) {
  const points = [];
  const seen = new Set();
  let invalidCount = 0;
  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({ where: '1=1', outFields: '*', outSR: '4326', returnGeometry: 'true', f: 'geojson', orderByFields: 'objectid ASC', resultOffset: String(page * 2000), resultRecordCount: '2000' });
    const data = await fetchJson(`${RDCA_URL}/query?${params}`, signal);
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Invalid RDCA response');
    for (const raw of data.features) {
      const point = normalizeRdca(raw);
      if (!point) { invalidCount += 1; continue; }
      if (seen.has(point.id)) throw new Error('Unstable RDCA response');
      seen.add(point.id); points.push(point);
    }
    if (data.features.length < 2000 && !data.exceededTransferLimit) {
      if (!points.length && invalidCount) throw new Error('Invalid RDCA geometry');
      const times = points.map(p => p.updatedAt).filter(Boolean).sort();
      return { points, invalidCount, updatedAt: times[times.length - 1] || null, fetchedAt: new Date().toISOString() };
    }
    if (data.features.length !== 2000) throw new Error('Incomplete RDCA response');
  }
  throw new Error('RDCA response too large');
}
