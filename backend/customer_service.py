from flask import jsonify, request, Response
import gzip
import threading
import time

COLUMNS = ['Project Code', 'Created At', 'Unit Code', 'Requester Name', 'Source',
           'Service Type', 'Category Name', 'Sub Category Name', 'SLA Days',
           'Assign To', 'Response By', 'Response Status', 'Handling Status']


def register_customer_service_routes(app, load_records):
    cache = {'body': None, 'gzip': None, 'expires': 0}
    lock = threading.Lock()

    @app.get('/api/customer-service-data')
    def customer_service_data():
        try:
            # Avoid repeated downloads of the 42k-row sheet across dashboard users.
            with lock:
                if cache['body'] is None or time.monotonic() >= cache['expires']:
                    records = load_records()
                    projected = [{column: str(row[column]).strip() if row.get(column) is not None else '' for column in COLUMNS} for row in records]
                    rows = [row for row in projected if any(row.values())]
                    body = jsonify({'status': 'success', 'data': rows}).get_data()
                    compressed = gzip.compress(body, compresslevel=3, mtime=0)
                    cache['body'] = body
                    cache['gzip'] = compressed
                    cache['expires'] = time.monotonic() + 60
                use_gzip = request.accept_encodings['gzip'] > 0
                body = cache['gzip'] if use_gzip else cache['body']
            response = Response(body, mimetype='application/json')
            if use_gzip:
                response.headers['Content-Encoding'] = 'gzip'
            response.headers['Vary'] = 'Accept-Encoding'
            response.headers['Cache-Control'] = 'no-store'
            return response
        except Exception:
            app.logger.exception('Unable to load CustomerRelation')
            return jsonify({'status': 'error', 'message': 'Unable to load Customer Service records.'}), 500
