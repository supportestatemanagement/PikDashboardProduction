import { useEffect, useMemo, useState } from "react";
import { fetchPumpAnalytics } from "../services/pumpService";

const STATIONS = ["ALL", "PS1", "PS2", "PS3", "PS4", "TWA", "SEA"];
const fmt = (value) => value == null ? "-" : String(value).replace(".", ",");
const dateLabel = (value) => new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

function MiniLine({ data }) {
  const series = ["PS1", "PS2", "PS3", "PS4", "SEA", "TWA"];
  const values = data.flatMap((row) => series.map((key) => row[key]).filter(Number.isFinite));
  const min = Math.min(...values, 0), max = Math.max(...values, 1), range = max - min || 1;
  const x = (i) => 28 + i * (650 / Math.max(data.length - 1, 1));
  const y = (v) => 15 + (1 - (v - min) / range) * 125;
  return <svg className="pump-chart" viewBox="0 0 710 175">
    {[0, .5, 1].map((r) => <line key={r} x1="28" x2="690" y1={15 + r * 125} y2={15 + r * 125} />)}
    {series.map((key, si) => { const points = data.map((row, i) => Number.isFinite(row[key]) ? `${x(i)},${y(row[key])}` : null).filter(Boolean).join(" "); return points && <polyline key={key} points={points} className={`pump-series s${si}`} />; })}
    {data.map((row, i) => <text key={row.period} x={x(i)} y="163" textAnchor="middle">{row.period.length === 7 ? new Date(`${row.period}-01`).toLocaleDateString("id-ID", { month: "short", year: "2-digit" }) : row.period.slice(5, 16)}</text>)}
  </svg>;
}

function EventList({ title, events, onSelect }) {
  return <div className="peak-group"><h3>{title}</h3>{events.length ? events.map((event, i) => <button key={`${event.station}-${event.date}-${event.time}`} onClick={() => onSelect(event)}><b>{i + 1}</b><span><strong>{event.station}</strong><small>{dateLabel(event.date)} • {event.time}</small></span><em>{fmt(event.level)}</em>{event.status && <i>{event.status}</i>}</button>) : <p>Tidak ada event pada periode ini.</p>}</div>;
}

export default function PumpWeatherDashboard({ dateRange }) {
  const [station, setStation] = useState("ALL"), [data, setData] = useState(null), [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => { const controller = new AbortController(); setLoading(true); setError(""); fetchPumpAnalytics(dateRange, station, controller.signal).then(setData).catch((e) => { if (e.name !== "AbortError") setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [dateRange, station]);
  const latest = data?.analytics?.latest;
  const statuses = useMemo(() => data?.statusSummary || {}, [data?.statusSummary]);
  const statusTotal = useMemo(() => Object.values(statuses).reduce((sum, value) => sum + value, 0), [statuses]);
  return <main className="pump-dashboard">
    <header><div><span>PUMP & WEATHER MONITORING</span><h1>Water Operations Overview</h1></div><div className="pump-filter"><label>Station</label><select value={station} onChange={(e) => setStation(e.target.value)}>{STATIONS.map((item) => <option key={item} value={item}>{item === "ALL" ? "All" : item === "SEA" ? "Sea Level" : item}</option>)}</select></div></header>
    {loading && <div className="pump-message">Memuat data operasional...</div>}{error && <div className="pump-message error">{error}</div>}
    <section className="pump-current-grid">
      <article><span>CURRENT WEATHER</span><strong>{latest?.weather || "-"}</strong><small>{latest ? `${dateLabel(latest.date)} • ${latest.time}` : "Belum ada data"}</small></article>
      {["PS1", "PS2", "PS3", "PS4"].map((key) => <article key={key}><span>{key} CURRENT LEVEL</span><strong>{fmt(latest?.stations?.[key]?.level)}</strong><small>{latest?.stations?.[key]?.status || "Status tidak tersedia"}</small></article>)}
      <article><span>SEA / TWA</span><strong>{fmt(latest?.sea)} / {fmt(latest?.twa)}</strong><small>Nilai asli • unit terpisah</small></article>
      <article><span>DATA COMPLETENESS</span><strong>{data?.analytics?.completeness || 0}%</strong><small>{data?.meta?.recordCount || 0} observasi</small></article>
    </section>
    <section className="pump-main-grid">
      <article className="pump-card peak-card"><div className="pump-card-head"><div><span>PEAK LEVEL EVENTS</span><small>Top 5 • nilai numerik tertinggi</small></div></div><EventList title="PUMP & SEA PEAK EVENTS" events={data?.pumpSeaEvents || []} onSelect={setSelected} />{(station === "ALL" || station === "TWA") && <EventList title="TWA PEAK EVENTS • UNIT TERPISAH" events={data?.twaEvents || []} onSelect={setSelected} />}</article>
      <article className="pump-card"><div className="pump-card-head"><div><span>{data?.chartMode === "monthly" ? "MONTHLY PEAK LEVEL" : "WATER LEVEL RANGE & TREND"}</span><small>{data?.chartMode === "monthly" ? "Highest observed level per month" : "Observasi aktual 4-jam"}</small></div></div><MiniLine data={data?.chart || []} /></article>
      <article className="pump-card status-card"><div className="pump-card-head"><div><span>PEAK EVENTS BY STATUS</span><small>Pump Status at Peak • PS1-PS4</small></div></div>{["Standby", "Run 1", "Run 2", "Run 3"].map((key) => <div className="status-summary" key={key}><span>{key}</span><div><i style={{ width: `${statusTotal ? (statuses[key] || 0) / statusTotal * 100 : 0}%` }} /></div><strong>{statuses[key] || 0}</strong></div>)}</article>
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
