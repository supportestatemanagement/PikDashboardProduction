"""Defaults also apply when Render's start command is just gunicorn app:app."""
import os

# All sockets must share the same in-memory room. Each open socket occupies
# a thread, so the synchronous single-thread worker cannot serve this feature.
workers = 1
worker_class = 'gthread'
threads = 100
timeout = 120
bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"
