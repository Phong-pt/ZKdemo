"""Signed session cookies: user_id + expiry, HMAC-SHA256, no server-side
session store needed. Format: base64url(payload_json) + "." + base64url(mac).

The signing key is generated once with secrets.token_bytes and cached on
disk (webapp/data/session_secret.txt) purely so sessions survive a dev
server restart — it is not committed (see .gitignore).
"""

import base64
import hashlib
import hmac
import json
import secrets
import time

from . import config


def _load_or_create_secret() -> bytes:
    if config.SESSION_SECRET_FILE.exists():
        return bytes.fromhex(config.SESSION_SECRET_FILE.read_text().strip())
    secret = secrets.token_bytes(32)
    config.SESSION_SECRET_FILE.write_text(secret.hex())
    return secret


_SECRET = _load_or_create_secret()


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    padding = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + padding)


def create_session_cookie(user_id: str) -> str:
    payload = json.dumps(
        {"user_id": user_id, "exp": time.time() + config.SESSION_TTL_SECONDS}
    ).encode("utf-8")
    mac = hmac.new(_SECRET, payload, hashlib.sha256).digest()
    return _b64url_encode(payload) + "." + _b64url_encode(mac)


def verify_session_cookie(cookie_value: str) -> str | None:
    try:
        payload_b64, mac_b64 = cookie_value.split(".", 1)
        payload = _b64url_decode(payload_b64)
        mac = _b64url_decode(mac_b64)
    except (ValueError, TypeError):
        return None

    expected_mac = hmac.new(_SECRET, payload, hashlib.sha256).digest()
    if not hmac.compare_digest(mac, expected_mac):
        return None

    try:
        data = json.loads(payload)
    except ValueError:
        return None

    if data.get("exp", 0) < time.time():
        return None

    return data.get("user_id")
