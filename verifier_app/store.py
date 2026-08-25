"""In-memory session store for the staff-facing status page — same style as
issuer.py's _pending_nonces / verifier.py's own _pending_sessions. This is
a SEPARATE dict from verifier.verifier's internal _pending_sessions: that
one tracks the actual cryptographic challenge/nonce state consumed by
verify_presentation; this one tracks UI-facing status for polling.
"""

import time

# n_v -> {"revealed_attrs", "status": "waiting"|"done"|"rejected",
#         "result": dict|None, "expires": float}
_sessions: dict[str, dict] = {}


def prune() -> None:
    now = time.time()
    for key in [k for k, v in _sessions.items() if v["expires"] < now]:
        del _sessions[key]


def create(n_v: str, revealed_attrs: list[str], ttl: float) -> None:
    _sessions[n_v] = {
        "revealed_attrs": revealed_attrs,
        "status": "waiting",
        "result": None,
        "expires": time.time() + ttl,
    }


def get(n_v: str) -> dict | None:
    prune()
    return _sessions.get(n_v)


def resolve(n_v: str, ok: bool, result: dict | None) -> None:
    """Idempotent on purpose: once a session leaves "waiting", further calls
    are no-ops. routes.py already serializes this per n_v with a lock, but
    keeping this defensive means a resolved result can never be clobbered
    even if something else calls resolve() without holding that lock."""
    session = _sessions.get(n_v)
    if session is None or session["status"] != "waiting":
        return
    session["status"] = "done" if ok else "rejected"
    session["result"] = result
