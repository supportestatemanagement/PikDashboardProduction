import { divIcon } from 'leaflet';
export const EARTHQUAKE_LAYERS = { latest: 'Gempa terbaru', history: 'Gempa M >= 5', felt: 'Gempa dirasakan' };
export const validEarthquakeCoordinates = coordinates => Array.isArray(coordinates) && coordinates.length === 2 && coordinates.every(Number.isFinite) && Math.abs(coordinates[0]) <= 90 && Math.abs(coordinates[1]) <= 180;
export function focusMapToCoordinates(map, coordinates, zoom = 8) {
  if (!validEarthquakeCoordinates(coordinates)) return false;
  map.stop();
  map.closePopup();
  map.flyTo(coordinates, zoom, { duration: 1.2, animate: !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches });
  return true;
}
export function focusMapToEarthquake(map, marker, group) {
  if (!marker || !group) return false;
  const { lat, lng } = marker.getLatLng();
  if (!validEarthquakeCoordinates([lat, lng])) return false;
  if (!map.hasLayer(group)) map.addLayer(group);
  focusMapToCoordinates(map, [lat, lng]);
  // autoPan=false on the popup prevents it from interrupting the flyTo.
  marker.openPopup();
  return true;
}
const iconCache = new Map();
export function earthquakeIcon(kind, magnitude, selected) {
  const size = kind === 'latest' ? 28 : magnitude >= 6 ? 18 : magnitude >= 5 ? 15 : 12;
  const key = `${kind}-${size}-${selected}`;
  if (!iconCache.has(key)) iconCache.set(key, divIcon({
    className: `ppb-earthquake-marker ppb-earthquake-${kind}${selected ? ' ppb-earthquake-selected' : ''}`,
    html: `<span class="ppb-earthquake-halo"></span><span class="ppb-earthquake-core" style="width:${size}px;height:${size}px"></span>`,
    iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -18],
  }));
  return iconCache.get(key);
}
