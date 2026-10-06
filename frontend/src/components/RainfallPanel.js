import { useEffect, useState } from 'react';
import { LoadingChart } from './DashboardLoading';

export default function RainfallPanel({ date }) {
  const [state, setState] = useState({ loading: true, rows: [], error: '' });
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, rows: [], error: '' });
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
  const max = Math.max(20, ...rows.map(row => Number.isFinite(row.value) ? row.value : 0)) * 1.03;
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
  return <article className="pw-panel pw-rain-panel" aria-label="Curah Hujan" aria-busy={state.loading}>
    <div className="pw-panel-head"><div><h2>CURAH HUJAN</h2><small>{date.split('-').reverse().join('/')} · Sheet CurahHujan</small></div></div>
    {state.loading ? <LoadingChart height={300} /> : state.error ? <p className="pw-no-data" role="alert">{state.error}</p> : !rows.length ? <p className="pw-no-data">Belum ada data curah hujan pada tanggal ini.</p> : <div className="pw-rain-scroll"><svg viewBox="0 0 980 410" className="pw-rain-chart" role="img" aria-label="Grafik Curah Hujan dalam milimeter">
      <g><rect x="310" y="8" width="70" height="24" fill="#bbdefb" stroke="#1976d2" strokeWidth="4" /><text x="392" y="27" fontSize="20">Curah Hujan (mm)</text></g>
      {[0, 4, 8, 12, 16, 20].map(value => <g key={value}><line x1="80" x2="940" y1={y(value)} y2={y(value)} stroke="#f1f1f1" /><text x="65" y={y(value) + 5} textAnchor="end">{value}</text></g>)}
      <path d="M80 40V310H940" fill="none" stroke="#e5e7eb" />
      {segments.map((segment, i) => <g key={i}><path d={`M${segment[0][0]},310 ${segment.map(point => `L${point.join(',')}`).join(' ')} L${segment[segment.length - 1][0]},310 Z`} fill="#bbdefb" fillOpacity=".55" /><polyline points={segment.map(point => point.join(',')).join(' ')} fill="none" stroke="#1976d2" strokeWidth="3" /></g>)}
      {[[20, 'Siaga 1: 20', '#ef3340'], [10, 'Siaga 2: 10', '#ff7f0e'], [5, 'Siaga 3: 5', '#ffbf00']].map(([value, label, color]) => <g key={value}><line x1="80" x2="940" y1={y(value)} y2={y(value)} stroke={color} strokeDasharray="12 8" strokeWidth="2" /><rect x="96" y={y(value) + 6} width="145" height="34" rx="7" fill={color} /><text x="168" y={y(value) + 29} textAnchor="middle" fill="white" fontWeight="700">{label}</text></g>)}
      {rows.map((row, i) => <g key={`${row.date}-${row.time}`}>{Number.isFinite(row.value) && <circle cx={x(i)} cy={y(row.value)} r="5" fill="#1976d2" tabIndex="0" aria-label={`${row.time}: ${row.value} mm`}><title>{row.date} {row.time}: {row.value} mm · {row.status}</title></circle>}{(i % labelEvery === 0 || i === rows.length - 1) && <text transform={`translate(${x(i)},340) rotate(-30)`} textAnchor="end" fontSize="13">{row.date.slice(5)} {row.time}</text>}</g>)}
      <text transform="translate(24,175) rotate(-90)" textAnchor="middle" fill="#1976d2" fontWeight="700" fontSize="20">Curah Hujan (mm)</text>
    </svg></div>}
  </article>;
}
