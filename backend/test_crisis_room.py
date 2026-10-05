import json
import os
import unittest
from unittest.mock import Mock, patch

from flask import Flask
from werkzeug.security import generate_password_hash
from dashboard_auth import register_dashboard_auth
from crisis_room import SignalingRoom, register_crisis_room


class CrisisAuthTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {'DASHBOARD_SESSION_SECRET': 'test-secret-' * 4,
                                     'CRISIS_ASTINA_PASSWORD_HASH': generate_password_hash('test-password')})
        env.start()
        self.addCleanup(env.stop)
        self.creator = Mock()
        self.app = Flask(__name__)
        register_dashboard_auth(self.app, lambda: [{'USERNAME': 'viewer', 'PASSWORD': 'viewer-password'}], self.creator)
        self.app.get('/api/admin-test')(lambda: 'private')
        self.client = self.app.test_client()

    def test_astina_is_scoped_and_refreshable_without_sheet_or_firebase(self):
        response = self.client.post('/api/login', json={'username': 'Astina', 'password': 'test-password'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['user']['role'], 'crisis_broadcaster')
        self.assertIsNone(response.json['expiresAt'])
        headers = {'Authorization': 'Bearer ' + response.json['sessionToken']}
        self.assertEqual(self.client.get('/api/session', headers=headers).status_code, 200)
        self.assertEqual(self.client.get('/api/session/refresh', headers=headers).status_code, 200)
        self.assertEqual(self.client.get('/api/firebase-token', headers=headers).status_code, 403)
        self.assertEqual(self.client.get('/api/admin-test', headers=headers).status_code, 403)
        self.creator.assert_not_called()
        self.assertEqual(self.client.post('/api/login', json={'username': 'Astina', 'password': 'wrong'}).status_code, 401)

    def test_viewer_cannot_refresh_broadcaster_session(self):
        token = self.client.post('/api/login', json={'username': 'viewer', 'password': 'viewer-password'}).json['sessionToken']
        self.assertEqual(self.client.get('/api/session/refresh', headers={'Authorization': 'Bearer ' + token}).status_code, 403)

    def test_sheet_astina_never_gets_admin_role(self):
        from dashboard_auth import officer_identity
        user = officer_identity([{'USERNAME': 'Astina', 'PASSWORD': 'p', 'ROLE': 'admin'}], 'Astina', 'p')
        self.assertEqual(user['role'], 'crisis_broadcaster')

    def test_preexisting_astina_session_is_downgraded_to_broadcaster(self):
        from dashboard_auth import session_serializer
        token = session_serializer().dumps({'username': 'Astina', 'email': '', 'role': 'admin'})
        headers = {'Authorization': 'Bearer ' + token}
        self.assertEqual(self.client.get('/api/session', headers=headers).json['user']['role'], 'crisis_broadcaster')
        self.assertEqual(self.client.get('/api/firebase-token', headers=headers).status_code, 403)

    def test_astina_session_does_not_expire_after_multiple_days(self):
        from dashboard_auth import session_serializer
        with patch('itsdangerous.timed.time.time', return_value=1000):
            token = session_serializer().dumps({'username': 'Astina', 'email': '', 'role': 'crisis_broadcaster'})
        headers = {'Authorization': 'Bearer ' + token}
        self.assertEqual(self.client.get('/api/session', headers=headers).status_code, 200)
        self.assertEqual(self.client.get('/api/session', headers={'Authorization': 'Bearer forged'}).status_code, 401)


class RoomTests(unittest.TestCase):
    def setUp(self):
        self.room = SignalingRoom()
        self.broadcast = Mock()
        self.viewer = Mock()
        self.other = Mock()
        self.bid = self.room.join(self.broadcast, True)
        self.vid = self.room.join(self.viewer, False)
        self.oid = self.room.join(self.other, False)

    def messages(self, socket):
        return [json.loads(call.args[0]) for call in socket.send.call_args_list]

    def test_start_stop_and_disconnect_inform_all_viewers(self):
        self.room.handle(self.vid, {'type': 'start'})
        self.assertFalse(self.room.live)
        self.room.handle(self.bid, {'type': 'start'})
        self.assertTrue(self.room.live)
        joined = [message['peer'] for message in self.messages(self.broadcast) if message['type'] == 'viewer-joined']
        self.assertCountEqual(joined, [self.vid, self.oid])
        self.room.handle(self.bid, {'type': 'stop'})
        self.assertEqual(self.messages(self.viewer)[-1], {'type': 'status', 'live': False})
        self.room.handle(self.bid, {'type': 'start'})
        self.room.leave(self.bid)
        self.assertFalse(self.room.live)
        self.assertIsNone(self.room.broadcaster)
        self.assertEqual(self.messages(self.other)[-1]['live'], False)

    def test_signals_are_targeted_and_viewers_cannot_offer(self):
        self.room.handle(self.bid, {'type': 'start'})
        self.viewer.reset_mock()
        self.other.reset_mock()
        self.room.handle(self.bid, {'type': 'offer', 'peer': self.vid, 'call': 'one', 'sdp': 'video-sdp'})
        self.assertEqual(self.messages(self.viewer), [{'type': 'offer', 'peer': self.bid, 'call': 'one', 'sdp': 'video-sdp'}])
        self.other.send.assert_not_called()
        self.broadcast.reset_mock()
        self.room.handle(self.vid, {'type': 'offer', 'peer': self.bid, 'call': 'forged', 'sdp': 'bad'})
        self.broadcast.send.assert_not_called()
        self.room.handle(self.vid, {'type': 'answer', 'peer': self.bid, 'call': 'one', 'sdp': 'answer'})
        self.assertEqual(self.messages(self.broadcast)[-1]['type'], 'answer')

    def test_heartbeat_rejoin_and_single_broadcaster(self):
        self.room.handle(self.vid, {'type': 'ping'})
        self.assertEqual(self.messages(self.viewer)[-1], {'type': 'pong'})
        second = Mock()
        self.assertIsNone(self.room.join(second, True))
        self.assertEqual(self.messages(second)[0]['type'], 'error')
        self.room.handle(self.bid, {'type': 'start'})
        self.broadcast.reset_mock()
        self.room.handle(self.vid, {'type': 'request-offer'})
        self.assertEqual(self.messages(self.broadcast), [{'type': 'viewer-joined', 'peer': self.vid}])


class WebSocketAuthorizationTests(unittest.TestCase):
    def test_viewer_cannot_request_broadcast_and_bad_origin_is_rejected(self):
        app = Flask(__name__)
        # Capture the registered handler so it can be exercised without a network.
        with patch('crisis_room.Sock') as sock:
            handlers = []
            sock.return_value.route.side_effect = lambda path: lambda handler: handlers.append(handler) or handler
            register_crisis_room(app)
        socket = Mock()
        with app.test_request_context('/api/crisis-room/ws', headers={'Origin': 'https://untrusted.example'}):
            handlers[0](socket)
            socket.receive.assert_not_called()
        socket.reset_mock()
        socket.receive.return_value = json.dumps({'type': 'auth', 'mode': 'broadcast', 'token': 'viewer-token'})
        with app.test_request_context('/api/crisis-room/ws', headers={'Origin': 'http://localhost:3000'}), patch('crisis_room.decode_dashboard_session', return_value={'username': 'viewer', 'role': ''}):
            handlers[0](socket)
        self.assertEqual(json.loads(socket.send.call_args.args[0])['type'], 'forbidden')

    def test_origin_rejection_reports_configuration_instead_of_silent_disconnect(self):
        app = Flask(__name__)
        with patch('crisis_room.Sock') as sock:
            handlers = []
            sock.return_value.route.side_effect = lambda path: lambda handler: handlers.append(handler) or handler
            register_crisis_room(app)
        socket = Mock()
        with patch.dict(os.environ, {'CRISIS_ALLOWED_ORIGINS': 'https://dashboard.example/'}), app.test_request_context('/api/crisis-room/ws', headers={'Origin': 'https://other.example'}):
            handlers[0](socket)
        self.assertEqual(json.loads(socket.send.call_args.args[0])['code'], 'origin-not-allowed')
        socket.close.assert_called_with(reason=1008, message='Origin not allowed')
        socket.receive.assert_not_called()

    def test_same_origin_and_loopback_frontends_work_without_extra_configuration(self):
        app = Flask(__name__)
        with patch('crisis_room.Sock') as sock:
            handlers = []
            sock.return_value.route.side_effect = lambda path: lambda handler: handlers.append(handler) or handler
            register_crisis_room(app)
        for origin in ['https://pikdashboard.vercel.app', 'http://127.0.0.1:3000', 'http://localhost']:
            socket = Mock()
            socket.receive.return_value = json.dumps({'type': 'auth', 'mode': 'viewer', 'token': 'forged'})
            from itsdangerous import BadSignature
            with patch.dict(os.environ, {'CRISIS_ALLOWED_ORIGINS': ''}), app.test_request_context('/api/crisis-room/ws', headers={'Origin': origin}), patch('crisis_room.decode_dashboard_session', side_effect=BadSignature('forged')):
                handlers[0](socket)
            self.assertEqual(json.loads(socket.send.call_args.args[0])['type'], 'unauthorized')

    def test_server_exception_reports_failure_without_leaking_secrets(self):
        app = Flask(__name__)
        with patch('crisis_room.Sock') as sock:
            handlers = []
            sock.return_value.route.side_effect = lambda path: lambda handler: handlers.append(handler) or handler
            register_crisis_room(app)
        socket = Mock()
        socket.receive.return_value = json.dumps({'type': 'auth', 'mode': 'viewer', 'token': 'secret-token'})
        with app.test_request_context('/api/crisis-room/ws', headers={'Origin': 'http://localhost:3000'}), patch('crisis_room.decode_dashboard_session', side_effect=RuntimeError('private-secret')):
            handlers[0](socket)
        message = json.loads(socket.send.call_args.args[0])
        self.assertEqual(message['code'], 'signaling-unavailable')
        self.assertNotIn('private-secret', json.dumps(message))


if __name__ == '__main__':
    unittest.main()
