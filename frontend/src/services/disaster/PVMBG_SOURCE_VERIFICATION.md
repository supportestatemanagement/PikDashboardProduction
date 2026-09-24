# PVMBG / MAGMA source verification — 24 September 2026

## Decision

Real-source integration is **disabled**. No stable public JSON list API was
verified. This does not assert that no API exists. No guessed endpoints, HTML
scraper, third-party source, persisted session signature, or public CORS proxy
has been added to production code.

## Official sources checked

| URL | Observation |
| --- | --- |
| https://magma.esdm.go.id/ | HTTP 200 HTML. Map's volcano list is embedded in an inline JavaScript array, `markersGunungApi`. |
| https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas | HTTP 200, `text/html; charset=UTF-8`. Activity levels are a webpage, not a verified JSON feed. |
| https://magma.esdm.go.id/v1/gunung-api/laporan | HTTP 200 HTML. Paginated reports and signed detail-page links. |
| https://geologi.esdm.go.id/ | Official portal/news, links to MAGMA; no public list API documentation found in the checked pages/search results. |
| https://www.esdm.go.id/ | Official HTML portal; no public list API documentation found in the checked pages/search results. |

## Discovered endpoint (not integrated)

The MAGMA homepage itself contains AJAX calls to:

`POST https://magma.esdm.go.id/v1/json/var?signature=<page-provided-signature>`

It sends `ga_code` and an `X-CSRF-TOKEN` header from the page's CSRF meta tag.
This is a per-volcano detail endpoint, not the list/coordinate feed.

- GET with the discovered signature: **405 Method Not Allowed**.
- POST with that signature and `ga_code=MER`, without session/CSRF: **419**.
- No successful report JSON response was obtained; JSON fields are therefore
  not considered verified merely because page JavaScript references them.
- Authentication: the public HTML did not require login. The JSON call uses
  a signature and CSRF/session mechanism; no documented public API token flow
  or stability contract was found.
- With `Origin: http://localhost:3000`, the POST 419 response and activity HTML
  returned `Access-Control-Allow-Origin: *`. This does **not** demonstrate a
  successful cross-origin authenticated POST or preflight. CORS is not the only
  blocker. No production browser CORS success is claimed.

## Fields observed, and their limits

The homepage embeds `ga_code`, `ga_nama_gapi`, `ga_status`, `ga_lat_gapi`,
`ga_lon_gapi`, `ga_kab_gapi`, and `ga_prov_gapi`. These cover identifier, name,
level, latitude, longitude, district and province, but **only inside HTML**.
No per-record update timestamp or recommendation was present in that map list.
Report pages show names, levels, observation periods/dates, and activity prose.
The map's detail-rendering script references recommendation, visual observation,
report-date and administrative-description fields, but their successful JSON
response schema was not verified.

No embedded records or report prose were copied into application data. Inspection
was one-time source investigation, not an approved production scraping pipeline.

## Implemented preparation

- `pvmbgVolcano.js`: explicit internal adapter contract, normalization, strict
  coordinates, status colors, sorting, counts, local filters, and a disabled loader.
- Original illustrative fallback retained, labeled, with null coordinates and
  timestamps. No fallback volcano is plotted or presented as official data.
- Overlay enabled by default; triangle markers, popup, panel focus at zoom 9,
  marker-to-panel selection are ready for verified data. Clicking a panel item
  re-enables its overlay if hidden. Missing coordinates disable navigation.
- A future verified loader can be passed to `useVolcanoSource`; polling is ten
  minutes and failed refreshes retain the last successful in-memory data. There
  is no claim of persistence across browser reloads.
- Summary counts describe the loaded dataset (currently illustrative), not a
  national live total. Missing fields and timestamps are never guessed.

## Safest next integration

Request a documented machine-readable dataset/access contract from PVMBG, with
stable identifiers, coordinates, levels and official timestamps. Verify payload,
authentication, allowed usage and CORS before enabling the loader. Map only fields
actually supplied to the internal contract. If a verified source needs server-side
access, use the existing Python backend with validation, timeouts, a 5–10 minute
shared cache and last-success retention. A proxy alone does not turn this
session-dependent HTML workflow into a stable public API.

HTML/browser scraping requires separate user approval and remains unimplemented.

Real-source status, real-coordinate production markers and actual browser map
navigation with official records remain pending. Automated UI tests use explicitly
synthetic fixtures and are not evidence of a working official data integration.
