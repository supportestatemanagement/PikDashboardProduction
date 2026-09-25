import { memo, useEffect, useMemo, useState } from 'react';
import { divIcon } from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, LayerGroup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { formatWib } from '../../services/disaster/client';
import EarthquakeLayer from './EarthquakeLayer';
import WaterLocationsLayer from './WaterLocationsLayer';
import { validEarthquakeCoordinates } from './earthquakeMap';
import DisasterIcon, { iconPaths } from './DisasterIcon';
import NowcastingLayer, { NowcastingEvents } from './NowcastingLayer';
import { NOWCASTING_AREA_CONFIG, NOWCASTING_LAYER_NAME, visibleNowcasting } from '../../services/disaster/bmkgNowcasting';
import { RDCA_LAYER_NAME } from '../../services/disaster/bmkgRdca';
const EMPTY_SOURCE = { data: null, loading: false, error: false };
const EMPTY_QUAKES = [];
const markerIcons = new Map();
function mapIcon(type, color) {
  const key = `${type}-${color}`;
  if (!markerIcons.has(key)) markerIcons.set(key, divIcon({ className: 'ppb-map-symbol', iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -13],
    html: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${iconPaths[type]}"/></svg>` }));
  return markerIcons.get(key);
}
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
function DisasterMap({ latestSource, historySource, feltSource = EMPTY_SOURCE, nowcastingSource = EMPTY_SOURCE, rdcaSource = EMPTY_SOURCE, waterSource = EMPTY_SOURCE, selection, focusRequest, onEarthquakeSelect }) {
  const [overlays, setOverlays] = useState({});
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const enabled = name => overlays[name] !== false;
  const latest = latestSource.data?.latest;
  const waterLocations = waterSource.data || [];
  const latestQuakes = useMemo(() => latest ? [latest] : [], [latest]);
  const history = historySource.data?.history || EMPTY_QUAKES;
  const felt = feltSource.data?.history || EMPTY_QUAKES;
  const rdca = rdcaSource.error ? [] : (rdcaSource.data?.points || []).filter(point => validEarthquakeCoordinates(point.coordinates));
  const warnings = nowcastingSource.error ? [] : visibleNowcasting(nowcastingSource.data?.features || [], Math.max(now, Date.now()));
  const legend = [
    ['Gempa terbaru', 'quake', '#ff1616', latestQuakes.some(q => validEarthquakeCoordinates(q.coordinates))],
    ['Gempa M >= 5', 'quake', '#f7943c', history.some(q => validEarthquakeCoordinates(q.coordinates))],
    ['Gempa dirasakan', 'quake', '#f472b6', felt.some(q => validEarthquakeCoordinates(q.coordinates))],
    ['Distribusi Air', 'water', '#38bdf8', waterLocations.some(location => validEarthquakeCoordinates(location.position))],
    [RDCA_LAYER_NAME, 'cloud', '#a3e635', rdca.length > 0],
  ].filter(([name, , , available]) => available && enabled(name));
  return <section className="ppb-map-surface" aria-label="Peta Bencana Indonesia">
    <div className="ppb-map-frame"><MapContainer center={[-2.5, 118]} zoom={5} scrollWheelZoom preferCanvas className="ppb-leaflet-map"><ResizeMap />
      <NowcastingEvents onToggle={() => {}} onLayerToggle={(name, visible) => setOverlays(previous => ({ ...previous, [name]: visible }))} />
      <TileLayer className="ppb-dark-tiles" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <LayersControl position="topleft">
        <LayersControl.Overlay checked name="Distribusi Air"><WaterLocationsLayer locations={waterLocations} /></LayersControl.Overlay>
        <LayersControl.Overlay checked name="Gempa terbaru"><EarthquakeLayer kind="latest" earthquakes={latestQuakes} selection={selection} focusRequest={focusRequest} onSelect={onEarthquakeSelect} /></LayersControl.Overlay>
        <LayersControl.Overlay checked name="Gempa M >= 5"><EarthquakeLayer kind="history" earthquakes={history} selection={selection} focusRequest={focusRequest} onSelect={onEarthquakeSelect} /></LayersControl.Overlay>
        <LayersControl.Overlay checked name="Gempa dirasakan"><EarthquakeLayer kind="felt" earthquakes={felt} selection={selection} focusRequest={focusRequest} onSelect={onEarthquakeSelect} /></LayersControl.Overlay>
        <LayersControl.Overlay checked name={NOWCASTING_LAYER_NAME}><LayerGroup>{enabled(NOWCASTING_LAYER_NAME) && <NowcastingLayer source={nowcastingSource} />}</LayerGroup></LayersControl.Overlay>
        <LayersControl.Overlay checked name={RDCA_LAYER_NAME}><LayerGroup>{enabled(RDCA_LAYER_NAME) && rdca.map(point => <Marker key={point.id} position={point.coordinates} icon={mapIcon('cloud', '#a3e635')} title="Pertumbuhan awan cepat"><Popup><b>RDCA</b><p>Koordinat: {point.coordinates.join(', ')}</p>{point.updatedAt && <p>{formatWib(point.updatedAt)}</p>}</Popup></Marker>)}</LayerGroup></LayersControl.Overlay>
      </LayersControl>
    </MapContainer>
      {(legend.length > 0 || (enabled(NOWCASTING_LAYER_NAME) && warnings.length > 0)) && <div className="ppb-legend" aria-label="Legenda peta">
        {legend.map(([name, type, color]) => <div className="ppb-legend-row" key={name}><DisasterIcon type={type} color={color} size={18} />{name === RDCA_LAYER_NAME ? 'RDCA' : name}</div>)}
        {enabled(NOWCASTING_LAYER_NAME) && Object.entries(NOWCASTING_AREA_CONFIG).filter(([label]) => warnings.some(feature => feature.properties.areaType === label)).map(([label, config]) => <div className="ppb-legend-row" key={label}><DisasterIcon type="alert" color={config.color} size={18} />{label}</div>)}
      </div>}
    </div>
    <div className="ppb-map-notices">
    {(latestSource.error || historySource.error || feltSource.error || nowcastingSource.error || rdcaSource.error) && <p className="ppb-source-note" role="status">Sebagian sumber gagal diperbarui.</p>}
    {waterSource.error && <p className="ppb-source-note" role="status">Lokasi Distribusi Air gagal diperbarui.{waterLocations.length > 0 && ' Menampilkan data terakhir.'} <button onClick={waterSource.retry}>Coba lagi</button></p>}
    </div>
  </section>;
}
export default memo(DisasterMap);
