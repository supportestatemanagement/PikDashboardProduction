"""Issue temporary ICE credentials; the dashboard never relays media."""
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from urllib.request import Request, urlopen

from flask import jsonify
from dashboard_auth import require_dashboard_session


def ice_configuration():
    now = int(time.time())
    ttl = max(300, min(86400, int(os.environ.get('CRISIS_TURN_TTL_SECONDS', '3600'))))
    stun = [url.strip() for url in os.environ.get('CRISIS_STUN_URLS', 'stun:stun.cloudflare.com:3478').split(',') if url.strip()]
    if any(not re.fullmatch(r'stuns?:[^\s]+', url) for url in stun):
        raise ValueError('Invalid STUN configuration')
    servers = [{'urls': stun}] if stun else []
    provider = os.environ.get('CRISIS_TURN_PROVIDER', 'coturn').strip().lower()
    if provider == 'cloudflare':
        key_id = os.environ.get('CRISIS_TURN_CLOUDFLARE_KEY_ID', '').strip()
        api_token = os.environ.get('CRISIS_TURN_CLOUDFLARE_API_TOKEN', '').strip()
        if not key_id and not api_token:
            return {'iceServers': servers, 'turnConfigured': False, 'expiresAt': (now + 300) * 1000}
        if not re.fullmatch(r'[a-zA-Z0-9_-]+', key_id) or not api_token:
            raise ValueError('Incomplete TURN configuration')
        request = Request(f'https://rtc.live.cloudflare.com/v1/turn/keys/{key_id}/credentials/generate-ice-servers',
                          data=json.dumps({'ttl': ttl}).encode(),
                          headers={'Authorization': 'Bearer ' + api_token, 'Content-Type': 'application/json'}, method='POST')
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read(65536))
        relay_servers = []
        for server in payload.get('iceServers', []):
            urls = server.get('urls', [])
            urls = [urls] if isinstance(urls, str) else urls
            urls = [url for url in urls if isinstance(url, str) and re.fullmatch(r'turns?:[^\s]+', url)]
            if urls and isinstance(server.get('username'), str) and isinstance(server.get('credential'), str) and server['username'] and server['credential']:
                relay_servers.append({'urls': urls, 'username': server['username'], 'credential': server['credential']})
        if not relay_servers:
            raise ValueError('TURN provider returned no relay credentials')
        servers.extend(relay_servers)
    elif provider == 'coturn':
        urls = [url.strip() for url in os.environ.get('CRISIS_TURN_URLS', '').split(',') if url.strip()]
        secret = os.environ.get('CRISIS_TURN_SHARED_SECRET', '')
        if not urls and not secret:
            return {'iceServers': servers, 'turnConfigured': False, 'expiresAt': (now + 300) * 1000}
        if not urls or len(secret) < 32 or any(not re.fullmatch(r'turns?:[^\s]+', url) for url in urls):
            raise ValueError('Invalid TURN configuration')
        username = f'{now + ttl}:{secrets.token_hex(12)}'
        credential = base64.b64encode(hmac.new(secret.encode(), username.encode(), hashlib.sha1).digest()).decode()
        servers.append({'urls': urls, 'username': username, 'credential': credential})
    else:
        raise ValueError('Unknown TURN provider')
    return {'iceServers': servers, 'turnConfigured': True, 'expiresAt': (now + ttl) * 1000}


def register_crisis_turn(app):
    @app.get('/api/crisis-room/ice-servers')
    @require_dashboard_session
    def ice_servers():
        try:
            response = jsonify(ice_configuration())
        except Exception as failure:
            app.logger.error('Crisis Room TURN credentials failed: %s', type(failure).__name__)
            response = jsonify({'status': 'error', 'message': 'Konfigurasi atau layanan TURN belum tersedia.'})
            response.status_code = 503
        response.headers['Cache-Control'] = 'no-store'
        return response
