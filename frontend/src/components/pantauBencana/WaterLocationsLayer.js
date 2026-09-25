import L from 'leaflet';
import { LayerGroup, Marker, Popup } from 'react-leaflet';
import { validEarthquakeCoordinates } from './earthquakeMap';

const waterIcon = L.divIcon({
  className: 'water-map-marker',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
  html: `<svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
    <circle cx="20" cy="20" r="18" fill="#fff" stroke="#d4e8ef" stroke-width="2" />
    <path d="M7 27c1-7 5-15 12-17 5-2 10 1 11 6-3-3-7-3-9 0 4-1 7 2 7 5-4-3-8-2-8 1 1 4 7 6 13 7-8 4-17-3-26 1Z" fill="#159bc6" />
    <path d="M12 21c2-5 6-8 10-7M12 25c2-3 4-4 7-4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" />
  </svg>`,
});

export default function WaterLocationsLayer({ locations = [] }) {
  const waterLocations = locations.filter(location => validEarthquakeCoordinates(location.position));
  return <LayerGroup>
        {waterLocations.map((location) => <Marker
          key={location.id}
          position={location.position}
          icon={waterIcon}
          title={`Berbagi Air: ${location.name}`}
          alt={`Lokasi berbagi air ${location.name}`}
          zIndexOffset={600}
        >
          <Popup className="traffic-popup">
            <div className="popup-title" style={{ color: '#38bdf8' }}>Berbagi Air</div>
            <div className="popup-row"><span>Nama Lokasi</span><strong>{location.name}</strong></div>
            <div className="popup-row"><span>Koordinat</span><strong>{location.position.join(', ')}</strong></div>
          </Popup>
        </Marker>)}
  </LayerGroup>;
}
