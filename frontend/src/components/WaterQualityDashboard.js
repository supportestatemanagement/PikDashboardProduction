import { useEffect, useMemo, useState } from "react";
import "./WaterQualityDashboard.css";
import WaterQualityTrend, { formatTrendValue } from "./WaterQualityTrend";

const columns = [
  ["TANGGAL", "Date"], ["JAM", "Time"],
  ["LOKASI SAMPLING", "Sampling Location"], ["WARNA AIR", "Water Color"],
  ["TDS", "TDS"], ["TEKANAN AIR", "Water Pressure"],
  ["KETERANGAN", "pH"], ["AREA", "Area"],
];
const areas = [
  ["BGM", "/logobgm.png"], ["GI", "/logogi2.png"],
  ["RWI", "/logorwi2.png"], ["PIK 2", "/logopik2.png"],
  ["PIK 2 Millenial", "/logopik2mil2.png"],
];
export function parseWaterDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2})[- /]+([a-z]+|\d{1,2})[- /]+(\d{2}|\d{4})$/i);
  if (match) {
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, mei: 4, jun: 5, jul: 6, aug: 7, agu: 7, sep: 8, oct: 9, okt: 9, nov: 10, dec: 11, des: 11 };
    const month = /^\d+$/.test(match[2]) ? Number(match[2]) - 1 : months[match[2].slice(0, 3).toLowerCase()];
    const year = Number(match[3]) + (match[3].length === 2 ? 2000 : 0);
    const date = new Date(year, month, Number(match[1]));
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === Number(match[1]) ? date.getTime() : null;
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return parseWaterDate(`${iso[3]}/${iso[2]}/${iso[1]}`);
  // The sheet also contains long English dates, e.g. Tuesday, September 22, 2026.
  const date = text ? new Date(text) : null;
  return date && Number.isFinite(date.getTime()) ? new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() : null;
}
export function tdsNumber(value) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}
export function tdsStatus(value) {
  const number = tdsNumber(value);
  return number === null ? "unknown" : number < 300 ? "green" : "red";
}
function areaName(value) {
  const area = String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
  return areas.find(([name]) => name.toUpperCase() === area)?.[0] || "Other";
}
export function phNumber(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/\bp\s*h\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i);
  return tdsNumber(match ? match[1] : text);
}
const normalize = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
export function phStatus(value) {
  const number = phNumber(value);
  return number === null ? 'unknown' : number >= 6.5 && number <= 8.5 ? 'green' : 'red';
}
const bands = [['green', '< 300'], ['red', '≥ 300']];
const phBands = [['green', '6.5–8.5'], ['red', '< 6.5 / > 8.5']];
const accents = ['#D32F2F', '#F57C00', '#388E3C', '#1976D2', '#8E24AA'];
function cellValue(row, key) {
  if (key === 'TANGGAL') return formatWaterDate(row[key]);
  if (key === 'JAM') return formatWaterTime(row[key]);
  return key === 'KETERANGAN' ? phNumber(row[key]) ?? '' : String(row[key] ?? '').trim();
}
function sampleTime(row) {
  const date = parseWaterDate(row.TANGGAL);
  if (date === null) return null;
  return date + (timeMinutes(row.JAM) ?? 0) * 60000;
}
const sortableKeys = ['TANGGAL', 'JAM', 'TDS', 'KETERANGAN'];
function timeMinutes(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})[:.,](\d{2})(?::(\d{2}))?$/);
  return match && Number(match[1]) < 24 && Number(match[2]) < 60 && Number(match[3] || 0) < 60
    ? Number(match[1]) * 60 + Number(match[2]) + Number(match[3] || 0) / 60 : null;
}
export function formatWaterDate(value) {
  const time = parseWaterDate(value);
  if (time === null) return '';
  const date = new Date(time);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(date.getDate()).padStart(2, '0')}-${months[date.getMonth()]}-${String(date.getFullYear()).slice(-2)}`;
}
export function formatWaterTime(value) {
  const minutes = timeMinutes(value);
  return minutes === null ? '' : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`;
}
function SortIcon({ direction }) {
  return <svg width="14" height="16" viewBox="0 0 14 16" fill="none" aria-hidden="true"><path d="m3 6 4-4 4 4" stroke="currentColor" strokeWidth="1.8" opacity={direction === 'descending' ? 0.25 : 1} /><path d="m3 10 4 4 4-4" stroke="currentColor" strokeWidth="1.8" opacity={direction === 'ascending' ? 0.25 : 1} /></svg>;
}
export function summarizeMeasurements(samples) {
  const tds = samples.map(row => ({ value: tdsNumber(row.TDS), location: String(row['LOKASI SAMPLING'] || '').trim() })).filter(row => row.value !== null);
  const ph = samples.map(row => phNumber(row.KETERANGAN)).filter(value => value !== null).sort((a, b) => a - b);
  const extreme = direction => {
    if (!tds.length) return { value: null, locations: '' };
    const value = Math[direction](...tds.map(row => row.value));
    return { value, locations: [...new Set(tds.filter(row => row.value === value).map(row => row.location || 'Location unavailable'))].join(', ') };
  };
  const middle = Math.floor(ph.length / 2);
  return { minTds: extreme('min'), maxTds: extreme('max'),
    medianPh: ph.length ? Number((ph.length % 2 ? ph[middle] : (ph[middle - 1] + ph[middle]) / 2).toFixed(3)) : null,
    minPh: ph.length ? ph[0] : null, maxPh: ph.length ? ph[ph.length - 1] : null,
    minPhLocations: [...new Set(samples.filter(row => ph.length && phNumber(row.KETERANGAN) === ph[0]).map(row => String(row['LOKASI SAMPLING'] || 'Location unavailable').trim()))].join(', '),
    maxPhLocations: [...new Set(samples.filter(row => ph.length && phNumber(row.KETERANGAN) === ph[ph.length - 1]).map(row => String(row['LOKASI SAMPLING'] || 'Location unavailable').trim()))].join(', ') };
}
export function dailyMeasurementPoints(rows, metric) {
  const groups = new Map();
  rows.forEach(row => {
    const time = parseWaterDate(row.TANGGAL), area = areaName(row.AREA);
    const value = metric === 'TDS' ? tdsNumber(row.TDS) : phNumber(row.KETERANGAN);
    if (time === null || value === null || area === 'Other') return;
    const id = `${area}-${time}`;
    if (!groups.has(id)) groups.set(id, { id, area, time, values: [] });
    groups.get(id).values.push(value);
  });
  return [...groups.values()].map(({ values, ...point }) => {
    values.sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    const value = metric === 'TDS' ? values.reduce((sum, number) => sum + number, 0) / values.length
      : values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    return { ...point, value, count: values.length };
  }).sort((a, b) => a.time - b.time);
}
export function measurementPoints(rows, metric) {
  return rows.map((row, id) => {
    const date = parseWaterDate(row.TANGGAL), time = timeMinutes(row.JAM);
    return { id, time: date === null || time === null ? null : date + time * 60000,
      value: metric === 'TDS' ? tdsNumber(row.TDS) : phNumber(row.KETERANGAN),
      area: areaName(row.AREA), location: String(row['LOKASI SAMPLING'] || 'Location unavailable') };
  }).filter(point => point.time !== null && point.value !== null && point.area !== 'Other').sort((a, b) => a.time - b.time);
}
export function compareMeasurements(a, b, sort) {
  const value = row => sort.key === 'TANGGAL' ? sampleTime(row) : sort.key === 'JAM' ? timeMinutes(row.JAM) : sort.key === 'TDS' ? tdsNumber(row.TDS) : phNumber(row.KETERANGAN);
  const left = value(a), right = value(b);
  if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
  return (left - right) * (sort.direction === 'ascending' ? 1 : -1);
}
export default function WaterQualityDashboard({ dateRange }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState({ key: 'TANGGAL', direction: 'descending' });
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch(`${process.env.REACT_APP_API_URL || ''}/api/water-quality-data`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Request failed');
        const result = await response.json();
        if (result.status !== 'success' || !Array.isArray(result.data)) throw new Error('Invalid response');
        if (!controller.signal.aborted) setRecords(result.data);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  const dated = useMemo(() => records.filter(row => {
    if (!dateRange) return true;
    const date = parseWaterDate(row.TANGGAL);
    return date !== null && date >= new Date(dateRange.start).setHours(0, 0, 0, 0)
      && date <= new Date(dateRange.end).setHours(23, 59, 59, 999);
  }), [records, dateRange]);
  const summaries = useMemo(() => areas.map(([name, logo], index) => {
    const samples = dated.filter(row => areaName(row.AREA) === name);
    const values = samples.map(row => tdsNumber(row.TDS)).filter(value => value !== null);
    const statistics = summarizeMeasurements(samples);
    const counts = samples.reduce((result, row) => { result[tdsStatus(row.TDS)]++; return result; }, { green: 0, red: 0, unknown: 0 });
    const times = samples.map(sampleTime).filter(value => value !== null);
    return { ...statistics, name, logo, accent: accents[index], samples: samples.length, counts,
      locations: new Set(samples.map(row => normalize(row['LOKASI SAMPLING'])).filter(Boolean)).size,
      average: values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : '—',
      latest: times.length ? new Date(Math.max(...times)).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' };
  }), [dated]);
  const options = useMemo(() => Object.fromEntries(['WARNA AIR', 'TEKANAN AIR', 'AREA'].map(key => [key,
    [...new Set(dated.map(row => normalize(row[key]) || 'Not recorded'))].sort()
  ])), [dated]);
  const rows = useMemo(() => dated.filter(row => {
    return columns.some(([key]) => normalize(cellValue(row, key)).includes(normalize(search))) && columns.every(([key]) => {
      const filter = filters[key];
      if (!filter) return true;
      if (key === 'TDS') return tdsStatus(row.TDS) === filter;
      if (key === 'KETERANGAN') return phStatus(row.KETERANGAN) === filter;
      if (options[key]) return (normalize(row[key]) || 'Not recorded') === filter;
      if (key === 'TANGGAL') return parseWaterDate(row.TANGGAL) === parseWaterDate(filter);
      return normalize(cellValue(row, key)).includes(normalize(filter));
    });
  }).sort((a, b) => compareMeasurements(a, b, sort)), [dated, search, filters, options, sort]);
  useEffect(() => setPage(1), [search, filters, dateRange, pageSize, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const trends = useMemo(() => ({ TDS: dailyMeasurementPoints(dated, 'TDS'), pH: dailyMeasurementPoints(dated, 'pH') }), [dated]);
  const setFilter = (key, value) => setFilters(previous => ({ ...previous, [key]: value }));
  const contentValue = value => loading ? <span className="water-loading-value" aria-label="Loading" /> : error ? 'Unavailable' : value;
  return <main className="water-quality" aria-label="Water quality dashboard">
    {error && <div role="alert">Unable to load water quality records. <button onClick={() => setReload(value => value + 1)}>Try again</button></div>}
      <section className="water-areas" aria-label="Water quality by area">
        {summaries.map(summary => <article className="water-area-card" key={summary.name} aria-busy={loading} aria-label={`${summary.name} water quality`} style={{ '--area-accent': summary.accent }}>
          <div className="water-area-heading"><img src={summary.logo} alt={summary.name} /><span className="water-location-count">{contentValue(`${summary.locations} sampling locations`)}</span></div>
          <div className="water-area-primary"><div><span>Average TDS</span><strong>{contentValue(summary.average)}</strong></div><div><span>Median pH</span><strong>{contentValue(summary.medianPh === null ? 'N/A' : formatTrendValue(summary.medianPh, 'pH'))}</strong></div><small>{contentValue(`${summary.samples} samples in selected period`)}</small></div>
          <div className="water-stat-grid">
            <div><span>Min TDS</span><strong>{contentValue(summary.minTds.value ?? 'N/A')}</strong><small>{contentValue(summary.minTds.locations || 'No measurements')}</small></div>
            <div><span>Max TDS</span><strong>{contentValue(summary.maxTds.value ?? 'N/A')}</strong><small>{contentValue(summary.maxTds.locations || 'No measurements')}</small></div>
            <div><span>Min pH</span><strong>{contentValue(summary.minPh ?? 'N/A')}</strong><small>{contentValue(summary.minPhLocations || 'No measurements')}</small></div>
            <div><span>Max pH</span><strong>{contentValue(summary.maxPh ?? 'N/A')}</strong><small>{contentValue(summary.maxPhLocations || 'No measurements')}</small></div>
          </div>
          <div className="water-area-bands">{bands.map(([status, label]) => <div key={status}><span><i className={status} />{label}</span><strong className={`water-count-${status}`}>{contentValue(summary.counts[status])}</strong><small>samples</small></div>)}</div>
          <div className="water-area-footer"><span>Latest sample: <b>{contentValue(summary.latest)}</b></span>{summary.counts.unknown > 0 && <span>{summary.counts.unknown} samples without TDS</span>}</div>
        </article>)}
      </section>
      <div className="water-trends">{['TDS', 'pH'].map(metric => <WaterQualityTrend key={metric} metric={metric} loading={loading} error={error} points={trends[metric]} areas={areas.map(([name]) => name)} />)}</div>
      <section className="water-records" aria-labelledby="water-records-title" aria-busy={loading}>
        <div className="water-toolbar"><div><h2 id="water-records-title">Water Quality Records</h2><p>{loading ? 'Loading records...' : error ? 'Records unavailable' : `${rows.length} matching records / ${pageSize} per page`}</p></div><label>Rows per page<select aria-label="Rows per page" value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>{[5, 10, 15, 20].map(size => <option key={size}>{size}</option>)}</select></label></div>
        <section className="water-filter-panel" aria-label="Record filters">
          <div className="water-filter-heading"><strong>Filter records</strong><button onClick={() => { setSearch(''); setFilters({}); }}>Clear filters</button></div>
          <div className="water-filter-grid"><label className="water-search">Search records<input type="search" value={search} placeholder="Enter a search keyword" onChange={event => setSearch(event.target.value)} /></label>
          {columns.map(([key, label]) => <label key={key}>{label}
            {key === 'TDS' ? <select aria-label="Filter TDS" value={filters[key] || ''} onChange={event => setFilter(key, event.target.value)}><option value="">All TDS</option>{bands.map(([status, band]) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}: {band}</option>)}</select>
            : key === 'KETERANGAN' ? <select aria-label="Filter pH" value={filters[key] || ''} onChange={event => setFilter(key, event.target.value)}><option value="">All pH</option>{phBands.map(([status, band]) => <option key={status} value={status}>{status === 'green' ? 'Green' : 'Red'}: {band}</option>)}</select>
            : options[key] ? <select aria-label={'Filter ' + label} value={filters[key] || ''} onChange={event => setFilter(key, event.target.value)}><option value="">All</option>{options[key].map(value => <option key={value} value={value}>{key === 'AREA' ? value.toUpperCase() : value[0].toUpperCase() + value.slice(1)}</option>)}</select>
            : <input aria-label={'Filter ' + label} type={key === 'TANGGAL' ? 'date' : 'text'} placeholder={key === 'JAM' ? 'Enter time (HH:MM)' : key === 'KETERANGAN' ? 'Enter pH value' : key === 'LOKASI SAMPLING' ? 'Enter sampling location' : 'Select a date'} value={filters[key] || ''} onChange={event => setFilter(key, event.target.value)} />}
          </label>)}</div>
        </section>
        <div className="water-table-scroll"><table><thead><tr>{columns.map(([key, label]) => <th key={key} scope="col" aria-sort={sortableKeys.includes(key) ? sort.key === key ? sort.direction : 'none' : undefined}>
          {sortableKeys.includes(key) ? <button aria-label={'Sort ' + label} onClick={() => setSort({ key, direction: sort.key === key && sort.direction === 'ascending' ? 'descending' : 'ascending' })}>{label} <SortIcon direction={sort.key === key ? sort.direction : undefined} /></button> : label}
        </th>)}</tr></thead>
          <tbody>{loading ? Array.from({ length: pageSize }, (_, index) => <tr key={index} aria-hidden="true">{columns.map(([key]) => <td key={key}><span className="water-loading-value" /></td>)}</tr>) : error ? <tr><td className="water-empty" colSpan={columns.length}>Records could not be loaded. Please try again.</td></tr> : rows.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((row, index) => <tr key={`${currentPage}-${index}`}>{columns.map(([key]) => <td key={key}>{key === 'TDS' ? <span className={`water-tds ${tdsStatus(row.TDS)}`} title={tdsStatus(row.TDS) === 'unknown' ? 'TDS unavailable' : `TDS ${bands.find(([status]) => status === tdsStatus(row.TDS))[1]}`}>{cellValue(row, key) || '—'}</span> : cellValue(row, key) === '' ? '—' : cellValue(row, key)}</td>)}</tr>)}{!loading && !error && rows.length === 0 && <tr><td className="water-empty" colSpan={columns.length}>No records match the selected dates and filters.</td></tr>}</tbody>
        </table></div>
        <footer className="water-pagination"><span>{rows.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, rows.length)} of {rows.length} records</span><div><button disabled={loading || error || currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pages}</span><button disabled={loading || error || currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></div></footer>
      </section>
  </main>;
}
