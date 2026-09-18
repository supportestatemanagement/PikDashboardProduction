import os
import unittest
from unittest.mock import Mock, patch
from flask import Flask
from dashboard_auth import register_dashboard_auth
from firebase_admin_service import create_dashboard_token


class DashboardAuthTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {'DASHBOARD_SESSION_SECRET': 'test-secret-' * 4})
        env.start()
        self.addCleanup(env.stop)
        self.records = [{'NAMA LENGKAP': 'ADMIN01', 'PASSWORD': 'sheet-password',
                         'EMAIL': 'admin@example.com', 'LEVEL': 'supervisor'}]
        self.creator = Mock(return_value=('custom-token', 'dashboard_ADMIN01'))
        app = Flask(__name__)
        register_dashboard_auth(app, lambda: self.records, self.creator)
        self.client = app.test_client()

    def login(self):
        return self.client.post('/api/login', json={'username': 'ADMIN01', 'password': 'sheet-password'})

    def test_login_preserves_sheet_validation_and_never_returns_password(self):
        response = self.login()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['user'], {'username': 'ADMIN01', 'email': 'admin@example.com', 'role': 'supervisor'})
        self.assertNotIn('password', response.get_data(as_text=True).lower())
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        self.assertEqual(self.client.post('/api/login', json={'username': 'ADMIN01', 'password': 'wrong'}).status_code, 401)
        self.assertEqual(self.client.post('/api/login', json=[]).status_code, 400)
        self.creator.assert_not_called()

    def test_username_schema_is_supported(self):
        self.records[0] = {'username': 'ADMIN01', 'password': 'sheet-password'}
        self.assertEqual(self.login().status_code, 200)

    def test_anonymous_forged_and_expired_sessions_cannot_mint(self):
        self.assertEqual(self.client.get('/api/firebase-token').status_code, 401)
        self.assertEqual(self.client.get('/api/firebase-token', headers={'Authorization': 'Bearer forged'}).status_code, 401)
        with patch('itsdangerous.timed.time.time', return_value=1000):
            token = self.login().json['sessionToken']
        self.assertEqual(self.client.get('/api/firebase-token', headers={'Authorization': 'Bearer ' + token}).status_code, 401)
        self.creator.assert_not_called()

    def test_token_endpoint_uses_server_identity_and_sanitizes_errors(self):
        headers = {'Authorization': 'Bearer ' + self.login().json['sessionToken']}
        self.assertEqual(self.client.get('/api/session', headers=headers).status_code, 200)
        response = self.client.get('/api/firebase-token?username=ATTACKER', headers=headers)
        self.assertEqual(response.json['firebaseUid'], 'dashboard_ADMIN01')
        self.creator.assert_called_once_with({'username': 'ADMIN01', 'email': 'admin@example.com', 'role': 'supervisor'})
        self.creator.side_effect = RuntimeError('PRIVATE KEY CONTENT')
        failed = self.client.get('/api/firebase-token', headers=headers)
        self.assertEqual(failed.status_code, 503)
        self.assertNotIn('PRIVATE', failed.get_data(as_text=True))

    def test_claims_are_allowlisted_and_admin_failure_does_not_break_login(self):
        with patch('firebase_admin_service.get_firebase_admin', return_value='app'), patch('firebase_admin_service.auth.create_custom_token', return_value=b'token') as mint:
            self.assertEqual(create_dashboard_token({'username': 'ADMIN01', 'email': 'admin@example.com', 'role': 'operator', 'password': 'secret'}), ('token', 'dashboard_ADMIN01'))
            claims = mint.call_args.args[1]
            self.assertEqual(claims['role'], 'dashboard')
            self.assertEqual(claims['officer_email'], 'admin@example.com')
            self.assertNotIn('password', claims)
            self.assertNotIn('email', claims)
        self.creator.side_effect = RuntimeError('missing credentials')
        self.assertEqual(self.login().status_code, 200)


if __name__ == '__main__':
    unittest.main()
