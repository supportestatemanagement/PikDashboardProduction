import { fetchJson, numberValue } from './client';
export const MARITIME_REFRESH_INTERVAL = 30 * 60 * 1000;
const API_URL = process.env.REACT_APP_API_URL || '';
export const MARITIME_LOCATIONS = [
  { id: 'pik1', label: 'PIK 1', port: 'Pelabuhan Muara Angke', code: 'XJ003', slug: 'pelabuhan-muara-angke' },
  { id: 'pik2', label: 'PIK 2', port: 'Pelabuhan Tanjung Pasir', code: 'XI003', slug: 'pelabuhan-tanjung-pasir' },
];
export function maritimeDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/.test(value)) return null;
  const date = new Date(value.replace(' ', 'T').replace(' UTC', ':00Z'));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
export function normalizeMaritime(payload, location, now = Date.now()) {
  if (payload?.code !== location.code || payload?.name !== location.port) throw new Error('Unexpected maritime reference');
  const forecasts = [...(payload.forecast_day1 || []), ...(payload['forecast_day2-4'] || [])].map(row => ({ ...row, validAt: maritimeDate(row.time) })).filter(row => row.validAt);
  forecasts.sort((a, b) => Math.abs(Date.parse(a.validAt) - now) - Math.abs(Date.parse(b.validAt) - now));
  if (!forecasts.length) throw new Error('No maritime forecast');
  const row = forecasts[0];
  const validFrom = maritimeDate(payload.valid_from), validUntil = maritimeDate(payload.valid_to), updatedAt = maritimeDate(payload.issued);
  if (!validFrom || !validUntil || !updatedAt) throw new Error('Invalid maritime validity');
  return { validFrom, validUntil, updatedAt, validAt: row.validAt, weather: row.weather,
    tides: numberValue(row.tides), waveHeight: numberValue(row.wave_height), waveCategory: row.wave_cat,
    windSpeed: numberValue(row.wind_speed), windFrom: row.wind_from,
    currentSpeed: numberValue(row.current_speed), currentTo: row.current_to, visibility: numberValue(row.visibility),
    sourceUrl: `https://maritim.bmkg.go.id/cuaca/pelabuhan/${location.slug}` };
}
export const maritimeLoaders = MARITIME_LOCATIONS.map(location => async signal => {
  const result = await fetchJson(`${API_URL}/api/disaster/maritime/${location.id}`, signal);
  if (result.success !== true) throw new Error('Maritime unavailable');
  return normalizeMaritime(result.data, location);
});
