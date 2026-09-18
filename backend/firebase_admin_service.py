"""Privileged Firebase operations. This module runs only on Render."""
import hashlib
import json
import os
import threading

import firebase_admin
from firebase_admin import auth, credentials

_lock = threading.Lock()
_app = None


def get_firebase_admin():
    global _app
    with _lock:
        if _app is None:
            raw = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON')
            if not raw:
                raise RuntimeError('Firebase Admin is not configured')
            account = json.loads(raw)
            if not isinstance(account, dict) or account.get('type') != 'service_account':
                raise ValueError('Invalid service account')
            _app = firebase_admin.initialize_app(credentials.Certificate(account), name='vehicle-dashboard')
    return _app


def create_dashboard_token(user):
    username = user['username']
    uid = 'dashboard_' + username
    if len(uid) > 128:
        uid = 'dashboard_' + hashlib.sha256(username.encode('utf-8')).hexdigest()
    claims = {'role': 'dashboard', 'username': username}
    # "email" is an OIDC reserved claim. Keep sheet metadata under a custom name.
    if user.get('email'):
        claims['officer_email'] = user['email']
    if user.get('role'):
        claims['officer_role'] = user['role']
    token = auth.create_custom_token(uid, claims, app=get_firebase_admin())
    return token.decode('utf-8') if isinstance(token, bytes) else token, uid
