import os
import secrets
import shutil
import time
from threading import RLock
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import auth
import chain
from auth import Account
from issuer import issuer
from wallet import wallet
from verifier import verifier

app = FastAPI(title="ZKP demo API")

STATIC_DIR = Path(__file__).resolve().parent / "static"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_session_connections: dict[str, list[WebSocket]] = {}
_flow_lock = RLock()
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


class IssueResponse(BaseModel):
    issued: bool
    identity: dict[str, str]


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
def get_config() -> dict[str, str | list[str]]:
    return {
        "google_client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),
        "verifier_domains": sorted(issuer.TRUSTED_VERIFIER_DOMAINS),
    }


@app.get("/api/chain")
def chain_status() -> dict:
    return chain.status()


@app.get("/api/cred-def")
def get_cred_def() -> dict:
    return issuer.get_public_cred_def()


@app.post("/api/issue", response_model=IssueResponse)
def issue_credential(body: IssueRequest, account: Account = Depends(auth.current_account)) -> IssueResponse:
    with _flow_lock:
        return _issue_credential(body, account.wallet_id)


def _issue_credential(body: IssueRequest, wallet_id: str) -> IssueResponse:
    credential = wallet.get_credential(wallet_id)
    if credential is not None:
        identity = wallet.get_identity(wallet_id)
        if identity is None:
            raise HTTPException(409, "Đã có credential cũ nhưng thiếu dữ liệu identity — gọi /api/reset rồi thử lại")
        if identity != body.model_dump(exclude={"document_type"}):
            raise HTTPException(409, "Ví demo đã có credential của danh tính khác")
        return IssueResponse(issued=True, identity=identity)

    attributes = body.model_dump(exclude={"document_type"})
    if any(not value.strip() for value in attributes.values()):
        raise HTTPException(400, "Thiếu thông tin — tất cả các trường đều bắt buộc")
    _check_against_schema(body.document_type, attributes)

    cred_def = issuer.get_public_cred_def()
    try:
        nonce = issuer.issue_challenge(attributes)
    except issuer.EkycMismatchError as mismatch:
        raise HTTPException(409, str(mismatch)) from mismatch
    if nonce is None:
        raise HTTPException(
            400,
            "Số CCCD này đã được cấp credential cho một ví khác. Credential đó gắn với link secret "
            "của ví kia nên ví này không dùng lại được, và issuer không cấp credential thứ hai cho "
            "cùng một số CCCD.",
        )

    ls = wallet.get_link_secret(wallet_id)
    v_prime = wallet.generate_blinding_factor()
    u = wallet.compute_commitment(cred_def["S"], cred_def["R"], cred_def["n"], v_prime, ls)
    wallet.save_pending_request(nonce, v_prime, ls, wallet_id)

    v_tilde, ls_tilde = wallet.generate_random_exponents()
    u_prime = wallet.compute_commitment_prime(cred_def["S"], cred_def["R"], cred_def["n"], v_tilde, ls_tilde)
    c = wallet.compute_challenge(u, u_prime, nonce)
    v_hat, ls_hat = wallet.compute_responses(c, v_tilde, ls_tilde, v_prime, ls)

    proof = {"nonce": nonce, "u": u, "c": c, "v_hat": v_hat, "ls_hat": ls_hat}
    signed = issuer.sign_blindly(attributes, proof)
    wallet.unblind_signature(
        signed["a"], signed["e"], signed["v_prime_prime"], nonce, attributes, cred_def, wallet_id
    )
    wallet.save_identity(attributes, wallet_id)

    return IssueResponse(issued=True, identity=attributes)


@app.post("/api/verify", response_model=VerifyResponse)
def verify(body: VerifyRequest, account: Account = Depends(auth.current_account)) -> VerifyResponse:
    with _flow_lock:
        return _verify(body, account.wallet_id)


def _check_against_schema(document_type: str, attributes: dict) -> None:
    """Issuer chỉ ký được thứ nó đã đăng ký khuôn mẫu trên chain. Quét bằng lái hay hộ chiếu ra một
    bộ thuộc tính khác thì dừng ở đây, không có khoá nào để ký nó."""
    allowed, source = chain.resolve_attributes()
    schema_name = chain.get_schema()["name"] if source == "chain" else "nationalIdentity"
    if document_type != schema_name:
        raise HTTPException(
            400,
            f"Issuer chưa đăng ký schema cho loại giấy tờ '{document_type}'. Trên chain hiện chỉ có "
            f"'{schema_name}', nên không có khoá công khai nào để ký giấy tờ này.",
        )
    if set(attributes) != set(allowed):
        missing = sorted(set(allowed) - set(attributes))
        extra = sorted(set(attributes) - set(allowed))
        raise HTTPException(
            400,
            f"Bộ thuộc tính không khớp schema '{schema_name}' trên chain — thiếu {missing}, thừa {extra}.",
        )


def _verify(body: VerifyRequest, wallet_id: str) -> VerifyResponse:
    invalid = [a for a in body.revealed_attrs if a not in revealable_attrs()]
    if len(set(body.revealed_attrs)) != len(body.revealed_attrs):
        raise HTTPException(400, "Thuộc tính bị lặp")
    if invalid:
        raise HTTPException(400, f"Không hỗ trợ tiết lộ thuộc tính: {invalid}")

    credential = wallet.get_credential(wallet_id)
    identity = wallet.get_identity(wallet_id)
    if credential is None or identity is None:
        raise HTTPException(400, "Chưa có credential nào được cấp — gọi /api/issue trước")

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
    session_id: str, body: PresentationApproval, account: Account = Depends(auth.current_account)
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


@app.get("/api/me")
def me(account: Account = Depends(auth.current_account)) -> dict:
    return {
        "email": account.email,
        "name": account.name,
        "wallet_id": account.wallet_id,
        "has_credential": wallet.get_credential(account.wallet_id) is not None,
        "identity": wallet.get_identity(account.wallet_id),
    }


@app.post("/api/reset")
def reset() -> dict[str, bool]:
    with _flow_lock:
        return _reset()


def _reset() -> dict[str, bool]:
    for state_file in [issuer.PUBLIC_CREDDEF_FILE, issuer.PRIVATE_KEY_FILE, issuer.EKYC_DB_FILE]:
        if state_file.exists():
            state_file.unlink()
    if wallet.WALLETS_DIR.exists():
        shutil.rmtree(wallet.WALLETS_DIR)
    issuer._pending_nonces.clear()
    verifier._pending_sessions.clear()
    _verification_requests.clear()
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
