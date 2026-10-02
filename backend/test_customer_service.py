import unittest
import gzip
import json
from unittest.mock import Mock
from flask import Flask
from customer_service import register_customer_service_routes


class CustomerServiceTests(unittest.TestCase):
    def test_compression_preserves_data_and_reuses_cached_response(self):
        app = Flask(__name__)
        loader = Mock(return_value=[{'Project Code': 'GIS', 'Requester Name': 'Example', 'SLA Days': 0}] * 100)
        register_customer_service_routes(app, loader)
        client = app.test_client()
        plain = client.get('/api/customer-service-data')
        compressed = client.get('/api/customer-service-data', headers={'Accept-Encoding': 'gzip, deflate'})
        self.assertEqual(compressed.headers['Content-Encoding'], 'gzip')
        self.assertIn('Accept-Encoding', compressed.headers['Vary'])
        self.assertEqual(json.loads(gzip.decompress(compressed.data)), plain.json)
        self.assertEqual(plain.json['data'][0]['SLA Days'], '0')
        self.assertLess(len(compressed.data), len(plain.data) / 4)
        refused = client.get('/api/customer-service-data', headers={'Accept-Encoding': 'gzip;q=0'})
        self.assertNotIn('Content-Encoding', refused.headers)
        loader.assert_called_once()

    def test_projects_required_columns_and_caches_sheet_read(self):
        app = Flask(__name__)
        loader = Mock(return_value=[{'Project Code': 'GIS', 'Unit Code': '001', 'Description': 'not needed'}, {}])
        register_customer_service_routes(app, loader)
        client = app.test_client()
        response = client.get('/api/customer-service-data')
        self.assertEqual(response.status_code, 200)
        rows = response.json['data']
        self.assertEqual(len(rows), 1)
        self.assertEqual(len(rows[0]), 13)
        self.assertEqual(rows[0]['Unit Code'], '001')
        self.assertNotIn('Description', rows[0])
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        client.get('/api/customer-service-data')
        loader.assert_called_once()

    def test_failure_does_not_cache_or_expose_internal_error(self):
        app = Flask(__name__)
        app.logger.disabled = True
        loader = Mock(side_effect=[RuntimeError('private detail'), []])
        register_customer_service_routes(app, loader)
        client = app.test_client()
        response = client.get('/api/customer-service-data')
        self.assertEqual(response.status_code, 500)
        self.assertNotIn('private detail', response.get_data(as_text=True))
        self.assertEqual(client.get('/api/customer-service-data').json['data'], [])


if __name__ == '__main__':
    unittest.main()
