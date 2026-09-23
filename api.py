import asyncio
from contextlib import asynccontextmanager
import os
import secrets
import shutil
import time
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import auth
import chain
import passkey
import issuance
import registry_publish
from auth import Account
from issuer import issuer
from wallet import wallet
from verifier import verifier

_registry_startup_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _registry_startup_task
    enabled = os.environ.get("AUTO_PUBLISH_REGISTRY", "true").strip().lower() not in {
        "0", "false", "no", "off"
    }
    configured = bool(os.environ.get("SEPOLIA_RPC_URL") and os.environ.get("ISSUER_PRIVATE_KEY"))
    if enabled and configured and registry_publish.needs_publish(recover_in_progress=True):
        # Submit the deployment in the background so Render's health check can serve while
        # Sepolia mines the contract, schema, and issuer public-key transactions.
        _registry_startup_task = asyncio.create_task(asyncio.to_thread(registry_publish.publish))
    yield


app = FastAPI(title="ZKP demo API", lifespan=lifespan)

SERVER_STARTED_AT = time.time()

# Nhật ký tạm để soi vì sao một thiết bị bị coi là chưa có ví: ghi lại vài lần gọi /api/me gần
# nhất kèm câu trả lời của máy chủ. Chỉ giữ 8 ký tự đầu của wallet_id (vốn đã là mã băm) để so
# xem hai thiết bị có đang vào cùng một ví hay không. Xoá đi khi đã tìm ra lỗi.
_recent_logins: list[dict] = []

STATIC_DIR = Path(__file__).resolve().parent / "static"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_session_connections: dict[str, list[WebSocket]] = {}
_flow_lock = issuance.lock
app.include_router(issuance.router)
_verification_requests: dict[str, dict] = {}


@app.websocket("/api/session/{session_id}/ws")
async def session_relay(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    peers = _session_connections.setdefault(session_id, [])
    peers.append(websocket)
    try:
        while True:
            message = await websocket.receive_text()
            for peer in list(peers):
                if peer is not websocket:
                    try:
                        await peer.send_text(message)
                    except (RuntimeError, WebSocketDisconnect):
                        if peer in peers:
                            peers.remove(peer)
    except WebSocketDisconnect:
        if websocket in peers:
            peers.remove(websocket)
        if not peers:
            _session_connections.pop(session_id, None)

def revealable_attrs() -> list[str]:
    """Thuộc tính verifier được phép hỏi — lấy từ schema issuer đã đăng ký trên chain, không phải
    từ một danh sách chép tay trong mã nguồn."""
    return chain.resolve_attributes()[0]


class IssueRequest(BaseModel):
    document_type: str = "nationalIdentity"
    cccd: str
    name: str
    dob: str
    sex: str
    nationality: str
    origin: str
    residence: str
    expiry: str


class VerifyRequest(BaseModel):
    revealed_attrs: list[str]


class VerifyResponse(BaseModel):
    verified: bool
    revealed: dict[str, str]


class VerifierLoginResponse(BaseModel):
    authorized: bool
    org_name: str | None
    email: str


@app.get("/api/config")
def get_config() -> dict:
    return {
        "google_client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),
        "verifier_domains": sorted(issuer.TRUSTED_VERIFIER_DOMAINS),
        # Gói free của Render không có ổ đĩa bền: mỗi lần deploy hoặc service ngủ dậy là ví,
        # passkey và cờ đã-cấp-credential ghi lúc chạy đều mất sạch, mọi tài khoản trở lại trạng
        # thái chưa có ví. Mốc này để đối chiếu khi thấy ví "tự dưng biến mất".
        "server_started_at": SERVER_STARTED_AT,
        "recent_logins": _recent_logins,
        "wallets_with_passkey": sum(
            1
            for directory in (
                wallet.WALLETS_DIR.iterdir() if wallet.WALLETS_DIR.is_dir() else []
            )
            if (directory / "passkey.json").exists()
        ),
    }


@app.get("/api/chain")
def chain_status() -> dict:
    return chain.status()


@app.get("/api/registry/schemas")
def registry_schemas() -> dict:
    try:
        return chain.list_registered_schemas()
    except chain.ChainNotConfigured as error:
        raise HTTPException(503, str(error)) from error
    except Exception:
        raise HTTPException(502, "Không thể đọc danh sách schema từ registry blockchain")


@app.get("/api/cred-def")
def get_cred_def() -> dict:
    return issuer.get_public_cred_def()


@app.get("/api/schema")
def active_schema() -> dict:
    """Khuôn mẫu thuộc tính mà verifier được phép hỏi, kèm nguồn đang dùng. Giao diện dựng danh
    sách claim từ đây, để schema issuer đã đăng ký trên chain là nguồn duy nhất thay vì một bản
    chép tay trong frontend."""
    try:
        attributes, source = chain.resolve_attributes()
    except Exception:
        # Chain đã cấu hình nhưng đọc không được: vẫn phải dựng được form, và nói thật là bản cục bộ.
        attributes, source = list(issuer.ATTRIBUTE_NAMES), "local"
    result = {"attributes": attributes, "source": source, "name": "nationalIdentity",
              "version": "1.0", "schema_id": None, "issuer": None}
    if source == "chain":
        schema = chain.get_schema()  # đã nằm trong cache sau resolve_attributes()
        result.update(name=schema["name"], version=schema["version"],
                      schema_id=schema["id"], issuer=schema["issuer"])
    return result


@app.get("/api/ekyc/lookup")
def ekyc_lookup(cccd: str, account: Account = Depends(auth.current_account)) -> dict[str, str]:
    """Mã QR in trên CCCD chỉ chứa số thẻ, họ tên, ngày sinh, giới tính và nơi thường trú — không
    có quê quán lẫn ngày hết hạn. Hai trường đó lấy từ hồ sơ issuer đang giữ thay vì trông chờ OCR
    đọc chữ trên ảnh. Các trường còn lại vẫn phải khớp đúng dữ liệu quét từ thẻ thì mới ký được,
    nên khai man tên hay ngày sinh của người khác vẫn bị từ chối như cũ."""
    record = issuer.find_by_cccd(cccd)
    if record is None:
        raise HTTPException(404, "Không tìm thấy hồ sơ căn cước cho số này")
    return {"origin": record["origin"], "expiry": record["expiry"]}


@app.get("/api/ekyc/demo-record")
def ekyc_demo_record(account: Account = Depends(auth.current_account)) -> dict[str, str]:
    """Một hồ sơ căn cước bất kỳ chưa được cấp credential, để mô phỏng bước quét thẻ bằng điện
    thoại khi thử demo trên một máy. Cơ sở dữ liệu này là dữ liệu giả lập và đã công khai trong
    danh-sach-cccd-demo.txt, nên ở đây không có dữ liệu thật nào bị lộ."""
    available = [record for record in issuer.EKYC_DB if not record["credential_issued"]]
    if not available:
        raise HTTPException(409, "Mọi hồ sơ căn cước mẫu đều đã được cấp credential; hãy reset demo")
    record = secrets.choice(available)
    return {name: record[name] for name in issuer.ATTRIBUTE_NAMES}


@app.post("/api/issue")
def issue_credential(body: IssueRequest, account: Account = Depends(auth.wallet_account)) -> dict:
    # Compatibility URL now enters the same approval queue; it cannot bypass the issuer.
    return issuance.submit(issuance.Submission(**body.model_dump()), account)


@app.post("/api/verify", response_model=VerifyResponse)
def verify(body: VerifyRequest, account: Account = Depends(auth.wallet_account)) -> VerifyResponse:
    with _flow_lock:
        return _verify(body, account.wallet_id)


def _verify(body: VerifyRequest, wallet_id: str) -> VerifyResponse:
    invalid = [a for a in body.revealed_attrs if a not in revealable_attrs()]
    if len(set(body.revealed_attrs)) != len(body.revealed_attrs):
        raise HTTPException(400, "Thuộc tính bị lặp")
    if invalid:
        raise HTTPException(400, f"Không hỗ trợ tiết lộ thuộc tính: {invalid}")

    credential = wallet.get_credential(wallet_id)
    identity = wallet.get_identity(wallet_id)
    if credential is None or identity is None:
        raise HTTPException(400, "Ví này chưa có thẻ định danh nào.")

    cred_def, _ = chain.resolve_cred_def()
    ls = wallet.get_link_secret(wallet_id)
    req = verifier.create_presentation_request(body.revealed_attrs)
    presentation = wallet.create_presentation(credential, identity, ls, cred_def, req)
    ok = verifier.verify_presentation(presentation, req["nonce"])
    revealed = {attr: identity[attr] for attr in body.revealed_attrs} if ok else {}
    return VerifyResponse(verified=ok, revealed=revealed)


class PresentationRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    purpose: str = Field(default="", max_length=1000)
    revealed_attrs: list[str] = Field(default_factory=list, max_length=8)
    conditions: list[str] = Field(default_factory=list, max_length=10)


class PresentationApproval(BaseModel):
    revealed_attrs: list[str] = Field(default_factory=list, max_length=8)


def _request(session_id: str) -> dict:
    session = _verification_requests.get(session_id)
    if session is None:
        raise HTTPException(404, "Không tìm thấy phiên xác minh")
    if session["status"] == "pending" and time.time() >= session["expires_at"]:
        session["status"] = "expired"
    return session


@app.post("/api/requests")
def create_request(
    body: PresentationRequest, verifier_org: tuple[Account, str] = Depends(auth.verifier_account)
) -> dict:
    if set(body.revealed_attrs) - set(revealable_attrs()):
        raise HTTPException(400, "Yêu cầu có thuộc tính ngoài schema issuer đã đăng ký trên chain")
    if len(set(body.revealed_attrs)) != len(body.revealed_attrs):
        raise HTTPException(400, "Thuộc tính bị lặp")
    if set(body.conditions) - {"credValid"}:
        raise HTTPException(400, "Demo chưa hỗ trợ predicate tuổi, quốc tịch, cư trú hoặc chứng minh không thu hồi")
    with _flow_lock:
        now = time.time()
        for key, value in list(_verification_requests.items()):
            if now > value["expires_at"] + 3600:
                del _verification_requests[key]
        session_id = secrets.token_urlsafe(24)
        session = {
            **body.model_dump(), "id": session_id, "status": "pending",
            "org_name": verifier_org[1],
            "expires_at": now + verifier.SESSION_TTL_SECONDS, "result": None,
        }
        _verification_requests[session_id] = session
        return session.copy()


@app.get("/api/requests/{session_id}")
def get_request(session_id: str) -> dict:
    with _flow_lock:
        return _request(session_id).copy()


@app.post("/api/requests/{session_id}/approve")
def approve_request(
    session_id: str, body: PresentationApproval, account: Account = Depends(auth.wallet_account)
) -> dict:
    with _flow_lock:
        session = _request(session_id)
        if session["status"] != "pending":
            raise HTTPException(409, "Phiên đã kết thúc hoặc hết hạn")
        if set(body.revealed_attrs) - set(session["revealed_attrs"]):
            raise HTTPException(400, "Không được chia sẻ ngoài yêu cầu")
        result = _verify(VerifyRequest(revealed_attrs=body.revealed_attrs), account.wallet_id)
        session["result"] = result.model_dump()
        session["status"] = "verified" if result.verified else "rejected"
        return session.copy()


@app.post("/api/requests/{session_id}/decline")
def decline_request(session_id: str) -> dict:
    with _flow_lock:
        session = _request(session_id)
        if session["status"] != "pending":
            raise HTTPException(409, "Phiên đã kết thúc hoặc hết hạn")
        session["status"] = "declined"
        return session.copy()


@app.post("/api/verifier/login", response_model=VerifierLoginResponse)
def verifier_login(account: Account = Depends(auth.current_account)) -> VerifierLoginResponse:
    org_name = issuer.find_verifier_org(account.email)
    return VerifierLoginResponse(
        authorized=org_name is not None, org_name=org_name, email=account.email
    )


@app.post("/api/passkey/register/options")
def passkey_register_options(account: Account = Depends(auth.current_account)) -> dict:
    with _flow_lock:
        return passkey.registration_options(account.wallet_id, account.name or account.email)


@app.post("/api/passkey/register/verify")
def passkey_register_verify(
    body: dict, account: Account = Depends(auth.current_account)
) -> dict:
    with _flow_lock:
        passkey.verify_registration(account.wallet_id, body)
        return {"verified": True, "unlock_token": passkey.grant(account.wallet_id)}


@app.post("/api/passkey/login/options")
def passkey_login_options(account: Account = Depends(auth.current_account)) -> dict:
    with _flow_lock:
        return passkey.authentication_options(account.wallet_id)


@app.post("/api/passkey/login/verify")
def passkey_login_verify(
    body: dict, account: Account = Depends(auth.current_account)
) -> dict:
    with _flow_lock:
        passkey.verify_authentication(account.wallet_id, body)
        return {"verified": True, "unlock_token": passkey.grant(account.wallet_id)}


@app.post("/api/passkey/skip")
def passkey_skip(account: Account = Depends(auth.current_account)) -> dict[str, bool]:
    with _flow_lock:
        """Máy không có thiết bị xác thực: ghi nhận ví đã cài nhưng không có passkey nào bảo vệ."""
        stored = wallet.get_passkey(account.wallet_id)
        if stored and stored["passkey"]:
            raise HTTPException(409, "Ví đã có passkey; cần xác thực bằng passkey đã đăng ký")
        wallet.save_passkey(None, account.wallet_id)
        return {"saved": True}


@app.get("/api/me")
def me(account: Account = Depends(auth.current_account), x_wallet_unlock: str = Header(default="")) -> dict:
    stored = wallet.get_passkey(account.wallet_id)
    locked = bool(stored and stored["passkey"] and not passkey.is_unlocked(account.wallet_id, x_wallet_unlock))
    _recent_logins.append({
        "at": round(time.time() - SERVER_STARTED_AT),
        "wallet": account.wallet_id[:8],
        "wallet_ready": stored is not None,
        "has_passkey": bool(stored and stored["passkey"]),
    })
    del _recent_logins[:-10]
    return {
        "email": account.email,
        "name": account.name,
        "wallet_id": account.wallet_id,
        "has_credential": wallet.get_credential(account.wallet_id) is not None,
        "identity": None if locked else wallet.get_identity(account.wallet_id),
        "wallet_locked": locked,
        "wallet_ready": stored is not None,
        "has_passkey": bool(stored and stored["passkey"]),
    }


@app.post("/api/reset", dependencies=[Depends(issuance.operator)])
def reset() -> dict[str, bool]:
    with _flow_lock:
        return _reset()


def _reset() -> dict[str, bool]:
    # Keep issuer keys stable: published credential definitions are immutable.
    for state_file in [issuer.EKYC_DB_FILE]:
        if state_file.exists():
            state_file.unlink()
    if wallet.WALLETS_DIR.exists():
        shutil.rmtree(wallet.WALLETS_DIR)
    issuer._pending_nonces.clear()
    verifier._pending_sessions.clear()
    _verification_requests.clear()
    issuance.requests.clear()
    issuance.persist()
    passkey._challenges.clear()
    passkey._unlocks.clear()
    issuer.EKYC_DB[:] = [dict(record) for record in issuer.SEED_EKYC_DB]
    return {"reset": True}


# Chỉ tồn tại ở image deploy (Dockerfile.render copy frontend/dist vào ./static) — khi chạy
# docker-compose thì nginx serve SPA nên thư mục này không có và route dưới không được đăng ký.
if STATIC_DIR.is_dir():

    # Không gửi Cache-Control thì trình duyệt tự suy ra thời hạn cache riêng và có thể giữ lại
    # index.html cũ; index.html cũ trỏ tới tên bundle cũ nên deploy xong người dùng vẫn thấy giao
    # diện cũ. Vite đặt hash nội dung vào tên file trong /assets nên nhóm đó cache vĩnh viễn được,
    # còn index.html phải kiểm tra lại với máy chủ mỗi lần mở.
    NO_CACHE = {"Cache-Control": "no-cache"}
    IMMUTABLE = {"Cache-Control": "public, max-age=31536000, immutable"}

    @app.get("/{full_path:path}")
    def spa(full_path: str) -> FileResponse:
        if full_path.startswith("api/"):
            raise HTTPException(404, "Không có endpoint này")
        index = STATIC_DIR / "index.html"
        if not full_path:
            return FileResponse(index, headers=NO_CACHE)
        candidate = (STATIC_DIR / full_path).resolve()
        if not candidate.is_relative_to(STATIC_DIR.resolve()) or not candidate.is_file():
            return FileResponse(index, headers=NO_CACHE)
        headers = IMMUTABLE if full_path.startswith("assets/") else NO_CACHE
        return FileResponse(candidate, headers=headers)
