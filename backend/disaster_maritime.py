"""Allowlisted BMKG port forecast proxy. No HTML parsing or arbitrary URLs."""
import json
import threading
import time
from urllib.request import Request, urlopen
from flask import jsonify

PORTS = {
    'pik1': ('pelabuhan-muara-angke', 'XJ003', 'Pelabuhan Muara Angke'),
    'pik2': ('pelabuhan-tanjung-pasir', 'XI003', 'Pelabuhan Tanjung Pasir'),
}
CACHE_SECONDS = 30 * 60
MAX_BYTES = 2 * 1024 * 1024


def validate_payload(data, code, name):
    if not isinstance(data, dict) or data.get('code') != code or data.get('name') != name:
        raise ValueError('Unexpected BMKG port')
    if not all(isinstance(data.get(field), str) and data[field] for field in ('issued', 'valid_from', 'valid_to')):
        raise ValueError('Missing forecast dates')
    rows = []
    for field in ('forecast_day1', 'forecast_day2-4'):
        values = data.get(field, [])
        if not isinstance(values, list) or not all(isinstance(row, dict) and isinstance(row.get('time'), str) for row in values):
            raise ValueError('Invalid forecast records')
        rows.extend(values)
    if not rows:
        raise ValueError('Empty forecast')
    return data


def register_maritime_routes(app):
    # Shared by requests within a worker; deployment with multiple workers has one
    # independent cache per worker. Use a shared cache for multi-instance scaling.
    cache = {}
    locks = {key: threading.Lock() for key in PORTS}

    @app.get('/api/disaster/maritime/<location>')
    def maritime_forecast(location):
        if location not in PORTS:
            return jsonify(success=False, error='Unknown maritime reference'), 404
        slug, code, name = PORTS[location]
        with locks[location]:
            previous = cache.get(location)
            if previous and time.monotonic() - previous['stored'] < CACHE_SECONDS:
                return jsonify(previous['response'])
            url = 'https://maritim.bmkg.go.id/api/pelabuhan?slug=' + slug
            try:
                request = Request(url, headers={'Accept': 'application/json', 'User-Agent': 'PikDashboard/1.0'})
                with urlopen(request, timeout=12) as response:
                    if response.status != 200 or 'json' not in response.headers.get('Content-Type', ''):
                        raise ValueError('Unexpected upstream response')
                    raw = response.read(MAX_BYTES + 1)
                    if len(raw) > MAX_BYTES:
                        raise ValueError('Oversized upstream response')
                data = validate_payload(json.loads(raw), code, name)
                result = {'success': True, 'source': 'BMKG Maritim', 'updatedAt': data['issued'], 'data': data}
                cache[location] = {'stored': time.monotonic(), 'response': result}
                return jsonify(result)
            except (OSError, ValueError, TypeError):
                # Do not masquerade an expired cache as a successful fresh fetch.
                # React keeps its last successful response with an explicit label.
                return jsonify(success=False, error='Data maritim resmi sementara tidak tersedia.'), 502
