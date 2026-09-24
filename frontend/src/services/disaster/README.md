# Pantau Bencana — source verification and operation

Updated 24 September 2026. Existing route, sidebar, authentication, dark styling
and Leaflet remain. No illustrative values or replacement numbers are supplied.

## Verified official sources

| Source | Endpoint | Cadence | Classification / verification |
| --- | --- | --- | --- |
| Local weather | https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={ADM4} | 30 min | FORECAST; both configured ADM4 endpoints returned JSON |
| Latest earthquake | https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json | 5 min | LIVE feed of latest reported event; event time is not fetch time |
| M >= 5 | https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json | 5 min | Reported event history |
| Felt earthquakes | https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json | 5 min | Verified JSON; includes coordinates, magnitude, depth, event time, felt areas |
| Hotspot | https://datacuaca.bmkg.go.id/arcgis/rest/services/production/geohotspot/FeatureServer/0/query | 15 min | Observation dataset; latest available observation date only, may be historical |
| Nowcasting | https://datacuaca.bmkg.go.id/arcgis/rest/services/production/nowcasting_public/MapServer/2/query | 5 min | Official warning feed; verified empty GeoJSON, active/current warnings not confirmed |
| RDCA | https://datacuaca.bmkg.go.id/arcgis/rest/services/production/rdca/FeatureServer/1/query | 5 min | Meteorological indicator; verified empty GeoJSON, active/current detections not confirmed |
| Maritime PIK 1 reference | https://maritim.bmkg.go.id/api/pelabuhan?slug=pelabuhan-muara-angke | 30 min | FORECAST; verified port XJ003, Pelabuhan Muara Angke |
| Maritime PIK 2 reference | https://maritim.bmkg.go.id/api/pelabuhan?slug=pelabuhan-tanjung-pasir | 30 min | FORECAST; verified port XI003, Pelabuhan Tanjung Pasir |
| ENSO | https://www.bmkg.go.id/iklim/dinamika-atmosfer | Disabled; future adapter 12 h | PERIODIC/CLIMATE source, integration UNAVAILABLE: no verified structured index feed |

All existing BMKG weather/earthquake/ArcGIS sources use direct fetch. Data loads
once per source/cadence at page level for the situation summary, independently of
map visibility. Only latest earthquake is visible initially; other overlays are
OFF. Map toggles do not trigger duplicate requests. Intervals and requests abort
on unmount. Successful empty data is `No data`, not `Error`. Unverified adapters
are `Unavailable`; no fake requests or values are used to make them look connected.

## Weather / earthquake / hotspot fields

Weather picks the closest forecast validity to fetch time. `weather_desc`, `t`,
`hu`, `ws`, `wd`, `vs_text` and `tcc` are used only when present. BMKG documents
`vs_text` as visibility and `tcc` as cloud cover %. `analysis_date` is forecast
production time in UTC. Forecasts are not observations.

Earthquakes include source `Potensi` when present; no tsunami risk is inferred.
Latest events and M5+ history are distinct feeds. Hotspot metadata exposes
objectid, longitude, latitude, date, time, region, provinsi, kabupaten, kecamatan,
system_date, date_full. No confidence field was advertised, so none is invented.
Hotspot counts are explicitly tied to the source observation date and do not imply
current fires. Source geometry and invalid records are handled per adapter.

## RDCA details

The official service directory lists `production/rdca` as FeatureServer/MapServer.
FeatureServer metadata lists sublayer **1 — RDCA**, geometry **esriGeometryPoint**,
EPSG:4326. Its fields are `objectid`, `latitude`, `longitude`, `system_date`.
Sublayer supports JSON/geoJSON/PBF, pagination and ordering, maxRecordCount 2000.
`system_date` alias is **Created At**; there is no separate verified observation
or service-update field. The UI preserves that distinction.

GeoJSON query returned HTTP 200 with an empty FeatureCollection, CORS echoing
`http://localhost:3000`. No real nonempty RDCA geometry/timestamp was available
in this check. Points are rendered as supplied, not expanded into fabricated
polygons. RDCA is an indicator of rapid convective cloud growth, not a disaster
warning. Old/undated values must not be interpreted as a current all-clear.

See [nowcasting verification](NOWCASTING_SOURCE_VERIFICATION.md) for its schema.
Its successful empty response displays exactly:
"Tidak ada area peringatan yang dikembalikan oleh sumber saat ini."

## Maritime proxy

The official port pages reference `/api/pelabuhan?slug=...` in their public script.
Both port JSON requests succeeded without credentials. No Access-Control-Allow-Origin
header was returned for the tested browser origin, so React uses the existing
Python backend, not a public CORS proxy:

- `GET /api/disaster/maritime/pik1`
- `GET /api/disaster/maritime/pik2`

`backend/disaster_maritime.py` only permits the two fixed ports. It checks port
identity and response shape, sets a timeout/size cap, and caches successes for
30 minutes per worker with a lock. Multiple workers/instances have independent
caches; a shared cache is recommended if deployed at larger scale. Upstream
failure after cache expiry returns 502, allowing the frontend to label its last
successful data explicitly. No expired cache is silently passed off as fresh.

Verified payload fields: code, name, issued, valid_from, valid_to, forecast_day1,
forecast_day2-4. Rows include time, weather, visibility (km), temp_avg, rh_avg,
wind_from, wind_speed (kt), wind_gust, wave_cat, wave_height (m), current_to,
current_speed (kt), tides (m). Units are shown on the official port pages.
All provided times explicitly use UTC; UI displays WIB. The closest forecast is
selected. Expired validity and failed updates show "Data terakhir tersedia".
The tide datum is not provided in JSON, so levels are not compared to local sensors.
No Kronjo reference is used.

The new route must be deployed/restarted on the backend configured by the existing
`REACT_APP_API_URL`. A successful upstream probe is not a claim that the deployed
backend already contains this route. No authentication behavior was changed.
An isolated local Flask test-client probe of both implemented proxy routes against
the real upstream returned HTTP 200 with the expected XJ003/XI003 identities and
source-issued timestamps. This verifies the proxy code, not deployment or browser
authentication/network configuration.

## ENSO

Official publications include numerical ENSO analyses, but a stable structured
BMKG Niño 3.4 feed was not verified. No article values are hard-coded or scraped.
The card shows "Data ENSO resmi sementara tidak tersedia." and a link to BMKG.
`getEnsoCategory` keeps official classification authoritative; only without one
will a numeric value use <= -0.5 La Niña, >= +0.5 El Niño, otherwise Netral. Missing
values are never classified as neutral. No unsupported intensity is inferred.
The card is ready for a verified adapter with value, officialCategory, period,
and updatedAt; it distinguishes Niño 3.4 from other indices/averaging periods.

## Monitoring references and configuration

```env
REACT_APP_BMKG_WEATHER_ADM4_PIK1=31.72.01.1002
REACT_APP_BMKG_WEATHER_ADM4_PIK2=36.03.14.2004
REACT_APP_DISASTER_MONITORING_RADIUS_KM=50
```

Only the radius variable is new; CRA needs the REACT_APP_ prefix. Existing
REACT_APP_API_URL continues to configure the backend. No new backend env is required.

Monitoring references reuse `HeatmapMap.js` AREA_CONFIG: PIK 1 uses **BGM**
[-6.1100, 106.7427], PIK 2 uses [-6.051, 106.694]. These are existing map reference
points, not newly surveyed PIK centers; the UI exposes their labels/coordinates.
Haversine with mean Earth radius 6371.0088 km counts hotspot/RDCA points within the
configured radius of each reference. Overlapping radii may count the same point
for both references. Counts are dated, never declared current without evidence.
Nowcasting counts remain national; no unsupported polygon proximity claim is made.

## Validation limitations

Automated service/UI tests use explicit synthetic fixtures for schema, boundaries,
errors and empty responses. Official network verification was read-only. A full
production browser session with deployed backend, current nonempty warning/RDCA
records and all credentials is separate from these tests. Build output has no
new dependencies; all new status and layout styling is scoped to this dashboard.
