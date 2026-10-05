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

WebRTC tries a direct connection and can use a separately configured TURN relay
when NAT/firewalls prevent it. The Render backend supplies signaling and temporary
ICE credentials; it never receives or forwards the captured video. No recording,
Meet integration, or splitting into nine streams is added. Each additional viewer
adds another outbound copy of the same stream, including when TURN is selected.
Office upload bandwidth, CPU, and relay bandwidth determine capacity. TURN data
transfer can incur provider charges. Test on actual office and viewer networks.

## Activate TURN fallback (required for the failing external viewers)

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

Both Astina and viewers fetch their own temporary ICE configuration before
negotiation. Valid credentials are cached in memory until near expiry. The client
renews two minutes before expiry and Astina renegotiates peer connections without
stopping the HCP capture. Viewers can briefly reconnect during this renewal.
Temporary renewal failures preserve unexpired credentials and retry. Missing or
invalid TURN configuration is visible in the page; direct connections still work.

After deployment, stop/start broadcast once (or reload Astina and reselect HCP)
and refresh viewers. Verify a mobile viewer on cellular data and a PC on another
network. **Detail koneksi** shows `turn: CONFIGURED` and `route: TURN` when the
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
