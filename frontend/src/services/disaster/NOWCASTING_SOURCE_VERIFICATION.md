# BMKG nowcasting verification — 24 September 2026

## Official discovery and chosen transport

- Directory: https://datacuaca.bmkg.go.id/arcgis/rest/services/production?f=pjson
- Service: https://datacuaca.bmkg.go.id/arcgis/rest/services/production/nowcasting_public/MapServer
- Sublayer: https://datacuaca.bmkg.go.id/arcgis/rest/services/production/nowcasting_public/MapServer/2
- Query: https://datacuaca.bmkg.go.id/arcgis/rest/services/production/nowcasting_public/MapServer/2/query

The official directory lists **MapServer**, not FeatureServer, for this service.
ArcGIS version is 10.91; map name is `nowcasting_publik_phase2`. Capabilities are
`Map,Query,Data`; supported query formats are `JSON, geoJSON, PBF`. The service
also advertises WMSServer and image export, but its verified feature-query
capability permits direct GeoJSON rendering in Leaflet without an Esri dependency.
No FeatureServer URL was guessed or used.

| Sublayer | Type | Geometry | Used |
| --- | --- | --- | --- |
| 0 — Provinsi | Feature Layer | esriGeometryPolygon | No |
| 1 — Kota Kabupaten | Feature Layer | esriGeometryPolygon | No |
| 2 — Nowcasting aktif | Feature Layer | esriGeometryPolygon | Yes |

Service and selected-layer spatial reference: **EPSG:4326 / WGS84**.
Selected layer has `hasZ: true`; queries explicitly request `returnZ=false` and
`outSR=4326`. The renderer uses `tipearea` with **Area Terjadi** and **Area Meluas**.
These are official area categories, **not severity levels**. The UI uses purple
and indigo to distinguish this overlay from existing disaster layers; those colors
are a UI choice, not the yellow/orange palette in BMKG's renderer. Unknown values
are preserved as source text and get neutral styling, not an invented category.

## Available fields

The selected layer metadata lists:

```
objectid, shape, idkecamatan, idlaporan, namaanalis, namakecamatan,
idkotakab, namakotakab, namaprovinsi, kategoridampak,
waktuberlaku, waktupembuatan, waktuberakhir, tipearea, approval,
laporanlapangan, indeksrisiko, upt, kodewilayah, kodekategoridampak,
kode_wilayah_right, no_sorting, st_area(shape), st_length(shape)
```

`waktuberlaku`, `waktupembuatan`, and `waktuberakhir` are `esriFieldTypeDate`.
`datesInUnknownTimezone` is false; time-reference metadata is null. The adapter
accepts ArcGIS epoch-millisecond dates and displays explicit WIB. It does not
guess the timezone of arbitrary strings. The service has no advertised layer
update timestamp/timeInfo, so the UI distinguishes source report creation time
(`waktupembuatan`) from the client's last successful fetch time.

Queries request only ID, region, area type, impact category, dates, field report
and UPT fields used by the UI. `kategoridampak` is displayed as source text; no
severity domain was supplied. There is **no verified separate weather-potential
field**, so the popup never inserts generic rain/lightning/wind claims.

## Requests actually verified

Metadata, count, JSON query and GeoJSON query succeeded without credentials.
The production-equivalent query includes:

```
where=1=1
outFields=objectid,idlaporan,namakecamatan,namakotakab,namaprovinsi,kategoridampak,waktuberlaku,waktupembuatan,waktuberakhir,tipearea,laporanlapangan,upt
returnGeometry=true
outSR=4326
returnZ=false
f=geojson
orderByFields=objectid ASC
resultOffset=0
resultRecordCount=2000
```

On 24 September 2026, server HTTP dates approximately 02:30–02:33 UTC
(09:30–09:33 WIB), repeated checks returned:

- HTTP **200**, `application/geo+json;charset=UTF-8`.
- `{"type":"FeatureCollection","features":[]}`.
- Independent count query: `{"count":0}`; JSON feature query was also empty.
- With `Origin: http://localhost:3000`, `Access-Control-Allow-Origin` echoed that
  origin. Requests need no custom headers or credentials in the application.

**Direct frontend fetch** is implemented; no backend or public CORS proxy was
needed. Production-origin behavior and full browser rendering against a nonempty
official response were not verified. Local shell restrictions required elevated
read-only requests during investigation; this is separate from browser CORS.

## Live/current status and limitations

This is a reachable official service named "Nowcasting aktif", but the inspected
responses contained no warning records. Therefore actual live issuance freshness,
real polygon coordinates, property values and warning validity cannot be confirmed
from this observation. Empty data is handled as a legitimate service response,
**not** a statement that Indonesia has no weather warnings. Polygon geometry and
field support are verified from metadata; nonempty rendering uses synthetic test
fixtures until an official warning is available.

- Overlay defaults **OFF**. The dashboard loads one shared source every five minutes for its situation summary. Toggling changes map visibility only; leaving the page aborts requests/timers.
- Known future/expired warnings are hidden; expiry is rechecked locally every
  15 seconds without extra network calls. The browser clock is used for validity
  filtering, not official update timestamps.
- Missing validity fields remain missing; popup labels validity unverified.
- On a fetch/refresh error, polygons are hidden and a layer-specific error is
  shown. Last-success timestamps remain visible; other layers keep working.
- A successful empty response removes old polygons. It does not reuse stale areas.
- Coordinates/rings and response shape are validated. Invalid records are counted
  and omitted; if every returned record is unusable, the layer reports an error.
- Server limit is 2,000 records. Query pagination is supported in metadata;
  retrieval is ordered and bounded to 20 pages, rejects duplicate IDs, and never
  silently accepts a detected truncated response. No snapshot isolation is
  promised by this live ArcGIS query; records can change between page requests.
- GeoJSON geometry is rendered directly, not converted from a fabricated schema.
  Both Polygon and MultiPolygon are accepted. All popup text is escaped by React.
- Service availability/SLA and public freshness guarantees were not documented in
  the inspected metadata. No claim of continuous/live coverage is made.

