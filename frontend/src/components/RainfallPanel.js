import { useEffect, useState } from 'react';
import { LoadingChart } from './DashboardLoading';

export default function RainfallPanel({ date }) {
  const [state, setState] = useState({ loading: true, rows: [], error: '' });
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, rows: [], error: '' });
    setHovered(null);
    setSelected(null);
    const params = new URLSearchParams({ startDate: date, endDate: date });
    fetch(`${process.env.REACT_APP_API_URL || ''}/api/pump-rainfall?${params}`, { signal: controller.signal })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(payload.message || 'Gagal memuat curah hujan.');
        return payload.data;
      }).then(rows => setState({ loading: false, rows: [...rows].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)), error: '' }))
      .catch(error => { if (error.name !== 'AbortError') setState({ loading: false, rows: [], error: error.message }); });
    return () => controller.abort();
  }, [date]);
  const rows = state.rows;
  const max = Math.ceil(Math.max(24, ...rows.map(row => Number.isFinite(row.value) ? row.value : 0)) / 4) * 4;
  const x = index => 80 + index / Math.max(1, rows.length - 1) * 860;
  const y = value => 310 - value / max * 270;
  const segments = [];
  let points = [];
  rows.forEach((row, i) => {
    if (Number.isFinite(row.value)) points.push([x(i), y(row.value)]);
    else if (points.length) { segments.push(points); points = []; }
  });
  if (points.length) segments.push(points);
  const labelEvery = Math.max(1, Math.ceil(rows.length / 18));
  const active = hovered ?? selected;
  const activeRow = active == null ? null : rows[active];
  const tooltipX = active == null ? 0 : Math.min(714, Math.max(84, x(active) - 110));
  const tooltipY = activeRow ? Math.max(42, y(activeRow.value) - 114) : 0;
  if (!state.loading && !state.error && !rows.some(row => Number.isFinite(row.value))) return null;
  return <article className="pw-panel pw-rain-panel" aria-label="Curah Hujan" aria-busy={state.loading}>
    <div className="pw-panel-head"><div><h2>CURAH HUJAN PIK 1</h2><small>Sumber: <a href="https://bbwscc.sdatelemetry.com/?page=pchcilicis" target="_blank" rel="noopener noreferrer" style={{ color: '#7dd3fc' }}>Data BBWSCC (Pos Curah Hujan Cengkareng Drain)</a></small></div></div>
    {state.loading ? <LoadingChart height={300} /> : state.error ? <p className="pw-no-data" role="alert">{state.error}</p> : !rows.length ? <p className="pw-no-data">Belum ada data curah hujan pada tanggal ini.</p> : <div className="pw-rain-scroll"><svg viewBox="0 0 980 410" preserveAspectRatio="none" className="pw-rain-chart" role="img" aria-label="Grafik Curah Hujan dalam milimeter">
      <g><rect x="784" y="14" width="24" height="12" fill="#bbdefb" stroke="#1976d2" strokeWidth="2" /><text x="816" y="24" fontSize="12">Curah Hujan (mm)</text></g>
      {Array.from({ length: max / 4 + 1 }, (_, i) => i * 4).map(value => <g key={value}><line x1="80" x2="940" y1={y(value)} y2={y(value)} stroke="#f1f1f1" /><text x="65" y={y(value) + 5} textAnchor="end">{value}</text></g>)}
      <path d="M80 40V310H940" fill="none" stroke="#e5e7eb" />
      {segments.map((segment, i) => <g key={i}><path d={`M${segment[0][0]},310 ${segment.map(point => `L${point.join(',')}`).join(' ')} L${segment[segment.length - 1][0]},310 Z`} fill="#bbdefb" fillOpacity=".55" /><polyline points={segment.map(point => point.join(',')).join(' ')} fill="none" stroke="#1976d2" strokeWidth="3" /></g>)}
      {[[20, 'Siaga 1: 20', '#ef3340'], [10, 'Siaga 2: 10', '#ff7f0e'], [5, 'Siaga 3: 5', '#ffbf00']].map(([value, label, color]) => <g key={value}><line x1="80" x2="940" y1={y(value)} y2={y(value)} stroke={color} strokeDasharray="12 8" strokeWidth="2" /><rect x="96" y={y(value) - 11} width="96" height="22" rx="5" fill={color} /><text x="144" y={y(value) + 4} textAnchor="middle" fill="white" fontWeight="700" fontSize="11">{label}</text></g>)}
      {rows.map((row, i) => <g key={`${row.date}-${row.time}`}>{Number.isFinite(row.value) && <circle cx={x(i)} cy={y(row.value)} r={active === i ? 7 : 4} fill="#1976d2" stroke={active === i ? '#fff' : 'none'} strokeWidth="2" tabIndex="0" style={{ cursor: 'pointer' }} aria-label={`${row.time}: ${row.value} mm`} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(i)} onBlur={() => setHovered(null)} onClick={() => setSelected(selected === i ? null : i)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(selected === i ? null : i); } if (event.key === 'Escape') { setSelected(null); setHovered(null); } }} />}{(i % labelEvery === 0 || i === rows.length - 1) && <text transform={`translate(${x(i)},340) rotate(-30)`} textAnchor="end" fontSize="13">{row.date.slice(5)} {row.time}</text>}</g>)}
      {activeRow && <g role="tooltip" pointerEvents="none"><line x1={x(active)} x2={x(active)} y1="40" y2="310" stroke="#1976d2" strokeOpacity=".25" strokeDasharray="4 4" /><rect x={tooltipX} y={tooltipY} width="220" height="100" rx="10" fill="#0f2138" stroke="#60a5fa" /><text x={tooltipX + 14} y={tooltipY + 25} fill="#cbd5e1" fontSize="13">{activeRow.date} · {activeRow.time} WIB</text><text x={tooltipX + 14} y={tooltipY + 54} fill="#67d9ff" fontWeight="700" fontSize="23">{new Intl.NumberFormat('id-ID').format(activeRow.value)} mm</text><text x={tooltipX + 14} y={tooltipY + 80} fill="#fff" fontSize="13">{String(activeRow.status || 'Status belum tersedia').slice(0, 30)}</text>{selected != null && <foreignObject x={tooltipX + 192} y={tooltipY + 4} width="24" height="24" pointerEvents="auto"><button type="button" aria-label="Tutup popup curah hujan" onClick={() => { setSelected(null); setHovered(null); }} style={{ display: 'block', width: 24, height: 24, padding: 0, border: 0, borderRadius: 5, background: '#263d58', color: '#fff', cursor: 'pointer', fontSize: 18 }}>×</button></foreignObject>}</g>}
      <text transform="translate(24,175) rotate(-90)" textAnchor="middle" fill="#1976d2" fontWeight="700" fontSize="20">Curah Hujan (mm)</text>
    </svg></div>}
  </article>;
}
