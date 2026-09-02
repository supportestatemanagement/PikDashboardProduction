import { useEffect, useMemo, useState } from "react";
import { fetchPumpAnalytics } from "../services/pumpService";

const STATIONS = ["ALL", "PS1", "PS2", "PS3", "PS4", "TWA", "SEA"];
const STATUS_COLORS = { "Standby": "#64748b", "Run 1": "#2dd4bf", "Run 2": "#fbbf24", "Run 3": "#fb7185" };
const fmt = (value) => value == null ? "-" : String(value).replace(".", ",");
const dateLabel = (value) => new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

/* ---------- icons ---------- */
function IconCloud() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 18h10.5a3.7 3.7 0 0 0 .4-7.38A5.6 5.6 0 0 0 7.1 8.4 4.3 4.3 0 0 0 7 18Z" /></svg>; }
function IconGauge() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.2 15a7.8 7.8 0 1 1 15.6 0" /><path d="M12 15l3.6-4.6" /><circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none" /></svg>; }
function IconWaves() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9c1.4-1.4 2.9-1.4 4.3 0s2.9 1.4 4.3 0 2.9-1.4 4.3 0 2.9 1.4 4.3 0" /><path d="M2 15c1.4-1.4 2.9-1.4 4.3 0s2.9 1.4 4.3 0 2.9-1.4 4.3 0 2.9 1.4 4.3 0" opacity=".5" /></svg>; }

/* ---------- radial gauge ---------- */
function RadialGauge({ value = 0, size = 62, stroke = 7, color = "#2dd4bf", label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="radial-gauge" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="radial-gauge-track" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke}
          className="radial-gauge-value" stroke={color}
          strokeDasharray={c} strokeDashoffset={c - (clamped / 100) * c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="radial-gauge-label">{label ?? `${Math.round(clamped)}%`}</div>
    </div>
  );
}

/* ---------- smooth glowing chart ---------- */
function smoothPath(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function MiniLine({ data }) {
  const series = ["PS1", "PS2", "PS3", "PS4", "SEA", "TWA"];
  const values = data.flatMap((row) => series.map((key) => row[key]).filter(Number.isFinite));
  const min = Math.min(...values, 0), max = Math.max(...values, 1), range = max - min || 1;
  const x = (i) => 28 + i * (650 / Math.max(data.length - 1, 1));
  const y = (v) => 15 + (1 - (v - min) / range) * 125;

  const segmentsFor = (key) => {
    const segs = []; let current = [];
    data.forEach((row, i) => {
      const v = row[key];
      if (Number.isFinite(v)) current.push([x(i), y(v)]);
      else if (current.length) { segs.push(current); current = []; }
    });
    if (current.length) segs.push(current);
    return segs;
  };

  return <svg className="pump-chart" viewBox="0 0 710 175">
    <defs>
      <filter id="pump-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="2.1" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
    {[0, .5, 1].map((r) => <line key={r} x1="28" x2="690" y1={15 + r * 125} y2={15 + r * 125} />)}
    {series.map((key, si) => segmentsFor(key).map((seg, gi) => <path key={`${key}-${gi}`} d={smoothPath(seg)} className={`pump-series s${si}`} />))}
    {data.map((row, i) => <text key={row.period} x={x(i)} y="163" textAnchor="middle">{row.period.length === 7 ? new Date(`${row.period}-01`).toLocaleDateString("id-ID", { month: "short", year: "2-digit" }) : row.period.slice(5, 16)}</text>)}
  </svg>;
}

function EventList({ title, events, onSelect }) {
  return <div className="peak-group"><h3>{title}</h3>{events.length ? events.map((event, i) => <button key={`${event.station}-${event.date}-${event.time}`} onClick={() => onSelect(event)}><b>{i + 1}</b><span><strong>{event.station}</strong><small>{dateLabel(event.date)} • {event.time}</small></span><em>{fmt(event.level)}</em>{event.status && <i style={{ "--status-color": STATUS_COLORS[event.status] || "#64748b" }}>{event.status}</i>}</button>) : <p>Tidak ada event pada periode ini.</p>}</div>;
}

export default function PumpWeatherDashboard({ dateRange }) {
  const [station, setStation] = useState("ALL"), [data, setData] = useState(null), [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => { const controller = new AbortController(); setLoading(true); setError(""); fetchPumpAnalytics(dateRange, station, controller.signal).then(setData).catch((e) => { if (e.name !== "AbortError") setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [dateRange, station]);
  const latest = data?.analytics?.latest;
  const statuses = useMemo(() => data?.statusSummary || {}, [data?.statusSummary]);
  const statusTotal = useMemo(() => Object.values(statuses).reduce((sum, value) => sum + value, 0), [statuses]);
  return <main className="pump-dashboard">
    <header>
      <div><span>PUMP &amp; WEATHER MONITORING</span><h1>Water Operations Overview</h1></div>
      <div className="pump-header-right">
        {latest && <div className="pump-live-chip"><i className="pump-live-dot" />Updated {dateLabel(latest.date)} • {latest.time}</div>}
        <div className="pump-filter"><label>Station</label><select value={station} onChange={(e) => setStation(e.target.value)}>{STATIONS.map((item) => <option key={item} value={item}>{item === "ALL" ? "All" : item === "SEA" ? "Sea Level" : item}</option>)}</select></div>
      </div>
    </header>
    {loading && <div className="pump-message">Memuat data operasional...</div>}{error && <div className="pump-message error">{error}</div>}
    <section className="pump-current-grid">
      <article>
        <span>CURRENT WEATHER</span>
        <div className="pump-kpi-row"><div className="pump-icon-badge weather"><IconCloud /></div><strong>{latest?.weather || "-"}</strong></div>
        <small>{latest ? `${dateLabel(latest.date)} • ${latest.time}` : "Belum ada data"}</small>
      </article>
      {["PS1", "PS2", "PS3", "PS4"].map((key, i) => <article key={key}>
        <span>{key} CURRENT LEVEL</span>
        <div className="pump-kpi-row"><div className={`pump-icon-badge s${i}`}><IconGauge /></div><strong>{fmt(latest?.stations?.[key]?.level)}<i>m</i></strong></div>
        <small>{latest?.stations?.[key]?.status || "Status tidak tersedia"}</small>
      </article>)}
      <article>
        <span>SEA / TWA</span>
        <div className="pump-kpi-row"><div className="pump-icon-badge sea"><IconWaves /></div><strong>{fmt(latest?.sea)}<i>/</i>{fmt(latest?.twa)}</strong></div>
        <small>Nilai asli • unit terpisah</small>
      </article>
      <article className="pump-kpi-gauge">
        <span>DATA COMPLETENESS</span>
        <RadialGauge value={data?.analytics?.completeness || 0} size={58} stroke={6} color="#2dd4bf" />
        <small>{data?.meta?.recordCount || 0} observasi</small>
      </article>
    </section>
    <section className="pump-main-grid">
      <article className="pump-card peak-card"><div className="pump-card-head"><div><span>PEAK LEVEL EVENTS</span><small>Top 5 • nilai numerik tertinggi</small></div></div><EventList title="PUMP & SEA PEAK EVENTS" events={data?.pumpSeaEvents || []} onSelect={setSelected} />{(station === "ALL" || station === "TWA") && <EventList title="TWA PEAK EVENTS • UNIT TERPISAH" events={data?.twaEvents || []} onSelect={setSelected} />}</article>
      <article className="pump-card"><div className="pump-card-head"><div><span>{data?.chartMode === "monthly" ? "MONTHLY PEAK LEVEL" : "WATER LEVEL RANGE & TREND"}</span><small>{data?.chartMode === "monthly" ? "Highest observed level per month" : "Observasi aktual 4-jam"}</small></div></div><MiniLine data={data?.chart || []} />
        <div className="pump-chart-legend">{["PS1", "PS2", "PS3", "PS4", "SEA", "TWA"].map((k, i) => <span key={k}><i className={`s${i}`} />{k}</span>)}</div>
      </article>
      <article className="pump-card status-card"><div className="pump-card-head"><div><span>PEAK EVENTS BY STATUS</span><small>Pump Status at Peak • PS1-PS4</small></div></div>
        <div className="status-gauge-grid">{["Standby", "Run 1", "Run 2", "Run 3"].map((key) => { const pct = statusTotal ? Math.round((statuses[key] || 0) / statusTotal * 100) : 0; return <div className="status-gauge-item" key={key}><RadialGauge value={pct} size={62} stroke={6} color={STATUS_COLORS[key]} /><span>{key}</span><strong>{statuses[key] || 0}</strong></div>; })}</div>
      </article>
    </section>
    <section className="pump-secondary-grid">
      <article className="pump-card"><div className="pump-card-head"><div><span>HIGHEST / LOWEST LEVEL</span><small>Range pada periode aktif</small></div></div><div className="range-table">{Object.entries(data?.analytics?.levelRange || {}).map(([key, value]) => <div key={key}><b>{key}</b><span>Low {fmt(value.low)}</span><strong>High {fmt(value.high)}</strong></div>)}</div></article>
      <article className="pump-card"><div className="pump-card-head"><div><span>PUMP OPERATION SUMMARY</span><small>Run occurrences</small></div></div><div className="occurrence-grid">{Object.entries(data?.analytics?.runOccurrences || {}).map(([key, value]) => <div key={key}><span>{key}</span><strong>{value}</strong><small>run records</small></div>)}</div></article>
      <article className="pump-card"><div className="pump-card-head"><div><span>PUMP STATUS TIMELINE</span><small>Observasi terbaru</small></div></div><div className="timeline-list">{(data?.analytics?.statusTimeline || []).slice(-6).reverse().map((row) => <div key={`${row.date}-${row.time}`}><time>{row.time}</time><span>{Object.entries(row.stations || {}).map(([key, value]) => `${key} ${value.status || "-"}`).join(" • ")}</span></div>)}</div></article>
      {!!data?.analytics?.tdsTrend?.length && <article className="pump-card"><div className="pump-card-head"><div><span>TDS TREND</span><small>Data tersedia pada periode aktif</small></div></div><div className="tds-list">{data.analytics.tdsTrend.slice(-6).reverse().map((row) => <div key={`${row.date}-${row.time}`}><span>{dateLabel(row.date)} • {row.time}</span><strong>{fmt(row.value)}</strong></div>)}</div></article>}
    </section>
    {selected && <div className="peak-modal-backdrop" onClick={() => setSelected(null)}><article className="peak-detail" onClick={(e) => e.stopPropagation()}><button aria-label="Tutup" onClick={() => setSelected(null)}>×</button><h2>{selected.station}</h2>{[["Level", fmt(selected.level)], ["Status", selected.status], ["Date", dateLabel(selected.date)], ["Time", selected.time], ["Weather", selected.weather], ["Sea Level", selected.sea != null ? fmt(selected.sea) : null], ["TWA", selected.twa != null ? fmt(selected.twa) : null], ["TDS", selected.tds != null ? fmt(selected.tds) : null]].filter(([, value]) => value != null && value !== "").map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</article></div>}
  </main>;
}