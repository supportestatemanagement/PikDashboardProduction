"""Shared group locations; only a signed Daniel session may change them."""
import math
import threading
import re
from flask import g, jsonify, request
from gspread.utils import rowcol_to_a1
from dashboard_auth import require_dashboard_session


def register_cctv_map(app, workbook, load_cameras):
    lock = threading.Lock()

    @app.get('/api/cctv-map')
    def read_cctv_map():
        try:
            locations = {}
            for row in load_cameras():
                group = str(row.get('Kelompok', '')).strip()
                parts = re.split(r'\s*[,;]\s*', str(row.get('Koordinat', '')).strip())
                if not group or group in locations or len(parts) != 2:
                    continue
                try:
                    lat, lng = map(float, parts)
                    if math.isfinite(lat) and math.isfinite(lng) and -90 <= lat <= 90 and -180 <= lng <= 180:
                        locations[group] = {'Kelompok': group, 'Latitude': lat, 'Longitude': lng}
                except ValueError:
                    continue
            return jsonify(status='success', data=list(locations.values()))
        except Exception:
            app.logger.exception('Unable to read CCTV coordinates')
            return jsonify(message='Gagal memuat lokasi kelompok CCTV.'), 503

    @app.put('/api/cctv-map')
    @require_dashboard_session
    def save_cctv_map():
        if g.dashboard_user.get('username') != 'Daniel':
            return jsonify(message='Hanya Daniel yang dapat mengubah lokasi.'), 403
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(message='Lokasi tidak valid.'), 400
        group = str(body.get('Kelompok', '')).strip()
        try:
            lat, lng = float(body['Latitude']), float(body['Longitude'])
            if not math.isfinite(lat) or not math.isfinite(lng) or not -90 <= lat <= 90 or not -180 <= lng <= 180:
                raise ValueError()
        except (KeyError, TypeError, ValueError):
            return jsonify(message='Koordinat tidak valid.'), 400
        try:
            with lock:
                sheet = workbook.worksheet('CCTV')
                rows = sheet.get_all_values()
                headers = [str(value).strip() for value in rows[0]] if rows else []
                if 'Kelompok' not in headers or 'Koordinat' not in headers:
                    return jsonify(message='Kolom Kelompok dan Koordinat wajib tersedia di sheet CCTV.'), 400
                group_column, coordinate_column = headers.index('Kelompok'), headers.index('Koordinat') + 1
                updates = [{'range': rowcol_to_a1(index, coordinate_column), 'values': [[f'{lat:.7f}, {lng:.7f}']]}
                           for index, row in enumerate(rows[1:], 2)
                           if group and len(row) > group_column and row[group_column].strip() == group]
                if not updates:
                    return jsonify(message='Kelompok tidak ditemukan di sheet CCTV.'), 400
                sheet.batch_update(updates, value_input_option='RAW')
            return jsonify(status='success')
        except Exception:
            app.logger.exception('Unable to save CCTV coordinates')
            return jsonify(message='Gagal menyimpan lokasi. Silakan coba lagi.'), 503
