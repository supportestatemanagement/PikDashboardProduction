import { VOLCANOES } from './volcanoService';
import useDisasterSource from './useDisasterSource';

export const VOLCANO_REFRESH_INTERVAL = 10 * 60 * 1000;
export const VOLCANO_SOURCE = 'PVMBG — MAGMA Indonesia';
export const VOLCANO_SOURCE_URL = 'https://magma.esdm.go.id/';
export const VOLCANO_STATUS_CONFIG = {
  NORMAL: { level: 1, roman: 'I', color: '#22c55e' },
  WASPADA: { level: 2, roman: 'II', color: '#eab308' },
  SIAGA: { level: 3, roman: 'III', color: '#f97316' },
  AWAS: { level: 4, roman: 'IV', color: '#ef4444' },
};
export const VOLCANO_LEVELS = Object.fromEntries(Object.entries(VOLCANO_STATUS_CONFIG).map(([status, config]) => [config.level, status]));
export const VOLCANO_STATUS_ORDER = Object.keys(VOLCANO_STATUS_CONFIG).reverse();
export const isValidLatLng = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const coordinate = value => (typeof value === 'number' || typeof value === 'string') && String(value).trim() && Number.isFinite(Number(value)) ? Number(value) : null;
export function normalizeVolcanoLevel(value) {
  const label = String(value ?? '').trim().toUpperCase();
  if (/^[1-4]$/.test(label)) return Number(label);
  if (VOLCANO_STATUS_CONFIG[label]) return VOLCANO_STATUS_CONFIG[label].level;
  const match = label.match(/^LEVEL\s+(IV|III|II|I|[1-4])(?:\s*\((NORMAL|WASPADA|SIAGA|AWAS)\))?$/);
  if (!match) return null;
  const level = ({ I: 1, II: 2, III: 3, IV: 4 })[match[1]] || Number(match[1]);
  return match[2] && VOLCANO_LEVELS[level] !== match[2] ? null : level;
}

// Internal adapter contract, NOT an assumed upstream MAGMA response schema.
// A future verified source adapter must explicitly map its fields to this contract.
export function normalizeVolcano(row, source = VOLCANO_SOURCE) {
  if (!row || typeof row !== 'object') return null;
  const id = typeof row.id === 'number' ? String(row.id) : text(row.id);
  const name = text(row.name);
  const level = normalizeVolcanoLevel(row.level ?? row.status);
  if (!id || !name || !level || (row.status != null && normalizeVolcanoLevel(row.status) !== level)) return null;
  const latitude = coordinate(row.latitude);
  const longitude = coordinate(row.longitude);
  // Require an explicit timezone; never assign browser time or infer source timezone.
  const timestamp = text(row.updatedAt);
  const updatedAt = timestamp && /(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp) && Number.isFinite(Date.parse(timestamp)) ? new Date(timestamp).toISOString() : null;
  return { id, name, level, status: VOLCANO_LEVELS[level],
    latitude: isValidLatLng(latitude, longitude) ? latitude : null,
    longitude: isValidLatLng(latitude, longitude) ? longitude : null,
    location: text(row.location), updatedAt, recommendation: text(row.recommendation),
    lastActivity: text(row.lastActivity), source };
}

export function normalizeVolcanoResponse(payload) {
  if (payload?.success !== true || !Array.isArray(payload.data)) throw new Error('Invalid volcano response');
  const data = payload.data.map(row => normalizeVolcano(row));
  if (data.some(row => !row) || new Set(data.map(row => row.id)).size !== data.length) throw new Error('Invalid volcano records');
  const updatedAt = normalizeVolcano({ id: 'timestamp', name: 'timestamp', level: 1, updatedAt: payload.updatedAt }).updatedAt;
  return { data, source: VOLCANO_SOURCE, updatedAt, isFallback: false };
}

export const sortVolcanoes = rows => [...rows].sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, 'id'));
export const filterVolcanoes = (rows, status) => sortVolcanoes(rows.filter(row => status === 'ALL' || row.status === status));
export const countVolcanoes = rows => Object.fromEntries(VOLCANO_STATUS_ORDER.map(status => [status, rows.filter(row => row.status === status).length]));

export const FALLBACK_VOLCANO_DATA = {
  source: 'Fallback ilustratif', isFallback: true, updatedAt: null,
  data: VOLCANOES.map((row, index) => normalizeVolcano({ ...row, id: `fallback-${index}`, location: row.place }, 'Fallback ilustratif')),
};

// Integration intentionally disabled: no stable public list API verified.
// Do not scrape HTML, persist signatures/CSRF tokens, or invent an endpoint here.
export async function fetchVolcanoes() {
  throw new Error('Verified PVMBG/MAGMA adapter is not available');
}

// A verified adapter can be supplied later; it must return normalizeVolcanoResponse(...).
// useDisasterSource preserves the last successful response on background failures.
export default function useVolcanoSource(loader = null) {
  const state = useDisasterSource(loader || fetchVolcanoes, VOLCANO_REFRESH_INTERVAL, Boolean(loader));
  return { ...state, data: state.data || FALLBACK_VOLCANO_DATA, unavailable: !loader || state.error };
}
