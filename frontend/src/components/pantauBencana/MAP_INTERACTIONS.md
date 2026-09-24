# WebGIS interaction notes

The existing dashboard layout and data sources remain unchanged.

- Dark Map is the default: existing standard OSM raster tiles with a scoped CSS
  color filter on that tile layer only. Light Map uses the same tiles unfiltered.
  This is an OSM dark presentation, not CARTO Dark Matter or a new tile provider.
  OSM attribution stays visible and readable. No API key or dependency is added.
- CARTO's current official documentation requires a raster API key, so an
  unauthenticated CARTO raster URL was not introduced:
  https://docs.carto.com/faqs/carto-basemaps
- Earthquake icons use small cached DivIcons. The latest has a 2.8-second radar
  pulse; history/felt have a softer 3.6-second pulse. Cores brighten/dim and rings
  expand using only transform/opacity animation. Selection adds a white
  ring. Reduced-motion preference disables pulse and animated navigation.
- Hotspot uses a soft translucent canvas stroke, not thousands of DOM animations.
  RDCA and warning geometry keep static fills/outlines. Existing RDCA points are
  not converted to artificial polygons.
- Root selection and explicit focus requests are separate. Card/history/felt
  list clicks create a request; marker clicks only update selection. The helper
  activates the Leaflet layer, closes the old popup, flies to zoom 8 and opens
  the chosen popup with autoPan disabled. Repeated clicks also work.
- Source refreshes do not create focus requests. Layer/marker refs avoid DOM
  searches and shared globals; no moveend listeners or animation timers are added.
- Small earthquake layers stay mounted even when hidden, allowing their refs to
  be used when navigating. Bulk hotspot/RDCA content is memoized and remains
  unrendered while its layer is OFF. No hover-triggered application state is used.
- Tests cover layer restoration, popup replacement, active state, repeated focus,
  invalid coordinates and no focus on refresh using mocked Leaflet adapters.
  A production browser visual/performance test is still separate from unit tests.
