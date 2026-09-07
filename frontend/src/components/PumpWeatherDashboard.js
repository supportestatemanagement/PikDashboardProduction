import { useEffect, useMemo, useState } from "react";
import { fetchPumpAnalytics } from "../services/pumpService";

const SERIES = [
  { key: "PS1", label: "PS1", color: "#35d6bd" },
  { key: "PS2", label: "PS2", color: "#39c6f4" },
  { key: "PS3", label: "PS3", color: "#6aa6ff" },
  { key: "PS4", label: "PS4", color: "#ffc43d" },
  { key: "TWA", label: "TWA", color: "#a78bfa" },
  { key: "SEA", label: "SEA", color: "#cbd5e1" },
];
const RUN_STATUS_KEYS = ["Run 1", "Run 2", "Run 3", "Run 4", "Run 5", "Run 6"];
const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const asDate = (value) => { const [y, m, d] = value.split("-").map(Number); return new Date(y, m - 1, d); };
const range = (start, end = start) => ({ start: asDate(start), end: asDate(end) });
const presetRange = (anchor, months) => {
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
  return <div className="pw-range-controls">
    <select aria-label="Preset rentang tanggal" defaultValue="" onChange={(e) => { if (e.target.value) onPreset(Number(e.target.value)); e.target.value = ""; }}><option value="" disabled>Preset</option><option value="3">3 bulan terakhir</option><option value="6">6 bulan terakhir</option><option value="12">1 tahun terakhir</option></select>
    <div className={`pw-date-filter${active ? " is-active" : ""}`}><input aria-label="Tanggal awal" type="date" value={start} onChange={(e) => onStart(e.target.value)} /><span>—</span><input aria-label="Tanggal akhir" type="date" value={end} onChange={(e) => onEnd(e.target.value)} /></div>
  </div>;
}

function CurrentCards({ latest }) {
  const cards = [
    { key: "weather", label: "CURRENT WEATHER", value: latest?.weather || "-", status: "Kondisi terakhir" },
    ...["PS1", "PS2", "PS3", "PS4"].map((key) => ({ key, label: key, value: fmt(latest?.stations?.[key]?.level), status: latest?.stations?.[key]?.status || "-" })),
    { key: "twa", label: "TWA LEVEL", value: fmt(latest?.twa), status: "Level terakhir" },
    { key: "sea", label: "SEA LEVEL", value: fmt(latest?.sea), status: "Level terakhir" },
  ];
  return <section className="pw-current-row">{cards.map((card) => <article key={card.key}><span>{card.label}</span><strong>{card.value}</strong><small>{card.status}</small></article>)}</section>;
}

function PeakPanel({ data, filter, setFilter, navbarKey }) {
  const active = filter.start !== navbarKey || filter.end !== navbarKey;
  const peaks = new Map((data?.stationPeaks || []).map((event) => [event.station, event]));
  return <article className={`pw-panel pw-peak-panel${active ? " is-filtered" : ""}`}>
    <div className="pw-panel-head"><div><h2>PEAK LEVEL BY STATION</h2><small>Nilai level tertinggi pada periode aktif</small></div><DateRangeFilter {...filter} active={active} onPreset={(months) => setFilter(presetRange(navbarKey, months))} onStart={(start) => start && setFilter((old) => ({ ...old, start, end: old.end < start ? start : old.end }))} onEnd={(end) => end && setFilter((old) => ({ ...old, start: old.start > end ? end : old.start, end }))} /></div>
    <div className="pw-peak-table"><div className="head"><span>STATION</span><span>TANGGAL</span><span>JAM</span><span>PEAK LEVEL</span></div>{SERIES.map(({ key, label }) => { const event = peaks.get(key); return <button key={key} disabled={!event}><b>{label}</b><span>{event ? niceDate(event.date) : "-"}</span><time>{event?.time || "-"}</time><strong>{fmt(event?.level)}</strong></button>; })}</div>
  </article>;
}

function TrendChart({ rows }) {
  const [active, setActive] = useState(() => new Set(SERIES.map(({ key }) => key)));
  const ordered = useMemo(() => [...rows].sort((a, b) => { const hour = (row) => Number(row.period.slice(-5, -3)) || 24; return hour(a) - hour(b); }), [rows]);
  const selected = SERIES.filter(({ key }) => active.has(key));
  const values = ordered.flatMap((row) => selected.map(({ key }) => row[key]).filter(Number.isFinite));
  const rawMin = values.length ? Math.min(...values) : 0, rawMax = values.length ? Math.max(...values) : 1;
  const padding = Math.max((rawMax - rawMin) * .12, .5), min = rawMin - padding, max = rawMax + padding, span = max - min || 1;
  const left = 68, right = 930, top = 34, bottom = 270;
  const x = (i) => left + i * ((right - left) / Math.max(ordered.length - 1, 1));
  const y = (value) => top + (1 - (value - min) / span) * (bottom - top);
  const toggle = (key) => setActive((old) => { const next = new Set(old); next.has(key) ? next.delete(key) : next.add(key); return next; });
  return <article className="pw-panel pw-trend-panel"><div className="pw-panel-head"><div><h2>WATER LEVEL TREND</h2><small>Observasi pada tanggal aktif</small></div></div>
    <div className="pw-series-switches">{SERIES.map((item) => <button key={item.key} className={active.has(item.key) ? "active" : ""} onClick={() => toggle(item.key)}><i style={{ background: item.color }} />{item.label}</button>)}</div>
    <div className="pw-chart-scroll"><svg className="pw-chart" viewBox="0 0 970 320" role="img" aria-label="Water level trend">
      {[0, .25, .5, .75, 1].map((ratio) => { const yy = top + ratio * (bottom - top), value = max - ratio * span; return <g key={ratio}><line x1={left} x2={right} y1={yy} y2={yy} /><text className="y-label" x={left - 12} y={yy + 4} textAnchor="end">{fmt(value)}</text></g>; })}
      {selected.map(({ key, color }) => { const points = ordered.map((row, i) => Number.isFinite(row[key]) ? `${x(i)},${y(row[key])}` : null).filter(Boolean).join(" "); return <g key={key}><polyline points={points} style={{ stroke: color }} />{ordered.map((row, i) => Number.isFinite(row[key]) && <g key={`${key}-${row.period}`}><circle cx={x(i)} cy={y(row[key])} r="3" style={{ fill: color }} /><text className="data-label" x={x(i)} y={y(row[key]) - 9} textAnchor="middle">{fmt(row[key])}</text></g>)}</g>; })}
      {ordered.map((row, i) => <text className="x-label" key={row.period} x={x(i)} y="298" textAnchor="middle">{row.period.slice(-5)}</text>)}
    </svg></div>
  </article>;
}

function StatusPanel({ data, filter, setFilter, navbarKey }) {
  const [pump, setPump] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const active = filter.start !== navbarKey || filter.end !== navbarKey;
  const events = useMemo(() => (data?.pumpStatusEvents || []).filter((event) =>
    (pump === "ALL" || event.station === pump) &&
    (statusFilter === "ALL" || event.status === statusFilter)
  ).slice().reverse(), [data?.pumpStatusEvents, pump, statusFilter]);
  const runTotals = useMemo(() => Object.fromEntries(RUN_STATUS_KEYS.map((status) => [status, events.filter((event) => event.status === status).length])), [events]);
  const setStart = (start) => start && setFilter((old) => ({ ...old, start, end: old.end < start ? start : old.end }));
  const setEnd = (end) => end && setFilter((old) => ({ ...old, start: old.start > end ? end : old.start, end }));
  return <article className={`pw-panel pw-status-panel${active ? " is-filtered" : ""}`}>
    <div className="pw-panel-head"><div><h2>PUMP STATUS LOG</h2><small>Riwayat status operasional PS1-PS4</small></div><div className="pw-status-filters"><select aria-label="Filter pompa" value={pump} onChange={(e) => setPump(e.target.value)}><option value="ALL">All Pumps</option>{["PS1", "PS2", "PS3", "PS4"].map((key) => <option key={key}>{key}</option>)}</select><select aria-label="Filter status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="ALL">All Status</option><option value="Standby">Standby</option>{RUN_STATUS_KEYS.map((key) => <option key={key}>{key}</option>)}</select><DateRangeFilter {...filter} active={active} onPreset={(months) => setFilter(presetRange(navbarKey, months))} onStart={setStart} onEnd={setEnd} /></div></div>
    <div className="pw-status-log"><div className="head"><span>POMPA</span><span>STATUS</span><span>TANGGAL</span><span>JAM</span></div>{events.length ? events.map((event, index) => <div className="row" key={`${event.station}-${event.date}-${event.time}-${index}`}><b>{event.station}</b><strong className={event.status === "Standby" ? "standby" : "running"}>{event.status}</strong><span>{niceDate(event.date)}</span><time>{event.time}</time></div>) : <p>Tidak ada status pada periode ini.</p>}</div>
    <div className="pw-run-summary"><h3>RUN OCCURRENCES</h3><div>{RUN_STATUS_KEYS.map((status) => <span key={status}><small>{status}</small><strong>{runTotals[status]}</strong></span>)}</div></div>
  </article>;
}

export default function PumpWeatherDashboard({ dateRange, isSidebarOpen = false }) {
  const navbarKey = iso(dateRange.start);
  const [peakFilter, setPeakFilter] = useState({ start: navbarKey, end: navbarKey });
  const [statusFilter, setStatusFilter] = useState({ start: navbarKey, end: navbarKey });
  useEffect(() => { setPeakFilter({ start: navbarKey, end: navbarKey }); setStatusFilter({ start: navbarKey, end: navbarKey }); }, [navbarKey]);
  const baseRange = useMemo(() => range(navbarKey), [navbarKey]);
  const peakRange = useMemo(() => range(peakFilter.start, peakFilter.end), [peakFilter.start, peakFilter.end]);
  const statusRange = useMemo(() => range(statusFilter.start, statusFilter.end), [statusFilter.start, statusFilter.end]);
  const base = usePumpData(baseRange), peaks = usePumpData(peakRange), statuses = usePumpData(statusRange);
  return <main className={`pump-dashboard pw-dashboard${isSidebarOpen ? " sidebar-open" : ""}`}>
    {(base.loading || peaks.loading || statuses.loading) && <div className="pw-loading">Memuat data PumpStation...</div>}
    {(base.error || peaks.error || statuses.error) && <div className="pw-error">{base.error || peaks.error || statuses.error}</div>}
    <CurrentCards latest={base.data?.analytics?.latest} />
    <section className="pw-main-grid"><PeakPanel data={peaks.data} filter={peakFilter} setFilter={setPeakFilter} navbarKey={navbarKey} /><TrendChart rows={base.data?.chart || []} /><StatusPanel data={statuses.data} filter={statusFilter} setFilter={setStatusFilter} navbarKey={navbarKey} /></section>
  </main>;
}
