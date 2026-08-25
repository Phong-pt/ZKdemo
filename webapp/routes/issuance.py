"""Screen [7]/[9]: runs the real issuance flow in a background thread (the
issuer's 596-bit prime generation in step 4 is genuinely slow and must not
block the asyncio event loop — see prompt-webapp-wallet.md Task C.5) and
streams progress to the browser over SSE.

Error codes from issuance_service map to the exact Vietnamese messages
specified in Task C.6's table.
"""

import json
import time
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from ..issuance_service import IssuanceError, run_issuance
from .auth import get_current_user_id

router = APIRouter(prefix="/api/issuance", tags=["issuance"])

_executor = ThreadPoolExecutor(max_workers=4)

# user_id -> {"step": int, "done": bool, "error": str|None, "finished": bool}
_progress: dict[str, dict] = {}

ERROR_MESSAGES = {
    "no_match": "Không tìm thấy thông tin trong cơ sở dữ liệu. Kiểm tra lại các trường đã nhập.",
    "already_issued": "CCCD này đã được cấp credential trước đó.",
    "bad_proof": "Lỗi xác thực. Vui lòng thử lại.",
    "bad_signature": "Chữ ký nhận được không hợp lệ. Vui lòng thử lại.",
    "unexpected": "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.",
}

REQUIRED_ATTRS = {"cccd", "name", "dob", "nationality", "address"}


def _run(user_id: str, attributes: dict) -> None:
    def on_progress(step: int, done: bool, error: str | None, tech: dict | None) -> None:
        prev_tech = _progress.get(user_id, {}).get("tech", {})
        _progress[user_id] = {
            "step": step,
            "done": done,
            "error": error,
            "finished": False,
            "tech": {**prev_tech, **(tech or {})},
        }

    try:
        run_issuance(user_id, attributes, on_progress)
        _progress[user_id] = {**_progress[user_id], "finished": True}
    except IssuanceError as exc:
        current = _progress.get(user_id, {"step": 1, "tech": {}})
        _progress[user_id] = {
            "step": current["step"],
            "done": False,
            "error": exc.code,
            "finished": True,
            "tech": current.get("tech", {}),
        }
    except Exception:  # noqa: BLE001 — genuinely unexpected, still must reach the client
        _progress[user_id] = {"step": 0, "done": False, "error": "unexpected", "finished": True, "tech": {}}


@router.post("/start")
def start_issuance(attributes: dict, user_id: str = Depends(get_current_user_id)):
    if set(attributes.keys()) != REQUIRED_ATTRS:
        raise HTTPException(400, "Thiếu hoặc thừa trường thông tin.")

    _progress[user_id] = {"step": 0, "done": False, "error": None, "finished": False, "tech": {}}
    _executor.submit(_run, user_id, dict(attributes))
    return {"ok": True}


@router.get("/stream")
def stream_issuance(user_id: str = Depends(get_current_user_id)):
    def event_source():
        last = None
        # Bounded to 5 minutes of polling so a forgotten open tab can't
        # pin a thread/connection open forever.
        deadline = time.time() + 300
        while time.time() < deadline:
            state = _progress.get(
                user_id, {"step": 0, "done": False, "error": None, "finished": False, "tech": {}}
            )
            if state != last:
                payload = dict(state)
                if state.get("error"):
                    payload["message"] = ERROR_MESSAGES.get(state["error"], ERROR_MESSAGES["unexpected"])
                yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
                last = state
            if state.get("finished"):
                return
            time.sleep(0.2)

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
