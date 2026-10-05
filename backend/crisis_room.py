"""Single-room, single-process signaling. No video passes through this service."""
import json
import os
import threading
import uuid

from flask import request
from flask_sock import Sock
from itsdangerous import BadSignature
from dashboard_auth import decode_dashboard_session, is_crisis_broadcaster


class SignalingRoom:
    def __init__(self):
        self.lock = threading.RLock()
        self.clients = {}
        self.broadcaster = None
        self.live = False

    def send(self, client_id, message):
        client = self.clients.get(client_id)
        if client:
            try:
                client['socket'].send(json.dumps(message))
            except Exception:
                # The receive loop handles removal; one dead viewer must not
                # interrupt the broadcast or another viewer's signaling.
                pass

    def status(self):
        for client_id in list(self.clients):
            self.send(client_id, {'type': 'status', 'live': self.live})

    def join(self, socket, broadcaster):
        with self.lock:
            if broadcaster and self.broadcaster:
                socket.send(json.dumps({'type': 'error', 'code': 'broadcaster-busy', 'message': 'Broadcaster sudah terhubung. Menunggu koneksi sebelumnya selesai.'}))
                return None
            client_id = uuid.uuid4().hex
            self.clients[client_id] = {'socket': socket, 'broadcaster': broadcaster}
            if broadcaster:
                self.broadcaster = client_id
            self.send(client_id, {'type': 'ready', 'id': client_id, 'live': self.live})
            if not broadcaster and self.live:
                self.send(self.broadcaster, {'type': 'viewer-joined', 'peer': client_id})
            return client_id

    def leave(self, client_id):
        with self.lock:
            self.clients.pop(client_id, None)
            if client_id == self.broadcaster:
                self.broadcaster = None
                self.live = False
                self.status()
            elif self.broadcaster:
                self.send(self.broadcaster, {'type': 'viewer-left', 'peer': client_id})

    def handle(self, client_id, message):
        with self.lock:
            client = self.clients.get(client_id)
            if not client:
                return
            kind = message.get('type')
            if kind == 'ping':
                self.send(client_id, {'type': 'pong'})
            elif kind in ('start', 'stop') and client_id == self.broadcaster:
                self.live = kind == 'start'
                self.status()
                if self.live:
                    for peer, info in list(self.clients.items()):
                        if not info['broadcaster']:
                            self.send(client_id, {'type': 'viewer-joined', 'peer': peer})
            elif kind == 'request-offer' and not client['broadcaster'] and self.live:
                self.send(self.broadcaster, {'type': 'viewer-joined', 'peer': client_id})
            elif kind in ('offer', 'answer', 'ice') and self.live:
                peer = message.get('peer')
                target = self.clients.get(peer)
                if not target or target['broadcaster'] == client['broadcaster']:
                    return
                if kind == 'offer' and not client['broadcaster']:
                    return
                if kind == 'answer' and client['broadcaster']:
                    return
                call = message.get('call')
                if not isinstance(call, str) or len(call) > 100:
                    return
                payload = {'type': kind, 'peer': client_id, 'call': call}
                if kind == 'ice':
                    payload['candidate'] = message.get('candidate')
                else:
                    sdp = message.get('sdp')
                    if not isinstance(sdp, str) or len(sdp) > 60000:
                        return
                    payload['sdp'] = sdp
                self.send(peer, payload)


def register_crisis_room(app):
    app.config['SOCK_SERVER_OPTIONS'] = {'ping_interval': 25, 'max_message_size': 65536}
    sock = Sock(app)
    room = SignalingRoom()

    @sock.route('/api/crisis-room/ws')
    def signaling(socket):
        origins = {value.strip() for value in os.environ.get('CRISIS_ALLOWED_ORIGINS', 'http://localhost:3000').split(',') if value.strip()}
        if request.headers.get('Origin') not in origins:
            socket.close(reason=1008, message='Origin not allowed')
            return
        client_id = None
        token = None
        try:
            raw = socket.receive(timeout=10)
            message = json.loads(raw or '{}')
            if not isinstance(message, dict) or message.get('type') != 'auth':
                return
            token = message.get('token', '')
            user = decode_dashboard_session(token)
            broadcaster = is_crisis_broadcaster(user)
            if message.get('mode') == 'broadcast' and not broadcaster:
                socket.send(json.dumps({'type': 'forbidden'}))
                return
            if broadcaster and message.get('mode') != 'broadcast':
                socket.send(json.dumps({'type': 'forbidden'}))
                return
            client_id = room.join(socket, broadcaster)
            if not client_id:
                return
            while True:
                raw = socket.receive(timeout=65)
                if raw is None:
                    break
                message = json.loads(raw)
                if not isinstance(message, dict):
                    break
                if message.get('type') == 'auth':
                    refreshed = decode_dashboard_session(message.get('token', ''))
                    if refreshed != user:
                        break
                    token = message['token']
                else:
                    decode_dashboard_session(token)
                    room.handle(client_id, message)
        except BadSignature:
            try:
                socket.send(json.dumps({'type': 'unauthorized'}))
            except Exception:
                pass
        except Exception:
            # Disconnects and malformed messages never expose credentials.
            pass
        finally:
            if client_id:
                room.leave(client_id)
            socket.close()

    return room
