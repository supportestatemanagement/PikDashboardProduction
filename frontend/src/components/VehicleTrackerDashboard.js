import HeatmapMap from './HeatmapMap';
import { useState } from 'react';
import VehicleHistoryTracking from './VehicleHistoryTracking';
import './VehicleTrackerDashboard.css';

export default function VehicleTrackerDashboard({ isActive = true }) {
  const [mode, setMode] = useState('live');
  return <main className="traffic-command-center vehicle-tracker-dashboard">
    <div className="vehicle-tracker-modes" role="group" aria-label="Tracking mode">
      <button type="button" aria-pressed={mode === 'live'} onClick={() => setMode('live')}>Live Tracking</button>
      <button type="button" aria-pressed={mode === 'history'} onClick={() => setMode('history')}>History Tracking</button>
    </div>
    <div className="vehicle-tracker-content">{mode === 'live' ? <HeatmapMap mode="vehicle-tracker" isActive={isActive} /> : <VehicleHistoryTracking isActive={isActive} />}</div>
  </main>;
}
