import base64
import hashlib
import hmac
import json
import os
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError

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

    def metered_env(self):
        return patch.dict(os.environ, {'CRISIS_TURN_PROVIDER': 'metered',
            'CRISIS_TURN_METERED_DOMAIN': 'https://office-app.metered.live/',
            'CRISIS_TURN_METERED_APP_ID': 'app-123',
            'CRISIS_TURN_METERED_SECRET_KEY': 'private+secret&value',
            'CRISIS_TURN_FORCE_RELAY': 'false'})

    def fresh_cache(self):
        return patch('crisis_turn._metered_cache', {'key': None, 'active': None, 'pending': None, 'draft': None, 'retryAt': 0, 'error': None})

    def upstream(self, payload):
        stream = Mock(read=Mock(return_value=json.dumps(payload).encode()))
        return Mock(__enter__=Mock(return_value=stream), __exit__=Mock(return_value=False))

    def create_payload(self):
        return {'username': 'temporary', 'password': 'temporary-password',
                'apiKey': 'credential-api-key', 'expiryInSeconds': 3600}

    def ice_payload(self):
        return [{'urls': 'stun:stun.relay.example:80', 'extra': 'discard'},
                {'urls': ['turn:relay.example:80', 'turns:relay.example:443?transport=tcp'],
                 'username': 'temporary', 'credential': 'temporary-password',
                 'secretKey': 'hidden-extra'}]

    def test_metered_creates_expiring_credentials_caches_and_waits_for_propagation(self):
        with self.metered_env(), self.fresh_cache(), patch('crisis_turn.time.time', return_value=1000) as clock, patch('crisis_turn.urlopen', side_effect=[self.upstream(self.create_payload()), self.upstream(self.ice_payload())]) as call:
            response = self.client.get('/api/crisis-room/ice-servers', headers=self.headers())
            self.assertEqual(response.status_code, 503)
            self.assertIn('2 menit', response.json['message'])
            create, fetch = [args.args[0] for args in call.call_args_list]
            self.assertEqual(create.method, 'POST')
            self.assertEqual(create.full_url, 'https://office-app.metered.live/api/v1/turn/credential?secretKey=private%2Bsecret%26value')
            self.assertEqual(json.loads(create.data), {'expiryInSeconds': 3600, 'label': 'crisis-room-app-123'})
            self.assertEqual(fetch.full_url, 'https://office-app.metered.live/api/v1/turn/credentials?apiKey=credential-api-key')
            clock.return_value = 1119
            self.assertEqual(self.client.get('/api/crisis-room/ice-servers', headers=self.headers()).status_code, 503)
            clock.return_value = 1120
            for username, role in [('Astina', 'crisis_broadcaster'), ('viewer', 'operator')]:
                response = self.client.get('/api/crisis-room/ice-servers', headers=self.headers(username, role))
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json['expiresAt'], 4600000)
                self.assertEqual(response.json['iceTransportPolicy'], 'all')
                self.assertEqual(response.json['iceServers'][-1]['credential'], 'temporary-password')
                for hidden in ['private+secret', 'credential-api-key', 'secretKey', 'extra', 'app-123']:
                    self.assertNotIn(hidden, response.get_data(as_text=True))
                self.assertEqual(response.headers['Cache-Control'], 'no-store')
            self.assertEqual(call.call_count, 2)

    def test_metered_rotation_keeps_old_credential_until_new_one_propagates(self):
        replacement = [{'urls': 'turn:relay.example:80', 'username': 'new', 'credential': 'new-password'}]
        with self.metered_env(), self.fresh_cache(), patch('crisis_turn.time.time', return_value=1000) as clock, patch('crisis_turn.urlopen', side_effect=[self.upstream(self.create_payload()), self.upstream(self.ice_payload()), self.upstream(self.create_payload()), self.upstream(replacement)]) as call:
            self.assertEqual(self.client.get('/api/crisis-room/ice-servers', headers=self.headers()).status_code, 503)
            clock.return_value = 1120
            self.assertEqual(ice_configuration()['iceServers'][-1]['username'], 'temporary')
            clock.return_value = 4300
            self.assertEqual(ice_configuration()['expiresAt'], 4600000)
            clock.return_value = 4419
            self.assertEqual(ice_configuration()['iceServers'][-1]['username'], 'temporary')
            clock.return_value = 4420
            self.assertEqual(ice_configuration()['iceServers'][-1]['username'], 'new')
            self.assertEqual(ice_configuration()['expiresAt'], 7900000)
            self.assertEqual(call.call_count, 4)

    def test_metered_failed_ice_fetch_reuses_created_credential_on_retry(self):
        with self.metered_env(), self.fresh_cache(), patch('crisis_turn.time.time', return_value=1000) as clock, patch('crisis_turn.urlopen', side_effect=[self.upstream(self.create_payload()), TimeoutError('secret'), self.upstream(self.ice_payload())]) as call:
            self.assertEqual(self.client.get('/api/crisis-room/ice-servers', headers=self.headers()).status_code, 503)
            self.assertEqual(self.client.get('/api/crisis-room/ice-servers', headers=self.headers()).status_code, 503)
            self.assertEqual(call.call_count, 2)
            clock.return_value = 1030
            self.assertEqual(self.client.get('/api/crisis-room/ice-servers', headers=self.headers()).status_code, 503)
            self.assertEqual([args.args[0].method for args in call.call_args_list], ['POST', 'GET', 'GET'])

    def test_metered_renewal_failure_keeps_valid_credentials_and_never_returns_expired_ones(self):
        with self.metered_env(), self.fresh_cache(), patch('crisis_turn.time.time', return_value=1000) as clock, patch('crisis_turn.urlopen', side_effect=[self.upstream(self.create_payload()), self.upstream(self.ice_payload()), TimeoutError('private-secret'), TimeoutError('private-secret')]):
            self.assertEqual(self.client.get('/api/crisis-room/ice-servers', headers=self.headers()).status_code, 503)
            clock.return_value = 1120
            self.assertEqual(ice_configuration()['expiresAt'], 4600000)
            clock.return_value = 4300
            self.assertEqual(ice_configuration()['expiresAt'], 4600000)
            clock.return_value = 4600
            self.assertEqual(self.client.get('/api/crisis-room/ice-servers', headers=self.headers()).status_code, 503)

    def test_metered_maintenance_starts_only_once_and_only_for_metered(self):
        from crisis_turn import start_metered_maintenance
        with patch('crisis_turn._metered_worker_started', False), patch('crisis_turn.threading.Thread') as worker:
            start_metered_maintenance()
            worker.assert_not_called()
            with self.metered_env():
                start_metered_maintenance()
                start_metered_maintenance()
            worker.assert_called_once()
            self.assertTrue(worker.call_args.kwargs['daemon'])
            worker.return_value.start.assert_called_once()

    def test_metered_errors_are_safe_and_debug_relay_is_explicit(self):
        with self.metered_env(), self.fresh_cache():
            for failure in [HTTPError('https://private-secret', 401, 'private-secret', {}, None), TimeoutError('private-secret')]:
                with patch('crisis_turn.urlopen', side_effect=failure):
                    response = self.client.get('/api/crisis-room/ice-servers', headers=self.headers())
                self.assertEqual(response.status_code, 503)
                self.assertIn('Metered:', response.json['message'])
                self.assertNotIn('private-secret', response.get_data(as_text=True))
            with patch.dict(os.environ, {'CRISIS_TURN_FORCE_RELAY': 'true'}), patch('crisis_turn.metered_servers', return_value=([{'urls': ['turn:relay.example'], 'username': 'user', 'credential': 'pass'}], 9999999999)):
                self.assertEqual(ice_configuration()['iceTransportPolicy'], 'relay')

    def test_metered_rejects_invalid_host_and_malformed_response(self):
        with self.metered_env(), self.fresh_cache(), patch.dict(os.environ, {'CRISIS_TURN_METERED_DOMAIN': 'https://attacker.example'}), patch('crisis_turn.urlopen') as call:
            self.assertEqual(self.client.get('/api/crisis-room/ice-servers', headers=self.headers()).status_code, 503)
            call.assert_not_called()
        for payload in [{}, [], [{'urls': 'https://bad', 'username': 'u', 'credential': 'p'}], [{'urls': 'turn:relay.example'}]]:
            with self.metered_env(), self.fresh_cache(), patch('crisis_turn.urlopen', side_effect=[self.upstream(self.create_payload()), self.upstream(payload)]):
                response = self.client.get('/api/crisis-room/ice-servers', headers=self.headers())
                self.assertEqual(response.status_code, 503)


if __name__ == '__main__':
    unittest.main()
