"""Shared group locations; only a signed Daniel session may change them."""
import math
import threading
from flask import g, jsonify, request
from gspread.exceptions import WorksheetNotFound
from dashboard_auth import require_dashboard_session


def register_cctv_map(app, workbook, load_cameras):
    lock = threading.Lock()

    def locations_sheet(create=False):
        try:
            return workbook.worksheet('CCTVMap')
        except WorksheetNotFound:
            if not create:
                return None
            sheet = workbook.add_worksheet(title='CCTVMap', rows=1000, cols=3)
            sheet.append_row(['Kelompok', 'Latitude', 'Longitude'])
            return sheet

    @app.get('/api/cctv-map')
    def read_cctv_map():
        try:
            sheet = locations_sheet()
            return jsonify(status='success', data=sheet.get_all_records() if sheet else [])
        except Exception:
            app.logger.exception('Unable to read CCTVMap')
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
            groups = {str(row.get('Kelompok', '')).strip() for row in load_cameras()}
            if not group or group not in groups:
                return jsonify(message='Kelompok tidak ditemukan di sheet CCTV.'), 400
            with lock:
                sheet = locations_sheet(create=True)
                rows = sheet.get_all_values()
                row_number = next((index for index, row in enumerate(rows[1:], 2) if row and row[0].strip() == group), None)
                if row_number:
                    sheet.update(range_name=f'A{row_number}:C{row_number}', values=[[group, lat, lng]], value_input_option='RAW')
                else:
                    sheet.append_row([group, lat, lng], value_input_option='RAW')
            return jsonify(status='success')
        except Exception:
            app.logger.exception('Unable to save CCTVMap')
            return jsonify(message='Gagal menyimpan lokasi. Silakan coba lagi.'), 503
