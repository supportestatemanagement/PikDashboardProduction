import { useEffect, useRef } from 'react';
import { divIcon } from 'leaflet';
import { LayerGroup, Marker, Popup, useMap } from 'react-leaflet';
import { isValidLatLng, VOLCANO_STATUS_CONFIG } from '../../services/disaster/pvmbgVolcano';
import { formatWib } from '../../services/disaster/client';

const icons = Object.fromEntries(Object.entries(VOLCANO_STATUS_CONFIG).map(([status, config]) => [status, divIcon({
  className: 'ppb-volcano-marker',
  html: `<span aria-hidden="true" style="color:${config.color}">▲</span>`,
  iconSize: [28, 28], iconAnchor: [14, 24], popupAnchor: [0, -24],
})]));

export function VolcanoDetails({ volcano }) {
  const config = VOLCANO_STATUS_CONFIG[volcano.status];
  return <div><b>GUNUNG API</b><h3>{volcano.name}</h3>
    <p><strong>Level {config.roman} — {volcano.status}</strong></p>
    <p>Lokasi: {volcano.location || 'Tidak tersedia'}</p>
    <p>Update: {volcano.updatedAt ? formatWib(volcano.updatedAt) : 'Tidak tersedia dari sumber'}</p>
    {volcano.lastActivity && <p>Aktivitas terakhir: {volcano.lastActivity}</p>}
    {volcano.recommendation ? <details><summary>Rekomendasi — lihat selengkapnya</summary><p className="ppb-volc-recommendation">{volcano.recommendation}</p></details> : <p>Rekomendasi: Tidak tersedia dari sumber</p>}
    <p>Sumber: {volcano.source}</p>
  </div>;
}

export default function VolcanoLayer({ volcanoes, focusRequest, onSelect, isFallback }) {
  const map = useMap();
  const group = useRef(null);
  const markers = useRef(new Map());
  useEffect(() => {
    if (!focusRequest || isFallback) return;
    const marker = markers.current.get(focusRequest.id);
    if (!marker || !group.current) return;
    // Re-enable a hidden overlay when the user explicitly navigates from the panel.
    if (!map.hasLayer(group.current)) map.addLayer(group.current);
    map.flyTo(marker.getLatLng(), 9, { animate: !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches });
    marker.openPopup();
  }, [map, focusRequest, isFallback]);
  return <LayerGroup ref={group}>{!isFallback && volcanoes.filter(v => isValidLatLng(v.latitude, v.longitude) && icons[v.status]).map(volcano => <Marker key={volcano.id}
    ref={marker => { if (marker) markers.current.set(volcano.id, marker); else markers.current.delete(volcano.id); }}
    position={[volcano.latitude, volcano.longitude]} icon={icons[volcano.status]} title={`${volcano.name} — ${volcano.status}`}
    eventHandlers={{ click: () => onSelect(volcano) }}>
    <Popup maxWidth={320} maxHeight={300}><VolcanoDetails volcano={volcano} /></Popup>
  </Marker>)}</LayerGroup>;
}
