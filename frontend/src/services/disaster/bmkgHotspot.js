import { fetchJson, numberValue, validCoordinates } from './client';
export const HOTSPOT_REFRESH_INTERVAL = 15 * 60 * 1000;
const QUERY = 'https://datacuaca.bmkg.go.id/arcgis/rest/services/production/geohotspot/FeatureServer/0/query';
export function normalizeHotspot(feature) {
  const p = feature.properties || {};
  const coords = feature.geometry?.type === 'Point' ? feature.geometry.coordinates : [];
  const coordinates = validCoordinates(numberValue(coords?.[1]), numberValue(coords?.[0]));
  return { id: String(feature.id ?? p.objectid ?? `${coordinates}-${p.date}-${p.time}`), coordinates,
    province: p.provinsi, district: p.kabupaten, subdistrict: p.kecamatan, date: p.date, time: p.time,
    updatedAt: numberValue(p.system_date) !== null ? new Date(Number(p.system_date)).toISOString() : null };
}
export async function fetchHotspots(signal) {
  // The public service includes historical records. Load the latest available
  // observation date, rather than plotting years of old detections as current.
  const latestParams = new URLSearchParams({ where: '1=1', outFields: 'date', returnGeometry: 'false', f: 'json', orderByFields: 'date_full DESC', resultRecordCount: '1' });
  const latest = await fetchJson(QUERY + '?' + latestParams, signal);
  const date = latest.features?.[0]?.attributes?.date;
  if (!date && Array.isArray(latest.features) && latest.features.length === 0) return { hotspots: [], updatedAt: new Date().toISOString(), timestampLabel: 'Terakhir diambil' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('Invalid hotspot date');
  const records = new Map();
  const countResult = await fetchJson(QUERY + '?' + new URLSearchParams({ where: `date='${date}'`, returnCountOnly: 'true', f: 'json' }), signal);
  if (!Number.isInteger(countResult.count) || countResult.count < 0 || countResult.count > 100000) throw new Error('Invalid hotspot count');
  const offsets = Array.from({ length: Math.ceil(countResult.count / 2000) }, (_, index) => index * 2000);
  const loadPage = async offset => {
    const params = new URLSearchParams({ where: `date='${date}'`, outFields: '*', returnGeometry: 'true', f: 'geojson', outSR: '4326', orderByFields: 'objectid ASC', resultOffset: String(offset), resultRecordCount: '2000' });
    const data = await fetchJson(QUERY + '?' + params, signal);
    if (!Array.isArray(data.features)) throw new Error('Invalid hotspot response');
    if (data.features.length !== Math.min(2000, countResult.count - offset)) throw new Error('Incomplete hotspot page');
    return data;
  };
  // Bounded concurrency avoids serial delays without flooding the public service.
  for (let index = 0; index < offsets.length; index += 3) {
    const pages = await Promise.allSettled(offsets.slice(index, index + 3).map(loadPage));
    if (pages.some(page => page.status === 'rejected')) throw new Error('Incomplete hotspot response');
    pages.forEach(page => {
      const data = page.value;
    data.features.map(normalizeHotspot).filter(row => row.coordinates).forEach(row => records.set(row.id, row));
    });
  }
  const hotspots = [...records.values()];
  const timestamps = hotspots.map(row => row.updatedAt).filter(Boolean).sort();
  return { hotspots, observationDate: date, updatedAt: timestamps[timestamps.length - 1] || new Date().toISOString(), timestampLabel: timestamps.length ? 'Pembaruan sumber hotspot' : 'Terakhir diambil' };
}
