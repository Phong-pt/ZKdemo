"""Durable request metadata; disclosed identity values stay in memory only."""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import sqlite3
import time


class RequestStore:
    def __init__(self, path=None):
        self.path = Path(path or os.environ.get(
            "VERIFIER_REQUESTS_DB", Path(__file__).resolve().parents[1] / "issuer" / "verification_requests.sqlite3"
        ))

    @contextmanager
    def connect(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(self.path)
        db.execute("CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, owner TEXT NOT NULL, data TEXT NOT NULL)")
        db.execute("CREATE INDEX IF NOT EXISTS requests_owner ON requests(owner)")
        try:
            with db:
                yield db
        finally:
            db.close()

    def save(self, session):
        data = dict(session)
        if data.get("result"):
            data["disclosed_attrs"] = data.get("disclosed_attrs", list(data["result"]["revealed"]))
            data["result"] = {"verified": data["result"]["verified"], "revealed": {}}
        with self.connect() as db:
            db.execute("INSERT INTO requests VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
                       (data["id"], data["owner_id"], json.dumps(data)))

    def _decode(self, row):
        if row is None:
            return None
        data = json.loads(row[0])
        if data["status"] == "pending" and time.time() >= data["expires_at"]:
            data["status"] = "expired"
            self.save(data)
        return data

    def get(self, session_id):
        with self.connect() as db:
            row = db.execute("SELECT data FROM requests WHERE id=?", (session_id,)).fetchone()
        return self._decode(row)

    def list_for(self, owner):
        with self.connect() as db:
            rows = db.execute("SELECT data FROM requests WHERE owner=?", (owner,)).fetchall()
        return sorted((self._decode(row) for row in rows), key=lambda s: s["created_at"], reverse=True)

    def clear(self):
        with self.connect() as db:
            db.execute("DELETE FROM requests")
