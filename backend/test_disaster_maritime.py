import json
import unittest
from unittest.mock import patch, MagicMock
from flask import Flask
from disaster_maritime import register_maritime_routes


class MaritimeTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        register_maritime_routes(app)
        self.client = app.test_client()
        self.payload = {'code': 'XJ003', 'name': 'Pelabuhan Muara Angke',
                        'issued': '2026-09-23 12:00 UTC', 'valid_from': '2026-09-24 00:00 UTC',
                        'valid_to': '2026-09-27 00:00 UTC', 'forecast_day1': [{'time': '2026-09-24 00:00 UTC'}]}

    def upstream(self):
        response = MagicMock()
        response.__enter__.return_value = response
        response.status = 200
        response.headers = {'Content-Type': 'application/json'}
        response.read.return_value = json.dumps(self.payload).encode()
        return response

    @patch('disaster_maritime.urlopen')
    def test_cache_and_allowlist(self, fetch):
        fetch.return_value = self.upstream()
        self.assertEqual(self.client.get('/api/disaster/maritime/unknown').status_code, 404)
        first = self.client.get('/api/disaster/maritime/pik1')
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json['data']['code'], 'XJ003')
        self.assertEqual(self.client.get('/api/disaster/maritime/pik1').status_code, 200)
        fetch.assert_called_once()
        self.assertIn('slug=pelabuhan-muara-angke', fetch.call_args.args[0].full_url)

    @patch('disaster_maritime.urlopen')
    def test_wrong_reference_and_upstream_failure(self, fetch):
        fetch.return_value = self.upstream()
        self.assertEqual(self.client.get('/api/disaster/maritime/pik2').status_code, 502)
        fetch.side_effect = OSError('Offline')
        self.assertEqual(self.client.get('/api/disaster/maritime/pik1').status_code, 502)

    @patch('disaster_maritime.time.monotonic')
    @patch('disaster_maritime.urlopen')
    def test_expired_cache_never_masquerades_as_fresh(self, fetch, clock):
        clock.return_value = 0
        fetch.return_value = self.upstream()
        self.assertEqual(self.client.get('/api/disaster/maritime/pik1').status_code, 200)
        clock.return_value = 1801
        fetch.side_effect = OSError('Offline')
        self.assertEqual(self.client.get('/api/disaster/maritime/pik1').status_code, 502)


if __name__ == '__main__':
    unittest.main()
