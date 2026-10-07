import os
import unittest
from unittest.mock import MagicMock, patch
from flask import Flask
from dashboard_auth import session_serializer
from cctv_map import register_cctv_map


class CctvMapTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'DASHBOARD_SESSION_SECRET': 'x' * 40})
        self.env.start()
        self.addCleanup(self.env.stop)
        app = Flask(__name__)
        self.workbook = MagicMock()
        self.sheet = self.workbook.worksheet.return_value
        self.sheet.get_all_values.return_value = [['Kelompok', 'Koordinat', 'Detail'], ['Gate', '-6, 106', 'A'], ['Other', '', 'B'], ['Gate', '', 'C']]
        self.sheet.get_all_records.return_value = [{'Kelompok': 'Gate', 'Latitude': -6, 'Longitude': 106}]
        register_cctv_map(app, self.workbook, lambda: [{'Kelompok': 'Gate', 'Koordinat': '-6, 106'}, {'Kelompok': 'Gate', 'Koordinat': ''}])
        self.client = app.test_client()

    def headers(self, name):
        return {'Authorization': 'Bearer ' + session_serializer().dumps({'username': name})}

    def test_save_is_authorized_by_signed_identity(self):
        body = {'Kelompok': 'Gate', 'Latitude': -6.1, 'Longitude': 106.7}
        self.assertEqual(self.client.put('/api/cctv-map', json=body).status_code, 401)
        self.assertEqual(self.client.put('/api/cctv-map', json=body, headers=self.headers('Other')).status_code, 403)
        self.sheet.batch_update.assert_not_called()
        self.assertEqual(self.client.put('/api/cctv-map', json=body, headers=self.headers('Daniel')).status_code, 200)
        self.sheet.batch_update.assert_called_once_with([
            {'range': 'B2', 'values': [['-6.1000000, 106.7000000']]},
            {'range': 'B4', 'values': [['-6.1000000, 106.7000000']]},
        ], value_input_option='RAW')
        self.assertEqual(self.client.get('/api/cctv-map').json['data'][0]['Kelompok'], 'Gate')

    def test_invalid_locations_are_rejected(self):
        for body in ({'Kelompok': 'Gate', 'Latitude': 100, 'Longitude': 106}, {'Kelompok': 'Unknown', 'Latitude': -6, 'Longitude': 106}):
            self.assertEqual(self.client.put('/api/cctv-map', json=body, headers=self.headers('Daniel')).status_code, 400)
        self.sheet.batch_update.assert_not_called()


if __name__ == '__main__':
    unittest.main()
