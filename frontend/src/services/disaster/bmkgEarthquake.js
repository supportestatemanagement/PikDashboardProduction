import { fetchJson, numberValue, sourceDate, validCoordinates } from './client';
export const EARTHQUAKE_REFRESH_INTERVAL = 5 * 60 * 1000;
const BASE = 'https://data.bmkg.go.id/DataMKG/TEWS/';
export function parseCoordinates(value) {
  const parts = typeof value === 'string' ? value.split(',') : [];
  return parts.length === 2 ? validCoordinates(numberValue(parts[0]), numberValue(parts[1])) : null;
}
function directionCoordinate(value) {
  const match = String(value || '').trim().match(/^([+-]?\d+(?:\.\d+)?)\s*(LU|LS|BT|BB)$/i);
  return match ? Number(match[1]) * (/LS|BB/i.test(match[2]) ? -1 : 1) : null;
}
export function normalizeEarthquake(row) {
  const coordinates = parseCoordinates(row.Coordinates || row.coordinates)
    || validCoordinates(directionCoordinate(row.Lintang), directionCoordinate(row.Bujur));
  const datetime = sourceDate(row.DateTime);
  return { id: `${datetime || row.Tanggal + row.Jam}-${coordinates?.join(',') || row.Wilayah}`,
    date: row.Tanggal || '', time: row.Jam || '', datetime,
    magnitude: numberValue(row.Magnitude), depth: numberValue(String(row.Kedalaman ?? '').replace(/\s*km/i, '')),
    region: row.Wilayah || '', potential: row.Potensi || '', coordinates, latitude: coordinates?.[0] ?? null, longitude: coordinates?.[1] ?? null,
    felt: row.Dirasakan && row.Dirasakan !== '-' ? row.Dirasakan : '',
    shakemap: /^[\w.-]+\.jpg$/.test(row.Shakemap || '') ? `https://static.bmkg.go.id/${row.Shakemap}` : null };
}
export async function fetchLatestEarthquake(signal) {
  const data = await fetchJson(BASE + 'autogempa.json', signal);
  if (!data.Infogempa?.gempa || Array.isArray(data.Infogempa.gempa)) throw new Error('Invalid earthquake response');
  const latest = normalizeEarthquake(data.Infogempa.gempa);
  return { latest, updatedAt: latest.datetime || new Date().toISOString(), timestampLabel: latest.datetime ? 'Waktu kejadian' : 'Terakhir diambil' };
}
export async function fetchEarthquakeHistory(signal) {
  const data = await fetchJson(BASE + 'gempaterkini.json', signal);
  if (!Array.isArray(data.Infogempa?.gempa)) throw new Error('Invalid earthquake history');
  const unique = new Map(data.Infogempa.gempa.map(normalizeEarthquake).filter(row => row.magnitude >= 5).map(row => [row.id, row]));
  const history = [...unique.values()].sort((a, b) => (Date.parse(b.datetime) || 0) - (Date.parse(a.datetime) || 0));
  return { history, updatedAt: history[0]?.datetime || new Date().toISOString(), timestampLabel: history[0]?.datetime ? 'Kejadian M5+ terbaru' : 'Terakhir diambil' };
}
export async function fetchFeltEarthquakes(signal) {
  const data = await fetchJson(BASE + 'gempadirasakan.json', signal);
  if (!Array.isArray(data.Infogempa?.gempa)) throw new Error('Invalid felt earthquake response');
  const history = [...new Map(data.Infogempa.gempa.map(normalizeEarthquake).map(row => [row.id, row])).values()];
  return { history, updatedAt: history[0]?.datetime || null, timestampLabel: 'Kejadian dirasakan terbaru' };
}
