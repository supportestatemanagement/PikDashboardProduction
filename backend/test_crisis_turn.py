import base64
import hashlib
import hmac
import json
import os
import unittest
from unittest.mock import Mock, patch

from flask import Flask
from dashboard_auth import register_dashboard_auth, session_serializer
from crisis_turn import ice_configuration, register_crisis_turn


class TurnCredentialTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {'DASHBOARD_SESSION_SECRET': 'test-dashboard-secret-' * 3,
            'CRISIS_TURN_PROVIDER': 'coturn', 'CRISIS_TURN_URLS': '', 'CRISIS_TURN_SHARED_SECRET': '',
            'CRISIS_TURN_TTL_SECONDS': '3600', 'CRISIS_STUN_URLS': 'stun:test.example:3478'})
        env.start()
        self.addCleanup(env.stop)
        self.app = Flask(__name__)
        register_dashboard_auth(self.app, lambda: [], Mock())
        register_crisis_turn(self.app)
        self.client = self.app.test_client()

    def headers(self, username='Astina', role='crisis_broadcaster'):
        return {'Authorization': 'Bearer ' + session_serializer().dumps({'username': username, 'role': role})}

    def test_anonymous_and_forged_requests_cannot_issue_turn_credentials(self):
        for headers in [{}, {'Authorization': 'Bearer forged'}]:
            self.assertEqual(self.client.get('/api/crisis-room/ice-servers', headers=headers).status_code, 401)

    def test_absent_turn_configuration_is_explicit_and_works_for_both_roles(self):
        for username, role in [('Astina', 'crisis_broadcaster'), ('viewer', 'operator')]:
            response = self.client.get('/api/crisis-room/ice-servers', headers=self.headers(username, role))
            self.assertEqual(response.status_code, 200)
            self.assertFalse(response.json['turnConfigured'])
            self.assertEqual(response.headers['Cache-Control'], 'no-store')

    def test_coturn_issues_expiring_hmac_credentials_without_exposing_secret_or_identity(self):
        secret = 'private-turn-shared-secret-' * 2
        with patch.dict(os.environ, {'CRISIS_TURN_URLS': 'turns:relay.example:443?transport=tcp,turn:relay.example:3478?transport=udp', 'CRISIS_TURN_SHARED_SECRET': secret}), patch('crisis_turn.time.time', return_value=1000):
            config = ice_configuration()
        relay = config['iceServers'][-1]
        self.assertTrue(config['turnConfigured'])
        self.assertEqual(relay['username'].split(':')[0], '4600')
        expected = base64.b64encode(hmac.new(secret.encode(), relay['username'].encode(), hashlib.sha1).digest()).decode()
        self.assertEqual(relay['credential'], expected)
        self.assertEqual(config['expiresAt'], 4600000)
        self.assertNotIn(secret, json.dumps(config))
        self.assertNotIn('Astina', relay['username'])

    def test_incomplete_or_invalid_turn_configuration_does_not_leak_secrets(self):
        for urls, secret in [('https://wrong.example', 'secret-value-' * 3), ('turn:relay.example:3478', '')]:
            with patch.dict(os.environ, {'CRISIS_TURN_URLS': urls, 'CRISIS_TURN_SHARED_SECRET': secret}):
                response = self.client.get('/api/crisis-room/ice-servers', headers=self.headers())
            self.assertEqual(response.status_code, 503)
            self.assertNotIn('secret-value', response.get_data(as_text=True))

    def test_cloudflare_key_stays_server_side_and_only_relay_credentials_are_returned(self):
        upstream = Mock()
        upstream.read.return_value = json.dumps({'iceServers': [
            {'urls': ['stun:upstream.example:3478']},
            {'urls': ['turns:relay.example:443?transport=tcp'], 'username': 'temporary-user', 'credential': 'temporary-password', 'extra': 'hidden'}
        ]}).encode()
        context = Mock()
        context.__enter__ = Mock(return_value=upstream)
        context.__exit__ = Mock(return_value=False)
        with patch.dict(os.environ, {'CRISIS_TURN_PROVIDER': 'cloudflare', 'CRISIS_TURN_CLOUDFLARE_KEY_ID': 'key-id', 'CRISIS_TURN_CLOUDFLARE_API_TOKEN': 'private-api-token'}), patch('crisis_turn.urlopen', return_value=context) as call:
            response = self.client.get('/api/crisis-room/ice-servers', headers=self.headers())
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json['turnConfigured'])
        self.assertEqual(response.json['iceServers'][-1]['credential'], 'temporary-password')
        self.assertNotIn('private-api-token', response.get_data(as_text=True))
        self.assertNotIn('extra', response.get_data(as_text=True))
        request = call.call_args.args[0]
        self.assertEqual(json.loads(request.data), {'ttl': 3600})
        self.assertEqual(request.headers['Authorization'], 'Bearer private-api-token')


if __name__ == '__main__':
    unittest.main()
