import { fetchJson, numberValue, sourceDate } from './client';
export const WEATHER_REFRESH_INTERVAL = 30 * 60 * 1000;
export const WEATHER_LOCATIONS = [
  { id: 'pik1', label: 'PIK 1 — Kamal Muara', adm4: process.env.REACT_APP_BMKG_WEATHER_ADM4_PIK1 || '' },
  { id: 'pik2', label: 'PIK 2 — Salembaran Jati', adm4: process.env.REACT_APP_BMKG_WEATHER_ADM4_PIK2 || '' },
];
export const weatherLoaders = WEATHER_LOCATIONS.map(({ adm4 }) => signal => fetchWeather(adm4, signal));
const directions = { N: 'Utara', NE: 'Timur Laut', E: 'Timur', SE: 'Tenggara', S: 'Selatan', SW: 'Barat Daya', W: 'Barat', NW: 'Barat Laut' };
export function normalizeWeather(payload, now = Date.now()) {
  const forecasts = (payload.data || []).flatMap(entry => (entry.cuaca || []).flat().map(row => ({ row, location: entry.lokasi || payload.lokasi })));
  const candidates = forecasts.map(({ row, location }) => ({ row, location,
    time: sourceDate(row.utc_datetime || row.datetime) || sourceDate(row.local_datetime, '+07:00')
  })).filter(item => item.time).sort((a, b) => Math.abs(Date.parse(a.time) - now) - Math.abs(Date.parse(b.time) - now));
  if (!candidates.length) throw new Error('No valid weather forecast');
  const { row, location, time } = candidates[0];
  const image = /^https:\/\/([\w-]+\.)*bmkg\.go\.id\//.test(row.image || '') ? row.image : null;
  return { temperature: numberValue(row.t), description: row.weather_desc || '', humidity: numberValue(row.hu),
    windSpeed: numberValue(row.ws), windDirection: directions[row.wd] || row.wd || '', localDatetime: time, image,
    visibility: typeof row.vs_text === 'string' && row.vs_text.trim() ? row.vs_text : null,
    cloudCover: numberValue(row.tcc),
    location: [location?.desa, location?.kecamatan, location?.kotkab, location?.provinsi].filter(Boolean).join(', '),
    updatedAt: sourceDate(row.analysis_date) || new Date(now).toISOString(), timestampLabel: row.analysis_date ? 'Produksi prakiraan' : 'Terakhir diambil' };
}
export async function fetchWeather(adm4, signal) {
  if (!/^\d{2}\.\d{2}\.\d{2}\.\d{4}$/.test(adm4)) throw new Error('ADM4 belum dikonfigurasi');
  return normalizeWeather(await fetchJson('https://api.bmkg.go.id/publik/prakiraan-cuaca?' + new URLSearchParams({ adm4 }), signal));
}
