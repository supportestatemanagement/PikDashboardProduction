import { useState } from "react";
import { CHECKPOINTS } from "../config/trafficConfig";
import { formatInteger } from "../services/trafficService";

const W = 520, H = 210, PAD = { top: 12, right: 10, bottom: 28, left: 42 };

export default function TrafficCharts({ hourly }) {
  const [active, setActive] = useState(["bgm", "linggi"]);
  const selected = CHECKPOINTS.filter((item) => active.includes(item.key));
  const values = selected.flatMap((item) => hourly.map((row) => Number(row[item.column]) || 0));
  const max = Math.max(1, ...values);
  const x = (index) => PAD.left + (index / 23) * (W - PAD.left - PAD.right);
  const y = (value) => PAD.top + (1 - value / max) * (H - PAD.top - PAD.bottom);
  const toggle = (key) => setActive((current) => current.includes(key) ? (current.length === 1 ? current : current.filter((item) => item !== key)) : [...current, key]);
  return <section className="glass-panel hourly-chart-panel">
    <div className="panel-heading chart-heading"><div><span>KEPADATAN KENDARAAN PER JAM</span><small>CheckpointHour · nilai final per jam</small></div>
      <div className="chart-legend">{CHECKPOINTS.map((item) => <button className={active.includes(item.key) ? "active" : ""} key={item.key} onClick={() => toggle(item.key)}><i style={{ background: item.color }} />{item.label.replace("CP ", "")}</button>)}</div>
    </div>
    <svg className="hourly-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grafik checkpoint per jam">
      {[0, .25, .5, .75, 1].map((ratio) => { const gridY = y(max * ratio); return <g key={ratio}><line x1={PAD.left} y1={gridY} x2={W - PAD.right} y2={gridY} /><text x={PAD.left - 7} y={gridY + 4}>{formatInteger(max * ratio)}</text></g>; })}
      {hourly.map((row, index) => index % 4 === 0 && <text className="x-label" key={row.time} x={x(index)} y={H - 7}>{row.time}</text>)}
      {selected.map((item) => { const points = hourly.map((row, index) => `${x(index)},${y(Number(row[item.column]) || 0)}`).join(" "); const area = `${PAD.left},${H - PAD.bottom} ${points} ${x(23)},${H - PAD.bottom}`; return <g key={item.key}><polygon points={area} fill={item.color} opacity=".06" /><polyline points={points} stroke={item.color} /></g>; })}
    </svg>
  </section>;
}
