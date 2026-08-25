"""SQLite storage for the `users` table (Task C.1 in prompt-webapp-wallet.md).

Everything else short-lived (WebAuthn challenges, capture sessions) stays in
plain in-memory dicts inside the routes that own them — the same pattern
issuer.py and verifier.py already use for _pending_nonces / _pending_sessions.
"""

import sqlite3
import time
from contextlib import contextmanager

from . import config

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    credential_id BLOB NOT NULL,
    public_key BLOB NOT NULL,
    sign_count INTEGER NOT NULL DEFAULT 0,
    created_at REAL NOT NULL
);
"""


@contextmanager
def get_db():
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with get_db() as conn:
        conn.execute(_SCHEMA)


def get_user_by_email(email: str) -> sqlite3.Row | None:
    with get_db() as conn:
        return conn.execute(
            "SELECT * FROM users WHERE email = ?", (email,)
        ).fetchone()


def get_user_by_id(user_id: str) -> sqlite3.Row | None:
    with get_db() as conn:
        return conn.execute(
            "SELECT * FROM users WHERE user_id = ?", (user_id,)
        ).fetchone()


def create_user(user_id: str, email: str, credential_id: bytes, public_key: bytes) -> None:
    with get_db() as conn:
        conn.execute(
            "INSERT INTO users (user_id, email, credential_id, public_key, sign_count, created_at)"
            " VALUES (?, ?, ?, ?, 0, ?)",
            (user_id, email, credential_id, public_key, time.time()),
        )


def update_sign_count(user_id: str, sign_count: int) -> None:
    with get_db() as conn:
        conn.execute(
            "UPDATE users SET sign_count = ? WHERE user_id = ?", (sign_count, user_id)
        )
