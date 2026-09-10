from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from issuer import issuer
from wallet import wallet
from verifier import verifier

app = FastAPI(title="ZKP demo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_session_connections: dict[str, list[WebSocket]] = {}


@app.websocket("/api/session/{session_id}/ws")
async def session_relay(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    peers = _session_connections.setdefault(session_id, [])
    peers.append(websocket)
    try:
        while True:
            message = await websocket.receive_text()
            for peer in peers:
                if peer is not websocket:
                    await peer.send_text(message)
    except WebSocketDisconnect:
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


@app.get("/api/cred-def")
def get_cred_def() -> dict:
    return issuer.get_public_cred_def()


@app.post("/api/issue", response_model=IssueResponse)
def issue_credential(body: IssueRequest) -> IssueResponse:
    credential = wallet.get_credential()
    if credential is not None:
        identity = wallet.get_identity()
        if identity is None:
            raise HTTPException(409, "Đã có credential cũ nhưng thiếu dữ liệu identity — gọi /api/reset rồi thử lại")
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
    invalid = [a for a in body.revealed_attrs if a not in REVEALABLE_ATTRS]
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


@app.post("/api/reset")
def reset() -> dict[str, bool]:
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
    issuer.EKYC_DB[:] = issuer.EKYC_DB[:1]
    issuer.EKYC_DB[0]["credential_issued"] = False
    return {"reset": True}
