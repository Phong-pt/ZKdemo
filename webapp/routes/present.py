"""Lets a Holder respond to a presentation request from an independent
Verifier site (a separate app/deployment entirely — see the `verifier`
branch). Two things live here:

- GET /api/issuer/cred-def: public, no auth. Mirrors what a real chain/
  ledger would expose — anyone (including a Verifier service) can fetch the
  Issuer's schema/public key to check a proof against it.
- POST /api/present/build: builds the actual ZK presentation for the
  logged-in user's stored credential, calling straight into
  wallet.wallet.create_presentation (no proof logic duplicated here).
  The frontend then POSTs the result cross-origin to the Verifier itself —
  this service never talks to the Verifier directly.
"""

from fastapi import APIRouter, Depends, HTTPException

from issuer import issuer as issuer_core
from wallet import wallet as wallet_core

from .. import wallet_store
from .auth import get_current_user_id

router = APIRouter(prefix="/api", tags=["present"])


def _presentation_to_json_safe(p: dict) -> dict:
    """JavaScript's JSON.parse silently corrupts integers this large
    (a_prime/e_hat/v_hat/etc. run to hundreds or thousands of bits, way past
    IEEE 754 double precision's ~53-bit safe range) — they round to
    Infinity, which JSON.stringify then turns into null on the way back
    out. Every big-int field has to cross the browser as a string."""
    return {
        "a_prime": str(p["a_prime"]),
        "c": str(p["c"]),
        "e_hat": str(p["e_hat"]),
        "v_hat": str(p["v_hat"]),
        "m_ls_hat": str(p["m_ls_hat"]),
        "m_hats": {k: str(v) for k, v in p["m_hats"].items()},
        "revealed": {
            k: {"raw": v["raw"], "encoded": str(v["encoded"])}
            for k, v in p["revealed"].items()
        },
    }


@router.get("/issuer/cred-def")
def public_cred_def():
    """Fetched server-to-server by the Verifier (Python requests -> Python
    json), never by a browser — plain int JSON is fine here, no precision
    issue to guard against."""
    return issuer_core.get_public_cred_def()


@router.post("/present/build")
def build_presentation(body: dict, user_id: str = Depends(get_current_user_id)):
    n_v = body.get("n_v")
    revealed_attrs = body.get("revealed_attrs")
    if not n_v or not isinstance(revealed_attrs, list):
        raise HTTPException(400, "Thiếu n_v hoặc revealed_attrs.")

    credential = wallet_store.get_credential(user_id)
    attributes = wallet_store.get_attributes(user_id)
    if credential is None or attributes is None:
        raise HTTPException(404, "Bạn chưa có credential nào để trình diện.")

    ls = wallet_store.get_or_create_link_secret(user_id)
    cred_def = issuer_core.get_public_cred_def()
    presentation_request = {"nonce": n_v, "revealed_attrs": revealed_attrs}

    try:
        presentation = wallet_core.create_presentation(
            credential, attributes, ls, cred_def, presentation_request
        )
    except (ValueError, KeyError) as exc:
        raise HTTPException(400, f"Không tạo được bằng chứng: {exc}") from exc

    return _presentation_to_json_safe(presentation)
