import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl, LayerGroup, Pane, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { formatWib } from '../../services/disaster/client';
import { EarthquakeDetails } from './EarthquakePanel';
import NowcastingLayer, { NowcastingEvents, NowcastingStatus } from './NowcastingLayer';
import { NOWCASTING_AREA_CONFIG, NOWCASTING_LAYER_NAME, visibleNowcasting } from '../../services/disaster/bmkgNowcasting';
import { RDCA_LAYER_NAME } from '../../services/disaster/bmkgRdca';
const EMPTY_SOURCE = { data: null, loading: false, error: false };
function ResizeMap() {
  const map = useMap();
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}
const radius = magnitude => magnitude >= 6 ? 12 : magnitude >= 5 ? 9 : 6;
function QuakeMarkers({ earthquakes, color }) {
  return earthquakes.filter(quake => quake.coordinates).map(quake => <CircleMarker key={quake.id} center={quake.coordinates} radius={radius(quake.magnitude)} pathOptions={{ color, fillOpacity: 0.7, weight: 2 }}><Popup><EarthquakeDetails quake={quake} /></Popup></CircleMarker>);
}
export default function DisasterMap({ latestSource, historySource, feltSource = EMPTY_SOURCE, hotspotSource = EMPTY_SOURCE, nowcastingSource = EMPTY_SOURCE, rdcaSource = EMPTY_SOURCE }) {
  const [nowcastingEnabled, setNowcastingEnabled] = useState(false);
  const [overlays, setOverlays] = useState({});
  const latest = latestSource.data?.latest;
  return <section className="ppb-panel">
    <div className="ppb-panel-head"><div className="ppb-panel-title"><span className="ppb-ind" />WebGIS Peta Bencana Indonesia</div></div>
    <div className="ppb-map-frame"><MapContainer center={[-2.5, 118]} zoom={5} scrollWheelZoom preferCanvas className="ppb-leaflet-map"><ResizeMap />
      <NowcastingEvents onToggle={setNowcastingEnabled} onLayerToggle={(name, visible) => setOverlays(previous => ({ ...previous, [name]: visible }))} />
      <LayersControl position="topright"><LayersControl.BaseLayer checked name="OpenStreetMap"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /></LayersControl.BaseLayer>
        <LayersControl.Overlay checked name="Gempa terbaru"><LayerGroup><Pane name="ppb-latest-quake" style={{ zIndex: 450 }}><QuakeMarkers earthquakes={latest ? [latest] : []} color="#f0475a" /></Pane></LayerGroup></LayersControl.Overlay>
        <LayersControl.Overlay name="Gempa M >= 5"><LayerGroup><QuakeMarkers earthquakes={overlays['Gempa M >= 5'] ? historySource.data?.history || [] : []} color="#f7943c" /></LayerGroup></LayersControl.Overlay>
        <LayersControl.Overlay name="Gempa dirasakan"><LayerGroup><QuakeMarkers earthquakes={overlays['Gempa dirasakan'] ? feltSource.data?.history || [] : []} color="#f472b6" /></LayerGroup></LayersControl.Overlay>
        <LayersControl.Overlay name="Hotspot BMKG"><LayerGroup>{overlays['Hotspot BMKG'] && !hotspotSource.error && (hotspotSource.data?.hotspots || []).map(point => <CircleMarker key={point.id} center={point.coordinates} radius={4} pathOptions={{ color: '#3fd4f2', weight: 1, fillOpacity: 0.7 }}><Popup><b>HOTSPOT BMKG</b>{[['Provinsi', point.province], ['Kabupaten', point.district], ['Kecamatan', point.subdistrict], ['Tanggal observasi', point.date], ['Waktu sumber', point.time]].filter(([, value]) => value != null && value !== '').map(([label, value]) => <p key={label}>{label}: {value}</p>)}<p>Deteksi hotspot, bukan konfirmasi kebakaran.</p></Popup></CircleMarker>)}</LayerGroup></LayersControl.Overlay>
        <LayersControl.Overlay name={NOWCASTING_LAYER_NAME}><LayerGroup>{nowcastingEnabled && <NowcastingLayer source={nowcastingSource} />}</LayerGroup></LayersControl.Overlay>
        <LayersControl.Overlay name={RDCA_LAYER_NAME}><LayerGroup>{overlays[RDCA_LAYER_NAME] && !rdcaSource.error && (rdcaSource.data?.points || []).map(point => <CircleMarker key={point.id} center={point.coordinates} radius={5} pathOptions={{ color: '#a3e635', fillOpacity: 0.35, weight: 2 }}><Popup><b>RDCA — Pertumbuhan Awan Cepat</b><p>Indikator meteorologis, bukan peringatan bencana.</p><p>Koordinat: {point.coordinates.join(', ')}</p>{point.updatedAt && <p>Created At (sumber): {formatWib(point.updatedAt)}</p>}<p>Sumber: BMKG</p></Popup></CircleMarker>)}</LayerGroup></LayersControl.Overlay>
      </LayersControl>
    </MapContainer><div className="ppb-legend"><div className="ppb-legend-title">LEGENDA</div>{[['#f0475a', 'Gempa terbaru'], ['#f7943c', 'Gempa M >= 5'], ['#f472b6', 'Gempa dirasakan'], ['#3fd4f2', 'Hotspot BMKG'], ['#a3e635', 'RDCA']].map(([color, label]) => <div className="ppb-legend-row" key={label}><span className="ppb-swatch ppb-circle" style={{ background: color }} />{label}</div>)}</div></div>
    {nowcastingEnabled && <div className="ppb-source-note" aria-label="Legenda peringatan dini cuaca">{Object.entries(NOWCASTING_AREA_CONFIG).map(([label, config]) => <span key={label} style={{ marginRight: 16 }}><span className="ppb-swatch" style={{ background: config.color }} /> {label}</span>)}</div>}
    <NowcastingStatus state={{ ...nowcastingSource, visibleCount: visibleNowcasting(nowcastingSource.data?.features || []).length }} />
    {(latestSource.error || historySource.error || feltSource.error) && <p className="ppb-source-note">Pembaruan gempa gagal. Data terakhir tersedia; waktu kejadian tercantum pada popup.</p>}
    <p className="ppb-source-note">{hotspotSource.error ? 'Hotspot sementara tidak tersedia; marker disembunyikan.' : hotspotSource.data ? `Hotspot tanggal observasi ${hotspotSource.data.observationDate || 'tidak tersedia'}: ${hotspotSource.data.hotspots.length} titik nasional. ${hotspotSource.data.timestampLabel}: ${formatWib(hotspotSource.data.updatedAt)}.` : 'Memuat hotspot BMKG...'}</p>
    <p className="ppb-source-note">{rdcaSource.error ? 'RDCA sementara tidak tersedia; titik disembunyikan.' : rdcaSource.data ? `RDCA: ${rdcaSource.data.points.length} titik dikembalikan sumber. ${rdcaSource.data.updatedAt ? `Created At terbaru: ${formatWib(rdcaSource.data.updatedAt)}.` : 'Waktu observasi tidak tersedia.'} Terakhir diambil: ${formatWib(rdcaSource.data.fetchedAt)}.` : 'Memuat RDCA BMKG...'} RDCA bukan peringatan bencana.</p>
  </section>;
}
