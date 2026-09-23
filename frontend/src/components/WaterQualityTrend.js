import { useState } from 'react';

const colors = ['#285ac2', '#008493', '#5945be', '#287c69', '#a56127'];
const timestamp = value => new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });

export default function WaterQualityTrend({ metric, points, areas }) {
  const statistic = metric === 'TDS' ? 'Daily average' : 'Daily median';
  const displayValue = value => Number(value.toFixed(2));
  const [area, setArea] = useState('All areas');
  const [hovered, setHovered] = useState(null);
  const visible = points.filter(point => area === 'All areas' || point.area === area);
  const start = visible.length ? Math.min(...visible.map(point => point.time)) : 0;
  const end = visible.length ? Math.max(...visible.map(point => point.time)) : 1;
  const values = visible.map(point => point.value);
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 1;
  const padding = Math.max((rawMax - rawMin) * 0.15, 0.2);
  const minimum = metric === 'pH' ? Math.max(0, rawMin - padding) : 0;
  const maximum = metric === 'pH' ? rawMax + padding : Math.max(600, rawMax) * 1.05;
  const x = time => end === start ? 420 : 65 + (time - start) / (end - start) * 710;
  const y = value => 255 - (value - minimum) / (maximum - minimum) * 210;
  const active = visible.includes(hovered) ? hovered : null;
  return <section className="water-trend" aria-label={`${metric} Trend`}>
    <div className="water-trend-heading"><div><h2>{metric} Trend</h2><p>{statistic} / {visible.length} daily points</p></div><label>Area<select aria-label={`${metric} Trend Area`} value={area} onChange={event => { setArea(event.target.value); setHovered(null); }}><option>All areas</option>{areas.map(name => <option key={name}>{name}</option>)}</select></label></div>
    <div className="water-trend-legend">{areas.filter(name => area === 'All areas' || area === name).map(name => <span key={name}><i style={{ background: colors[areas.indexOf(name)] }} />{name}</span>)}</div>
    {visible.length ? <div className="water-trend-scroll"><svg viewBox="0 0 820 330" role="img" aria-label={`${metric} ${statistic.toLowerCase()} by date`}>
      <text x="20" y="22" className="water-axis-title">{statistic} {metric}</text>
      {Array.from({ length: 5 }, (_, index) => minimum + (maximum - minimum) * index / 4).map(value => <g key={value}><line x1="65" x2="775" y1={y(value)} y2={y(value)} stroke="#e7edf5" /><text x="55" y={y(value) + 4} textAnchor="end">{metric === 'pH' ? value.toFixed(2) : Math.round(value)}</text></g>)}
      {metric === 'TDS' && [300, 500].map(value => <g key={value}><line x1="65" x2="775" y1={y(value)} y2={y(value)} stroke={value === 300 ? '#dc962d' : '#d95454'} strokeDasharray="5 5" /><text x="778" y={y(value) + 4}>{value}</text></g>)}
      {areas.map((name, index) => {
        const series = visible.filter(point => point.area === name);
        return <g key={name}><polyline fill="none" stroke={colors[index]} strokeWidth="1.8" points={series.map(point => `${x(point.time)},${y(point.value)}`).join(' ')} />{series.map(point => <circle key={point.id} cx={x(point.time)} cy={y(point.value)} r="4" fill={colors[index]} stroke="white" strokeWidth="1" tabIndex="0" aria-label={`${name}, ${timestamp(point.time)}, ${statistic} ${metric} ${displayValue(point.value)}, ${point.count} samples`} onMouseEnter={() => setHovered(point)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(point)} onBlur={() => setHovered(null)}><title>{`${name} / ${timestamp(point.time)} / ${statistic} ${metric}: ${displayValue(point.value)} / ${point.count} samples`}</title></circle>)}</g>;
      })}
      {[...new Set(visible.map(point => point.time))].filter((time, index, dates) => index % Math.max(1, Math.ceil(dates.length / 5)) === 0 || index === dates.length - 1).map(time => <text key={time} x={x(time)} y="279" textAnchor="middle">{timestamp(time)}</text>)}
      <text x="420" y="315" textAnchor="middle" className="water-axis-title">Date</text>
    </svg></div> : <div className="water-trend-empty">No measurements with a valid date and {metric} value.</div>}
    <div className="water-trend-detail" role="status">{active ? `${active.area} / ${timestamp(active.time)} / ${statistic} ${metric}: ${displayValue(active.value)} / ${active.count} samples` : 'Hover or focus on a point to see its daily value and sample count.'}</div>
  </section>;
}
