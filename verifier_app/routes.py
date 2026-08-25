"""API for the Verifier portal. Calls straight into verifier/verifier.py's
real create_presentation_request / verify_presentation — no proof logic
duplicated. The Issuer's public cred-def is fetched from the Holder wallet's
own public endpoint (GET /api/issuer/cred-def), mirroring how a real
deployment would fetch it from a public ledger/chain rather than trusting a
locally bundled copy.
"""

import io
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


@router.post("/api/check/{n_v}/submit")
def submit_check(n_v: str, body: dict):
    """Public, cross-origin: the wallet's browser POSTs the built
    presentation here directly."""
    session = store.get(n_v)
    if session is None:
        raise HTTPException(404, "Yêu cầu đã hết hạn.")
    if session["status"] != "waiting":
        # Already resolved (e.g. a retried request) — don't re-consume
        # verifier.verifier's one-shot session and flip a success to a
        # false rejection.
        return {"ok": session["status"] == "done"}

    presentation = body.get("presentation")
    if not isinstance(presentation, dict):
        raise HTTPException(400, "Thiếu presentation.")

    try:
        cred_def = _get_cred_def()
    except requests.RequestException as exc:
        raise HTTPException(502, f"Không lấy được cred-def từ ví: {exc}") from exc

    ok = verifier_core.verify_presentation(presentation, cred_def, n_v)
    revealed = presentation.get("revealed") or {}
    result = {k: v.get("raw") for k, v in revealed.items()} if ok else None

    store.resolve(n_v, ok, result)
    return {"ok": ok}
