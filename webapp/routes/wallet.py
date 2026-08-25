"""Screens [3]/[4]/[8]: wallet init and reading the issued credential back
for display. Never returns {a, e, v} to the frontend — those stay server-side,
only used internally when a presentation is built (out of scope here, see
prompt-webapp-wallet.md which stops at screen [8])."""

from fastapi import APIRouter, Depends, HTTPException

from .. import wallet_store
from .auth import get_current_user_id

router = APIRouter(prefix="/api/wallet", tags=["wallet"])

SCHEMA_NAME = "CCCD"
ISSUER_NAME = "Cục Cảnh sát QLHC về TTXH"


@router.post("/init")
def wallet_init(user_id: str = Depends(get_current_user_id)):
    # Sub-millisecond: generating a 256-bit link secret is not something to
    # fake a loading screen over (see the note in prompt-webapp-wallet.md B.2).
    wallet_store.get_or_create_link_secret(user_id)
    return {"ok": True}


@router.get("/credential")
def get_credential(user_id: str = Depends(get_current_user_id)):
    attributes = wallet_store.get_attributes(user_id)
    if attributes is None:
        raise HTTPException(404, "Chưa có credential nào.")

    return {
        "schema_name": SCHEMA_NAME,
        "issuer_name": ISSUER_NAME,
        "issued_at": wallet_store.credential_issued_at(user_id),
        "attributes": attributes,
    }
