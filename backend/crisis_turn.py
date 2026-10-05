"""Issue temporary ICE credentials; the dashboard never relays media."""
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
import threading
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from urllib.error import HTTPError, URLError

from flask import jsonify
from dashboard_auth import require_dashboard_session


class TurnProviderError(Exception):
    """Safe message only: never include upstream URLs, bodies, or credentials."""


_metered_lock = threading.RLock()
_metered_cache = {'key': None, 'active': None, 'pending': None, 'draft': None, 'retryAt': 0, 'error': None}
_metered_worker_started = False


def metered_settings(ttl):
    domain = os.environ.get('CRISIS_TURN_METERED_DOMAIN', '').strip().lower()
    domain = domain.removeprefix('https://').rstrip('/')
    app_id = os.environ.get('CRISIS_TURN_METERED_APP_ID', '').strip()
    secret = os.environ.get('CRISIS_TURN_METERED_SECRET_KEY', '').strip()
    if not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.metered\.live', domain) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,128}', app_id) or not secret:
        raise TurnProviderError('Metered: DOMAIN, APP_ID atau SECRET_KEY belum valid di backend.')
    return domain, app_id, secret, max(600, ttl)


def metered_request(request):
    try:
        with urlopen(request, timeout=10) as response:
            raw = response.read(65537)
        if len(raw) > 65536:
            raise ValueError('Oversized response')
        return json.loads(raw)
    except HTTPError as failure:
        message = 'Metered: autentikasi, paket atau kuota credential ditolak.' if failure.code in (400, 401, 403, 404) else 'Metered: layanan credential gagal merespons.'
        raise TurnProviderError(message) from None
    except (URLError, TimeoutError):
        raise TurnProviderError('Metered: koneksi layanan gagal atau timeout. Coba kembali.') from None
    except (ValueError, TypeError):
        raise TurnProviderError('Metered: respons credential tidak valid.') from None


def metered_ice(payload):
    try:
        if not isinstance(payload, list) or len(payload) > 64:
            raise ValueError('Invalid ICE response')
        servers = []
        for server in payload:
            if not isinstance(server, dict):
                continue
            urls = server.get('urls', [])
            urls = [urls] if isinstance(urls, str) else urls
            if not isinstance(urls, list):
                continue
            stun = [url for url in urls if isinstance(url, str) and re.fullmatch(r'stuns?:[^\s]+', url)]
            turn = [url for url in urls if isinstance(url, str) and re.fullmatch(r'turns?:[^\s]+', url)]
            if stun:
                servers.append({'urls': stun})
            if turn and isinstance(server.get('username'), str) and isinstance(server.get('credential'), str) and server['username'] and server['credential']:
                servers.append({'urls': turn, 'username': server['username'], 'credential': server['credential']})
        if not any('credential' in server for server in servers):
            raise ValueError('No relay credentials')
        return servers
    except (ValueError, TypeError):
        raise TurnProviderError('Metered: respons ICE tidak valid atau tidak memuat credential TURN.') from None


def metered_servers(ttl):
    settings = metered_settings(ttl)
    domain, app_id, secret, ttl = settings
    with _metered_lock:
        if _metered_cache['key'] != settings:
            _metered_cache.update(key=settings, active=None, pending=None, draft=None, retryAt=0, error=None)
        now = int(time.time())
        pending = _metered_cache['pending']
        if pending and now >= pending['readyAt']:
            _metered_cache.update(active=pending, pending=None)
        active = _metered_cache['active']
        if active and active['expiresAt'] <= now + 60:
            active = None
            _metered_cache['active'] = None
        # Prepare a replacement five minutes before expiry. The frontend renews
        # two minutes before expiry, after this replacement has propagated.
        if not _metered_cache['pending'] and now >= _metered_cache['retryAt'] and (not active or active['expiresAt'] - now <= 300):
            try:
                draft = _metered_cache['draft']
                if not draft or draft['expiresAt'] <= now + 180:
                    created = metered_request(Request(f'https://{domain}/api/v1/turn/credential?' + urlencode({'secretKey': secret}),
                        data=json.dumps({'expiryInSeconds': ttl, 'label': 'crisis-room-' + app_id}).encode(),
                        headers={'Content-Type': 'application/json'}, method='POST'))
                    if not isinstance(created, dict) or not isinstance(created.get('apiKey'), str) or not created['apiKey'] or created.get('expiryInSeconds') != ttl:
                        raise TurnProviderError('Metered: respons pembuatan credential tidak valid.')
                    draft = {'apiKey': created['apiKey'], 'expiresAt': now + ttl, 'readyAt': int(time.time()) + 120}
                    _metered_cache['draft'] = draft
                servers = metered_ice(metered_request(Request(f'https://{domain}/api/v1/turn/credentials?' + urlencode({'apiKey': draft['apiKey']}), method='GET')))
                _metered_cache['pending'] = {'servers': servers, 'expiresAt': draft['expiresAt'], 'readyAt': draft['readyAt']}
                _metered_cache['draft'] = None
                _metered_cache['retryAt'] = 0
                _metered_cache['error'] = None
            except TurnProviderError as failure:
                _metered_cache['retryAt'] = int(time.time()) + 30
                _metered_cache['error'] = str(failure)
                if not active:
                    raise
                # Keep the valid credential and let the maintenance worker retry.
        if not active:
            raise TurnProviderError(_metered_cache['error'] or 'Metered: credential sedang disiapkan. Tunggu sekitar 2 menit lalu coba kembali.')
        return active['servers'], active['expiresAt']


def start_metered_maintenance():
    global _metered_worker_started
    if os.environ.get('CRISIS_TURN_PROVIDER', '').strip().lower() != 'metered':
        return
    with _metered_lock:
        if _metered_worker_started:
            return
        _metered_worker_started = True
    def maintain():
        while True:
            try:
                ttl = max(600, min(86400, int(os.environ.get('CRISIS_TURN_TTL_SECONDS', '3600'))))
                metered_servers(ttl)
            except Exception:
                pass  # Authenticated endpoint provides sanitized diagnostics.
            threading.Event().wait(20)
    threading.Thread(target=maintain, name='crisis-metered-rotation', daemon=True).start()


def ice_configuration():
    now = int(time.time())
    ttl = max(300, min(86400, int(os.environ.get('CRISIS_TURN_TTL_SECONDS', '3600'))))
    stun = [url.strip() for url in os.environ.get('CRISIS_STUN_URLS', 'stun:stun.cloudflare.com:3478').split(',') if url.strip()]
    if any(not re.fullmatch(r'stuns?:[^\s]+', url) for url in stun):
        raise ValueError('Invalid STUN configuration')
    servers = [{'urls': stun}] if stun else []
    provider = os.environ.get('CRISIS_TURN_PROVIDER', 'coturn').strip().lower()
    expires_at = now + ttl
    if provider == 'metered':
        metered, expires_at = metered_servers(ttl)
        servers.extend(metered)
    elif provider == 'cloudflare':
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
    return {'iceServers': servers, 'turnConfigured': True, 'expiresAt': expires_at * 1000,
            'iceTransportPolicy': 'relay' if os.environ.get('CRISIS_TURN_FORCE_RELAY', '').strip().lower() == 'true' else 'all'}


def register_crisis_turn(app):
    start_metered_maintenance()
    @app.get('/api/crisis-room/ice-servers')
    @require_dashboard_session
    def ice_servers():
        try:
            response = jsonify(ice_configuration())
        except Exception as failure:
            app.logger.error('Crisis Room TURN credentials failed: %s', type(failure).__name__)
            response = jsonify({'status': 'error', 'message': str(failure) if isinstance(failure, TurnProviderError) else 'Konfigurasi atau layanan TURN belum tersedia.'})
            response.status_code = 503
        response.headers['Cache-Control'] = 'no-store'
        return response
