import { fetchJson } from './client';

// Verified MapServer feature sublayer. This service is NOT a FeatureServer.
export const NOWCASTING_SERVICE = 'https://datacuaca.bmkg.go.id/arcgis/rest/services/production/nowcasting_public/MapServer';
export const NOWCASTING_LAYER_URL = `${NOWCASTING_SERVICE}/2`;
export const NOWCASTING_LAYER_NAME = 'Peringatan Dini Cuaca';
export const NOWCASTING_REFRESH_INTERVAL = 5 * 60 * 1000;
// Official tipearea renderer values, not severity levels. UI colors deliberately
// differ from earthquakes and hotspots; these are not BMKG's palette.
export const NOWCASTING_AREA_CONFIG = {
  'Area Terjadi': { color: '#a855f7', dashArray: undefined },
  'Area Meluas': { color: '#6366f1', dashArray: '6 4' },
};
export const nowcastingStyle = feature => ({
  ...(NOWCASTING_AREA_CONFIG[feature?.properties?.areaType] || { color: '#94a3b8' }),
  weight: 2, fillOpacity: 0.18,
});
const FIELDS = 'objectid,idlaporan,namakecamatan,namakotakab,namaprovinsi,kategoridampak,waktuberlaku,waktupembuatan,waktuberakhir,tipearea,laporanlapangan,upt';
const PAGE_SIZE = 2000;
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
// ArcGIS esriFieldTypeDate: epoch milliseconds; metadata datesInUnknownTimezone=false.
export function nowcastingDate(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
const validPoint = point => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90;
const validRing = ring => Array.isArray(ring) && ring.length >= 4 && ring.every(validPoint) && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
const validPolygon = coordinates => Array.isArray(coordinates) && coordinates.length > 0 && coordinates.every(validRing);
export function validNowcastingGeometry(geometry) {
  return geometry?.type === 'Polygon' ? validPolygon(geometry.coordinates) : geometry?.type === 'MultiPolygon' && Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0 && geometry.coordinates.every(validPolygon);
}

export function normalizeNowcasting(feature) {
  if (feature?.type !== 'Feature' || !validNowcastingGeometry(feature.geometry)) return null;
  const p = feature.properties || {};
  const id = feature.id ?? p.objectid;
  if (!['string', 'number'].includes(typeof id) || String(id).trim() === '' || (typeof id === 'number' && !Number.isFinite(id))) return null;
  const validFrom = nowcastingDate(p.waktuberlaku);
  const validUntil = nowcastingDate(p.waktuberakhir);
  if (validFrom && validUntil && Date.parse(validUntil) <= Date.parse(validFrom)) return null;
  return { type: 'Feature', id: String(id), geometry: feature.geometry, properties: {
    reportId: text(p.idlaporan), areaType: text(p.tipearea),
    region: [p.namakecamatan, p.namakotakab, p.namaprovinsi].map(text).filter(Boolean).join(', '),
    impactCategory: text(p.kategoridampak), validFrom, validUntil,
    issuedAt: nowcastingDate(p.waktupembuatan), fieldReport: text(p.laporanlapangan), unit: text(p.upt),
  } };
}

// Unknown validity remains explicitly unverified; known expired/future records
// are hidden even between network refreshes. No warning type is inferred.
export function visibleNowcasting(features, now = Date.now()) {
  return features.filter(({ properties: p }) => (!p.validFrom || Date.parse(p.validFrom) <= now) && (!p.validUntil || Date.parse(p.validUntil) > now));
}

export async function fetchNowcasting(signal) {
  const features = [];
  const seen = new Set();
  let invalidCount = 0;
  let rawCount = 0;
  // Bound requests and reject truncated/unstable pages rather than reporting a
  // partial national warning dataset as complete. 2000 is the verified server limit.
  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({ where: '1=1', outFields: FIELDS, returnGeometry: 'true', outSR: '4326', returnZ: 'false', f: 'geojson', orderByFields: 'objectid ASC', resultOffset: String(page * PAGE_SIZE), resultRecordCount: String(PAGE_SIZE) });
    const response = await fetchJson(`${NOWCASTING_LAYER_URL}/query?${params}`, signal);
    if (response.type !== 'FeatureCollection' || !Array.isArray(response.features)) throw new Error('Invalid nowcasting GeoJSON');
    rawCount += response.features.length;
    for (const raw of response.features) {
      const feature = normalizeNowcasting(raw);
      if (!feature) { invalidCount += 1; continue; }
      if (seen.has(feature.id)) throw new Error('Unstable nowcasting pagination');
      seen.add(feature.id);
      features.push(feature);
    }
    if (response.features.length < PAGE_SIZE && response.exceededTransferLimit !== true) {
      if (rawCount > 0 && !features.length) throw new Error('No usable nowcasting polygons');
      const dates = features.map(feature => feature.properties.issuedAt).filter(Boolean).sort();
      return { features, rawCount, invalidCount, latestIssuedAt: dates[dates.length - 1] || null, fetchedAt: new Date().toISOString() };
    }
    if (response.features.length !== PAGE_SIZE) throw new Error('Incomplete nowcasting page');
  }
  throw new Error('Nowcasting response exceeds safe page limit');
}
