import unittest
from unittest.mock import patch, MagicMock
from flask import Flask
from disaster_enso import parse_weekly, register_enso_routes

TEXT = '''Weekly SST data starts week centered on 2Sept1981
                Nino1+2      Nino3        Nino34        Nino4
  Week          SST SSTA     SST SSTA     SST SSTA     SST SSTA
 02SEP1981     20.6-0.1     24.8-0.1     26.5-0.2     28.3-0.3
 09SEP1981     20.1-0.6     24.7-0.2     26.5 0.1     28.4-0.2
'''


class EnsoTests(unittest.TestCase):
    def test_column_and_centered_date(self):
        data = parse_weekly(TEXT)
        self.assertEqual(data['value'], 0.1)
        self.assertEqual(data['series'][0]['value'], -0.2)
        self.assertEqual(data['periodDate'], '1981-09-09')
        self.assertEqual(data['periodType'], 'week-centered')

    def test_invalid_response_not_neutral(self):
        for text in ('<html>Unavailable</html>', TEXT.replace('26.5 0.1', 'missing'), TEXT.replace('09SEP1981', '02SEP1981')):
            with self.assertRaises(ValueError):
                parse_weekly(text)

    def test_cache_and_expired_error(self):
        app = Flask(__name__)
        register_enso_routes(app)
        response = MagicMock()
        response.status = 200
        response.read.return_value = TEXT.encode()
        response.__enter__.return_value = response
        with patch('disaster_enso.urlopen', return_value=response) as upstream, patch('disaster_enso.time.monotonic', return_value=0):
            client = app.test_client()
            self.assertEqual(client.get('/api/disaster/enso').status_code, 200)
            self.assertEqual(client.get('/api/disaster/enso').status_code, 200)
            self.assertEqual(upstream.call_count, 1)
        with patch('disaster_enso.time.monotonic', return_value=21601), patch('disaster_enso.urlopen', side_effect=OSError('offline')):
            self.assertEqual(client.get('/api/disaster/enso').status_code, 502)


if __name__ == '__main__':
    unittest.main()
