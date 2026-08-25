"""Screens [5]/[6]: QR handoff to a phone, "capture" the CCCD, confirm the
recognized fields.

There is no real OCR/MRZ engine wired in — issuer/issuer.py's EKYC_DB has
exactly one seed record for this whole demo, so "recognition" here just
returns that record's fields. It is simulated on purpose (see the honesty
note on screen [3] in prompt-webapp-wallet.md: "Demo mô phỏng"), not a stub
for a real integration that got skipped.

Photos are read into memory and never touch disk, so there is nothing to
delete afterwards — the deletion requirement in Part A.2 is satisfied by
simply not persisting them in the first place.
"""

import io
import secrets
import time

import qrcode
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import Response as FastAPIResponse

from issuer.issuer import EKYC_DB

from .. import config
from .auth import get_current_user_id

router = APIRouter(tags=["capture"])

# capture_id -> {"user_id", "status", "result": dict|None, "expires": float}
_sessions: dict[str, dict] = {}


def _prune() -> None:
    now = time.time()
    for key in [k for k, v in _sessions.items() if v["expires"] < now]:
        del _sessions[key]


def _get_session(capture_id: str) -> dict:
    _prune()
    session = _sessions.get(capture_id)
    if session is None:
        raise HTTPException(404, "Phiên quét đã hết hạn hoặc không tồn tại.")
    return session


@router.post("/api/capture/session")
def create_capture_session(user_id: str = Depends(get_current_user_id)):
    _prune()
    capture_id = secrets.token_urlsafe(16)
    _sessions[capture_id] = {
        "user_id": user_id,
        "status": "waiting",
        "result": None,
        "expires": time.time() + config.CAPTURE_TTL_SECONDS,
    }
    return {
        "capture_id": capture_id,
        "capture_url": f"{config.PUBLIC_BASE_URL}/capture/{capture_id}",
        "expires_in": config.CAPTURE_TTL_SECONDS,
    }


@router.get("/api/capture/{capture_id}/qr.png")
def capture_qr(capture_id: str, user_id: str = Depends(get_current_user_id)):
    session = _get_session(capture_id)
    if session["user_id"] != user_id:
        raise HTTPException(403, "Phiên quét không thuộc về bạn.")

    url = f"{config.PUBLIC_BASE_URL}/capture/{capture_id}"
    img = qrcode.make(url, box_size=8, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return FastAPIResponse(content=buf.getvalue(), media_type="image/png")


@router.get("/api/capture/{capture_id}/status")
def capture_status(capture_id: str):
    session = _get_session(capture_id)
    return {"status": session["status"]}


@router.post("/api/capture/{capture_id}/opened")
def capture_opened(capture_id: str):
    session = _get_session(capture_id)
    if session["status"] == "waiting":
        session["status"] = "opened"
    return {"status": session["status"]}


@router.post("/api/capture/{capture_id}/photos")
async def capture_photos(capture_id: str, front: UploadFile, back: UploadFile):
    session = _get_session(capture_id)
    session["status"] = "capturing"

    # Read into memory, never write to disk; bytes fall out of scope (and get
    # GC'd) as soon as this function returns — nothing left to clean up.
    await front.read()
    await back.read()

    session["status"] = "processing"

    # Simulated OCR: always "recognizes" the one seeded demo record.
    seed = EKYC_DB[0]
    session["result"] = {
        "cccd": seed["cccd"],
        "name": seed["name"],
        "dob": seed["dob"],
        "nationality": seed["nationality"],
        "address": seed["address"],
    }
    session["status"] = "done"

    return {"status": "done"}


@router.get("/api/capture/{capture_id}/result")
def capture_result(capture_id: str, user_id: str = Depends(get_current_user_id)):
    session = _get_session(capture_id)
    if session["user_id"] != user_id:
        raise HTTPException(403, "Phiên quét không thuộc về bạn.")
    if session["status"] != "done" or session["result"] is None:
        raise HTTPException(409, "Chưa có kết quả nhận diện.")
    return session["result"]


@router.post("/api/capture/{capture_id}/confirm")
def capture_confirm(capture_id: str, attributes: dict, user_id: str = Depends(get_current_user_id)):
    session = _get_session(capture_id)
    if session["user_id"] != user_id:
        raise HTTPException(403, "Phiên quét không thuộc về bạn.")

    required = {"cccd", "name", "dob", "nationality", "address"}
    if set(attributes.keys()) != required:
        raise HTTPException(400, "Thiếu hoặc thừa trường thông tin.")

    del _sessions[capture_id]  # confirmed — the capture session's job is done
    return {"attributes": attributes}
