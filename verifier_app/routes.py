"""API for the Verifier portal. Calls straight into verifier/verifier.py's
real create_presentation_request / verify_presentation — no proof logic
duplicated. The Issuer's public cred-def is fetched from the Holder wallet's
own public endpoint (GET /api/issuer/cred-def), mirroring how a real
deployment would fetch it from a public ledger/chain rather than trusting a
locally bundled copy.
"""

import io
import threading
import time
from urllib.parse import quote

import qrcode
import requests
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from verifier import verifier as verifier_core

from . import config, store

router = APIRouter()

ATTR_NAMES = ["cccd", "name", "dob", "nationality", "address"]

_cred_def_cache: dict = {"value": None, "fetched_at": 0.0}

# FastAPI runs sync `def` routes in a thread pool — a slow /submit (Render
# cold start on the wallet side, network hiccups) plus an impatient retry
# from the browser can land two concurrent submits for the same n_v. Without
# this, both could pass the "still waiting" check before either resolves,
# race inside verifier.verify_presentation's one-shot session pop, and the
# LOSING request's resolve() could overwrite an already-successful result.
# One lock per n_v, serializing just that request's critical section.
_submit_locks: dict[str, threading.Lock] = {}
_submit_locks_guard = threading.Lock()


def _lock_for(n_v: str) -> threading.Lock:
    with _submit_locks_guard:
        return _submit_locks.setdefault(n_v, threading.Lock())


def _get_cred_def() -> dict:
    now = time.time()
    if _cred_def_cache["value"] is None or now - _cred_def_cache["fetched_at"] > config.CRED_DEF_CACHE_SECONDS:
        resp = requests.get(f"{config.WALLET_APP_URL}/api/issuer/cred-def", timeout=10)
        resp.raise_for_status()
        _cred_def_cache["value"] = resp.json()
        _cred_def_cache["fetched_at"] = now
    return _cred_def_cache["value"]


@router.post("/api/check/create")
def create_check(body: dict):
    revealed_attrs = body.get("revealed_attrs")
    if not isinstance(revealed_attrs, list) or not revealed_attrs:
        raise HTTPException(400, "Chọn ít nhất một trường để yêu cầu.")
    if not set(revealed_attrs).issubset(ATTR_NAMES):
        raise HTTPException(400, "Trường không hợp lệ.")

    store.prune()
    request = verifier_core.create_presentation_request(revealed_attrs)
    n_v = request["nonce"]
    store.create(n_v, revealed_attrs, config.SESSION_TTL_SECONDS)

    wallet_link = (
        f"{config.WALLET_APP_URL}/present"
        f"?verifier={quote(config.PUBLIC_BASE_URL, safe='')}&n_v={n_v}"
    )
    return {"n_v": n_v, "expires_in": config.SESSION_TTL_SECONDS, "wallet_link": wallet_link}


@router.get("/api/check/{n_v}/qr.png")
def check_qr(n_v: str):
    session = store.get(n_v)
    if session is None:
        raise HTTPException(404, "Yêu cầu đã hết hạn.")
    wallet_link = (
        f"{config.WALLET_APP_URL}/present"
        f"?verifier={quote(config.PUBLIC_BASE_URL, safe='')}&n_v={n_v}"
    )
    img = qrcode.make(wallet_link, box_size=8, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")


@router.get("/api/check/{n_v}")
def get_check(n_v: str):
    """Public, cross-origin: the wallet's browser fetches this directly to
    know what's being asked before showing the consent screen."""
    session = store.get(n_v)
    if session is None:
        raise HTTPException(404, "Yêu cầu không tồn tại hoặc đã hết hạn.")
    return {"revealed_attrs": session["revealed_attrs"], "verifier_name": config.VERIFIER_NAME}


@router.get("/api/check/{n_v}/status")
def check_status(n_v: str):
    session = store.get(n_v)
    if session is None:
        raise HTTPException(404, "Yêu cầu không tồn tại hoặc đã hết hạn.")
    return {"status": session["status"], "result": session["result"]}


def _presentation_from_json_safe(p: dict) -> dict:
    """Reverses webapp/routes/present.py's _presentation_to_json_safe — the
    wallet sends every big-int field as a string specifically so the
    browser's JSON.parse/stringify round trip in between doesn't corrupt
    it; verify_presentation needs real Python ints for the modexp math."""
    return {
        "a_prime": int(p["a_prime"]),
        "c": int(p["c"]),
        "e_hat": int(p["e_hat"]),
        "v_hat": int(p["v_hat"]),
        "m_ls_hat": int(p["m_ls_hat"]),
        "m_hats": {k: int(v) for k, v in p["m_hats"].items()},
        "revealed": {
            k: {"raw": v["raw"], "encoded": int(v["encoded"])}
            for k, v in p["revealed"].items()
        },
    }


@router.post("/api/check/{n_v}/submit")
def submit_check(n_v: str, body: dict):
    """Public, cross-origin: the wallet's browser POSTs the built
    presentation here directly."""
    session = store.get(n_v)
    if session is None:
        raise HTTPException(404, "Yêu cầu đã hết hạn.")

    raw_presentation = body.get("presentation")
    if not isinstance(raw_presentation, dict):
        raise HTTPException(400, "Thiếu presentation.")
    try:
        presentation = _presentation_from_json_safe(raw_presentation)
    except (KeyError, ValueError, TypeError) as exc:
        raise HTTPException(400, f"Presentation không đúng định dạng: {exc}") from exc

    with _lock_for(n_v):
        session = store.get(n_v)
        if session is None:
            raise HTTPException(404, "Yêu cầu đã hết hạn.")
        if session["status"] != "waiting":
            # Already resolved by an earlier (possibly concurrent) submit
            # for this same n_v — don't re-consume verifier.verifier's
            # one-shot session and risk flipping a success to a rejection.
            return {"ok": session["status"] == "done"}

        try:
            cred_def = _get_cred_def()
        except requests.RequestException as exc:
            raise HTTPException(502, f"Không lấy được cred-def từ ví: {exc}") from exc

        ok = verifier_core.verify_presentation(presentation, cred_def, n_v)
        revealed = presentation.get("revealed") or {}
        result = {k: v.get("raw") for k, v in revealed.items()} if ok else None

        store.resolve(n_v, ok, result)
        return {"ok": ok}
