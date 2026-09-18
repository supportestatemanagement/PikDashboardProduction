import { useEffect, useMemo, useRef, useState } from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { subscribeVehicles } from '../services/vehicleTrackingService';
import './VehicleTrackingLayer.css';
import { useVehicleAuth } from './VehicleAuthProvider';
import { getVehicleType, vehicleIconSvg } from './vehicleIcons';

function VehicleMarker({ vehicle, now, connected }) {
  const marker = useRef(null);
  const stale = !Number.isFinite(vehicle.timestamp) || now - vehicle.timestamp > 60000;
  const status = !vehicle.tracking ? 'Tracking berhenti' : stale ? 'GPS tidak diperbarui' : !connected ? 'Koneksi terputus' : 'Live';
  const heading = Number.isFinite(vehicle.heading) ? vehicle.heading : 0;
  const vehicleType = getVehicleType(vehicle);
  const icon = useMemo(() => L.divIcon({
    className: 'vehicle-map-icon', iconSize: [32, 48], iconAnchor: [16, 24],
    html: vehicleIconSvg(vehicleType, heading, status === 'Live'),
  }), [heading, status, vehicleType]);

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
  const { status: authStatus, user, retry } = useVehicleAuth();
  const [vehicles, setVehicles] = useState([]);
  const [status, setStatus] = useState('Menghubungkan GPS…');
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!isActive || authStatus !== 'ready' || !user) { setVehicles([]); return undefined; }
    let unsubscribe;
    try { unsubscribe = subscribeVehicles(setVehicles, setStatus, user); }
    catch { setVehicles([]); setStatus('Unable to connect to realtime vehicle data.'); }
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => { unsubscribe?.(); clearInterval(timer); };
  }, [isActive, authStatus, user]);
  if (authStatus !== 'ready') return <div className="vehicle-tracking-status" role="status">
    {authStatus === 'error' ? <>Unable to connect to realtime vehicle data. <button className="vehicle-auth-retry" onClick={retry}>Coba lagi</button></> : 'Connecting to realtime service...'}
  </div>;
  return <>
    <div className="vehicle-tracking-status" role="status">GPS · {status}{status === 'Terhubung' && ` · ${vehicles.length} kendaraan`}
      {status === 'Unable to connect to realtime vehicle data.' && <button className="vehicle-auth-retry" onClick={retry}>Coba lagi</button>}
    </div>
    {vehicles.map(vehicle => <VehicleMarker key={vehicle.id} vehicle={vehicle} now={now} connected={status === 'Terhubung'} />)}
  </>;
}
