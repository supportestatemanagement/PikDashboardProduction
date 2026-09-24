import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl, LayerGroup, Pane, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import useDisasterSource from '../../services/disaster/useDisasterSource';
import { fetchHotspots, HOTSPOT_REFRESH_INTERVAL } from '../../services/disaster/bmkgHotspot';
import { formatWib } from '../../services/disaster/client';
import { EarthquakeDetails } from './EarthquakePanel';
import VolcanoLayer from './VolcanoLayer';
import { VOLCANO_STATUS_CONFIG } from '../../services/disaster/pvmbgVolcano';
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
function HotspotEvents({ onToggle }) {
  useMapEvents({ overlayadd: event => { if (event.name === 'Hotspot BMKG') onToggle(true); }, overlayremove: event => { if (event.name === 'Hotspot BMKG') onToggle(false); } });
  return null;
}
function HotspotLayer({ onState, enabled }) {
  const source = useDisasterSource(fetchHotspots, HOTSPOT_REFRESH_INTERVAL, enabled);
  useEffect(() => { onState(enabled ? source : null); return () => onState(null); }, [source, onState, enabled]);
  if (source.error) return null;
  return (source.data?.hotspots || []).map(hotspot => <CircleMarker key={hotspot.id} center={hotspot.coordinates} radius={4} pathOptions={{ color: '#3fd4f2', weight: 1, fillOpacity: 0.7 }}><Popup><b>HOTSPOT</b>{[['Provinsi', hotspot.province], ['Kabupaten', hotspot.district], ['Kecamatan', hotspot.subdistrict], ['Tanggal observasi', hotspot.date], ['Waktu sumber', hotspot.time]].filter(([, value]) => value !== null && value !== undefined && value !== '').map(([label, value]) => <p key={label}>{label}: {value}</p>)}</Popup></CircleMarker>);
}
const radius = magnitude => magnitude >= 6 ? 12 : magnitude >= 5 ? 9 : 6;
export default function DisasterMap({ latestSource, historySource, volcanoes = [], volcanoSource, volcanoFocus, onVolcanoSelect }) {
  const [hotspotState, setHotspotState] = useState(null);
  const [hotspotEnabled, setHotspotEnabled] = useState(false);
  const latest = latestSource.data?.latest;
  const history = (historySource.data?.history || []).filter(quake => quake.coordinates && quake.id !== latest?.id);
  return <section className="ppb-panel">
    <div className="ppb-panel-head"><div className="ppb-panel-title"><span className="ppb-ind" />WebGIS Peta Bencana Indonesia</div></div>
    <div className="ppb-map-frame"><MapContainer center={[-2.5, 118]} zoom={5} scrollWheelZoom preferCanvas className="ppb-leaflet-map"><ResizeMap /><HotspotEvents onToggle={setHotspotEnabled} />
      <LayersControl position="topright"><LayersControl.BaseLayer checked name="OpenStreetMap"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /></LayersControl.BaseLayer>
        <LayersControl.Overlay checked name="Gempa Terkini"><LayerGroup><Pane name="ppb-latest-quake" style={{ zIndex: 450 }}>{latest?.coordinates && <CircleMarker center={latest.coordinates} radius={radius(latest.magnitude)} pathOptions={{ color: '#f0475a', fillOpacity: 0.8, weight: 2 }}><Popup maxWidth={260}><EarthquakeDetails quake={latest} /></Popup></CircleMarker>}</Pane></LayerGroup></LayersControl.Overlay>
        <LayersControl.Overlay checked name="Riwayat Gempa M≥5"><LayerGroup>{history.map(quake => <CircleMarker key={quake.id} center={quake.coordinates} radius={radius(quake.magnitude)} pathOptions={{ color: '#f7943c', fillOpacity: 0.65, weight: 1 }}><Popup><EarthquakeDetails quake={quake} /></Popup></CircleMarker>)}</LayerGroup></LayersControl.Overlay>
        <LayersControl.Overlay name="Hotspot BMKG"><LayerGroup><HotspotLayer onState={setHotspotState} enabled={hotspotEnabled} /></LayerGroup></LayersControl.Overlay>
        <LayersControl.Overlay checked name="Gunung Api PVMBG"><VolcanoLayer volcanoes={volcanoes} isFallback={volcanoSource?.data?.isFallback ?? true} focusRequest={volcanoFocus} onSelect={onVolcanoSelect} /></LayersControl.Overlay>
      </LayersControl>
    </MapContainer><div className="ppb-legend"><div className="ppb-legend-title">LEGENDA (INDONESIA)</div>{[['#f0475a', 'Gempa Terkini'], ['#f7943c', 'Riwayat Gempa M5+'], ['#3fd4f2', 'Hotspot BMKG']].map(([color, label]) => <div className="ppb-legend-row" key={label}><span className="ppb-swatch ppb-circle" style={{ background: color }} />{label}</div>)}<div className="ppb-legend-title">Gunung Api</div>{Object.entries(VOLCANO_STATUS_CONFIG).map(([status, config]) => <div className="ppb-legend-row" key={status}><span style={{ color: config.color }}>▲</span>{status[0] + status.slice(1).toLowerCase()}</div>)}</div></div>
    {volcanoSource?.data?.isFallback && <p className="ppb-source-note">Gunung Api PVMBG: sumber belum terhubung; marker tidak ditampilkan.</p>}
    {volcanoSource?.error && !volcanoSource.data.isFallback && <p className="ppb-source-note">Gunung Api PVMBG: data terakhir tersedia; pembaruan gagal.</p>}
    {(latestSource.loading || historySource.loading) && <p className="ppb-source-note">Memuat marker gempa...</p>}
    {(latestSource.error || historySource.error) && <p className="ppb-source-note">Sebagian data gempa gagal diperbarui. Peta tetap tersedia.</p>}
    {hotspotState && <p className="ppb-source-note">{hotspotState.error ? 'Layer hotspot sementara tidak tersedia.' : !hotspotState.data ? 'Memuat hotspot BMKG...' : <>Hotspot tanggal {hotspotState.data.observationDate || '-'} ({hotspotState.data.hotspots.length} titik). {hotspotState.data.timestampLabel}: {formatWib(hotspotState.data.updatedAt)}</>}</p>}
  </section>;
}
