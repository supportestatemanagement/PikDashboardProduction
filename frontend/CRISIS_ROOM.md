# Crisis Room

Authenticated viewers open `/crisis-room`. Astina opens `/crisis-room/broadcast`
and has no other dashboard menus or Firebase dashboard token. The backend forces
the `crisis_broadcaster` role for the exact username `Astina`, including accounts
loaded from OFFICER. The broadcaster cannot start a second simultaneous session.

## Activate Astina

Recommended: run `python provision_astina.py` from `backend` with dependencies
installed. Enter a unique password twice. Set the printed
`CRISIS_ASTINA_PASSWORD_HASH` in Render's environment, together with the existing
`DASHBOARD_SESSION_SECRET`. The account's username is `Astina`; the password is
never embedded in frontend code. Alternatively, add Astina and its password to
the existing OFFICER sheet; its role is forcibly restricted regardless of ROLE
or LEVEL. A configured password hash takes precedence over the sheet.

Astina's signed session has no time expiry (`expiresAt: null`), including across
network outages and browser restarts. Manual logout still clears the session.
Invalid signatures or rotating DASHBOARD_SESSION_SECRET require login again.
Normal viewer sessions retain their existing expiry. Store Astina's credentials
and session only on the designated office PC.

## Deploy

- Install the updated backend requirements (`flask-sock` supplies WebSocket support).
- Run **one Render instance and one Gunicorn worker**, with threads:
  `gunicorn --workers 1 --threads 100 --timeout 120 -b 0.0.0.0:$PORT app:app`.
  The Dockerfile already uses this command. Room membership is in memory; multiple
  instances/workers need shared signaling coordination before scaling.
  `backend/gunicorn.conf.py` also sets the defaults for a native Render service
  started with `gunicorn app:app` from the backend directory.
- Set `CRISIS_ALLOWED_ORIGINS` to the exact frontend origin(s), comma separated,
  e.g. `https://dashboard.example.com,http://localhost:3000`. No trailing slash.
  If unset, https://pikdashboard.vercel.app, localhost:3000, 127.0.0.1:3000,
  and the backend's own origin are allowed.
- Set frontend `REACT_APP_API_URL` to the HTTPS Render backend. WebSockets use WSS
  at `/api/crisis-room/ws`; session tokens are sent in the first frame, not URLs.
- Configure the frontend static host to rewrite `/crisis-room` and
  `/crisis-room/broadcast` to `/index.html` (SPA fallback).
- Application ping/pong runs every 15 seconds; silent sockets reconnect after
  60 seconds, with exponential backoff capped at 30 seconds plus jitter. The
  WebSocket server also sends protocol pings. A restart resets membership;
  Astina's retained capture registers again and viewers renegotiate automatically.
  Heartbeats do not guarantee that a free Render service stays awake.

## Operate

1. On the office PC, keep HCP Hikvision open with its 3×3 CCTV grid.
2. Use desktop Chrome/Edge over HTTPS (localhost works for development), login as
   Astina, and press **Start Share Screen**. In the browser picker, select the
   entire **HCP Hikvision window**. The browser requires this manual selection;
   the app cannot silently select a named window or recapture after a reload.
3. Keep the HCP window visible (do not minimize it), the browser open, the PC awake,
   and the network connected. Screen capture survives a signaling reconnect,
   but not browser/PC restart, closing the tab, or browser Stop sharing.
4. Viewers login normally, then select **Crisis Room**. The one captured video
   contains the full grid. It fits the viewing area without cropping/stretching.
5. **Stop Broadcast**, browser Stop sharing, or logout stops all capture tracks
   and closes peer connections. Viewers see OFFLINE.

LIVE means capture is published (Astina) or the video peer is connected (viewer).
CONNECTING means initial signaling/video negotiation. RECONNECTING means signaling
or media is recovering. OFFLINE means no active broadcast.

## Network and capacity

Each new viewer fetches authenticated ICE configuration from the backend, then
first negotiates using only its STUN entries on both ends without gathering relay
candidates. A failed connection, a 30-second
connection timeout, or an 8-second disconnection triggers a fresh offer for that
viewer with optional TURN fallback. Other viewers keep their existing connections.
If no TURN provider is configured, retries remain direct and show a configuration
message. The Render backend supplies signaling and temporary
ICE credentials; it never receives or forwards the captured video. No recording,
Meet integration, or splitting into nine streams is added. Each additional viewer
adds another outbound copy of the same stream, including when TURN is selected.
Office upload bandwidth, CPU, and relay bandwidth determine capacity. TURN data
transfer can incur provider charges. Test on actual office and viewer networks.

## Optional TURN fallback

Metered is the selected provider in `backend/.env.example`. Set these values
manually in Render; no production deployment or environment mutation is automated:

```env
CRISIS_TURN_PROVIDER=metered
CRISIS_TURN_METERED_APP_ID=<APP_ID_FROM_DEVELOPERS>
CRISIS_TURN_METERED_DOMAIN=<YOUR_APP.metered.live>
CRISIS_TURN_METERED_SECRET_KEY=<SECRET_KEY_FROM_DEVELOPERS>
CRISIS_TURN_TTL_SECONDS=3600
CRISIS_TURN_FORCE_RELAY=false
```

Copy the app ID, Metered domain, and Secret key from Developers into Render only.
DOMAIN accepts `example.metered.live` or `https://example.metered.live/`; arbitrary
hosts, paths, ports, userinfo, or non-HTTPS URLs are rejected. APP_ID identifies
the credential label `crisis-room-<APP_ID>`; the documented application TURN API
uses the domain, not APP_ID in an invented URL path or authentication field.
The backend first performs
`POST https://<domain>/api/v1/turn/credential?secretKey=...` with JSON
`{expiryInSeconds: 3600, label: ...}`, then calls
`GET https://<domain>/api/v1/turn/credentials?apiKey=<CREATED_CREDENTIAL_KEY>`.
These v1 endpoints remain the documented APIs for this operation, even though
Metered also offers v2 listing/project APIs. Both calls have a 10-second timeout.
The backend validates responses and forwards only STUN/TURN URLs and required
temporary TURN username/password fields plus expiry/policy metadata. Neither the
Secret key nor generated API key reaches Vercel, frontend code, browser logs, or
endpoint error responses. Both roles must supply
their signed dashboard session to `/api/crisis-room/ice-servers`; responses use
`Cache-Control: no-store`. Backend error messages distinguish invalid configuration,
rejected keys, service timeouts, and malformed ICE responses without upstream URLs
or response bodies. See [Metered Create TURN Credential](https://www.metered.ca/docs/turn-rest-api/post-create-credential/)
and [Metered Get TURN Credential](https://www.metered.ca/docs/turn-rest-api/get-credential/).

Temporary credentials now have provider-side expiration. Metered TTL is clamped
to 600–86400 seconds (default 3600) to leave time for propagation and renewal.
A daemon maintenance worker starts with the Metered backend and checks every
20 seconds. One process-local credential is reused for Astina and authenticated
viewers, rather than creating one on every request. A replacement is prepared
five minutes before expiry and held for 120 seconds before becoming active.
The existing valid credential stays available during preparation or temporary
renewal failures. A failed ICE fetch retries the created credential's API key,
instead of creating another credential on every retry.
Provider failures have a 30-second retry backoff shared across requests.

After backend startup/restart, allow around 2 minutes for initial preparation;
until ready, the endpoint returns a sanitized 503 preparation message and normal
mode can still try STUN. In relay debug, wait for preparation, then refresh Astina
and viewers before testing. Cache is process-local, so preserve the required
single-worker/single-instance deployment. Render suspension/restart discards the
cache and triggers another warmup. Returned `expiresAt` uses the actual credential
creation time plus TTL; requests never extend a cached credential's expiration.
Expired credentials are never returned, and quota/authentication failures stay
visible without exposing secrets. Older APP_NAME/API_KEY environment variables
are no longer used by this provider. See
[Metered expiring credentials](https://www.metered.ca/docs/turnserver-guides/expiring-turn-credentials/).

For a temporary relay test set `CRISIS_TURN_FORCE_RELAY=true` **in Render**.
Backend returns `iceTransportPolicy: relay`; Astina and viewer bypass the initial
STUN-only attempt and use relay from their first peer connection. Normal production
uses `false` (`iceTransportPolicy: all`, STUN-first then optional relay fallback).
After toggling, reload both pages and reselect HCP on Astina to use the fresh
configuration; existing clients may retain their cached policy until refresh.
There are no TURN secrets or debug configuration required in Vercel.

Testing with Astina on office Wi-Fi and a viewer on mobile cellular/external Wi-Fi:

1. Enter the Developers settings in Render ENV; allow the backend to create and
   propagate its initial temporary credential before testing (around 2 minutes).
2. Enable relay debug temporarily. Refresh Astina, start sharing the HCP grid,
   then open a logged-in viewer on a different network.
3. Verify `mode: FORCE_RELAY_DEBUG`, `iceTransportPolicy: relay`, LIVE video,
   `route: TURN`, and candidate types containing `relay`. Browser console logs
   ICE gathering, ICE connection, and peer connection states plus only selected
   candidate types; no IP addresses, SDP, API keys, or passwords are logged.
4. Move viewer to another menu: viewer closes immediately and Astina removes that
   peer without stopping capture. Return to Crisis Room: reconnect automatically.
5. Hide viewer tab for <30 seconds: connection stays. Hide >30 seconds: disconnect;
   returning recreates it. Hide Astina tab: screen sharing continues. Connect a
   second viewer while capture is active and confirm it receives the current grid.
6. Set relay debug back to false and refresh both pages. Expect STUN_ONLY initially,
   then TURN_FALLBACK if direct ICE fails (or after 30 seconds). Check LIVE and
   `route: TURN` on blocked networks or `route: DIRECT` where P2P succeeds.
7. Test beyond the refresh interval and provider credential expiration/rotation.
   Mobile OS suspension can delay the viewer's 30-second background timer.

The code alone does not create a TURN server or provider account. Configure ONE
of the following options in **Render environment variables**, then redeploy the
backend and frontend. Do not place provider keys in Vercel or REACT_APP_* variables.
An authenticated `/api/crisis-room/ice-servers` request returns only short-lived
credentials with `Cache-Control: no-store`. Credentials remain in browser memory.

Cloudflare TURN (a provider account and TURN key are required):

```env
CRISIS_TURN_PROVIDER=cloudflare
CRISIS_TURN_CLOUDFLARE_KEY_ID=YOUR_TURN_KEY_ID
CRISIS_TURN_CLOUDFLARE_API_TOKEN=YOUR_TURN_CREDENTIAL_GENERATION_TOKEN
CRISIS_TURN_TTL_SECONDS=3600
```

Use the token issued for that TURN key, not a public credential or the browser's
dashboard session token. The backend calls the provider's credential-generation
API and passes on temporary relay credentials, including TCP/TLS URLs. See
[Cloudflare credential generation](https://developers.cloudflare.com/realtime/turn/generate-credentials/).

Company coturn server (a reachable TURN host is required):

```env
CRISIS_TURN_PROVIDER=coturn
CRISIS_TURN_URLS=turn:turn.COMPANY.example:3478?transport=udp,turns:turn.COMPANY.example:443?transport=tcp
CRISIS_TURN_SHARED_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
CRISIS_TURN_TTL_SECONDS=3600
```

On coturn, enable `use-auth-secret` and set `static-auth-secret` to exactly the
same secret. Configure a valid TLS certificate, the actual relay addresses/ports,
and firewall rules on that separate TURN server. TLS on port 443 is useful for
restrictive client networks. Render's HTTP signaling service is not the TURN host.
Temporary credentials use the timestamp/HMAC mechanism documented by
[coturn](https://github.com/coturn/coturn/blob/master/README.turnserver).

Both Astina and viewers fetch ICE configuration before negotiating a new peer.
Valid credentials are cached in memory until near expiry. The client
renews two minutes before expiry and Astina renegotiates only fallback peers without
stopping the HCP capture. Viewers can briefly reconnect during this renewal.
Temporary renewal failures preserve unexpired credentials and retry. Missing or
invalid TURN configuration is visible in the page; direct connections still work.

After deployment, stop/start broadcast once (or reload Astina and reselect HCP)
and refresh viewers. Verify a mobile viewer on cellular data and a PC on another
network. **Detail koneksi** shows `mode: STUN_FIRST`, `attemptMode: STUN_ONLY`,
and `turn: CONFIGURED` if the backend supplies relay credentials (this does not
mean relay is being used). `route: DIRECT` confirms the selected
media path is direct. After failure, `attemptMode: TURN_FALLBACK` indicates the
second attempt, which still allows direct ICE. It shows `turn: CONFIGURED` and `route: TURN` when the
selected candidate path uses the relay, or `route: DIRECT` for a direct path.
Verify renewal beyond one hour and operation for 24 hours before relying on it.

Existing anonymous dashboard read/upload APIs keep their existing contracts;
this feature does not retrofit access control across those legacy APIs. Requests
carrying Astina's signed session are denied outside Crisis Room/session endpoints.

## Acceptance checks on the real office PC

- Normal user: Crisis Room only, no broadcast buttons; direct broadcast URL
  redirects to the viewer page. Forged WebSocket broadcast mode is rejected.
- Astina: broadcast menu only; no Firebase token or other authenticated API access.
- Start capture, select HCP, verify the entire 3×3 grid and aspect ratio on two viewers.
- Join a viewer mid-broadcast; stop/restart broadcast; refresh viewer; check status.
- Disconnect/reconnect office internet or restart Render. Capture remains active
  and both viewers recover without choosing HCP again.
- Stop sharing through the browser and logout: viewers become OFFLINE.
- Confirm Astina remains logged in beyond 24 hours, including a network outage.

Automated tests cover role enforcement, session renewal authorization, signaling
message routing, heartbeat/reconnect, SDP/ICE order, and cleanup. Real HCP capture
and office firewall behavior require the above deployment checks.

## Viewer connection lifecycle

Viewers connect only while the Crisis Room menu is mounted. Leaving the menu
immediately closes the WebRTC peers and signaling socket; the server notifies
Astina to remove that viewer's outgoing peer. Opening the menu reconnects and
subscribes automatically.

When a viewer tab or PWA becomes hidden, a 30-second grace timer starts. Returning
before it expires cancels the timer and preserves the connection. After 30 seconds,
the viewer disconnects and clears its video; returning to the visible Crisis Room
automatically creates a fresh connection using the current login session. Browser
background timer throttling or OS suspension can delay execution of this timer.
This visibility policy never applies to Astina's publisher connection or capture.

## Troubleshoot a blank viewer

Open **Detail koneksi** on Astina and on the viewer:

- `signaling: RECONNECTING`: video negotiation has not started. Check the shown
  `signalingUrl`, frontend origin allowlist, and backend WebSocket support. When
  deploying, `REACT_APP_API_URL` must point to Render, not `localhost:5000` (the
  latter points to each viewer's own PC). Rebuild the frontend after changing it.
- `broadcast: OFFLINE`: the server has no active capture. A local screen preview
  on Astina alone does not confirm publishing; Astina must show LIVE.
- `signaling: CONNECTED`, `broadcast: ACTIVE`, and `ice: failed`/`checking`: SDP
  signaling works but the media path is failing. If `turn: NOT_CONFIGURED` or
  `UNAVAILABLE`, configure TURN using the section above. If TURN is configured,
  check its credentials, connectivity, TLS certificate, and relay firewall ports.
- Compare `serverId` on Astina and viewer. Different values mean connections landed
  in different workers/instances (or one connection has not completed registration).
  Use one Render instance and one threaded Gunicorn worker for this room.

Origin rejections, transport disconnects, offer timeouts, and media failures now
show distinct messages in the page. Backend logs record only exception type and
signaling mode/server ID; tokens, SDP, and credentials are not logged.
