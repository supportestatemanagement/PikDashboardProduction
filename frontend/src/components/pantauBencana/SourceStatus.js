import { combinedStatus, sourceStatus } from '../../services/disaster/monitoring';
import { visibleNowcasting } from '../../services/disaster/bmkgNowcasting';
const labels = { Connected: 'CONNECTED', 'No data': 'NO ACTIVE DATA', Partial: 'PARTIAL', Error: 'ERROR', Unavailable: 'UNAVAILABLE', 'Not loaded': 'UNAVAILABLE', Loading: 'Menghubungkan...' };
export default function SourceStatus({ sources: s }) {
  const statuses = [
    ['BMKG Weather', combinedStatus(s.weather), s.weather],
    ['BMKG Earthquake', combinedStatus([s.latest, s.history, s.felt]), [s.latest, s.history, s.felt]],
    ['BMKG Nowcasting', sourceStatus(s.nowcasting, visibleNowcasting(s.nowcasting.data?.features || [])), [s.nowcasting]],
    ['BMKG RDCA', sourceStatus(s.rdca, s.rdca.data?.points), [s.rdca]],
    ['BMKG Maritime', combinedStatus(s.maritime), s.maritime], ['NOAA ENSO', sourceStatus(s.enso), [s.enso]],
  ];
  return <section className="ppb-panel ppb-status-section" aria-label="Status sumber"><div className="ppb-panel-head"><h2 className="ppb-panel-title">Data Source Status</h2></div><div className="ppb-source-status">{statuses.map(([name, status, sources]) => <div key={name}><span>{name}</span><strong data-status={status}>{labels[status]}</strong>{status === 'No data' && <small>Connected - {name === 'BMKG Nowcasting' ? 'No Active Warning' : name === 'BMKG RDCA' ? 'No Active Area' : 'hasil sumber kosong'}</small>}{sources.some(source => source.error && source.data) && <small>Data terakhir tersedia; lihat waktu sumber.</small>}{sources.some(source => source.error && source.retry) && <button className="ppb-retry" onClick={() => sources.filter(source => source.error).forEach(source => source.retry?.())}>Coba Lagi</button>}</div>)}</div></section>;
}
