import HeatmapMap from './HeatmapMap';

export default function VehicleTrackerDashboard({ isActive = true }) {
  return <main className="traffic-command-center vehicle-tracker-dashboard">
    <HeatmapMap mode="vehicle-tracker" isActive={isActive} />
  </main>;
}
