import datetime
import math
from flask import jsonify, request


def parse_rainfall(values):
    if not values:
        return []
    result = {}
    for cells in values[1:]:
        row = dict(zip(values[0], cells))
        try:
            date = datetime.date.fromisoformat(str(row.get('Tanggal', '')).strip())
            hour, minute = map(int, str(row.get('Jam', '')).strip().split(':'))
            time = datetime.time(hour, minute).strftime('%H:%M')
            text = str(row.get('Hujan (mm)', '')).strip().replace(',', '.')
            value = float(text) if text else None
            if value is not None and (not math.isfinite(value) or value < 0):
                value = None
        except (ValueError, TypeError):
            continue
        result[(date.isoformat(), time)] = {'date': date.isoformat(), 'time': time, 'value': value, 'status': row.get('Status', '')}
    return [result[key] for key in sorted(result)]


def register_rainfall_routes(app, load_values):
    @app.get('/api/pump-rainfall')
    def rainfall():
        try:
            start = datetime.date.fromisoformat(request.args['startDate'])
            end = datetime.date.fromisoformat(request.args['endDate'])
            if start > end:
                raise ValueError()
        except (ValueError, KeyError):
            return jsonify(status='error', message='Rentang tanggal tidak valid.'), 400
        try:
            rows = [row for row in parse_rainfall(load_values()) if start.isoformat() <= row['date'] <= end.isoformat()]
            return jsonify(status='success', data=rows)
        except Exception:
            app.logger.exception('Unable to load CurahHujan')
            return jsonify(status='error', message='Gagal memuat data CurahHujan.'), 500
