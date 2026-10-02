import { useEffect, useMemo, useState } from 'react';
import { CUSTOMER_COLUMNS, countCustomerValues, dailyCustomerTickets, fetchCustomerRows } from '../services/customerService';
import { toApiDate } from '../services/trafficService';
import './WaterQualityDashboard.css';
import './CustomerServiceDashboard.css';

const number = value => value.toLocaleString('id-ID');
const colors = ['#3b82f6', '#18bfd4', '#8b5cf6', '#f59e0b', '#10b981', '#ef6464', '#ec4899', '#6366f1', '#64748b', '#0d9488'];
const logos = { BGM: '/logobgm.png', GIS: '/logogi2.png', GI: '/logogi2.png', RWI: '/logorwi2.png', PIK2: '/logopik2.png' };
const categorical = ['Project Code', 'Source', 'Service Type', 'Category Name', 'Response Status', 'Handling Status'];
const options = (rows, column) => [...new Set(rows.map(row => row[column]).filter(Boolean))].sort();
function Select({ label, value, onChange, values }) {
  return <label className="cs-select">{label}<select value={value} onChange={e => onChange(e.target.value)}><option value="">All</option>{values.map(item => <option key={item}>{item}</option>)}</select></label>;
}
function Empty() { return <p className="cs-empty">Tidak ada tiket untuk pilihan ini.</p>; }
function Bars({ items, horizontal = false, label }) {
  if (!items.length) return <Empty />;
  const max = Math.max(...items.map(item => item.count), 1);
  return <div className={horizontal ? 'cs-horizontal' : 'cs-bars-scroll'} aria-label={label}>
    {horizontal ? items.map((item, i) => <div className="cs-horizontal-row" key={item.label}>
      <span title={item.label}>{item.label}</span><div><i style={{ width: `${item.count / max * 100}%`, background: colors[i % colors.length] }} /></div><strong>{number(item.count)}</strong>
    </div>) : <div className="cs-bars" style={{ minWidth: Math.max(360, items.length * 112) }}>
      {items.map((item, i) => <div className="cs-bar-column" key={item.label}><div className="cs-bar-track"><div className="cs-bar" style={{ height: `${item.count / max * 90}%`, background: colors[i % colors.length] }}><strong>{number(item.count)}</strong></div></div><span title={item.label}>{item.label}</span></div>)}
    </div>}
  </div>;
}
function DailyChart({ rows }) {
  const items = useMemo(() => dailyCustomerTickets(rows), [rows]);
  if (!items.length) return <Empty />;
  const width = Math.max(640, items.length * 13), height = 255, max = Math.max(...items.map(item => item.count), 1);
  const x = i => 44 + i * (width - 70) / Math.max(1, items.length - 1), y = value => 220 - value / max * 175;
  const tickEvery = Math.max(1, Math.ceil(items.length / 12));
  return <div className="cs-line-scroll"><svg viewBox={`0 0 ${width} ${height}`} style={{ minWidth: width }} role="img" aria-label="Daily Customer Service Tickets">
    {[0, .25, .5, .75, 1].map(fraction => <g key={fraction}><line x1="40" x2={width - 20} y1={y(max * fraction)} y2={y(max * fraction)} stroke="#e8eef7" /><text x="34" y={y(max * fraction) + 4} textAnchor="end">{Math.round(max * fraction)}</text></g>)}
    <polyline fill="none" stroke="#3b82f6" strokeWidth="2" points={items.map((item, i) => `${x(i)},${y(item.count)}`).join(' ')} />
    {items.map((item, i) => <g key={item.label}><circle cx={x(i)} cy={y(item.count)} r="3" fill="#3b82f6" stroke="white" tabIndex="0"><title>{item.label}: {number(item.count)} tiket</title></circle>{items.length <= 45 && <text x={x(i)} y={y(item.count) - 9} textAnchor="middle">{item.count}</text>}{(i % tickEvery === 0 || i === items.length - 1) && <text x={x(i)} y="245" textAnchor="middle">{item.label.slice(5).split('-').reverse().join('/')}</text>}</g>)}
  </svg></div>;
}
function SourceChart({ rows }) {
  const items = countCustomerValues(rows, 'Source');
  if (!items.length) return <Empty />;
  let offset = 0;
  const stops = items.map((item, i) => { const start = offset; offset += item.count / rows.length * 100; return `${colors[i % colors.length]} ${start}% ${offset}%`; });
  return <div className="cs-source"><div className="cs-pie" role="img" aria-label={`Source distribution: ${items.map(item => `${item.label} ${item.count}`).join(', ')}`} style={{ background: `conic-gradient(${stops.join(',')})` }} />
    <ul>{items.map((item, i) => <li key={item.label}><i style={{ background: colors[i % colors.length] }} /><span>{item.label}</span><strong>{number(item.count)}</strong><small>{(item.count / rows.length * 100).toFixed(1)}%</small></li>)}</ul>
  </div>;
}
function statusColor(value) {
  if (/overdue/i.test(value)) return 'red';
  if (/complete on target/i.test(value)) return 'green';
  if (/progress/i.test(value)) return 'orange';
  return 'unknown';
}
function Records({ rows }) {
  const [filters, setFilters] = useState({}), [search, setSearch] = useState('');
  const [page, setPage] = useState(1), [size, setSize] = useState(15);
  const [sort, setSort] = useState({ column: 'Created At', direction: -1 });
  const values = useMemo(() => Object.fromEntries(categorical.map(column => [column, options(rows, column)])), [rows]);
  const matching = useMemo(() => rows.filter(row => (!search || CUSTOMER_COLUMNS.some(column => row[column].toLowerCase().includes(search.toLowerCase()))) && Object.entries(filters).every(([column, value]) => !value || (categorical.includes(column) ? row[column] === value : row[column].toLowerCase().includes(value.toLowerCase())))).sort((a, b) => {
    const column = sort.column;
    if (column === 'Created At') return ((a.date + a[column].slice(-8)).localeCompare(b.date + b[column].slice(-8))) * sort.direction;
    return a[column].localeCompare(b[column], undefined, { numeric: true }) * sort.direction;
  }), [rows, search, filters, sort]);
  const pages = Math.max(1, Math.ceil(matching.length / size)), current = Math.min(page, pages);
  const changeFilter = (column, value) => { setFilters(old => ({ ...old, [column]: value })); setPage(1); };
  return <section className="water-records cs-panel" aria-label="Customer Service Records">
    <div className="water-toolbar"><div><h2>Customer Service Records</h2><p>{number(matching.length)} tiket sesuai filter</p></div><label>Rows per page<select value={size} onChange={e => { setSize(+e.target.value); setPage(1); }}>{[15, 25, 50, 100].map(value => <option key={value}>{value}</option>)}</select></label></div>
    <div className="water-filter-panel"><div className="water-filter-heading"><strong>Filter records</strong><button onClick={() => { setFilters({}); setSearch(''); setPage(1); }}>Clear filters</button></div><div className="water-filter-grid"><label className="water-search">Search records<input placeholder="Search all columns..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label>
      {CUSTOMER_COLUMNS.map(column => <label key={column}>{column}{categorical.includes(column) ? <select aria-label={`Filter ${column}`} value={filters[column] || ''} onChange={e => changeFilter(column, e.target.value)}><option value="">All</option>{values[column].map(value => <option key={value}>{value}</option>)}</select> : <input aria-label={`Filter ${column}`} value={filters[column] || ''} placeholder="Contains..." onChange={e => changeFilter(column, e.target.value)} />}</label>)}
    </div></div>
    <div className="water-table-scroll"><table><thead><tr>{CUSTOMER_COLUMNS.map(column => <th key={column} aria-sort={sort.column === column ? sort.direction === 1 ? 'ascending' : 'descending' : 'none'}><button onClick={() => setSort(old => ({ column, direction: old.column === column ? -old.direction : 1 }))}>{column}{sort.column === column ? sort.direction === 1 ? ' ↑' : ' ↓' : ''}</button></th>)}</tr></thead><tbody>
      {matching.slice((current - 1) * size, current * size).map((row, i) => <tr key={i}>{CUSTOMER_COLUMNS.map(column => <td key={column}>{['Response Status', 'Handling Status'].includes(column) ? <span className={`water-tds ${statusColor(row[column])}`}>{row[column] || '—'}</span> : row[column] || '—'}</td>)}</tr>)}
      {!matching.length && <tr><td colSpan={CUSTOMER_COLUMNS.length} className="water-empty">Tidak ada tiket sesuai filter.</td></tr>}
    </tbody></table></div><footer className="water-pagination"><span>{matching.length ? (current - 1) * size + 1 : 0}–{Math.min(current * size, matching.length)} of {number(matching.length)}</span><div><button disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</button><span>Page {current} of {pages}</span><button disabled={current === pages} onClick={() => setPage(current + 1)}>Next</button></div></footer>
  </section>;
}
export default function CustomerServiceDashboard({ dateRange }) {
  const [data, setData] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const [dailyArea, setDailyArea] = useState(''), [issueArea, setIssueArea] = useState(''), [category, setCategory] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetchCustomerRows(controller.signal).then(rows => { if (!controller.signal.aborted) setData(rows); }).catch(err => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  const start = dateRange ? toApiDate(dateRange.start) : '', end = dateRange ? toApiDate(dateRange.end) : '';
  const rows = useMemo(() => data.filter(row => row.date && (!start || row.date >= start) && (!end || row.date <= end)), [data, start, end]);
  const areas = useMemo(() => options(data, 'Project Code'), [data]);
  const categories = useMemo(() => options(rows.filter(row => !issueArea || row['Project Code'] === issueArea), 'Category Name'), [rows, issueArea]);
  const selectedCategory = categories.includes(category) ? category : '';
  const daily = useMemo(() => rows.filter(row => !dailyArea || row['Project Code'] === dailyArea), [rows, dailyArea]);
  const issues = useMemo(() => countCustomerValues(rows.filter(row => (!issueArea || row['Project Code'] === issueArea) && (!selectedCategory || row['Category Name'] === selectedCategory)), 'Sub Category Name').slice(0, 5), [rows, issueArea, selectedCategory]);
  if (loading) return <main className="water-quality cs-dashboard" role="status">Memuat Customer Service...</main>;
  if (error) return <main className="water-quality cs-dashboard"><div role="alert">{error} <button onClick={() => setAttempt(value => value + 1)}>Coba lagi</button></div></main>;
  return <main className="water-quality cs-dashboard" aria-label="Customer Service Dashboard">
    <div className="cs-summary" style={{ '--cs-summary-count': areas.length + 1 }}><article className="cs-summary-card cs-total cs-panel"><span>TOTAL TICKETS</span><strong>{number(rows.length)}</strong></article>{areas.map(area => <article className="cs-summary-card cs-panel" key={area}>{logos[area] ? <img src={logos[area]} alt={area} /> : <span>{area}</span>}<div><small>{area}</small><strong>{number(rows.filter(row => row['Project Code'] === area).length)}</strong></div></article>)}</div>
    {data.some(row => !row.date) && <p className="cs-note">{number(data.filter(row => !row.date).length)} tiket tidak memiliki Created At yang valid dan tidak masuk rentang tanggal.</p>}
    <div className="cs-chart-grid"><section className="cs-chart cs-panel"><header><h2>Daily Customer Service Tickets</h2><Select label="Daily Project Code" value={dailyArea} onChange={setDailyArea} values={areas} /></header><DailyChart rows={daily} /></section>
      <section className="cs-chart cs-panel"><header><h2>Top Reported Issues</h2><div className="cs-controls"><Select label="Issue Project Code" value={issueArea} onChange={value => { setIssueArea(value); setCategory(''); }} values={areas} /><Select label="Issue Category Name" value={selectedCategory} onChange={setCategory} values={categories} /></div></header><p>Top 5 · Sub Category Name</p><Bars items={issues} label="Top reported sub categories" /></section></div>
    <div className="cs-chart-grid cs-three"><section className="cs-chart cs-panel"><header><h2>Source</h2><span>Jumlah & persentase</span></header><SourceChart rows={rows} /></section><section className="cs-chart cs-panel"><header><h2>Service Type</h2></header><Bars items={countCustomerValues(rows, 'Service Type')} label="Tickets by Service Type" /></section><section className="cs-chart cs-panel"><header><h2>Category Name</h2></header><Bars horizontal items={countCustomerValues(rows, 'Category Name')} label="Tickets by Category Name" /></section></div>
    <Records rows={rows} />
  </main>;
}
