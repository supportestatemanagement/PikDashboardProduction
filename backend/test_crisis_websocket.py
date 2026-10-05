"""Local wire-level signaling check, independent of Sheets and OCR services."""
import json
import os
import threading
import unittest
from unittest.mock import patch

from flask import Flask
from simple_websocket import Client
from werkzeug.serving import make_server
from dashboard_auth import session_serializer
from crisis_room import register_crisis_room


class WebSocketWireTests(unittest.TestCase):
    def test_authenticated_broadcast_to_two_viewers_and_heartbeat(self):
        with patch.dict(os.environ, {'DASHBOARD_SESSION_SECRET': 'test-secret-' * 4,
                                     'CRISIS_ALLOWED_ORIGINS': 'http://localhost:3000'}):
            app = Flask(__name__)
            register_crisis_room(app)
            server = make_server('127.0.0.1', 0, app, threaded=True)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            connections = []
            try:
                url = f'ws://127.0.0.1:{server.server_port}/api/crisis-room/ws'

                def connect(username, role, mode):
                    socket = Client(url, headers={'Origin': 'http://localhost:3000'})
                    connections.append(socket)
                    socket.send(json.dumps({'type': 'auth', 'mode': mode,
                                            'token': session_serializer().dumps({'username': username, 'role': role})}))
                    message = json.loads(socket.receive(timeout=3))
                    self.assertEqual(message['type'], 'ready')
                    return socket, message['id']

                broadcaster, bid = connect('Astina', 'crisis_broadcaster', 'broadcast')
                first, fid = connect('first', '', 'viewer')
                second, sid = connect('second', '', 'viewer')
                broadcaster.send(json.dumps({'type': 'start'}))
                self.assertTrue(json.loads(broadcaster.receive(timeout=3))['live'])
                joined = [json.loads(broadcaster.receive(timeout=3))['peer'] for _ in range(2)]
                self.assertCountEqual(joined, [fid, sid])
                self.assertTrue(json.loads(first.receive(timeout=3))['live'])
                self.assertTrue(json.loads(second.receive(timeout=3))['live'])
                broadcaster.send(json.dumps({'type': 'offer', 'peer': fid, 'call': 'grid', 'sdp': 'video-sdp'}))
                offer = json.loads(first.receive(timeout=3))
                self.assertEqual(offer['peer'], bid)
                self.assertEqual(offer['sdp'], 'video-sdp')
                first.send(json.dumps({'type': 'answer', 'peer': bid, 'call': 'grid', 'sdp': 'answer-sdp'}))
                self.assertEqual(json.loads(broadcaster.receive(timeout=3))['type'], 'answer')
                second.send(json.dumps({'type': 'ping'}))
                self.assertEqual(json.loads(second.receive(timeout=3)), {'type': 'pong'})
                broadcaster.send(json.dumps({'type': 'stop'}))
                self.assertFalse(json.loads(first.receive(timeout=3))['live'])
                self.assertFalse(json.loads(second.receive(timeout=3))['live'])
            finally:
                for socket in connections:
                    if socket.connected:
                        socket.close()
                server.shutdown()
                server.server_close()
                thread.join(timeout=3)


if __name__ == '__main__':
    unittest.main()
