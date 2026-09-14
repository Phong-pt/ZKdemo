import os
import secrets
import time
from threading import RLock
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

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

REVEALABLE_ATTRS = ["name", "dob", "nationality", "address"]


class IssueRequest(BaseModel):
    cccd: str
    name: str
    dob: str
    nationality: str
    address: str


class IssueResponse(BaseModel):
    issued: bool
    identity: dict[str, str]


class VerifyRequest(BaseModel):
    revealed_attrs: list[str]


class VerifyResponse(BaseModel):
    verified: bool
    revealed: dict[str, str]


class VerifierLoginRequest(BaseModel):
    email: str


class VerifierLoginResponse(BaseModel):
    authorized: bool
    org_name: str | None


@app.get("/api/config")
def get_config() -> dict[str, str | list[str]]:
    return {
        "google_client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),
        "verifier_domains": sorted(issuer.TRUSTED_VERIFIER_DOMAINS),
    }


@app.get("/api/cred-def")
def get_cred_def() -> dict:
    return issuer.get_public_cred_def()


@app.post("/api/issue", response_model=IssueResponse)
def issue_credential(body: IssueRequest) -> IssueResponse:
    with _flow_lock:
        return _issue_credential(body)


def _issue_credential(body: IssueRequest) -> IssueResponse:
    credential = wallet.get_credential()
    if credential is not None:
        identity = wallet.get_identity()
        if identity is None:
            raise HTTPException(409, "Đã có credential cũ nhưng thiếu dữ liệu identity — gọi /api/reset rồi thử lại")
        if identity != body.model_dump():
            raise HTTPException(409, "Ví demo đã có credential của danh tính khác")
        return IssueResponse(issued=True, identity=identity)

    attributes = body.model_dump()
    if any(not value.strip() for value in attributes.values()):
        raise HTTPException(400, "Thiếu thông tin — tất cả các trường đều bắt buộc")

    cred_def = issuer.get_public_cred_def()
    nonce = issuer.issue_challenge(attributes)
    if nonce is None:
        raise HTTPException(400, "CCCD này đã được cấp credential rồi")

    ls = wallet.get_link_secret()
    v_prime = wallet.generate_blinding_factor()
    u = wallet.compute_commitment(cred_def["S"], cred_def["R"], cred_def["n"], v_prime, ls)
    wallet.save_pending_request(nonce, v_prime, ls)

    v_tilde, ls_tilde = wallet.generate_random_exponents()
    u_prime = wallet.compute_commitment_prime(cred_def["S"], cred_def["R"], cred_def["n"], v_tilde, ls_tilde)
    c = wallet.compute_challenge(u, u_prime, nonce)
    v_hat, ls_hat = wallet.compute_responses(c, v_tilde, ls_tilde, v_prime, ls)

    proof = {"nonce": nonce, "u": u, "c": c, "v_hat": v_hat, "ls_hat": ls_hat}
    signed = issuer.sign_blindly(attributes, proof)
    wallet.unblind_signature(signed["a"], signed["e"], signed["v_prime_prime"], nonce, attributes, cred_def)
    wallet.save_identity(attributes)

    return IssueResponse(issued=True, identity=attributes)


@app.post("/api/verify", response_model=VerifyResponse)
def verify(body: VerifyRequest) -> VerifyResponse:
    with _flow_lock:
        return _verify(body)


def _verify(body: VerifyRequest) -> VerifyResponse:
    invalid = [a for a in body.revealed_attrs if a not in REVEALABLE_ATTRS]
    if len(set(body.revealed_attrs)) != len(body.revealed_attrs):
        raise HTTPException(400, "Thuộc tính bị lặp")
    if invalid:
        raise HTTPException(400, f"Không hỗ trợ tiết lộ thuộc tính: {invalid}")

    credential = wallet.get_credential()
    identity = wallet.get_identity()
    if credential is None or identity is None:
        raise HTTPException(400, "Chưa có credential nào được cấp — gọi /api/issue trước")

    cred_def = issuer.get_public_cred_def()
    ls = wallet.get_link_secret()
    req = verifier.create_presentation_request(body.revealed_attrs)
    presentation = wallet.create_presentation(credential, identity, ls, cred_def, req)
    ok = verifier.verify_presentation(presentation, req["nonce"])
    revealed = {attr: identity[attr] for attr in body.revealed_attrs} if ok else {}
    return VerifyResponse(verified=ok, revealed=revealed)


class PresentationRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    purpose: str = Field(default="", max_length=1000)
    revealed_attrs: list[str] = Field(default_factory=list, max_length=4)
    conditions: list[str] = Field(default_factory=list, max_length=10)


class PresentationApproval(BaseModel):
    revealed_attrs: list[str] = Field(default_factory=list, max_length=4)


def _request(session_id: str) -> dict:
    session = _verification_requests.get(session_id)
    if session is None:
        raise HTTPException(404, "Không tìm thấy phiên xác minh")
    if session["status"] == "pending" and time.time() >= session["expires_at"]:
        session["status"] = "expired"
    return session


@app.post("/api/requests")
def create_request(body: PresentationRequest) -> dict:
    if set(body.revealed_attrs) - set(REVEALABLE_ATTRS):
        raise HTTPException(400, "Yêu cầu có thuộc tính chưa được hỗ trợ")
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
            "expires_at": now + verifier.SESSION_TTL_SECONDS, "result": None,
        }
        _verification_requests[session_id] = session
        return session.copy()


@app.get("/api/requests/{session_id}")
def get_request(session_id: str) -> dict:
    with _flow_lock:
        return _request(session_id).copy()


@app.post("/api/requests/{session_id}/approve")
def approve_request(session_id: str, body: PresentationApproval) -> dict:
    with _flow_lock:
        session = _request(session_id)
        if session["status"] != "pending":
            raise HTTPException(409, "Phiên đã kết thúc hoặc hết hạn")
        if set(body.revealed_attrs) - set(session["revealed_attrs"]):
            raise HTTPException(400, "Không được chia sẻ ngoài yêu cầu")
        result = verify(VerifyRequest(revealed_attrs=body.revealed_attrs))
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
def verifier_login(body: VerifierLoginRequest) -> VerifierLoginResponse:
    org_name = issuer.find_verifier_org(body.email)
    return VerifierLoginResponse(authorized=org_name is not None, org_name=org_name)


@app.post("/api/reset")
def reset() -> dict[str, bool]:
    with _flow_lock:
        return _reset()


def _reset() -> dict[str, bool]:
    for state_file in [
        issuer.PUBLIC_CREDDEF_FILE,
        issuer.PRIVATE_KEY_FILE,
        wallet.LINK_SECRET_FILE,
        wallet.PENDING_REQUEST_FILE,
        wallet.CREDENTIAL_FILE,
        wallet.IDENTITY_FILE,
    ]:
        if state_file.exists():
            state_file.unlink()
    issuer._pending_nonces.clear()
    verifier._pending_sessions.clear()
    _verification_requests.clear()
    issuer.EKYC_DB[:] = issuer.EKYC_DB[:1]
    issuer.EKYC_DB[0]["credential_issued"] = False
    return {"reset": True}


# Chỉ tồn tại ở image deploy (Dockerfile.render copy frontend/dist vào ./static) — khi chạy
# docker-compose thì nginx serve SPA nên thư mục này không có và route dưới không được đăng ký.
if STATIC_DIR.is_dir():

    @app.get("/{full_path:path}")
    def spa(full_path: str) -> FileResponse:
        if full_path.startswith("api/"):
            raise HTTPException(404, "Không có endpoint này")
        index = STATIC_DIR / "index.html"
        if not full_path:
            return FileResponse(index)
        candidate = (STATIC_DIR / full_path).resolve()
        if not candidate.is_relative_to(STATIC_DIR.resolve()) or not candidate.is_file():
            return FileResponse(index)
        return FileResponse(candidate)
