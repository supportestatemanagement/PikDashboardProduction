import { useEffect, useState } from 'react';
import { countNearby, MONITORING_CENTERS, MONITORING_RADIUS_KM } from '../../services/disaster/monitoring';
import { formatWib } from '../../services/disaster/client';
import { getEnsoCategory } from '../../services/disaster/noaaEnsoService';
import { visibleNowcasting } from '../../services/disaster/bmkgNowcasting';
import { validEarthquakeCoordinates } from './earthquakeMap';
import DataTypeBadge from './DataTypeBadge';
const unavailable = source => source?.loading ? 'Memuat sumber...' : source?.error ? 'Pembaruan sumber gagal.' : 'Data belum tersedia.';
const cached = source => source.error ? 'Data terakhir tersedia: ' : '';
export default function CurrentSituationCard({ sources, onEarthquakeSelect }) {
  const { latest, weather, hotspot, rdca, nowcasting, maritime, enso } = sources;
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const nearby = (source, points, empty) => !source.data ? unavailable(source) : cached(source) + (points.length ? MONITORING_CENTERS.map((center, i) => `PIK ${i + 1}: ${countNearby(points, center.coordinates)} titik dalam radius monitoring`).join(' / ') : empty);
  const active = visibleNowcasting(nowcasting.data?.features || [], now);
  const items = [
    ['Gempa terbaru', 'NEAR REAL-TIME', latest.data ? `${cached(latest)}M ${latest.data.latest.magnitude ?? '-'} / ${latest.data.latest.region} / Occurred ${formatWib(latest.data.latest.datetime)}` : unavailable(latest)],
    ['Peringatan Dini Cuaca', 'NOWCAST', nowcasting.error ? 'Gagal mengambil peringatan BMKG; area disembunyikan.' : nowcasting.data ? active.length ? `${active.length} area nasional; waktu berlaku mengikuti sumber.` : 'Tidak ada area peringatan aktif yang dikembalikan sumber saat ini.' : unavailable(nowcasting)],
    ['RDCA', 'NEAR REAL-TIME ANALYSIS', nearby(rdca, rdca.data?.points || [], 'Tidak ada area RDCA aktif yang dikembalikan sumber saat ini.')],
    ['Hotspot', 'OBSERVATION', nearby(hotspot, hotspot.data?.hotspots || [], 'Tidak ada hotspot yang dikembalikan sumber pada periode ini.') + (hotspot.data?.observationDate ? ` Observed: ${hotspot.data.observationDate}.` : '')],
    ['Prakiraan Cuaca', 'FORECAST', weather.map((source, i) => `PIK ${i + 1}: ${source.data ? `${cached(source)}${source.data.description} / Valid ${formatWib(source.data.localDatetime)}` : unavailable(source)}`).join(' / ')],
    ['Maritim', 'FORECAST', maritime.map((source, i) => `PIK ${i + 1}: ${source.data ? `${source.error || now >= Date.parse(source.data.validUntil) ? 'Data terakhir tersedia' : 'Prakiraan tersedia'} / Valid ${formatWib(source.data.validAt)}` : 'Data maritim resmi sementara tidak tersedia.'}`).join(' / ')],
    ['ENSO', 'CLIMATE INDICATOR', enso.data ? `${cached(enso)}${getEnsoCategory(enso.data.value, enso.data.officialCategory)} / ${enso.data.period}` : 'Data ENSO terbaru sementara tidak tersedia.'],
  ];
  return <section className="ppb-panel ppb-summary" aria-label="Situasi Terkini"><div className="ppb-panel-head"><div><h2 className="ppb-panel-title">SITUASI TERKINI</h2><p className="ppb-muted">Ringkasan informasi monitoring terbaru</p></div></div>
    <div className="ppb-card-body"><dl className="ppb-situation">{items.map(([label, type, value]) => <div key={label}><dt>{label}</dt><dd><DataTypeBadge type={type} />{label === 'Gempa terbaru' && latest.data ? <button type="button" className="ppb-inline-map-action" disabled={!validEarthquakeCoordinates(latest.data.latest.coordinates)} onClick={() => onEarthquakeSelect?.(latest.data.latest, 'latest')}>{value}<span className="ppb-map-action-label">Lihat di Peta</span></button> : <p>{value}</p>}</dd></div>)}</dl>
      <p className="ppb-muted">Radius monitoring {MONITORING_RADIUS_KM} km (Haversine) dari referensi peta existing. Hitungan mengikuti periode data sumber, bukan jaminan tidak ada risiko.</p>
    </div></section>;
}
