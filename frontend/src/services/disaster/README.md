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
| Nowcasting | https://datacuaca.bmkg.go.id/arcgis/rest/services/production/nowcasting_public/MapServer/2/query | 5 min | Official warning feed; verified empty GeoJSON, active/current warnings not confirmed |
| RDCA | https://datacuaca.bmkg.go.id/arcgis/rest/services/production/rdca/FeatureServer/1/query | 5 min | Meteorological indicator; verified empty GeoJSON, active/current detections not confirmed |
| Maritime PIK 1 reference | https://maritim.bmkg.go.id/api/pelabuhan?slug=pelabuhan-muara-angke | 30 min | FORECAST; verified port XJ003, Pelabuhan Muara Angke |
| Maritime PIK 2 reference | https://maritim.bmkg.go.id/api/pelabuhan?slug=pelabuhan-tanjung-pasir | 30 min | FORECAST; verified port XI003, Pelabuhan Tanjung Pasir |
| ENSO | https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for | 6 h | CLIMATE INDICATOR; official weekly anomaly via backend proxy |

All existing BMKG weather/earthquake/ArcGIS sources use direct fetch. Data loads
once per source/cadence at page level for the situation summary, independently of
map visibility. Only latest earthquake is visible initially; other overlays are
OFF. Map toggles do not trigger duplicate requests. Intervals and requests abort
on unmount. Successful empty data is `No data`, not `Error`. Unverified adapters
are `Unavailable`; no fake requests or values are used to make them look connected.

## Weather / earthquake fields

Weather picks the closest forecast validity to fetch time. `weather_desc`, `t`,
`hu`, `ws`, `wd`, `vs_text` and `tcc` are used only when present. BMKG documents
`vs_text` as visibility and `tcc` as cloud cover %. `analysis_date` is forecast
production time in UTC. Forecasts are not observations.

Earthquakes include source `Potensi` when present; no tsunami risk is inferred.
Latest events and M5+ history are distinct feeds. Source geometry and invalid records are handled per adapter.

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

## ENSO / NOAA CPC

Official index catalog https://www.cpc.ncep.noaa.gov/data/indices/ links the
weekly OISST v2.1 (1991-2020) feed at
https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for . This is conventional
Niño 3.4 SSTA, not relative Niño 3.4 or the three-month ONI.
Verified HTTP 200 on 24 September 2026, no Access-Control-Allow-Origin header.
The local Flask route `/api/disaster/enso` was also verified against the actual
upstream with HTTP 200. Latest returned period: 16 September 2026, anomaly
+3.0 degrees C; previous +2.9. These are verification results, never defaults.

The header explicitly says **week centered**, so the UI does not mislabel it
as week ending. No publication timestamp is provided; browser fetch time is
not shown as a source update. Parser validates header, eight numeric columns,
ordered dates and anomaly range; reads Nino34 SSTA (sixth numeric column).
Only the last twelve actual weekly rows are returned. Backend caches successful
responses for six hours per worker; frontend polls every six hours. Failed
refreshes keep labeled last-successful data with its period. No extra env vars.
Restart/deploy backend to register the route; upstream verification does not
prove deployed browser connectivity.

Basic category uses <= -0.5 La Niña / >= +0.5 El Niño / otherwise Neutral.
It is explicitly not an official NOAA ENSO event declaration. Trend uses signed
latest-minus-previous anomaly: absolute change below 0.05 degrees C is Stable,
otherwise rising/falling. This is index direction, not La Niña event strength.
Actual weekly rows drive the compact sparkline. Missing data produces no values.

## Dashboard information design

Reusable DataTypeBadge has keyboard-focus and hover descriptions. Summary is
above local forecasts and the existing WebGIS; maritime and climate follow;
source status is last. Refresh time means last successful retrieval, not source
event/valid time. Empty successful responses are NO ACTIVE DATA; errors remain
ERROR even when a labeled prior response is shown. Retry is source-specific.
Map focus helper, radar animation, dark tiles, layer toggles and earthquake
selection are retained. RDCA is still official point geometry, not invented areas.

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
points, not newly surveyed PIK centers; the UI identifies the existing-map reference.
Haversine with mean Earth radius 6371.0088 km counts RDCA points within the
configured radius of each reference. Overlapping radii may count the same point
for both references. Counts are dated, never declared current without evidence.
Nowcasting counts remain national; no unsupported polygon proximity claim is made.

## Validation limitations

Automated service/UI tests use explicit synthetic fixtures for schema, boundaries,
errors and empty responses. Official network verification was read-only. A full
production browser session with deployed backend, current nonempty warning/RDCA
records and all credentials is separate from these tests. Build output has no
new dependencies; all new status and layout styling is scoped to this dashboard.

## Verification after information-design update (24 September 2026)

Read-only upstream requests with Origin http://localhost:3000:
- Weather (both ADM4): HTTP 200, Access-Control-Allow-Origin *.
- Latest/history/felt earthquakes: HTTP 200, Access-Control-Allow-Origin *.
  This confirms availability, not the freshness of every observation.
- Nowcasting GeoJSON: HTTP 200, origin reflected, zero features.
- RDCA GeoJSON: HTTP 200, origin reflected, zero features.
- Muara Angke XJ003 and Tanjung Pasir XI003: HTTP 200, no CORS;
  issued 2026-09-23 12:00 UTC. Existing backend proxy remains necessary.
- NOAA feed and local isolated Flask route: HTTP 200; see period details above.
No partial/unavailable upstream occurred in this verification. This is not a
claim that the newly added route is already deployed to the production backend.

Changed files in this update:
- components/pantauBencana: PusatPantauBencana.js, CurrentSituationCard.js,
  WeatherBanner.js, MaritimeConditionCard.js, EnsoCard.js, SourceStatus.js,
  DisasterMap.js, EarthquakePanel.js, NowcastingLayer.js, pantauBencana.css.
- New component: DataTypeBadge.js (reusable purpose tooltip/badge).
- Services: new noaaEnsoService.js and ensoClassification.js; removed the disabled
  bmkgEnso.js adapter; updated useDisasterSource.js (successful refresh time,
  source retry, stable memoized reference) and README.md.
- Backend: new disaster_enso.py; registered route in app.py.
- Tests: new noaaEnsoService.test.js and backend/test_disaster_enso.py;
  updated dashboardSources.test.js, ConditionCards.test.js, NowcastingLayer.test.js.
- No environment variables or dependencies added by this update.

QA: 34 relevant frontend tests passed; six backend tests passed. The broader
frontend run before the two added ENSO tests passed 103 tests, with unrelated
CCTV jsdom stylesheet console messages. Scoped ESLint has no violations.
Production build succeeds with pre-existing warnings in CallCenterDashboard.js
and PerparkiranDashboard.js. Browser visual/console and deployed Network QA are
not performed here; responsive CSS is provided but not screenshot-verified.
