import { useEffect, useMemo, useState } from "react";
import "./WaterQualityDashboard.css";

const columns = [
  ["NO", "No."], ["TANGGAL", "Date"], ["JAM", "Time"],
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
  return number === null ? "unknown" : number < 300 ? "green" : number < 500 ? "orange" : "red";
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
const bands = [['green', '< 300'], ['orange', '300 – < 500'], ['red', '≥ 500']];
const accents = ['#285ac2', '#008493', '#5945be', '#287c69', '#a56127'];
function cellValue(row, key) {
  return key === 'KETERANGAN' ? phNumber(row[key]) ?? '' : String(row[key] ?? '').trim();
}
function sampleTime(row) {
  const date = parseWaterDate(row.TANGGAL);
  if (date === null) return null;
  const time = String(row.JAM || '').match(/^(\d{1,2})[:.](\d{2})/);
  return date + (time ? (Number(time[1]) * 60 + Number(time[2])) * 60000 : 0);
}
export default function WaterQualityDashboard({ dateRange }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
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
    const counts = samples.reduce((result, row) => { result[tdsStatus(row.TDS)]++; return result; }, { green: 0, orange: 0, red: 0, unknown: 0 });
    const times = samples.map(sampleTime).filter(value => value !== null);
    return { name, logo, accent: accents[index], samples: samples.length, counts,
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
      if (options[key]) return (normalize(row[key]) || 'Not recorded') === filter;
      if (key === 'TANGGAL') return parseWaterDate(row.TANGGAL) === parseWaterDate(filter);
      return normalize(cellValue(row, key)).includes(normalize(filter));
    });
  }).sort((a, b) => (sampleTime(b) ?? -Infinity) - (sampleTime(a) ?? -Infinity)), [dated, search, filters, options]);
  useEffect(() => setPage(1), [search, filters, dateRange]);
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const currentPage = Math.min(page, pages);
  const hasFilters = search || Object.values(filters).some(Boolean);
  const setFilter = (key, value) => setFilters(previous => ({ ...previous, [key]: value }));
  return <main className="water-quality" aria-label="Water quality dashboard">
    {loading ? <p role="status">Loading water quality records…</p> : error ? <div role="alert">Unable to load water quality records. <button onClick={() => setReload(value => value + 1)}>Try again</button></div> : <>
      <section className="water-areas" aria-label="Water quality by area">
        {summaries.map(summary => <article className="water-area-card" key={summary.name} aria-label={`${summary.name} water quality`} style={{ '--area-accent': summary.accent }}>
          <div className="water-area-heading"><img src={summary.logo} alt={summary.name} /><span className="water-location-count">{summary.locations} sampling locations</span></div>
          <div className="water-area-primary"><span>Average TDS</span><strong>{summary.average}</strong><small>{summary.samples} samples in selected period</small></div>
          <div className="water-area-bands">{bands.map(([status, label]) => <div key={status}><span><i className={status} />{label}</span><strong className={`water-count-${status}`}>{summary.counts[status]}</strong><small>samples</small></div>)}</div>
          <div className="water-area-footer"><span>Latest sample: <b>{summary.latest}</b></span>{summary.counts.unknown > 0 && <span>{summary.counts.unknown} samples without TDS</span>}</div>
        </article>)}
      </section>
      <section className="water-records" aria-labelledby="water-records-title">
        <div className="water-toolbar"><div><h2 id="water-records-title">Water Quality Records</h2><p>{rows.length} matching records · 10 per page</p></div><label className="water-search">Search records<input type="search" value={search} placeholder="Search any column…" onChange={event => setSearch(event.target.value)} /></label>{hasFilters && <button className="water-clear" onClick={() => { setSearch(''); setFilters({}); }}>Clear filters</button>}</div>
        <div className="water-table-scroll"><table><thead><tr>{columns.map(([key, label]) => <th key={key} scope="col"><span>{label}</span>
          {key === 'TDS' ? <select aria-label="Filter TDS" value={filters[key] || ''} onChange={event => setFilter(key, event.target.value)}><option value="">All TDS</option>{bands.map(([status, band]) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}: {band}</option>)}</select>
            : options[key] ? <select aria-label={`Filter ${label}`} value={filters[key] || ''} onChange={event => setFilter(key, event.target.value)}><option value="">All</option>{options[key].map(value => <option key={value} value={value}>{key === 'AREA' ? value.toUpperCase() : value[0].toUpperCase() + value.slice(1)}</option>)}</select>
              : <input aria-label={`Filter ${label}`} type={key === 'TANGGAL' ? 'date' : 'text'} placeholder="Filter…" value={filters[key] || ''} onChange={event => setFilter(key, event.target.value)} />}
        </th>)}</tr></thead>
          <tbody>{rows.slice((currentPage - 1) * 10, currentPage * 10).map((row, index) => <tr key={`${currentPage}-${index}`}>{columns.map(([key]) => <td key={key}>{key === 'TDS' ? <span className={`water-tds ${tdsStatus(row.TDS)}`} title={tdsStatus(row.TDS) === 'unknown' ? 'TDS unavailable' : `TDS ${bands.find(([status]) => status === tdsStatus(row.TDS))[1]}`}>{cellValue(row, key) || '—'}</span> : cellValue(row, key) === '' ? '—' : cellValue(row, key)}</td>)}</tr>)}{rows.length === 0 && <tr><td className="water-empty" colSpan={columns.length}>No records match the selected dates and filters.</td></tr>}</tbody>
        </table></div>
        <footer className="water-pagination"><span>{rows.length ? (currentPage - 1) * 10 + 1 : 0}–{Math.min(currentPage * 10, rows.length)} of {rows.length} records</span><div><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pages}</span><button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></div></footer>
      </section>
    </>}
  </main>;
}
