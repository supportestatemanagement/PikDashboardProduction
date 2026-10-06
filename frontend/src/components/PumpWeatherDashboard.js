import { useEffect, useMemo, useState } from "react";
import { LoadingValue, LoadingChart } from "./DashboardLoading";
import { fetchPumpAnalytics } from "../services/pumpService";

const SERIES = [
  { key: "PS1", label: "PS1", color: "#35d6bd" },
  { key: "PS2", label: "PS2", color: "#39c6f4" },
  { key: "PS3", label: "PS3", color: "#6aa6ff" },
  { key: "PS4", label: "PS4", color: "#ffc43d" },
  { key: "TWA", label: "TWA", color: "#a78bfa" },
  { key: "SEA", label: "SEA", color: "#cbd5e1" },
];
const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const asDate = (value) => { const [y, m, d] = value.split("-").map(Number); return new Date(y, m - 1, d); };
const range = (start, end = start) => ({ start: asDate(start), end: asDate(end) });
const todayRange = () => { const today = iso(new Date()); return { start: today, end: today }; };
const yearToDate = () => { const today = iso(new Date()); return { start: `${today.slice(0, 4)}-01-01`, end: today }; };
const rangeLabel = (start, end) => start === end ? niceDate(start) : `${niceDate(start)} - ${niceDate(end)}`;
const presetRange = (anchor, months) => {
  if (months === "today") return todayRange();
  if (months === "year") return yearToDate();
  const end = asDate(anchor);
  const start = new Date(end.getFullYear(), end.getMonth() - months, 1);
  const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  start.setDate(Math.min(end.getDate(), lastDay));
  return { start: iso(start), end: anchor };
};
const fmt = (value) => value == null ? "-" : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(value);
const niceDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

function usePumpData(dateRange) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const start = dateRange.start;
  const end = dateRange.end;
  useEffect(() => {
    const controller = new AbortController();
    setState((old) => ({ ...old, loading: true, error: "" }));
    fetchPumpAnalytics({ start, end }, "ALL", controller.signal)
      .then((data) => setState({ data, loading: false, error: "" }))
      .catch((error) => { if (error.name !== "AbortError") setState({ data: null, loading: false, error: error.message }); });
    return () => controller.abort();
  }, [start, end]);
  return state;
}

function DateRangeFilter({ start, end, onStart, onEnd, onPreset, active }) {
  const currentYear = yearToDate();
  const selected = start === currentYear.end && end === currentYear.end ? "today" : start === currentYear.start && end === currentYear.end ? "year" : "";
  return <details className={`pw-range-picker${active ? " is-active" : ""}`}>
    <summary>{rangeLabel(start, end)}<span aria-hidden="true">&#9662;</span></summary>
    <div className="pw-range-popover">
      <label>Pilih Preset<select aria-label="Preset rentang tanggal" value={selected} onChange={(e) => onPreset(["year", "today"].includes(e.target.value) ? e.target.value : Number(e.target.value))}><option value="" disabled>Rentang khusus</option><option value="today">Hari ini</option><option value="year">Tahun ini</option><option value="3">3 bulan terakhir</option><option value="6">6 bulan terakhir</option><option value="12">1 tahun terakhir</option></select></label>
      <div className="pw-range-inputs"><label>Mulai<input aria-label="Tanggal awal" type="date" value={start} onChange={(e) => onStart(e.target.value)} /></label><label>Akhir<input aria-label="Tanggal akhir" type="date" value={end} onChange={(e) => onEnd(e.target.value)} /></label></div>
      <button type="button" onClick={(e) => { e.currentTarget.closest("details").open = false; }}>Selesai</button>
    </div>
  </details>;
}

function CurrentCards({ latest, latestSea, loading = false }) {
  const cards = [
    ...["PS1", "PS2", "PS3", "PS4"].map((key) => ({ key, label: key, value: fmt(latest?.stations?.[key]?.level), status: latest?.stations?.[key]?.status || "-" })),
    { key: "twa", label: "TWA", value: fmt(latest?.twa), status: "Latest level" },
    { key: "sea", label: "SEA", value: fmt(latestSea ? latestSea.sea : latest?.sea), status: latestSea ? `${niceDate(latestSea.date)} / ${latestSea.time}` : "Latest level" },
  ];
  return <section className="pw-current-row">{cards.map((card) => {
    const isPump = /^PS[1-4]$/.test(card.key);
    const state = /^run\s*[1-9]\d*$/i.test(card.status) ? "on" : /^standby$/i.test(card.status) ? "off" : "unknown";
    const label = state === "unknown" ? "N/A" : state.toUpperCase();
    return <article key={card.key} className="pw-level-card" aria-busy={loading}>
      <div className="pw-level-reading"><span>{card.label}</span><strong>{loading ? <LoadingValue /> : <>{card.value}{card.value !== "-" && " M"}</>}</strong><small>{loading ? <LoadingValue /> : card.status}</small></div>
      {isPump && !loading && <span className={`pw-pump-indicator is-${state}`} aria-label={`${card.key} pump ${state}`} title={state === "unknown" ? "Pump status unavailable" : `Pump ${label}`}><i aria-hidden="true" />{label}</span>}
    </article>;
  })}</section>;
}

export function PeakPanel({ data, filter, setFilter, navbarKey, loading = false }) {
  const active = filter.start !== navbarKey || filter.end !== navbarKey;
  const peaks = new Map((data?.stationPeaks || []).map((event) => [event.station, event]));
  return <article aria-busy={loading} className={`pw-panel pw-peak-panel${active ? " is-filtered" : ""}`}>
    <div className="pw-panel-head"><div><h2>PEAK LEVEL BY STATION</h2><small>Highest water level in the selected period</small></div><DateRangeFilter {...filter} active={active} onPreset={(months) => setFilter(presetRange(navbarKey, months))} onStart={(start) => start && setFilter((old) => ({ ...old, start, end: old.end < start ? start : old.end }))} onEnd={(end) => end && setFilter((old) => ({ ...old, start: old.start > end ? end : old.start, end }))} /></div>
    <div className="pw-peak-table"><div className="head"><span>STATION</span><span>DATE</span><span>TIME</span><span>PEAK LEVEL (M)</span><span title="Total pump run count on the peak date">RUN COUNT</span></div>{SERIES.map(({ key, label }) => { const event = peaks.get(key); const runs = event ? summarizePumpDays(data?.pumpStatusEvents || [], key).find((day) => day.date === event.date) : null; return <button key={key} disabled={loading || !event}><b>{label}</b><span>{loading ? <LoadingValue /> : event ? niceDate(event.date) : "-"}</span><time>{loading ? <LoadingValue /> : event?.time || "-"}</time><strong>{loading ? <LoadingValue /> : fmt(event?.level)}</strong><strong>{loading ? <LoadingValue /> : runs ? fmt(runs.total) : "-"}</strong></button>; })}</div>
  </article>;
}

function UpdatedLabel({ latest, loading = false }) {
  return <span className="pw-active-date">Updated: {loading ? <LoadingValue /> : latest?.date ? `${niceDate(latest.date)} / ${latest.time || "-"}` : "-"}</span>;
}

function TrendChart({ rows, latest, loading = false }) {
  const [active, setActive] = useState(() => new Set(SERIES.map(({ key }) => key)));
  const ordered = useMemo(() => [...rows].sort((a, b) => { const hour = (row) => Number(row.period.slice(-5, -3)) || 24; return hour(a) - hour(b); }), [rows]);
  const selected = SERIES.filter(({ key }) => active.has(key));
  const values = ordered.flatMap((row) => selected.map(({ key }) => row[key]).filter(Number.isFinite));
  const rawMin = values.length ? Math.min(...values) : 0, rawMax = values.length ? Math.max(...values) : 1;
  const padding = Math.max((rawMax - rawMin) * .12, .5), min = rawMin - padding, max = rawMax + padding, span = max - min || 1;
  const left = 92, right = 930, top = 34, bottom = 270;
  const x = (i) => left + 24 + i * ((right - left - 24) / Math.max(ordered.length - 1, 1));
  const y = (value) => top + (1 - (value - min) / span) * (bottom - top);
  const toggle = (key) => setActive((old) => { const next = new Set(old); next.has(key) ? next.delete(key) : next.add(key); return next; });
  return <article className="pw-panel pw-trend-panel" aria-busy={loading}><div className="pw-panel-head"><div><h2>WATER LEVEL TREND</h2><small>Observations on the selected date</small></div><UpdatedLabel latest={latest} loading={loading} /></div>
    <div className="pw-series-switches">{SERIES.map((item) => <button key={item.key} className={active.has(item.key) ? "active" : ""} onClick={() => toggle(item.key)}><i style={{ background: item.color }} />{item.label}</button>)}</div>
    <div className="pw-chart-scroll">{loading ? <LoadingChart height={320} /> : <svg className="pw-chart" viewBox="0 0 970 320" role="img" aria-label="Water level trend">
      {[0, .25, .5, .75, 1].map((ratio) => { const yy = top + ratio * (bottom - top), value = max - ratio * span; return <g key={ratio}><line x1={left} x2={right} y1={yy} y2={yy} /><text className="y-label" x={left - 12} y={yy + 4} textAnchor="end">{fmt(value)}</text></g>; })}
      {selected.map(({ key, color }) => { const points = ordered.map((row, i) => Number.isFinite(row[key]) ? `${x(i)},${y(row[key])}` : null).filter(Boolean).join(" "); return <g key={key}><polyline points={points} style={{ stroke: color }} />{ordered.map((row, i) => Number.isFinite(row[key]) && <g key={`${key}-${row.period}`}><circle cx={x(i)} cy={y(row[key])} r="3" style={{ fill: color }} /><text className="data-label" x={x(i)} y={y(row[key]) - 9} textAnchor="middle">{fmt(row[key])}</text></g>)}</g>; })}
      {ordered.map((row, i) => <text className="x-label" key={row.period} x={x(i)} y="298" textAnchor="middle">{row.period.slice(-5)}</text>)}
    </svg>}</div>
  </article>;
}

function WeatherPanel({ rows, loading = false }) {
  const ordered = [...rows].sort((a, b) => (a.time === "00:00" ? "24:00" : a.time).localeCompare(b.time === "00:00" ? "24:00" : b.time));
  const icon = (weather) => {
    const value = String(weather || "").toLowerCase();
    if (/petir|badai|thunder/.test(value)) return "\u26c8\ufe0f";
    if (/hujan|rain|gerimis/.test(value)) return "\ud83c\udf27\ufe0f";
    if (/cerah berawan|partly/.test(value)) return "\ud83c\udf24\ufe0f";
    if (/awan|mendung|cloud|overcast/.test(value)) return "\u2601\ufe0f";
    if (/cerah|sun|clear/.test(value)) return "\u2600\ufe0f";
    return "-";
  };
  return <section aria-busy={loading} className="pw-panel pw-weather-panel" aria-label="Cuaca per jam">
    <div className="pw-panel-head"><div><h2>WEATHER CONDITIONS</h2></div></div>
    {loading ? <div className="pw-weather-hours">{Array.from({ length: 6 }, (_, index) => <article key={index}><LoadingValue /><LoadingValue /><LoadingValue /></article>)}</div> : ordered.length ? <div className="pw-weather-hours">{ordered.map((row) => <article key={`${row.date}-${row.time}`}>
      <time>{row.time}</time><span className="pw-weather-icon" aria-hidden="true">{icon(row.weather)}</span><strong>{row.weather || "Belum ada data"}</strong>
    </article>)}</div> : <p>Belum ada data cuaca pada tanggal ini.</p>}
  </section>;
}

export function summarizePumpDays(events, station) {
  const days = new Map();
  const minutes = (time) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(time || "");
    if (!match) return null;
    const hour = Number(match[1]);
    return (hour === 0 ? 24 : hour) * 60 + Number(match[2]);
  };
  let previousDate = null, activePumps = 0;
  // Stable sorting preserves worksheet update order for equal timestamps.
  const ordered = events.filter((event) => event.station === station).slice().sort((a, b) =>
    a.date.localeCompare(b.date) || (minutes(a.time) ?? 0) - (minutes(b.time) ?? 0));
  ordered.forEach((event) => {
    const status = String(event.status ?? "").trim();
    const match = /^(?:run\s*)?(\d+)$/i.exec(status);
    if (!match && !/^(?:stand\s*by|stby)$/i.test(status)) return;
    if (!days.has(event.date)) days.set(event.date, { date: event.date, counts: {}, total: 0 });
    const day = days.get(event.date);
    // Reset at the reporting-day boundary, never because of a logging gap.
    // Repeated RUN readings remain the same session until the status changes.
    if (event.date !== previousDate) {
      activePumps = 0;
    }
    const running = match ? Number(match[1]) : 0;
    if (match) {
      const runLabel = `Run ${running}`;
      day.counts[runLabel] = (day.counts[runLabel] || 0) + 1;
      day.total += Math.max(0, running - activePumps);
    }
    activePumps = running;
    previousDate = event.date;
  });
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function StatusPanel({ data, station, filter, loading = false }) {
  const days = useMemo(() => summarizePumpDays(data?.pumpStatusEvents || [], station), [data?.pumpStatusEvents, station]);
  return <article className="pw-panel pw-status-panel" aria-busy={loading}>
    <div className="pw-panel-head"><div><h2>{station}</h2><small>Total Pump Run Count</small></div></div>
    <div className="pw-daily-total"><span className="pw-period-label">{rangeLabel(filter.start, filter.end)}</span><strong>{loading ? <LoadingValue /> : days.length ? fmt(days.reduce((total, day) => total + day.total, 0)) : "-"}</strong></div>
    {!loading && !days.length && <small className="pw-no-data">Tidak ada status pada periode ini.</small>}
  </article>;
}

function SeaLevelChart({ rows }) {
  const readings = rows.map(row => ({ hour: Number(row.period.slice(-5, -3)) || 24, time: row.period.slice(-5), value: row.SEA })).sort((a, b) => a.hour - b.hour);
  const available = readings.filter(row => Number.isFinite(row.value));
  if (!available.length) return <p className="pw-no-data">Belum ada nilai level air laut pada tanggal ini.</p>;
  const low = available.reduce((a, b) => b.value < a.value ? b : a);
  const high = available.reduce((a, b) => b.value > a.value ? b : a);
  const minimum = Math.floor(Math.min(0, low.value) * 2) / 2;
  const maximum = Math.ceil(Math.max(2, high.value + .2) * 2) / 2;
  const x = hour => 80 + hour / 24 * 960;
  const y = value => 300 - (value - minimum) / (maximum - minimum) * 240;
  const segments = [];
  let segment = [];
  readings.forEach((row, index) => {
    if (!Number.isFinite(row.value) || (index && row.hour - readings[index - 1].hour > 1)) {
      if (segment.length) segments.push(segment);
      segment = [];
    }
    if (Number.isFinite(row.value)) segment.push(row);
  });
  if (segment.length) segments.push(segment);
  return <div className="pw-sea-chart-scroll"><svg className="pw-sea-chart" viewBox="0 0 1100 370" role="img" aria-label="Grafik level air laut per jam dari sheet SeaLevel">
    <defs><linearGradient id="sea-level-background" x2="0" y2="1"><stop stopColor="#eef7fa" /><stop offset="1" stopColor="#badde8" /></linearGradient></defs>
    <rect x="80" y="60" width="960" height="240" fill="url(#sea-level-background)" />
    <text x="18" y="30">Ketinggian (m)</text>
    {Array.from({ length: 6 }, (_, i) => { const value = minimum + (maximum - minimum) * i / 5; return <g key={i}><line x1="80" x2="1040" y1={y(value)} y2={y(value)} className="pw-sea-grid" /><text x="66" y={y(value) + 5} textAnchor="end">{fmt(value)}</text></g>; })}
    <path d="M80 60V300H1040" className="pw-sea-axis" />
    {Array.from({ length: 25 }, (_, hour) => <g key={hour}><line x1={x(hour)} x2={x(hour)} y1="300" y2={hour % 2 ? 306 : 311} className="pw-sea-axis" />{hour % 2 === 0 && <text x={x(hour)} y="334" textAnchor="middle">{hour === 24 ? '24:00' : `${hour}:00`}</text>}</g>)}
    {segments.map((points, index) => <polyline key={index} points={points.map(row => `${x(row.hour)},${y(row.value)}`).join(' ')} className="pw-sea-line" />)}
    {available.map(row => <circle key={row.hour} cx={x(row.hour)} cy={y(row.value)} r="4" className="pw-sea-point" tabIndex="0" aria-label={`${row.time}: ${fmt(row.value)} meter`}><title>{row.time}: {fmt(row.value)} M</title></circle>)}
    {[low, ...(high !== low ? [high] : [])].map((row, index) => <g key={index} className={index ? 'pw-sea-high' : 'pw-sea-low'}><circle cx={x(row.hour)} cy={y(row.value)} r="6" /><text x={Math.min(990, Math.max(130, x(row.hour)))} y={y(row.value) - 17} textAnchor="middle">{index ? 'Tertinggi' : 'Terendah'} · {row.time}</text></g>)}
    <text x="560" y="362" textAnchor="middle">Jam (WIB)</text>
  </svg></div>;
}

export function SeaLevelPanel({ data, loading }) {
  const sheet = data?.analytics?.seaLevelSheet;
  const latest = sheet?.latest;
  const levels = sheet;
  const rows = sheet?.hours || [];
  return <article className="pw-panel pw-sea-panel" aria-label="Sea Level" aria-busy={loading}>
    <div className="pw-panel-head"><div><h2>SEA LEVEL</h2><small>Level air laut per jam · Sheet SeaLevel</small></div><UpdatedLabel latest={latest} loading={loading} /></div>
    <dl className="pw-sea-summary">
      {[["Level terakhir", latest?.sea], ["Tertinggi", levels?.highest], ["Terendah", levels?.lowest]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{loading ? <LoadingValue /> : value == null ? "—" : `${fmt(value)} M`}</dd></div>)}
    </dl>
    {loading ? <LoadingChart height={300} /> : rows.length ? <SeaLevelChart rows={rows} /> : <p className="pw-no-data">Belum ada data level air laut pada tanggal ini.</p>}
  </article>;
}

export default function PumpWeatherDashboard({ dateRange, isSidebarOpen = false }) {
  const navbarKey = iso(dateRange.start);
  const [peakFilter, setPeakFilter] = useState(yearToDate);
  const [statusFilter, setStatusFilter] = useState(() => ({ start: navbarKey, end: navbarKey }));
  useEffect(() => {
    setStatusFilter({ start: navbarKey, end: navbarKey });
  }, [navbarKey]);
  const baseRange = useMemo(() => range(navbarKey), [navbarKey]);
  const peakRange = useMemo(() => range(peakFilter.start, peakFilter.end), [peakFilter.start, peakFilter.end]);
  const statusRange = useMemo(() => range(statusFilter.start, statusFilter.end), [statusFilter.start, statusFilter.end]);
  const base = usePumpData(baseRange), peaks = usePumpData(peakRange), statuses = usePumpData(statusRange);
  return <main className={`pump-dashboard pw-dashboard${isSidebarOpen ? " sidebar-open" : ""}`}>
    {(base.error || peaks.error || statuses.error) && <div className="pw-error">{base.error || peaks.error || statuses.error}</div>}
    <WeatherPanel loading={base.loading} rows={base.data?.analytics?.weatherTimeline || []} />
    <section className="pw-panel pw-level-section" aria-label="Water levels">
      <div className="pw-status-toolbar"><h2>WATER LEVELS</h2><UpdatedLabel loading={base.loading} latest={base.data?.analytics?.latest} /></div>
      <CurrentCards loading={base.loading} latest={base.data?.analytics?.latest} latestSea={base.data?.analytics?.latestSea} />
    </section>
    <SeaLevelPanel loading={base.loading} data={base.data} />
    <section className="pw-main-grid"><PeakPanel loading={peaks.loading} data={peaks.data} filter={peakFilter} setFilter={setPeakFilter} navbarKey={navbarKey} /><TrendChart loading={base.loading} rows={base.data?.chart || []} latest={base.data?.analytics?.latest} /></section>
    <section className="pw-panel pw-status-section" aria-label="Pump Run Summary">
      <div className="pw-status-toolbar"><h2>PUMP RUN SUMMARY</h2><DateRangeFilter {...statusFilter} active={statusFilter.start !== navbarKey || statusFilter.end !== navbarKey} onPreset={(months) => setStatusFilter(presetRange(navbarKey, months))} onStart={(start) => start && setStatusFilter((old) => ({ ...old, start, end: old.end < start ? start : old.end }))} onEnd={(end) => end && setStatusFilter((old) => ({ ...old, start: old.start > end ? end : old.start, end }))} /></div>
      <div className="pw-status-row">{["PS1", "PS2", "PS3", "PS4"].map((station) => <StatusPanel loading={statuses.loading} key={station} station={station} data={statuses.data} filter={statusFilter} />)}</div>
    </section>
  </main>;
}
