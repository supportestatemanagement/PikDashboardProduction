import unittest
from flask import Flask
from pump_rainfall import parse_rainfall, register_rainfall_routes


class RainfallTests(unittest.TestCase):
    values = [['Tanggal', 'Jam', 'Hujan (mm)', 'Status'],
              ['2026-10-06', '11:00', '0.00', 'Cerah'],
              ['2026-10-06', '9:55', '2,5', 'Hujan'],
              ['2026-10-06', '10:00', '', ''],
              ['2026-10-05', '23:55', '1', 'Hujan']]

    def test_numeric_hour_order_zero_and_blanks(self):
        rows = parse_rainfall(self.values)
        self.assertEqual([row['time'] for row in rows], ['23:55', '09:55', '10:00', '11:00'])
        self.assertEqual([row['value'] for row in rows], [1, 2.5, None, 0])

    def test_date_filter(self):
        app = Flask(__name__)
        register_rainfall_routes(app, lambda: self.values)
        client = app.test_client()
        response = client.get('/api/pump-rainfall?startDate=2026-10-06&endDate=2026-10-06')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json['data']), 3)
        self.assertEqual(client.get('/api/pump-rainfall?startDate=bad&endDate=bad').status_code, 400)
