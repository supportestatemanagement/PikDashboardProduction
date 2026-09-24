import { fetchJson } from './client';
export { getEnsoCategory, ensoImpact } from './ensoClassification';
export const ENSO_REFRESH_INTERVAL = 6 * 60 * 60 * 1000;
export const ENSO_SOURCE_URL = 'https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for';
// Signed weekly change, not event intensity. Feed precision is 0.1 degree.
export const ENSO_TREND_THRESHOLD = 0.05;
export function getEnsoTrend(series) {
  if (!Array.isArray(series) || series.length < 2) return null;
  const delta = series[series.length - 1].value - series[series.length - 2].value;
  return Math.abs(delta) < ENSO_TREND_THRESHOLD ? 'Stabil' : delta > 0 ? 'Menguat' : 'Melemah';
}
export async function fetchEnso(signal) {
  const response = await fetchJson(`${process.env.REACT_APP_API_URL || ''}/api/disaster/enso`, signal);
  const data = response.data;
  if (!response.success || !Number.isFinite(data?.value) || data.periodType !== 'week-centered' || !Number.isFinite(Date.parse(data.periodDate)) || !Array.isArray(data.series) || !data.series.length || data.series.some(row => !Number.isFinite(row.value) || !Number.isFinite(Date.parse(row.date)))) throw new Error('Invalid NOAA response');
  return { ...data, period: `Week centered ${new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(data.periodDate))}` };
}
