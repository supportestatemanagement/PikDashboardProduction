import { combinedStatus, sourceStatus } from '../../services/disaster/monitoring';
export default function SourceStatus({ sources: s }) {
  const statuses = [
    ['BMKG Weather', combinedStatus(s.weather)], ['BMKG Earthquake', combinedStatus([s.latest, s.history, s.felt])],
    ['BMKG Hotspot', sourceStatus(s.hotspot, s.hotspot.data?.hotspots)],
    ['BMKG Nowcasting', sourceStatus(s.nowcasting, s.nowcasting.data?.features)],
    ['BMKG RDCA', sourceStatus(s.rdca, s.rdca.data?.points)],
    ['BMKG Maritime', combinedStatus(s.maritime)], ['ENSO BMKG', sourceStatus(s.enso)],
  ];
  return <div className="ppb-source-status" aria-label="Status sumber">{statuses.map(([name, status]) => <span key={name}>{name}: <strong>{status}</strong></span>)}</div>;
}
