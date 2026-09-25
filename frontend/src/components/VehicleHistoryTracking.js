import { useEffect, useMemo, useState } from 'react';
import { Polyline, Marker, Popup, useMap } from 'react-leaflet';
import HeatmapMap from './HeatmapMap';
import L from 'leaflet';
import { getVehicleColor, getVehicleType, vehicleIconSvg } from './vehicleIcons';
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
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(60);
  const duration = first ? last.timestamp - first.timestamp : 0;
  useEffect(() => {
    setPlaying(false);
    setStarted(false);
    setElapsed(0);
  }, [points]);
  useEffect(() => {
    if (!playing || !points.length) return undefined;
    let frame;
    let previous;
    const tick = now => {
      const delta = previous === undefined ? 0 : (now - previous) * playbackSpeed;
      if (delta) setElapsed(value => Math.min(duration, value + delta));
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, playbackSpeed, duration, points]);
  useEffect(() => {
    if (started && elapsed >= duration) setPlaying(false);
  }, [elapsed, duration, started]);
  const playback = useMemo(() => {
    if (!started || !first) return null;
    const timestamp = first.timestamp + elapsed;
    let low = 0, high = points.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (points[middle].timestamp <= timestamp) low = middle;
      else high = middle - 1;
    }
    const from = points[low], to = points[Math.min(low + 1, points.length - 1)];
    const fraction = to.timestamp > from.timestamp ? (timestamp - from.timestamp) / (to.timestamp - from.timestamp) : 0;
    const position = from.position.map((value, axis) => value + (to.position[axis] - value) * fraction);
    const heading = Math.atan2((to.position[1] - from.position[1]) * Math.cos(position[0] * Math.PI / 180), to.position[0] - from.position[0]) * 180 / Math.PI;
    const color = getVehicleColor({ id: vehicle });
    return { position, timestamp, color, trail: [...renderHistoryPoints(points.slice(0, low + 1)), position],
      icon: L.divIcon({ className: 'history-vehicle-icon', html: vehicleIconSvg(getVehicleType({ id: vehicle }), heading, color), iconSize: [32, 48], iconAnchor: [16, 24] }) };
  }, [started, first, elapsed, points, vehicle]);
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
      <div className="history-playback" aria-label="Playback controls">
        <div className="history-playback-actions">
          <button type="button" disabled={!first || playing} onClick={() => { if (elapsed >= duration) setElapsed(0); setStarted(true); setPlaying(duration > 0); }}>Start</button>
          <button type="button" disabled={!playing} onClick={() => setPlaying(false)}>Stop</button>
          <label>Playback speed<select value={playbackSpeed} onChange={event => setPlaybackSpeed(Number(event.target.value))}>{[1, 10, 60, 300].map(speed => <option key={speed} value={speed}>{speed}×</option>)}</select></label>
        </div>
        <progress aria-label="Playback progress" max={duration || 1} value={started ? (duration ? elapsed : 1) : 0} />
        <span>{playback ? `${historyTime(playback.timestamp)} WIB · ${elapsed >= duration ? 'Selesai' : playing ? 'Berjalan' : 'Dihentikan'}` : 'Klik Start untuk memutar perjalanan.'}</span>
      </div>
      {first && <div className="history-summary" aria-label="History summary"><span>Vehicle: <b>{name}</b></span><span>Date: <b>{date}</b></span><span>Start: <b>{historyTime(first.timestamp)} WIB</b></span><span>End: <b>{historyTime(last.timestamp)} WIB</b></span><span>Duration: <b>{Math.floor(minutes / 60)}h {minutes % 60}m</b></span><span>Distance: <b>{distance.toFixed(1)} km</b></span><span>Points: <b>{points.length.toLocaleString('en-US')}</b></span></div>}
      {message && <div role="status">{message}</div>}
    </section>
    <div className="history-map"><HeatmapMap mode="vehicle-tracker" isActive={isActive} showLiveVehicles={false}>
      <FitHistory points={points} />
      {points.length > 1 && <Polyline positions={positions} pathOptions={{ color: '#94a3b8', weight: 4, opacity: 0.45 }} />}
      {playback && <>
        <Polyline positions={playback.trail} pathOptions={{ color: playback.color, weight: 6, opacity: 1 }} />
        <Marker position={playback.position} icon={playback.icon} zIndexOffset={1000} title={`Playback: ${name}`} />
      </>}
      {first && <Endpoint point={first} label="START" vehicle={name} />}
      {last && <Endpoint point={last} label="END" vehicle={name} />}
    </HeatmapMap></div>
  </div>;
}
