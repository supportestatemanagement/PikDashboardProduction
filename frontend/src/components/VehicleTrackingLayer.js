import { useEffect, useMemo, useRef, useState } from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { subscribeVehicles } from '../services/vehicleTrackingService';
import './VehicleTrackingLayer.css';
import VehicleLogin from './VehicleLogin';
import { refreshVehicleSession } from '../services/vehicleAuthService';

function VehicleMarker({ vehicle, now, connected }) {
  const marker = useRef(null);
  const stale = !Number.isFinite(vehicle.timestamp) || now - vehicle.timestamp > 60000;
  const status = !vehicle.tracking ? 'Tracking berhenti' : stale ? 'GPS tidak diperbarui' : !connected ? 'Koneksi terputus' : 'Live';
  const heading = Number.isFinite(vehicle.heading) ? vehicle.heading : 0;
  const icon = useMemo(() => L.divIcon({
    className: 'vehicle-map-icon', iconSize: [32, 48], iconAnchor: [16, 24],
    html: `<svg width="32" height="48" viewBox="0 0 32 48" style="transform:rotate(${heading}deg)" aria-hidden="true"><rect x="4" y="9" width="4" height="10" rx="2" fill="#111827"/><rect x="24" y="9" width="4" height="10" rx="2" fill="#111827"/><rect x="4" y="31" width="4" height="10" rx="2" fill="#111827"/><rect x="24" y="31" width="4" height="10" rx="2" fill="#111827"/><rect x="7" y="2" width="18" height="44" rx="7" fill="${status === 'Live' ? '#fbbf24' : '#94a3b8'}" stroke="#fff" stroke-width="2"/><path d="M10 12h12l-1 9H11Z M11 32h10l1 6H10Z" fill="#1e293b"/><path d="M10 5h4m4 0h4" stroke="#fff" stroke-width="3"/></svg>`,
  }), [heading, status]);

  useEffect(() => {
    const instance = marker.current;
    if (!instance) return undefined;
    const start = instance.getLatLng();
    const began = performance.now();
    let frame;
    const move = (time) => {
      const progress = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 1 : Math.min((time - began) / 900, 1);
      instance.setLatLng([start.lat + (vehicle.latitude - start.lat) * progress, start.lng + (vehicle.longitude - start.lng) * progress]);
      if (progress < 1) frame = requestAnimationFrame(move);
    };
    frame = requestAnimationFrame(move);
    return () => cancelAnimationFrame(frame);
  }, [vehicle.latitude, vehicle.longitude]);
  const initialPosition = useRef(vehicle.position);
  const name = vehicle.vehicle_name || vehicle.vehicle_id || vehicle.id;
  return <Marker ref={marker} position={initialPosition.current} icon={icon} title={name} zIndexOffset={1000}>
    <Tooltip permanent direction="top" offset={[0, -28]} className={`vehicle-map-label ${status === 'Live' ? '' : 'vehicle-map-label--inactive'}`}>
      {name} {vehicle.plate_number || ''}{status !== 'Live' && <small>{status}</small>}
    </Tooltip>
    <Popup><strong>{name}</strong><div>Pelat: {vehicle.plate_number || '—'}</div>
      <div>Petugas: {vehicle.officer_name || '—'}</div><div>Status: {status}</div>
      <div>Akurasi GPS: {Number.isFinite(vehicle.accuracy) ? `${vehicle.accuracy.toFixed(1)} m` : '—'}</div>
      <div>Pembaruan: {Number.isFinite(vehicle.timestamp) ? new Date(vehicle.timestamp).toLocaleString('id-ID') : '—'}</div>
    </Popup>
  </Marker>;
}

export default function VehicleTrackingLayer({ isActive }) {
  const [session, setSession] = useState(null);
  const [sessionError, setSessionError] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [status, setStatus] = useState('Menghubungkan GPS…');
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!isActive || !session) return undefined;
    const unsubscribe = subscribeVehicles(setVehicles, setStatus, session.idToken);
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => { unsubscribe(); clearInterval(timer); };
  }, [isActive, session]);
  useEffect(() => {
    if (!session) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const renewed = await refreshVehicleSession(session.refreshToken, controller.signal);
        if (!controller.signal.aborted) setSession(renewed);
      } catch (err) {
        if (!controller.signal.aborted) {
          setSession(null); setVehicles([]); setSessionError(err.message);
        }
      }
    }, Math.max(0, session.expiresAt - Date.now() - 60000));
    return () => { clearTimeout(timer); controller.abort(); };
  }, [session]);
  if (!session) return <VehicleLogin error={sessionError} onLogin={next => { setSessionError(''); setSession(next); }} />;
  return <>
    <div className="vehicle-tracking-status" role="status">GPS · {status}{status === 'Terhubung' && ` · ${vehicles.length} kendaraan`}</div>
    <button className="vehicle-logout" onClick={event => { event.stopPropagation(); setSession(null); setVehicles([]); }}>Keluar GPS</button>
    {vehicles.map(vehicle => <VehicleMarker key={vehicle.id} vehicle={vehicle} now={now} connected={status === 'Terhubung'} />)}
  </>;
}
