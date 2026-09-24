import { memo, useEffect, useRef } from 'react';
import { LayerGroup, Marker, Popup, useMap } from 'react-leaflet';
import { EarthquakeDetails } from './EarthquakePanel';
import { earthquakeIcon, focusMapToEarthquake, validEarthquakeCoordinates } from './earthquakeMap';

const EarthquakeMarker = memo(function EarthquakeMarker({ quake, kind, selected, onSelect, registry }) {
  return <Marker ref={marker => { if (marker) registry.current.set(quake.id, marker); else registry.current.delete(quake.id); }}
    position={quake.coordinates} icon={earthquakeIcon(kind, quake.magnitude, selected)}
    zIndexOffset={selected ? 1200 : kind === 'latest' ? 1000 : 0}
    title={`M ${quake.magnitude ?? '-'} — ${quake.region}`}
    eventHandlers={{ click: () => onSelect?.(quake, kind, false) }}>
    <Popup autoPan={false} maxWidth={320}><EarthquakeDetails quake={quake} isLatest={kind === 'latest'} /></Popup>
  </Marker>;
});

export default memo(function EarthquakeLayer({ earthquakes, kind, selection, focusRequest, onSelect }) {
  const map = useMap();
  const group = useRef(null);
  const markers = useRef(new Map());
  useEffect(() => {
    if (focusRequest?.kind === kind) focusMapToEarthquake(map, markers.current.get(focusRequest.id), group.current);
    // Only an explicit user request triggers navigation, never updated feed data.
  }, [map, kind, focusRequest]);
  return <LayerGroup ref={group}>{earthquakes.filter(q => validEarthquakeCoordinates(q.coordinates)).map(quake => <EarthquakeMarker key={quake.id} quake={quake} kind={kind}
    selected={selection?.id === quake.id && selection?.kind === kind} onSelect={onSelect} registry={markers} />)}</LayerGroup>;
});
