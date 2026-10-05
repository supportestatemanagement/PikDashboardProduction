"""Run locally; paste the printed hash into Render, never the plaintext password."""
from getpass import getpass
from werkzeug.security import generate_password_hash

if __name__ == '__main__':
    password = getpass('Password baru untuk Astina (minimal 12 karakter): ')
    if len(password) < 12 or password != getpass('Ulangi password: '):
        raise SystemExit('Password terlalu pendek atau tidak cocok.')
    print('CRISIS_ASTINA_PASSWORD_HASH=' + generate_password_hash(password, method='scrypt'))
