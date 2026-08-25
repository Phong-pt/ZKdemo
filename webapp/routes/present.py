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


@router.get("/issuer/cred-def")
def public_cred_def():
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
        return wallet_core.create_presentation(
            credential, attributes, ls, cred_def, presentation_request
        )
    except (ValueError, KeyError) as exc:
        raise HTTPException(400, f"Không tạo được bằng chứng: {exc}") from exc
