"""Official NOAA/CPC weekly Niño 3.4 text feed; six-hour worker cache."""
import re
import threading
import time
from datetime import datetime
from urllib.request import Request, urlopen
from flask import jsonify

SOURCE_URL = 'https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for'
CACHE_SECONDS = 6 * 60 * 60


def parse_weekly(text):
    if 'week centered' not in text or 'Nino34' not in text:
        raise ValueError('Unexpected NOAA schema')
    rows = []
    for line in text.splitlines():
        match = re.match(r'^\s*(\d{2}[A-Z]{3}\d{4})\s+(.+)$', line)
        if not match:
            continue
        values = re.findall(r'[+-]?\d+\.\d+', match[2])
        if len(values) != 8:
            raise ValueError('Invalid NOAA record')
        date = datetime.strptime(match[1], '%d%b%Y').date().isoformat()
        value = float(values[5])  # Nino34 SSTA, not SST or Nino4.
        if not -10 <= value <= 10:
            raise ValueError('Invalid anomaly')
        if rows and date <= rows[-1]['date']:
            raise ValueError('Unordered periods')
        rows.append({'date': date, 'value': value})
    if not rows:
        raise ValueError('Empty NOAA feed')
    return {'value': rows[-1]['value'], 'periodDate': rows[-1]['date'],
            'periodType': 'week-centered', 'series': rows[-12:], 'source': 'NOAA/CPC'}


def register_enso_routes(app):
    cache = {}
    lock = threading.Lock()

    @app.get('/api/disaster/enso')
    def enso():
        with lock:
            if cache and time.monotonic() - cache['stored'] < CACHE_SECONDS:
                return jsonify(success=True, data=cache['data'])
            try:
                with urlopen(Request(SOURCE_URL, headers={'User-Agent': 'PikDashboard/1.0'}), timeout=12) as response:
                    raw = response.read(1024 * 1024 + 1)
                    if response.status != 200 or len(raw) > 1024 * 1024:
                        raise ValueError('Invalid response')
                data = parse_weekly(raw.decode('ascii'))
                cache.update(stored=time.monotonic(), data=data)
                return jsonify(success=True, data=data)
            except (OSError, ValueError):
                return jsonify(success=False, error='Gagal mengambil data ENSO NOAA/CPC.'), 502
