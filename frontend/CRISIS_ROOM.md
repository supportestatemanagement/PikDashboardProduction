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
- Set `CRISIS_ALLOWED_ORIGINS` to the exact frontend origin(s), comma separated,
  e.g. `https://dashboard.example.com,http://localhost:3000`. No trailing slash.
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

Video goes directly from Astina to each viewer using WebRTC; the backend forwards
only offers, answers, ICE candidates, and room status. Only STUN servers are used
(`REACT_APP_CRISIS_STUN_URLS`, comma-separated `stun:`/`stuns:` URLs). There is no
TURN, media relay, recording, Meet integration, or splitting into nine streams.
Restrictive firewalls or symmetric NAT may prevent a direct connection. Test on
the actual office and viewer networks. Each extra viewer adds another outbound
copy of the same captured stream, so office upload bandwidth and CPU determine
capacity. A backend signaling service alone cannot overcome blocked peer traffic.

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
