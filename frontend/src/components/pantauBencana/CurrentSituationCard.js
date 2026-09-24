import { countNearby, MONITORING_CENTERS, MONITORING_RADIUS_KM, sourceStatus } from '../../services/disaster/monitoring';
import { formatWib } from '../../services/disaster/client';
import { getEnsoCategory } from '../../services/disaster/bmkgEnso';
import { visibleNowcasting } from '../../services/disaster/bmkgNowcasting';
import { validEarthquakeCoordinates } from './earthquakeMap';

function nearbyText(source, points, timestamp) {
  if (!source?.data) return sourceStatus(source);
  const counts = MONITORING_CENTERS.map(center => `${center.label}: ${countNearby(points, center.coordinates)} titik`).join(' · ');
  return `${source.error ? 'Data terakhir tersedia — ' : ''}${counts}. Data sumber: ${timestamp || 'waktu observasi tidak tersedia'}.`;
}
export default function CurrentSituationCard({ sources, onEarthquakeSelect }) {
  const { latest, weather, hotspot, rdca, nowcasting, maritime, enso } = sources;
  const items = [
    ['Gempa terbaru', latest.data ? `${latest.error ? 'Data terakhir tersedia — ' : ''}M ${latest.data.latest.magnitude ?? '-'} · ${latest.data.latest.region} · ${formatWib(latest.data.updatedAt)}` : sourceStatus(latest)],
    ...weather.map((source, index) => [`Cuaca PIK ${index + 1}`, source.data ? `${source.error ? 'Data terakhir tersedia — ' : ''}${source.data.description}, ${source.data.temperature ?? '-'} °C · Prakiraan ${formatWib(source.data.localDatetime)}` : sourceStatus(source)]),
    ['Hotspot', nearbyText(hotspot, hotspot.data?.hotspots || [], hotspot.data?.observationDate)],
    ['RDCA', nearbyText(rdca, rdca.data?.points || [], rdca.data?.updatedAt ? formatWib(rdca.data.updatedAt) : null)],
    ['Peringatan Cuaca', nowcasting.error ? 'Error — area tidak ditampilkan' : nowcasting.data ? nowcasting.data.rawCount === 0 ? 'Tidak ada area peringatan yang dikembalikan oleh sumber saat ini.' : `${visibleNowcasting(nowcasting.data.features).length} area nasional ditampilkan; berlaku mengikuti waktu sumber.` : sourceStatus(nowcasting)],
    ['ENSO', enso.data ? `${enso.error ? 'Data terakhir tersedia — ' : ''}${getEnsoCategory(enso.data.value, enso.data.officialCategory)} · ${enso.data.period} · ${formatWib(enso.data.updatedAt)}` : 'Data resmi belum tersedia'],
    ...maritime.map((source, index) => [`Maritim PIK ${index + 1}`, source.data ? `${source.error || Date.now() >= Date.parse(source.data.validUntil) ? 'Data terakhir tersedia' : 'Prakiraan tersedia'} · ${formatWib(source.data.validAt)} · Update ${formatWib(source.data.updatedAt)}` : sourceStatus(source)]),
  ];
  return <section className="ppb-panel" aria-label="Situasi Terkini"><div className="ppb-panel-head"><h2 className="ppb-panel-title">SITUASI TERKINI</h2></div>
    <div className="ppb-card-body"><dl className="ppb-situation">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{label === 'Gempa terbaru' && latest.data ? <button type="button" className="ppb-inline-map-action" disabled={!validEarthquakeCoordinates(latest.data.latest.coordinates)} onClick={() => onEarthquakeSelect?.(latest.data.latest, 'latest')}>{value}<span className="ppb-map-action-label">Lihat di Peta</span></button> : value}</dd></div>)}</dl>
      <p className="ppb-muted">Hitungan titik menggunakan Haversine dalam radius {MONITORING_RADIUS_KM} km dari referensi peta existing. Hotspot mengikuti tanggal observasi, bukan konfirmasi kebakaran. RDCA adalah indikator meteorologis, bukan peringatan bencana.</p>
      <p className="ppb-muted">{MONITORING_CENTERS.map(c => `${c.label}: ${c.coordinates.join(', ')}`).join(' · ')}</p>
    </div></section>;
}
