import { useEffect, useMemo, useState } from "react";
import "./WaterQualityDashboard.css";

const columns = [
  ["NO", "No."], ["TANGGAL", "Date"], ["JAM", "Time"],
  ["LOKASI SAMPLING", "Sampling Location"], ["WARNA AIR", "Water Color"],
  ["TDS", "TDS"], ["TEKANAN AIR", "Water Pressure"],
  ["KETERANGAN", "Remarks"], ["AREA", "Area"],
];
const areas = [
  ["BGM", "/logobgm.png"], ["GI", "/logogi2.png"],
  ["RWI", "/logorwi2.png"], ["PIK 2", "/logopik2.png"],
  ["PIK 2 Millenial", "/logopik2mil2.png"], ["Other", "/logoother2.png"],
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
  return number === null ? "unknown" : number < 300 ? "green" : number <= 500 ? "orange" : "red";
}
function areaName(value) {
  const area = String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
  return areas.find(([name]) => name.toUpperCase() === area)?.[0] || "Other";
}
function sortValue(row, column) {
  if (column === "TANGGAL") return parseWaterDate(row[column]);
  if (column === "TDS" || column === "NO") return tdsNumber(row[column]);
  return String(row[column] ?? "");
}

export default function WaterQualityDashboard({ dateRange }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("All areas");
  const [sort, setSort] = useState({ column: "TANGGAL", direction: "descending" });
  const [page, setPage] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch(`${process.env.REACT_APP_API_URL || ""}/api/water-quality-data`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Request failed");
        const result = await response.json();
        if (result.status !== "success" || !Array.isArray(result.data)) throw new Error("Invalid response");
        if (!controller.signal.aborted) setRecords(result.data);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  const dated = useMemo(() => records.filter(row => {
    if (!dateRange) return true;
    const date = parseWaterDate(row.TANGGAL);
    const start = new Date(dateRange.start).setHours(0, 0, 0, 0);
    const end = new Date(dateRange.end).setHours(23, 59, 59, 999);
    return date !== null && date >= start && date <= end;
  }), [records, dateRange]);
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return dated.filter(row => (area === "All areas" || areaName(row.AREA) === area)
      && columns.some(([key]) => String(row[key] ?? "").toLowerCase().includes(query)))
      .sort((a, b) => {
        const left = sortValue(a, sort.column), right = sortValue(b, sort.column);
        if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
        const comparison = typeof left === "number" ? left - right : left.localeCompare(right, "en", { numeric: true });
        return sort.direction === "ascending" ? comparison : -comparison;
      });
  }, [dated, search, area, sort]);
  useEffect(() => setPage(1), [search, area, sort, dateRange]);
  const pages = Math.max(1, Math.ceil(rows.length / 15));
  const currentPage = Math.min(page, pages);
  const counts = dated.reduce((result, row) => { result[tdsStatus(row.TDS)]++; return result; }, { green: 0, orange: 0, red: 0, unknown: 0 });
  return <main className="water-quality">
    <header className="water-heading"><div><h1>Water Quality Monitoring</h1><p>Sampling overview · KualitasAir</p></div><button onClick={() => setReload(value => value + 1)} disabled={loading}>Refresh</button></header>
    {loading ? <p role="status">Loading water quality records…</p> : error ? <div role="alert">Unable to load water quality records. <button onClick={() => setReload(value => value + 1)}>Try again</button></div> : <>
      <section className="water-areas" aria-label="Records by area">
        <article className="water-total"><span>Total records</span><strong>{dated.length}</strong></article>
        {areas.map(([name, logo]) => <article key={name}><img src={logo} alt={name} /><strong>{dated.filter(row => areaName(row.AREA) === name).length}</strong><span>{name}</span></article>)}
      </section>
      <section className="water-statuses" aria-label="TDS overview">
        {[["green", "TDS < 300"], ["orange", "TDS 300–500"], ["red", "TDS > 500"], ["unknown", "TDS unavailable"]].map(([status, label]) => <div key={status} className={`water-status ${status}`}><span>{label}</span><strong>{counts[status]}</strong></div>)}
      </section>
      <section className="water-records" aria-labelledby="water-records-title">
        <div className="water-toolbar"><div><h2 id="water-records-title">Water Quality Records</h2><p>{rows.length} matching records</p></div><label>Search records<input type="search" value={search} placeholder="Search any column…" onChange={event => setSearch(event.target.value)} /></label><label>Area<select value={area} onChange={event => setArea(event.target.value)}>{["All areas", ...areas.map(([name]) => name)].map(name => <option key={name}>{name}</option>)}</select></label></div>
        <div className="water-table-scroll"><table><thead><tr>{columns.map(([key, label]) => <th key={key} scope="col" aria-sort={sort.column === key ? sort.direction : "none"}><button onClick={() => setSort({ column: key, direction: sort.column === key && sort.direction === "ascending" ? "descending" : "ascending" })}>{label} {sort.column === key ? sort.direction === "ascending" ? "↑" : "↓" : "↕"}</button></th>)}</tr></thead>
          <tbody>{rows.slice((currentPage - 1) * 15, currentPage * 15).map((row, index) => <tr key={`${currentPage}-${index}`}>{columns.map(([key]) => <td key={key}>{key === "TDS" ? <span className={`water-tds ${tdsStatus(row.TDS)}`} title={tdsStatus(row.TDS) === "unknown" ? "TDS unavailable" : `TDS category: ${tdsStatus(row.TDS)}`}>{String(row.TDS ?? "").trim() || "—"}</span> : String(row[key] ?? "").trim() || "—"}</td>)}</tr>)}{rows.length === 0 && <tr><td colSpan={columns.length}>No records match the selected dates and filters.</td></tr>}</tbody>
        </table></div>
        <footer className="water-pagination"><span>Page {currentPage} of {pages}</span><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></footer>
      </section>
    </>}
  </main>;
}
