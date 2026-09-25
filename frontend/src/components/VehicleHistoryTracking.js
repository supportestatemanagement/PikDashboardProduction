import { useEffect, useMemo, useState } from 'react';
import { Polyline, Marker, Popup, useMap } from 'react-leaflet';
import HeatmapMap from './HeatmapMap';
import L from 'leaflet';
import { useVehicleAuth } from './VehicleAuthProvider';
import { HISTORY_VEHICLES, todayWib, historyTime, readVehicleHistory, historyDistance, renderHistoryPoints } from '../services/vehicleHistoryService';

const endpointIcon = label => L.divIcon({ className: `history-endpoint history-endpoint-${label.toLowerCase()}`, html: `<span>${label}</span>`, iconSize: [54, 26], iconAnchor: [27, label === 'START' ? 26 : 0], popupAnchor: [0, -26] });
const startIcon = endpointIcon('START'), endIcon = endpointIcon('END');

function FitHistory({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) {
      const desktop = map.getSize().x > 600;
      map.fitBounds(points.map(point => point.position), { paddingTopLeft: [40, desktop ? 40 : 290], paddingBottomRight: [desktop ? 380 : 40, 40], maxZoom: 17 });
    }
  }, [map, points]);
  return null;
}

function Endpoint({ point, label, vehicle }) {
  return <Marker position={point.position} icon={label === 'START' ? startIcon : endIcon} title={`${label}: ${vehicle}`}>
    <Popup><strong>{label} · {vehicle}</strong><div>Time: {historyTime(point.timestamp)} WIB</div>
      {Number.isFinite(point.speed) && <div>Speed (GPS raw): {point.speed}</div>}
      {Number.isFinite(point.accuracy) && <div>Accuracy: {point.accuracy} m</div>}
    </Popup>
  </Marker>;
}

export default function VehicleHistoryTracking({ isActive }) {
  const { status: authStatus, user, retry: retryAuth } = useVehicleAuth();
  const [vehicle, setVehicle] = useState(HISTORY_VEHICLES[0].id);
  const [date, setDate] = useState(todayWib);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ key: '', points: [], status: 'loading' });
  const key = `${vehicle}/${date}/${attempt}`;
  useEffect(() => {
    if (!isActive || authStatus !== 'ready' || !user || !date) return undefined;
    let cancelled = false;
    setResult({ key, points: [], status: 'loading' });
    readVehicleHistory(vehicle, date, user).then(points => {
      if (!cancelled) setResult({ key, points, status: 'ready' });
    }).catch(() => {
      if (!cancelled) setResult({ key, points: [], status: 'error' });
    });
    return () => { cancelled = true; };
  }, [isActive, authStatus, user, vehicle, date, key]);
  const points = useMemo(() => isActive && authStatus === 'ready' && user && result.key === key && result.status === 'ready' ? result.points : [], [isActive, authStatus, user, result, key]);
  const positions = useMemo(() => renderHistoryPoints(points), [points]);
  const distance = useMemo(() => historyDistance(points), [points]);
  const name = HISTORY_VEHICLES.find(item => item.id === vehicle).name;
  const first = points[0], last = points[points.length - 1];
  const minutes = first ? Math.floor((last.timestamp - first.timestamp) / 60000) : 0;
  let message = 'Loading tracking history...';
  if (!date) message = 'Select a date.';
  else if (authStatus === 'error') message = 'Unable to connect to Firebase. Please retry.';
  else if (authStatus === 'ready' && result.key === key) {
    if (result.status === 'error') message = 'Unable to load tracking history. Check your connection and Firebase read permission.';
    else if (result.status === 'ready') message = points.length ? '' : 'No tracking history found for selected date.';
  }
  return <div className="vehicle-history">
    <section className="history-toolbar" aria-label="History tracking panel">
      <div className="history-panel-heading">History Tracking<span>Riwayat perjalanan kendaraan</span></div>
      <div className="history-filters">
        <label>Vehicle<select value={vehicle} onChange={event => setVehicle(event.target.value)}>{[...new Set(HISTORY_VEHICLES.map(item => item.area))].map(area => <optgroup key={area} label={area}>{HISTORY_VEHICLES.filter(item => item.area === area).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}</select></label>
        <label>Date<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
        <button type="button" onClick={() => authStatus === 'error' ? retryAuth() : setAttempt(value => value + 1)}>Refresh</button>
      </div>
      {first && <div className="history-summary" aria-label="History summary"><span>Vehicle: <b>{name}</b></span><span>Date: <b>{date}</b></span><span>Start: <b>{historyTime(first.timestamp)} WIB</b></span><span>End: <b>{historyTime(last.timestamp)} WIB</b></span><span>Duration: <b>{Math.floor(minutes / 60)}h {minutes % 60}m</b></span><span>Distance: <b>{distance.toFixed(1)} km</b></span><span>Points: <b>{points.length.toLocaleString('en-US')}</b></span></div>}
      {message && <div role="status">{message}</div>}
    </section>
    <div className="history-map"><HeatmapMap mode="vehicle-tracker" isActive={isActive} showLiveVehicles={false}>
      <FitHistory points={points} />
      {points.length > 1 && <Polyline positions={positions} pathOptions={{ color: '#38bdf8', weight: 5, opacity: 1 }} />}
      {first && <Endpoint point={first} label="START" vehicle={name} />}
      {last && <Endpoint point={last} label="END" vehicle={name} />}
    </HeatmapMap></div>
  </div>;
}
