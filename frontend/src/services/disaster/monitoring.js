export const isValidCenter = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite) && Math.abs(value[0]) <= 90 && Math.abs(value[1]) <= 180;
const radius = Number(process.env.REACT_APP_DISASTER_MONITORING_RADIUS_KM || 50);
export const MONITORING_RADIUS_KM = Number.isFinite(radius) && radius > 0 ? radius : 50;
// Existing HeatmapMap AREA_CONFIG references, not newly asserted survey centers.
export const MONITORING_CENTERS = [
  { id: 'pik1', label: 'PIK 1 (referensi BGM)', coordinates: [-6.1100, 106.7427] },
  { id: 'pik2', label: 'PIK 2 (referensi peta existing)', coordinates: [-6.051, 106.694] },
];
export function haversineKm(a, b) {
  if (!isValidCenter(a) || !isValidCenter(b)) return null;
  const rad = degrees => degrees * Math.PI / 180;
  const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export const countNearby = (points, center, radiusKm = MONITORING_RADIUS_KM) => !isValidCenter(center) ? null : points.filter(point => { const distance = haversineKm(center, point.coordinates); return distance !== null && distance <= radiusKm; }).length;
export function sourceStatus(source, rows) {
  if (!source || source.unavailable) return 'Unavailable';
  if (source.error) return 'Error';
  if (!source.data) return source.loading ? 'Loading' : 'Not loaded';
  if (Array.isArray(rows) && rows.length === 0) return 'No data';
  return 'Connected';
}
export function combinedStatus(sources) {
  const statuses = sources.map(source => sourceStatus(source));
  if (statuses.every(status => status === 'Connected')) return 'Connected';
  if (statuses.some(status => status === 'Connected')) return 'Partial';
  if (statuses.some(status => status === 'Error')) return 'Error';
  return statuses.includes('Loading') ? 'Loading' : 'Unavailable';
}
