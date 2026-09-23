import { formatWib } from '../../services/disaster/client';
export function EarthquakeDetails({ quake }) {
  return <><b>GEMPA BUMI - M {quake.magnitude ?? '-'}</b><p>{quake.region}</p><p>{formatWib(quake.datetime)}</p>{quake.depth !== null && <p>Kedalaman: {quake.depth} km</p>}{quake.coordinates && <p>Koordinat: {quake.coordinates.join(', ')}</p>}{quake.felt && <p>DIRASAKAN: {quake.felt}</p>}</>;
}
export default function EarthquakePanel({ latestSource, historySource }) {
  const history = historySource.data?.history || [];
  const latest = history[0];
  return <section className="ppb-panel" aria-label="Gempa BMKG">
    <div className="ppb-panel-head"><div className="ppb-panel-title"><span className="ppb-ind" />Gempa Bumi (M &ge; 5.0)</div></div>
    {historySource.error && <p className="ppb-source-note" role="status">Data gempa sementara tidak tersedia.{latest && ' Menampilkan data terakhir.'}</p>}
    {!latest && <p className="ppb-source-note">{historySource.loading ? 'Memuat data gempa...' : 'Belum ada data M5+.'}</p>}
    {latest && <><div className="ppb-quake-highlight"><div className="ppb-quake-highlight-top"><div className="ppb-quake-mag">M {latest.magnitude}</div><span className="ppb-badge ppb-badge-terkini">TERKINI M5+</span></div><div className="ppb-quake-loc">{latest.region}</div><div className="ppb-quake-meta"><span>{formatWib(latest.datetime)}</span>{latest.depth !== null && <span>Kedalaman: {latest.depth} km</span>}</div>{latest.felt && <div className="ppb-quake-warn">DIRASAKAN: {latest.felt}</div>}</div>
      <div className="ppb-list-label">RIWAYAT SEBELUMNYA</div><div className="ppb-quake-list">{history.slice(1).map(quake => <div className="ppb-quake-item" key={quake.id}><div className="ppb-num">{quake.magnitude}</div><div className="ppb-txt"><b>{quake.region}</b><span>{formatWib(quake.datetime)}</span></div></div>)}</div></>}
    <div className="ppb-source-note">{historySource.data && <>BMKG Gempa - {historySource.data.timestampLabel}: {formatWib(historySource.data.updatedAt)}</>}</div>
    {latestSource.data && <div className="ppb-source-note">Gempa terkini (semua magnitudo): M {latestSource.data.latest.magnitude} - {latestSource.data.latest.region}<br />{formatWib(latestSource.data.updatedAt)}</div>}
    {latestSource.error && <p className="ppb-source-note">Pembaruan gempa terkini gagal.{latestSource.data && ' Marker memakai data terakhir.'}</p>}
  </section>;
}
