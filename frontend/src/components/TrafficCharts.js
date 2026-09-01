import { useState } from "react";
import { CHECKPOINTS } from "../config/trafficConfig";
import { formatInteger } from "../services/trafficService";
import PanelControls from "./PanelControls";

const W = 1200, H = 380, PAD = { top: 36, right: 28, bottom: 62, left: 66 };
const HOUR_ORDER = [...Array.from({ length: 23 }, (_, index) => `${String(index + 1).padStart(2, "0")}:00`), "00:00"];

export default function TrafficCharts({ hourly, maximized, onMaximize }) {
  const [active, setActive] = useState(["bgm", "linggi"]);
  const [minimized, setMinimized] = useState(false);
  const rowsByTime = new Map(hourly.map((row) => [String(row.time).slice(0, 5), row]));
  const orderedHourly = HOUR_ORDER.map((time) => rowsByTime.get(time) || { time });
  const selected = CHECKPOINTS.filter((item) => active.includes(item.key));
  const values = selected.flatMap((item) => orderedHourly.map((row) => Number(row[item.column]) || 0));
  const max = Math.max(1, ...values);
  const x = (index) => PAD.left + (index / 23) * (W - PAD.left - PAD.right);
  const y = (value) => PAD.top + (1 - value / max) * (H - PAD.top - PAD.bottom);
  const toggle = (key) => setActive((current) => current.includes(key) ? (current.length === 1 ? current : current.filter((item) => item !== key)) : [...current, key]);

  return <section className={`glass-panel hourly-chart-panel ${minimized ? "panel-minimized" : ""} ${maximized ? "panel-maximized" : ""}`}>
    <div className="panel-heading chart-heading">
      <div className="chart-title-row"><div><span>KEPADATAN KENDARAAN PER JAM</span></div>
        <PanelControls minimized={minimized} maximized={maximized} onMinimize={() => { setMinimized(!minimized); if (!minimized && maximized) onMaximize(); }} onMaximize={onMaximize} />
      </div>
      {!minimized && <div className="chart-legend">{CHECKPOINTS.map((item) => <button className={active.includes(item.key) ? "active" : ""} key={item.key} onClick={() => toggle(item.key)}><i style={{ background: item.color }} />{item.label.replace("CP ", "")}</button>)}</div>}
    </div>
    {!minimized && <svg className="hourly-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grafik checkpoint per jam">
      {[0, .25, .5, .75, 1].map((ratio) => { const gridY = y(max * ratio); return <g key={ratio}><line x1={PAD.left} y1={gridY} x2={W - PAD.right} y2={gridY} /><text x={PAD.left - 7} y={gridY + 4}>{formatInteger(max * ratio)}</text></g>; })}
      {orderedHourly.map((row, index) => <text className="x-label" key={row.time} x={x(index)} y={H - 12} transform={maximized ? undefined : `rotate(-58 ${x(index)} ${H - 12})`}>{row.time}</text>)}
      {selected.map((item, seriesIndex) => {
        const points = orderedHourly.map((row, index) => `${x(index)},${y(Number(row[item.column]) || 0)}`).join(" ");
        const area = `${PAD.left},${H - PAD.bottom} ${points} ${x(23)},${H - PAD.bottom}`;
        return <g key={item.key}>
          <polygon points={area} fill={item.color} opacity=".06" />
          <polyline points={points} stroke={item.color} />
          {orderedHourly.map((row, index) => {
            const value = Number(row[item.column]) || 0;
            const pointY = y(value);
            return <g key={`${item.key}-${row.time}`}>
              <circle className="data-point" cx={x(index)} cy={pointY} r="1.8" fill={item.color} />
              <text className="data-label" x={x(index)} y={pointY + (seriesIndex % 2 === 0 ? -5 : 9)}>{formatInteger(value)}</text>
            </g>;
          })}
        </g>;
      })}
    </svg>}
  </section>;
}
