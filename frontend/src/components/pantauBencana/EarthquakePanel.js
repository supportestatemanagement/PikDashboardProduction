import DataTypeBadge from './DataTypeBadge';
import { formatWib } from '../../services/disaster/client';
import { validEarthquakeCoordinates } from './earthquakeMap';
export function EarthquakeDetails({ quake, isLatest = false }) {
  return <div className="ppb-quake-popup">
    {isLatest && <span className="ppb-badge ppb-badge-terkini">TERBARU</span>}
    <div className="ppb-popup-magnitude">M {quake.magnitude ?? '-'}</div><p className="ppb-popup-location">{quake.region}</p>
    <dl><dt>Kedalaman</dt><dd>{quake.depth != null ? `${quake.depth} km` : 'Tidak tersedia'}</dd>
      <dt>Waktu kejadian</dt><dd>{formatWib(quake.datetime)}</dd>
      <dt>Koordinat</dt><dd>{quake.coordinates?.join(', ') || 'Tidak tersedia'}</dd>
      {quake.felt && <><dt>Dirasakan</dt><dd>{quake.felt}</dd></>}
      {quake.potential && <><dt>Potensi tsunami (informasi BMKG)</dt><dd>{quake.potential}</dd></>}
    </dl><a href="https://data.bmkg.go.id/gempabumi/" target="_blank" rel="noreferrer">Sumber: BMKG</a>
  </div>;
}
const EMPTY_SOURCE = {};
export default function EarthquakePanel({ latestSource, historySource, feltSource = EMPTY_SOURCE, selection, onSelect }) {
  const latest = latestSource.data?.latest;
  const active = (quake, kind) => selection?.id === quake.id && selection?.kind === kind;
  return <section className="ppb-panel" aria-label="Gempa BMKG">
    <div className="ppb-panel-head"><h2 className="ppb-panel-title"><span className="ppb-ind" />Gempa BMKG</h2><DataTypeBadge type="NEAR REAL-TIME" /></div>
    <div className="ppb-list-label">GEMPA TERBARU</div>
    {latestSource.error && <p className="ppb-source-note">Pembaruan gagal.{latest && ' Data terakhir tersedia.'}</p>}
    {latest ? <button type="button" className={`ppb-quake-highlight ppb-quake-action${active(latest, 'latest') ? ' ppb-quake-active' : ''}`} aria-pressed={active(latest, 'latest')}
      disabled={!validEarthquakeCoordinates(latest.coordinates)} onClick={() => onSelect?.(latest, 'latest')}>
      <span className="ppb-quake-highlight-top"><span className="ppb-quake-mag">M {latest.magnitude ?? '-'}</span><span className="ppb-badge ppb-badge-terkini">TERBARU</span></span>
      <span className="ppb-quake-loc">{latest.region}</span><span className="ppb-quake-meta">{formatWib(latest.datetime)}{latest.depth != null && <span>Kedalaman: {latest.depth} km</span>}</span>
      <span className="ppb-map-action-label">{validEarthquakeCoordinates(latest.coordinates) ? 'Lihat di Peta' : 'Koordinat tidak tersedia'}</span>
    </button> : <p className="ppb-source-note">{latestSource.loading ? 'Memuat gempa terbaru...' : 'Data gempa terbaru belum tersedia.'}</p>}
    {[[historySource, 'history', 'Riwayat Gempa M >= 5'], [feltSource, 'felt', 'Gempa Dirasakan']].map(([source, kind, label]) => <div key={kind}>
      <h3 className="ppb-list-label">{label}</h3>
      {source.error && <p className="ppb-source-note">Pembaruan gagal.{source.data && ' Data terakhir tersedia.'}</p>}
      {!source.data?.history?.length && <p className="ppb-source-note">{source.loading ? 'Memuat data...' : 'Belum ada data.'}</p>}
      <div className="ppb-quake-list">{(source.data?.history || []).map(quake => <button type="button" key={quake.id} className={`ppb-quake-item ppb-quake-action${active(quake, kind) ? ' ppb-quake-active' : ''}`}
        aria-pressed={active(quake, kind)} disabled={!validEarthquakeCoordinates(quake.coordinates)} onClick={() => onSelect?.(quake, kind)}>
        <span className="ppb-num">{quake.magnitude ?? '-'}</span><span className="ppb-txt"><b>{quake.region}</b><span>{formatWib(quake.datetime)}</span>{!validEarthquakeCoordinates(quake.coordinates) && <span>Koordinat tidak tersedia</span>}</span>
      </button>)}</div>
    </div>)}
    <p className="ppb-source-note"><a href="https://data.bmkg.go.id/gempabumi/" target="_blank" rel="noreferrer">Source: BMKG</a></p>
  </section>;
}
