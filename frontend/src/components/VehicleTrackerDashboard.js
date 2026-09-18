import { useEffect, useState } from 'react';
import HeatmapMap from './HeatmapMap';
import { fetchWaterLocations } from '../services/trafficService';

export default function VehicleTrackerDashboard({ isActive = true }) {
  const [waterLocations, setWaterLocations] = useState([]);
  const [waterError, setWaterError] = useState('');
  useEffect(() => {
    if (!isActive) return undefined;
    const controller = new AbortController();
    setWaterError('');
    fetchWaterLocations(controller.signal)
      .then(locations => { if (!controller.signal.aborted) setWaterLocations(locations); })
      .catch(error => { if (!controller.signal.aborted) setWaterError(error.message); });
    return () => controller.abort();
  }, [isActive]);
  return <main className="traffic-command-center vehicle-tracker-dashboard">
    <HeatmapMap mode="vehicle-tracker" waterLocations={waterLocations} isActive={isActive} />
    {waterError && <div className="traffic-error" role="alert">Lokasi berbagi air tidak dapat dimuat: {waterError}</div>}
  </main>;
}
