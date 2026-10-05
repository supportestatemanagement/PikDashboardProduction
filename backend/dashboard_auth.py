"""Dashboard authentication: keep OFFICER validation, issue a signed session."""
import os
import time
from functools import wraps

from flask import g, jsonify, request
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from werkzeug.security import check_password_hash

BROADCASTER_ROLE = 'crisis_broadcaster'


def is_crisis_broadcaster(user):
    return user.get('username') == 'Astina' and user.get('role') == BROADCASTER_ROLE


def decode_dashboard_session(token):
    # Verify the signature before deciding whether this identity expires.
    payload = session_serializer().loads(token)
    if not isinstance(payload, dict) or not payload.get('username'):
        raise BadSignature('Invalid identity')
    if payload['username'] == 'Astina':
        payload['role'] = BROADCASTER_ROLE
    else:
        session_serializer().loads(token, max_age=session_lifetime())
    return payload


def session_serializer():
    secret = os.environ.get('DASHBOARD_SESSION_SECRET', '')
    if len(secret) < 32:
        raise RuntimeError('Dashboard session signing is not configured')
    return URLSafeTimedSerializer(secret, salt='dashboard-session-v1')


def session_lifetime():
    return max(60, int(os.environ.get('DASHBOARD_SESSION_TTL_SECONDS', '28800')))


def officer_identity(records, username, password):
    for row in records:
        fields = {str(key).strip().lower(): value for key, value in row.items()}
        # Preserve the existing NAMA LENGKAP login identifier; support USERNAME
        # for sheets using that schema instead. Do not change password matching.
        name = fields.get('nama lengkap', fields.get('username', ''))
        if str(name) == username and str(fields.get('password', '')) == password:
            return {
                'username': str(name),
                'email': str(fields.get('email') or ''),
                'role': BROADCASTER_ROLE if str(name) == 'Astina' else str(fields.get('role') or fields.get('level') or ''),
            }
    return None


def require_dashboard_session(handler):
    @wraps(handler)
    def authenticated(*args, **kwargs):
        authorization = request.headers.get('Authorization', '')
        if not authorization.startswith('Bearer '):
            return jsonify({'status': 'unauthorized'}), 401
        try:
            payload = decode_dashboard_session(authorization[7:])
        except (BadSignature, SignatureExpired):
            return jsonify({'status': 'unauthorized'}), 401
        except Exception:
            return jsonify({'status': 'error', 'message': 'Authentication unavailable'}), 503
        g.dashboard_user = payload
        return handler(*args, **kwargs)
    return authenticated


def register_dashboard_auth(app, load_officers, create_firebase_token):
    @app.before_request
    def restrict_broadcaster():
        # Existing public read APIs retain their contract. Signed broadcaster
        # sessions are never accepted outside the explicitly scoped endpoints.
        allowed = {'/api/login', '/api/session', '/api/session/refresh', '/api/crisis-room/ws', '/api/crisis-room/ice-servers'}
        authorization = request.headers.get('Authorization', '')
        if request.path.startswith('/api/') and request.path not in allowed and authorization.startswith('Bearer '):
            try:
                if is_crisis_broadcaster(decode_dashboard_session(authorization[7:])):
                    return jsonify({'status': 'forbidden'}), 403
            except (BadSignature, SignatureExpired):
                return jsonify({'status': 'unauthorized'}), 401

    @app.after_request
    def private_auth_responses(response):
        if request.path in ('/api/login', '/api/session', '/api/session/refresh', '/api/firebase-token'):
            response.headers['Cache-Control'] = 'no-store'
        return response

    @app.post('/api/login')
    def login():
        data = request.get_json(silent=True) or {}
        if not isinstance(data, dict) or not isinstance(data.get('username'), str) or not isinstance(data.get('password'), str):
            return jsonify({'status': 'failed'}), 400
        if not data['username'] or not data['password']:
            return jsonify({'status': 'failed'}), 401
        try:
            astina_hash = os.environ.get('CRISIS_ASTINA_PASSWORD_HASH', '')
            if data['username'] == 'Astina' and astina_hash:
                user = {'username': 'Astina', 'email': '', 'role': BROADCASTER_ROLE} if check_password_hash(astina_hash, data['password']) else None
            else:
                user = officer_identity(load_officers(), data['username'], data['password'])
            if user is None:
                return jsonify({'status': 'failed'}), 401
            token = session_serializer().dumps(user)
            return jsonify({'status': 'success', 'user': user, 'sessionToken': token,
                            'expiresAt': None if is_crisis_broadcaster(user) else (int(time.time()) + session_lifetime()) * 1000})
        except Exception:
            return jsonify({'status': 'error', 'message': 'Login service unavailable'}), 503

    @app.get('/api/session')
    @require_dashboard_session
    def dashboard_session():
        return jsonify({'user': g.dashboard_user})

    @app.get('/api/session/refresh')
    @require_dashboard_session
    def refresh_broadcaster_session():
        if not is_crisis_broadcaster(g.dashboard_user):
            return jsonify({'status': 'forbidden'}), 403
        return jsonify({'user': g.dashboard_user, 'sessionToken': session_serializer().dumps(g.dashboard_user),
                        'expiresAt': None})

    @app.get('/api/firebase-token')
    @require_dashboard_session
    def firebase_token():
        try:
            user = g.dashboard_user
            token, uid = create_firebase_token(user)
            return jsonify({'firebaseToken': token, 'firebaseUid': uid,
                            'username': user['username'], 'email': user['email']})
        except Exception:
            # Never expose SDK exception text, private keys, or Google credentials.
            return jsonify({'status': 'error', 'message': 'Realtime authentication unavailable'}), 503
