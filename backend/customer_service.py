from flask import jsonify
import threading
import time

COLUMNS = ['Project Code', 'Created At', 'Unit Code', 'Requester Name', 'Source',
           'Service Type', 'Category Name', 'Sub Category Name', 'SLA Days',
           'Assign To', 'Response By', 'Response Status', 'Handling Status']


def register_customer_service_routes(app, load_records):
    cache = {'rows': None, 'expires': 0}
    lock = threading.Lock()

    @app.get('/api/customer-service-data')
    def customer_service_data():
        try:
            # Avoid repeated downloads of the 42k-row sheet across dashboard users.
            with lock:
                if cache['rows'] is None or time.monotonic() >= cache['expires']:
                    records = load_records()
                    projected = [{column: str(row[column]).strip() if row.get(column) is not None else '' for column in COLUMNS} for row in records]
                    cache['rows'] = [row for row in projected if any(row.values())]
                    cache['expires'] = time.monotonic() + 60
                rows = cache['rows']
            response = jsonify({'status': 'success', 'data': rows})
            response.headers['Cache-Control'] = 'no-store'
            return response
        except Exception:
            app.logger.exception('Unable to load CustomerRelation')
            return jsonify({'status': 'error', 'message': 'Unable to load Customer Service records.'}), 500
