import L from 'leaflet';
import { LayerGroup, Marker, Popup, useMap } from 'react-leaflet';
import { focusMapToCoordinates, validEarthquakeCoordinates } from './earthquakeMap';

const waterIcon = L.divIcon({
  className: 'water-map-marker',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -8],
  html: `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
    <path d="M12 2S4 11 4 15a8 8 0 0 0 16 0c0-4-8-13-8-13Z" fill="#38bdf8" stroke="#e0f2fe" stroke-width="1.5" />
    <path d="M8 15a4 4 0 0 0 4 4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" />
  </svg>`,
});

export default function WaterLocationsLayer({ locations = [] }) {
  const map = useMap();
  const waterLocations = locations.filter(location => validEarthquakeCoordinates(location.position) && location.distributions?.some(entry => entry.date));
  return <LayerGroup>
        {waterLocations.map((location) => <Marker
          key={location.id}
          position={location.position}
          icon={waterIcon}
          title={`Distribusi Air: ${location.name}`}
          alt={`Lokasi distribusi air ${location.name}`}
          eventHandlers={{ click: event => {
            focusMapToCoordinates(map, location.position, Math.max(map.getZoom(), 15));
            event.target.openPopup();
          } }}
          zIndexOffset={600}
        >
          <Popup className="traffic-popup" autoPan={false} maxHeight={320} minWidth={260}>
            <div className="popup-title" style={{ color: '#38bdf8' }}>Distribusi Air</div>
            <div className="popup-row"><span>Nama Lokasi</span><strong>{location.name}</strong></div>
            <div className="popup-row"><span>Koordinat</span><strong>{location.position.join(', ')}</strong></div>
            {location.distributions.filter(entry => entry.date).map(entry => <section key={entry.id} style={{ borderTop: '1px solid #475569', marginTop: 10, paddingTop: 8 }}>
              <div className="popup-row"><span>Tanggal</span><strong>{entry.date.split('-').reverse().join('/')}</strong></div>
              <div className="popup-row"><span>No.</span><strong>{entry.number ?? '-'}</strong></div>
              <div className="popup-row"><span>Lokasi</span><strong>{entry.location || '-'}</strong></div>
              <div className="popup-row"><span>Kampung</span><strong>{entry.village || '-'}</strong></div>
              <div className="popup-row"><span>Kecamatan</span><strong>{entry.district || '-'}</strong></div>
              <div className="popup-row"><span>Jumlah KK</span><strong>{entry.households ?? '-'}</strong></div>
              <div className="popup-row"><span>Jumlah Warga</span><strong>{entry.residents ?? '-'}</strong></div>
            </section>)}
          </Popup>
        </Marker>)}
  </LayerGroup>;
}
