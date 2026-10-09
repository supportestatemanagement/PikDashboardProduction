import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AttributionControl, CircleMarker, MapContainer, Polygon, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { CCTV_AREAS } from './cctvAreas';
import 'leaflet/dist/leaflet.css';
import './CctvGroupMap.css';

const labelOffsets = {
  'Fresh Market & Emerald': { direction: 'top', offset: [0, -30], anchor: [0, 36] },
  'Sektor Barat': { direction: 'left', offset: [-24, -22], anchor: [30, 22] },
  'Smart Camera ROW 85': { direction: 'bottom', offset: [22, 30], anchor: [-22, -36] },
  'Sektor Tengah': { direction: 'right', offset: [24, 0], anchor: [-30, 0] },
  'ROW 85': { direction: 'right', offset: [24, 0], anchor: [-30, 0] },
  'Rukan Crown': { direction: 'bottom', offset: [0, 24], anchor: [0, -30] },
};

function AreaLabel({ area, count }) {
  const { direction, offset, anchor: [x, y] } = labelOffsets[area.name] || labelOffsets['ROW 85'];
  return <Tooltip permanent direction={direction} offset={offset} className="cctv-area-label">
    <span className="cctv-area-callout" data-direction={direction} style={{ '--area-color': area.color }}>
      <svg className="cctv-area-connector" width="1" height="1" aria-hidden="true"><line x1={x} y1={y} x2="0" y2="0" stroke={area.color} strokeWidth="2" /><circle cx={x} cy={y} r="5" fill={area.color} stroke="white" strokeWidth="2" /></svg>
      <span className="cctv-area-label-box"><span className="cctv-area-label-name">{area.name}</span><span className="cctv-area-label-count">{count.toLocaleString('id-ID')}</span></span>
    </span>
  </Tooltip>;
}

function FitAreas() {
  const map = useMap();
  useEffect(() => { map.fitBounds(CCTV_AREAS.flatMap(area => (area.polygons || [area.coordinates]).flatMap(ring => ring.map(([lng, lat]) => [lat, lng]))), { padding: [30, 30] }); }, [map]);
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
      {CCTV_AREAS.map(area => <Polygon key={area.name} positions={area.polygons ? area.polygons.map(ring => [ring.map(([lng, lat]) => [lat, lng])]) : area.coordinates.map(([lng, lat]) => [lat, lng])} pathOptions={{ color: area.color, fillColor: area.color, fillOpacity: .3, weight: 2 }}>
        {!area.labelPosition && <AreaLabel area={area} count={counts.get(area.name.toLowerCase()) || 0} />}
        <Popup><div className="cctv-area-popup"><strong>{area.name}</strong><p>Total CCTV: <b>{counts.get(area.name.toLowerCase()) || 0}</b></p></div></Popup>
      </Polygon>)}
      {CCTV_AREAS.filter(area => area.labelPosition).map(area => <CircleMarker key={`label-${area.name}`} center={[area.labelPosition[1], area.labelPosition[0]]} radius={0} interactive={false} pathOptions={{ opacity: 0, fillOpacity: 0 }}><AreaLabel area={area} count={counts.get(area.name.toLowerCase()) || 0} /></CircleMarker>)}
    </MapContainer></div>
    <small>Klik area untuk melihat total CCTV · Sumber: kolom Area Kelompok</small>
  </>;
  return <section className="cctv-group-map-card"><header><h2>Peta Area CCTV</h2><button ref={expandButton} aria-label="Perbesar peta CCTV" onClick={() => setExpanded(true)}>⛶</button></header>{!expanded && content}{expanded && createPortal(<dialog ref={dialog} className="cctv-group-map-dialog" aria-label="Peta CCTV diperbesar" onCancel={() => setExpanded(false)} onClick={event => { if (event.target === event.currentTarget) setExpanded(false); }}><header><h2>Peta Area CCTV</h2><button onClick={() => setExpanded(false)}>Tutup</button></header>{content}</dialog>, document.body)}</section>;
}
