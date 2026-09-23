# Pantau Bencana Develop data sources

The existing page and menu use the existing Leaflet / React-Leaflet dependencies.
No backend proxy, new dependency, or authentication change is required.

## Weather configuration

Set `REACT_APP_BMKG_WEATHER_ADM4` in `frontend/.env` to the confirmed village-level
BMKG administrative code for the PIK / PIK 2 location, then restart/rebuild CRA.
The value is intentionally empty in `.env.example`. No fallback location is used.
Weather is a forecast, not a live sensor measurement; the banner shows its forecast
validity time and production time separately. The nearest forecast is selected
using explicit UTC/WIB offsets, regardless of the browser's timezone.

## Public endpoints and polling

- Latest earthquake: `https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json` (60 seconds).
- M5+ history: `https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json` (60 seconds).
- Weather: `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=...` (30 minutes).
- Hotspots: `https://datacuaca.bmkg.go.id/arcgis/rest/services/production/geohotspot/FeatureServer/0/query`
  (30 minutes while enabled; initially OFF).

All requests use native fetch with HTTP/error checks, abort cleanup and a 20-second
timeout. Each source polls independently; failure does not erase previously fetched
card data. Error messages identify retained data. A failed hotspot refresh hides the
hotspot markers while leaving the map functional.

Latest earthquake and M5+ history are different feeds: the red marker can be below
M5, while the M5+ card highlights the latest entry in the M5+ feed. Invalid coordinates
never create markers. Earthquake event times are labeled as event times, not feed
publication timestamps.

The hotspot service contains historical records. Query the latest available observation
date first, then paginate that date with stable object-ID ordering and GeoJSON/WGS84
coordinates. Show the observation date and `system_date` from the source. Do not
describe these points as current fires or real-time detections. The service returned
18,003 points for 2026-09-01 during verification on 2026-09-23.

## Verification and future sources

The earthquake endpoints, weather endpoint (using BMKG's documented Kemayoran sample
only for verification), hotspot metadata and GeoJSON queries returned HTTP 200.
Responses allowed cross-origin requests (`*` or echoed Origin). No third-party CORS
proxy is used. Deployment/network access can still fail; the UI handles each source
independently.

Volcano data remains illustrative, isolated in `volcanoService.js` and labeled
"Data sementara" in the UI. No volcano markers with fabricated coordinates are plotted.
PVMBG/MAGMA, nowcasting, RDCA and other overlays require verified service metadata
before implementation.

Official documentation:
- https://data.bmkg.go.id/gempabumi/
- https://data.bmkg.go.id/prakiraan-cuaca/

Attribution to BMKG and OpenStreetMap remains visible in the page and map.
