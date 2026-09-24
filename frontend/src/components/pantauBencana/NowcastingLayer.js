import { useEffect, useState } from 'react';
import { GeoJSON, Pane, Popup, useMapEvents } from 'react-leaflet';
import { formatWib } from '../../services/disaster/client';
import { NOWCASTING_LAYER_NAME, NOWCASTING_LAYER_URL, nowcastingStyle, visibleNowcasting } from '../../services/disaster/bmkgNowcasting';

export function NowcastingEvents({ onToggle, onLayerToggle }) {
  useMapEvents({
    overlayadd: event => { if (event.name === NOWCASTING_LAYER_NAME) onToggle(true); onLayerToggle?.(event.name, true); },
    overlayremove: event => { if (event.name === NOWCASTING_LAYER_NAME) onToggle(false); onLayerToggle?.(event.name, false); },
  });
  return null;
}

export function NowcastingDetails({ warning }) {
  return <div><b>PERINGATAN DINI CUACA</b>
    {warning.region && <p><strong>Wilayah:</strong> {warning.region}</p>}
    {warning.areaType && <p><strong>Tipe area:</strong> {warning.areaType}</p>}
    {warning.impactCategory && <p><strong>Kategori dampak:</strong> {warning.impactCategory}</p>}
    {warning.validFrom && <p><strong>Mulai berlaku:</strong> {formatWib(warning.validFrom)}</p>}
    {warning.validUntil && <p><strong>Berakhir:</strong> {formatWib(warning.validUntil)}</p>}
    {(!warning.validFrom || !warning.validUntil) && <p>Waktu berlaku tidak lengkap; status aktif belum dapat diverifikasi.</p>}
    {warning.issuedAt && <p><strong>Dibuat BMKG:</strong> {formatWib(warning.issuedAt)}</p>}
    {warning.fieldReport && <details><summary>Laporan lapangan</summary><p>{warning.fieldReport}</p></details>}
    {warning.unit && <p><strong>UPT:</strong> {warning.unit}</p>}
    {warning.reportId && <p><strong>ID laporan:</strong> {warning.reportId}</p>}
    <p>Sumber: <a href={NOWCASTING_LAYER_URL} target="_blank" rel="noreferrer">BMKG</a></p>
  </div>;
}

// Presentation only; the dashboard owns one shared source for map and summary.
export default function NowcastingLayer({ source }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const warnings = visibleNowcasting(source.data?.features || [], Math.max(now, Date.now()));
  // Failed refreshes hide warning polygons, so old areas cannot look current.
  if (source.error || !source.data) return null;
  return <Pane name="ppb-nowcasting" style={{ zIndex: 390 }}>{warnings.map(feature => <GeoJSON key={`${source.data.fetchedAt}-${feature.id}`} data={feature} style={nowcastingStyle}>
    <Popup maxWidth={340} maxHeight={300}><NowcastingDetails warning={feature.properties} /></Popup>
  </GeoJSON>)}</Pane>;
}

export function NowcastingStatus({ state }) {
  if (!state) return null;
  return <div className="ppb-source-note" role="status">
    <strong>Peringatan Dini Cuaca BMKG: </strong>
    {state.error ? 'Layer sementara tidak tersedia; polygon disembunyikan.' : !state.data ? 'Memuat area peringatan...' : state.data.rawCount === 0 ? 'Tidak ada area peringatan yang dikembalikan oleh sumber saat ini.' : `${state.visibleCount} area tersedia dari ${state.data.rawCount} record sumber.`}
    {state.data && <>
      {' '}Terakhir berhasil diambil: {formatWib(state.data.fetchedAt)}.
      {state.data.latestIssuedAt && <> Laporan terbaru dalam respons dibuat BMKG: {formatWib(state.data.latestIssuedAt)}.</>}
      {!state.error && state.data.invalidCount > 0 && <> {state.data.invalidCount} record invalid tidak ditampilkan.</>}
      {!state.error && state.visibleCount < state.data.features.length && <> Area yang belum berlaku atau sudah berakhir tidak ditampilkan.</>}
    </>}
  </div>;
}
