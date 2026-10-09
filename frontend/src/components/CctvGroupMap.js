import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AttributionControl, MapContainer, Polygon, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { CCTV_AREAS } from './cctvAreas';
import 'leaflet/dist/leaflet.css';
import './CctvGroupMap.css';

function FitAreas() {
  const map = useMap();
  useEffect(() => { map.fitBounds(CCTV_AREAS.flatMap(area => area.coordinates.map(([lng, lat]) => [lat, lng])), { padding: [30, 30] }); }, [map]);
  return null;
}

export default function CctvGroupMap({ records }) {
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef(null);
  const expandButton = useRef(null);
  const counts = useMemo(() => {
    const result = new Map();
    records.forEach(row => {
      const name = String(row['Area Kelompok'] || '').trim().toLowerCase();
      if (name && (row.Tahun || String(row['Nama Pada Layar (OSD)'] || '').trim())) result.set(name, (result.get(name) || 0) + 1);
    });
    return result;
  }, [records]);
  useEffect(() => {
    if (!expanded) return;
    dialog.current.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; expandButton.current?.focus(); };
  }, [expanded]);
  const content = <>
    <div className="cctv-group-map-canvas"><MapContainer center={[-6.107, 106.746]} zoom={15} attributionControl={false} style={{ height: '100%', width: '100%' }}>
      <AttributionControl position="bottomright" prefix={false} />
      <TileLayer className="cctv-area-tiles" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={'Map data from &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> | <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a>'} />
      <FitAreas />
      {CCTV_AREAS.map(area => <Polygon key={area.name} positions={area.coordinates.map(([lng, lat]) => [lat, lng])} pathOptions={{ color: area.color, fillColor: area.color, fillOpacity: .3, weight: 2 }}>
        <Tooltip permanent direction="right" className="cctv-area-label"><span className="cctv-area-callout" style={{ '--area-color': area.color }}><span className="cctv-area-dot" /><span className="cctv-area-leader" /><span className="cctv-area-label-box"><span className="cctv-area-label-name">{area.name}</span><span className="cctv-area-label-count">{(counts.get(area.name.toLowerCase()) || 0).toLocaleString('id-ID')}</span></span></span></Tooltip>
        <Popup><div className="cctv-area-popup"><strong>{area.name}</strong><p>Total CCTV: <b>{counts.get(area.name.toLowerCase()) || 0}</b></p></div></Popup>
      </Polygon>)}
    </MapContainer></div>
    <small>Klik area untuk melihat total CCTV · Sumber: kolom Area Kelompok</small>
  </>;
  return <section className="cctv-group-map-card"><header><h2>Peta Area CCTV</h2><button ref={expandButton} aria-label="Perbesar peta CCTV" onClick={() => setExpanded(true)}>⛶</button></header>{!expanded && content}{expanded && createPortal(<dialog ref={dialog} className="cctv-group-map-dialog" aria-label="Peta CCTV diperbesar" onCancel={() => setExpanded(false)} onClick={event => { if (event.target === event.currentTarget) setExpanded(false); }}><header><h2>Peta Area CCTV</h2><button onClick={() => setExpanded(false)}>Tutup</button></header>{content}</dialog>, document.body)}</section>;
}
