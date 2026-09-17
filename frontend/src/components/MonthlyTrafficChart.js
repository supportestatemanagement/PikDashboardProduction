import { useEffect, useState } from "react";
import { CHECKPOINTS } from "../config/trafficConfig";
import { fetchMonthlyTraffic, formatInteger, toApiDate } from "../services/trafficService";
import PanelControls from "./PanelControls";

const SERIES = [...CHECKPOINTS, ...[
  ["BGM", "#f97316"], ["GI", "#e879f9"], ["RWI", "#a3e635"], ["PIK2", "#f8fafc"],
].map(([area, color]) => ({ key: `vehicle-${area}`, column: `VehicleIN-${area}`, label: `Vehicle In ${area}`, color }))];
const monthLabel = (month) => new Date(`${month}-01T00:00:00`).toLocaleDateString("id-ID", { month: "short", year: "numeric" });

export default function MonthlyTrafficChart({ maximized, onMaximize }) {
  const currentMonth = toApiDate(new Date()).slice(0, 7);
  const [range, setRange] = useState({ start: currentMonth, end: currentMonth });
  const [draft, setDraft] = useState(range);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [minimized, setMinimized] = useState(true);
  const [active, setActive] = useState(() => CHECKPOINTS.map(({ key }) => key));
  const start = maximized ? range.start : currentMonth;
  const end = maximized ? range.end : currentMonth;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    fetchMonthlyTraffic(start, end, controller.signal).then((payload) => {
      if (!controller.signal.aborted) setData(payload);
    }).catch((err) => {
      if (!controller.signal.aborted) setError(err.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [start, end]);

  useEffect(() => {
    if (!maximized) return undefined;
    const close = (event) => { if (event.key === "Escape") onMaximize(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [maximized, onMaximize]);

  const rows = data?.rows || [];
  const selected = SERIES.filter(({ key }) => active.includes(key));
  const max = Math.max(1, ...rows.flatMap((row) => selected.map(({ column }) => Number(row[column]) || 0)));
  const width = maximized ? Math.max(1600, rows.length * (data?.granularity === "monthly" ? 85 : 48) + 140) : 1000;
  const height = maximized ? 500 : 290;
  const baseline = height - 45;
  const x = (index) => 100 + index / Math.max(1, rows.length - 1) * (width - 135);
  const y = (value) => baseline - value / max * (baseline - 35);
  const labelPositions = rows.map((row) => {
    const positions = {};
    let previous = 10;
    selected.map((item) => ({ key: item.key, top: y(Number(row[item.column]) || 0) - 8 }))
      .sort((a, b) => a.top - b.top)
      .forEach(({ key, top }) => { positions[key] = Math.max(top, previous + 14); previous = positions[key]; });
    const overflow = Math.max(0, previous - (baseline + 14));
    return Object.fromEntries(Object.entries(positions).map(([key, value]) => [key, value - overflow]));
  });
  const hasData = rows.some((row) => row.recordCount > 0);
  const toggle = (key) => setActive((items) => items.includes(key) ? (items.length > 1 ? items.filter((item) => item !== key) : items) : [...items, key]);

  return <section className={`glass-panel hourly-chart-panel monthly-chart-panel ${minimized ? "panel-minimized" : ""} ${maximized ? "panel-maximized" : ""}`} aria-label="Monthly checkpoint and vehicle in traffic" aria-busy={loading}>
    <div className="monthly-toolbar">
    <div className="panel-heading chart-heading">
      <div className="chart-title-row"><div><span>MONTHLY TRAFFIC</span>{!minimized && <small>{monthLabel(start)}{start !== end ? ` – ${monthLabel(end)}` : ""}</small>}</div>
        <PanelControls minimized={minimized} maximized={maximized} onMinimize={() => setMinimized(!minimized)} onMaximize={onMaximize} />
      </div>
      {!minimized && <div className="monthly-legends">{[SERIES.slice(0, CHECKPOINTS.length), SERIES.slice(CHECKPOINTS.length)].map((group, index) => <div className="chart-legend" key={index} aria-label={index === 0 ? "Checkpoint" : "Vehicle In"}>{group.map((item) => <button type="button" key={item.key} aria-pressed={active.includes(item.key)} className={active.includes(item.key) ? "active" : ""} onClick={() => toggle(item.key)}><i style={{ background: item.color }} />{item.label}</button>)}</div>)}</div>}
    </div>
    {maximized && <form className="monthly-range" onSubmit={(event) => { event.preventDefault(); if (draft.start && draft.end && draft.start <= draft.end) setRange({ ...draft }); }}>
      <label>Bulan awal<input type="month" required value={draft.start} max={draft.end || undefined} onChange={(event) => setDraft({ ...draft, start: event.target.value })} /></label>
      <label>Bulan akhir<input type="month" required value={draft.end} min={draft.start || undefined} onChange={(event) => setDraft({ ...draft, end: event.target.value })} /></label>
      <button type="submit">Terapkan</button>
      <button type="button" onClick={() => { const next = { start: currentMonth, end: currentMonth }; setDraft(next); setRange(next); }}>Bulan ini</button>
    </form>}
    </div>
    {!minimized && (loading ? <p className="monthly-message" role="status">Memuat traffic bulanan…</p> : error ? <p className="monthly-message" role="alert">{error}</p> : !hasData ? <p className="monthly-message">Belum ada data untuk rentang bulan ini.</p> : <div className="monthly-plot-scroll"><svg className="hourly-svg monthly-svg" style={maximized ? { minWidth: width * .8 } : undefined} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio={maximized ? "none" : "xMidYMid meet"} role="img" aria-label={`Grafik checkpoint dan vehicle in ${monthLabel(start)} sampai ${monthLabel(end)}`}>
      {[0, .25, .5, .75, 1].map((ratio) => <g key={ratio}><line x1="70" y1={y(max * ratio)} x2={width - 35} y2={y(max * ratio)} /><text x="62" y={y(max * ratio) + 4}>{formatInteger(max * ratio)}</text></g>)}
      {rows.map((row, index) => (maximized || index % Math.max(1, Math.ceil(rows.length / 8)) === 0 || index === rows.length - 1) && <text className="x-label" key={row.period} x={x(index)} y={height - 12}>{data.granularity === "daily" ? row.period.slice(8) : monthLabel(row.period)}</text>)}
      {selected.map((item, seriesIndex) => <g key={item.key}>
        <path d={rows.map((row, index) => row.recordCount ? `${index > 0 && rows[index - 1].recordCount ? "L" : "M"}${x(index)},${y(Number(row[item.column]) || 0)}` : "").join(" ")} fill="none" stroke={item.color} strokeWidth="2" />
        {rows.map((row, index) => {
          if (!row.recordCount) return null;
          const value = Number(row[item.column]) || 0;
          const pointY = y(value);
          return <g key={row.period}>
            <circle cx={x(index)} cy={pointY} r="3" fill={item.color}><title>{row.period} · {item.label}: {formatInteger(value)}</title></circle>
            <text className="data-label monthly-data-label" x={x(index)} y={maximized ? labelPositions[index][item.key] : pointY + (seriesIndex % 2 === 0 ? -7 : 13)}>{formatInteger(value)}</text>
          </g>;
        })}
      </g>)}
    </svg></div>)}
  </section>;
}
