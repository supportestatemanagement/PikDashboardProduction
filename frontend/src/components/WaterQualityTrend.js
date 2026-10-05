import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const colors = ['#D32F2F', '#F57C00', '#388E3C', '#1976D2', '#8E24AA'];
const timestamp = value => new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
export const formatTrendValue = (value, metric) => metric === 'pH' ? (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2) : String(Number(value.toFixed(2)));

export default function WaterQualityTrend({ metric, points, areas, loading = false, error = false }) {
  const statistic = metric === 'TDS' ? 'Daily average' : 'Daily median';
  const displayValue = value => formatTrendValue(value, metric);
  const [area, setArea] = useState('All areas');
  const [hovered, setHovered] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useRef(null);
  const expandRef = useRef(null);
  useEffect(() => {
    if (!expanded) return;
    const dialog = dialogRef.current;
    const expandButton = expandRef.current;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      expandButton?.focus();
    };
  }, [expanded]);
  const visible = points.filter(point => area === 'All areas' || point.area === area);
  const active = visible.includes(hovered) ? hovered : null;
  const renderChart = large => {
    const width = large ? 1400 : 820, height = large ? 520 : 350;
    const left = 65, right = width - 55, top = 45, bottom = height - 85;
    const dates = [...new Set(visible.map(point => point.time))].sort((a, b) => a - b);
    const start = dates[0] ?? 0, end = dates[dates.length - 1] ?? 1;
    const values = visible.map(point => point.value);
    const rawMin = values.length ? Math.min(...values) : 0;
    const rawMax = values.length ? Math.max(...values) : 1;
    const padding = Math.max((rawMax - rawMin) * 0.15, 0.2);
    const minimum = metric === 'pH' ? Math.max(0, Math.min(6, rawMin - padding)) : 0;
    const maximum = metric === 'pH' ? Math.max(9, rawMax + padding) : Math.max(600, rawMax) * 1.05;
    // Inset both ends so the first point and its label clear the vertical axis.
    const x = time => end === start ? (left + right) / 2 : left + 42 + (time - start) / (end - start) * (right - left - 84);
    const y = value => bottom - (value - minimum) / (maximum - minimum) * (bottom - top);
    const labelY = new Map();
    dates.forEach(date => {
      const sameDay = visible.filter(point => point.time === date).sort((a, b) => y(a.value) - y(b.value));
      let previous = top - 22;
      sameDay.forEach(point => {
        const position = Math.max(y(point.value) - 11, previous + 15);
        labelY.set(point.id, position);
        previous = position;
      });
      const overflow = Math.max(0, previous - (bottom - 5));
      if (overflow) sameDay.forEach(point => labelY.set(point.id, labelY.get(point.id) - overflow));
    });
    const dateStep = Math.max(1, Math.ceil(dates.length / (large ? 14 : 5)));
    return <>
      <div className="water-trend-heading"><div><h2>{metric} Trend</h2><p>{loading ? 'Loading daily values...' : error ? 'Daily values unavailable' : `${statistic} / ${visible.length} daily points`}</p></div><div className="water-trend-actions"><label>Area<select aria-label={`${metric} Trend Area${large ? ' expanded' : ''}`} value={area} onChange={event => { setArea(event.target.value); setHovered(null); }}><option>All areas</option>{areas.map(name => <option key={name}>{name}</option>)}</select></label>
        {large ? <button type="button" onClick={() => setExpanded(false)} aria-label={`Close ${metric} Trend`}>Close</button> : <button type="button" ref={expandRef} onClick={() => setExpanded(true)} aria-label={`Expand ${metric} Trend`} title="Expand chart"><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4M3 3l5 5m9-5-5 5M3 17l5-5m9 5-5-5" /></svg></button>}
      </div></div>
      <div className="water-trend-legend">{areas.filter(name => area === 'All areas' || area === name).map(name => <span key={name}><i style={{ background: colors[areas.indexOf(name)] }} />{name}</span>)}</div>
      {loading ? <div className="water-chart-loading" role="status"><div className="water-loading-grid" aria-hidden="true" /><span>Loading {metric} trend...</span></div> : error ? <div className="water-trend-empty">Trend data could not be loaded.</div> : visible.length ? <div className="water-trend-scroll"><svg className="water-trend-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metric} ${statistic.toLowerCase()} by date`}>
        <text x="20" y="22" className="water-axis-title">{statistic} {metric}</text>
        {metric === 'TDS' && <g pointerEvents="none">
          <rect x={left} y={top} width={right - left} height={y(300) - top} fill="#f8c7c7" />
        </g>}
        {metric === 'pH' && <g pointerEvents="none">
          <rect x={left} y={top} width={right - left} height={y(8.5) - top} fill="#f8c7c7" />
          <rect x={left} y={y(6.5)} width={right - left} height={bottom - y(6.5)} fill="#f8c7c7" />
        </g>}
        {Array.from({ length: 5 }, (_, index) => minimum + (maximum - minimum) * index / 4).map(value => <g key={value}><line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#e7edf5" /><text x={left - 10} y={y(value) + 4} textAnchor="end">{metric === 'pH' ? value.toFixed(2) : Math.round(value)}</text></g>)}
        {(metric === 'TDS' ? [300, 500] : [6.5, 8.5]).map(value => <g key={value}><line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke={metric === 'TDS' && value === 500 ? '#b45309' : '#d95454'} strokeDasharray="5 5" /><text className="water-threshold-label" style={metric === 'TDS' && value === 500 ? { fill: '#b45309' } : undefined} x={right + 6} y={y(value)} dominantBaseline="middle">{metric === 'TDS' && value === 500 ? '<500' : value}</text></g>)}
        {areas.map((name, index) => {
          const series = visible.filter(point => point.area === name);
          return <g key={name}><polyline fill="none" stroke={colors[index]} strokeWidth="1.8" points={series.map(point => `${x(point.time)},${y(point.value)}`).join(' ')} />{series.map(point => <g key={point.id}>
            <circle cx={x(point.time)} cy={y(point.value)} r="4" fill={colors[index]} stroke="white" strokeWidth="1" tabIndex="0" aria-label={`${name}, ${timestamp(point.time)}, ${statistic} ${metric} ${displayValue(point.value)}, ${point.count} samples`} onMouseEnter={() => setHovered(point)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(point)} onBlur={() => setHovered(null)}><title>{`${name} / ${timestamp(point.time)} / ${statistic} ${metric}: ${displayValue(point.value)} / ${point.count} samples`}</title></circle>
            <text className="water-data-label" x={x(point.time)} y={labelY.get(point.id)} textAnchor="middle" style={{ fill: colors[index] }}>{displayValue(point.value)}</text>
          </g>)}</g>;
        })}
        {dates.filter((time, index) => index % dateStep === 0 || index === dates.length - 1).map(time => <text key={time} x={x(time)} y={bottom + 24} textAnchor="middle">{timestamp(time)}</text>)}
        <text x={(left + right) / 2} y={height - 18} textAnchor="middle" className="water-axis-title">Date</text>
      </svg></div> : <div className="water-trend-empty">No measurements with a valid date and {metric} value.</div>}
      <div className="water-trend-detail">
        {metric === 'TDS' && <div className="water-trend-source">Batas tambahan TDS {'<500'} mg/L: <a href="https://jdih.kemkes.go.id/documents/peraturan-menteri-kesehatan-nomor-492menkesperiv2010" target="_blank" rel="noopener noreferrer">JDIH Kemenkes — Permenkes No. 492/Menkes/Per/IV/2010</a></div>}
        <div role="status">{active ? `${active.area} / ${timestamp(active.time)} / ${statistic} ${metric}: ${displayValue(active.value)} / ${active.count} samples` : 'Hover or focus on a point to see its daily value and sample count.'}</div>
        <div className="water-trend-source">Parameter wajib air minum ({metric === 'TDS' ? 'TDS <300' : 'pH 6.5–8.5'}): <a href="https://peraturan.bpk.go.id/Details/245563/permenkes-no-2-tahun-2023" target="_blank" rel="noopener noreferrer">JDIH BPK — Permenkes No. 2 Tahun 2023</a></div>
      </div>
    </>;
  };
  return <>
    <section className="water-trend" aria-label={`${metric} Trend`} aria-busy={loading}>{renderChart(false)}</section>
    {expanded && createPortal(<dialog className="water-chart-dialog water-quality" ref={dialogRef} aria-label={`${metric} Trend expanded`} onCancel={() => setExpanded(false)} onClick={event => { if (event.target === event.currentTarget) setExpanded(false); }}><div className="water-trend water-trend-expanded">{renderChart(true)}</div></dialog>, document.body)}
  </>;
}
