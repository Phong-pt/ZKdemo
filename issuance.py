"""Issuer approval workflow for the existing server-hosted wallet."""
import json
import os
import secrets
import time
from threading import RLock
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict

import auth
import registry_publish
from issuer import issuer
from wallet import wallet

router = APIRouter()
lock = RLock()
STATE_FILE = Path(__file__).resolve().parent / "issuer" / "issuance_requests.json"
requests: dict[str, dict] = json.loads(STATE_FILE.read_text()) if STATE_FILE.exists() else {}
TTL = 15 * 60
for _request in requests.values():
    if _request["status"] == "pending" and _request["expires_at"] > time.time():
        issuer._pending_nonces[_request["nonce"]] = _request["attributes"].copy()


def persist():
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    temp = STATE_FILE.with_suffix(".tmp")
    temp.write_text(json.dumps(requests, ensure_ascii=False))
    temp.replace(STATE_FILE)


def operator(x_issuer_token: str = Header(default="")):
    expected = os.environ.get("ISSUER_PORTAL_TOKEN", "")
    if not expected:
        raise HTTPException(503, "Chưa cấu hình ISSUER_PORTAL_TOKEN trên backend")
    if not secrets.compare_digest(x_issuer_token, expected):
        raise HTTPException(401, "Mã truy cập issuer không đúng")


class Submission(BaseModel):
    model_config = ConfigDict(str_max_length=500, extra="forbid")
    document_type: str = "nationalIdentity"
    cccd: str
    name: str
    dob: str
    sex: str
    nationality: str
    origin: str
    residence: str
    expiry: str


def get_request(request_id):
    request = requests.get(request_id)
    if request is None:
        raise HTTPException(404, "Không tìm thấy yêu cầu; phiên backend có thể đã khởi động lại")
    if request["status"] == "pending" and time.time() >= request["expires_at"]:
        request["status"] = "expired"
        issuer._pending_nonces.pop(request["nonce"], None)
        persist()
    return request


def db_check(attrs):
    record = issuer.find_by_cccd(attrs["cccd"])
    return {
        "found": record is not None,
        "already_issued": bool(record and record["credential_issued"]),
        "fields": [{"name": key, "submitted": attrs[key],
                    "stored": record.get(key) if record else None,
                    "matches": bool(record and record.get(key) == attrs[key])}
                   for key in issuer.ATTRIBUTE_NAMES],
        "matches": bool(record and all(record.get(k) == attrs[k] for k in issuer.ATTRIBUTE_NAMES)),
    }


def view(request, for_issuer=False):
    result = {k: request[k] for k in ("id", "status", "created_at", "expires_at", "nonce", "checks", "reason")}
    result["identity"] = request["attributes"] if request["status"] == "issued" else None
    if for_issuer:
        result.update({"wallet_id": request["wallet_id"], "email": request["email"],
                       "attributes": request["attributes"], "database": db_check(request["attributes"]),
                       "proof": {k: str(v) for k, v in request["proof"].items()},
                       "public_key": {"n": str(request["public_key"]["n"]),
                                      "S": str(request["public_key"]["S"]),
                                      "R": str(request["public_key"]["R"])}})
        result["signature"] = {k: str(v) for k, v in request.get("signature", {}).items()}
    return result


@router.get("/api/issuance/current")
def current(account: auth.Account = Depends(auth.wallet_account)):
    with lock:
        for request in reversed(list(requests.values())):
            if request["wallet_id"] == account.wallet_id:
                request = get_request(request["id"])
                if request["status"] in ("pending", "signed"):
                    return {**view(request), "attributes": request["attributes"]}
        return None


@router.post("/api/issuance/requests")
def submit(body: Submission, account: auth.Account = Depends(auth.wallet_account)):
    with lock:
        attrs = body.model_dump(exclude={"document_type"})
        if body.document_type != "nationalIdentity":
            raise HTTPException(400, f"Chưa hỗ trợ schema '{body.document_type}'; hiện chỉ có nationalIdentity")
        if any(not x.strip() for x in attrs.values()):
            raise HTTPException(400, "Cần đầy đủ thông tin của schema CCCD nationalIdentity")
        for item in requests.values():
            item = get_request(item["id"])
            if item["wallet_id"] == account.wallet_id and item["status"] in ("pending", "signed", "issued"):
                if item["attributes"] != attrs:
                    raise HTTPException(409, "Ví đã có yêu cầu hoặc credential khác; hãy hoàn tất yêu cầu hiện tại")
                return view(item)
        if wallet.get_credential(account.wallet_id) is not None:
            if wallet.get_identity(account.wallet_id) != attrs:
                raise HTTPException(409, "Ví đã có credential của danh tính khác")
            return {"id": "existing", "status": "issued", "identity": attrs}

        # Issuer challenge; DB approval happens later. Never auto-enrol an unknown CCCD.
        nonce = issuer.generate_nonce()
        public_key = issuer.get_public_cred_def()
        ls = wallet.get_link_secret(account.wallet_id)
        v_prime = wallet.generate_blinding_factor()
        u = wallet.compute_commitment(public_key["S"], public_key["R"], public_key["n"], v_prime, ls)
        vt, lst = wallet.generate_random_exponents()
        ut = wallet.compute_commitment_prime(public_key["S"], public_key["R"], public_key["n"], vt, lst)
        c = wallet.compute_challenge(u, ut, nonce)
        vh, lsh = wallet.compute_responses(c, vt, lst, v_prime, ls)
        wallet.save_pending_request(nonce, v_prime, ls, account.wallet_id)
        issuer._pending_nonces[nonce] = attrs.copy()
        request_id = secrets.token_urlsafe(18)
        item = {"id": request_id, "wallet_id": account.wallet_id, "email": account.email,
                "attributes": attrs, "nonce": nonce, "public_key": public_key,
                "proof": {"nonce": nonce, "u": u, "c": c, "v_hat": vh, "ls_hat": lsh},
                "created_at": time.time(), "expires_at": time.time() + TTL,
                "status": "pending", "checks": None, "reason": None}
        requests[request_id] = item
        persist()
        return view(item)


@router.get("/api/issuance/requests/{request_id}")
def poll(request_id: str, account: auth.Account = Depends(auth.wallet_account)):
    with lock:
        item = get_request(request_id)
        if item["wallet_id"] != account.wallet_id:
            raise HTTPException(403, "Yêu cầu không thuộc ví này")
        return view(item)


@router.get("/api/issuer/requests", dependencies=[Depends(operator)])
def queue():
    with lock:
        return [view(get_request(key), True) for key in reversed(list(requests))]


@router.post("/api/issuance/requests/{request_id}/cancel")
def cancel(request_id: str, account: auth.Account = Depends(auth.wallet_account)):
    with lock:
        item = get_request(request_id)
        if item["wallet_id"] != account.wallet_id:
            raise HTTPException(403, "Yêu cầu không thuộc ví này")
        if item["status"] != "pending":
            raise HTTPException(409, "Chỉ có thể hủy yêu cầu chưa được issuer ký")
        issuer._pending_nonces.pop(item["nonce"], None)
        item.update(status="rejected", reason="Người dùng hủy yêu cầu để sửa hồ sơ")
        persist()
        return view(item)


def check(item):
    database = db_check(item["attributes"])
    nonce_ok = (item["status"] == "pending" and time.time() < item["expires_at"]
                and item["proof"]["nonce"] == item["nonce"]
                and issuer._pending_nonces.get(item["nonce"]) == item["attributes"])
    try:
        proof_ok = nonce_ok and issuer.verify_proof(item["proof"])
    except (ValueError, KeyError, TypeError, ZeroDivisionError):
        proof_ok = False
    item["checks"] = {"database": database["matches"], "not_issued": not database["already_issued"],
                      "nonce": nonce_ok, "proof": bool(proof_ok), "checked_at": time.time()}
    return item["checks"]


@router.post("/api/issuer/requests/{request_id}/check", dependencies=[Depends(operator)])
def inspect(request_id: str):
    with lock:
        item = get_request(request_id)
        if item["status"] != "pending":
            raise HTTPException(409, "Yêu cầu đã kết thúc")
        check(item)
        persist()
        return view(item, True)


@router.post("/api/issuer/requests/{request_id}/approve", dependencies=[Depends(operator)])
def approve(request_id: str, tasks: BackgroundTasks):
    with lock:
        item = get_request(request_id)
        if item["status"] != "pending":
            raise HTTPException(409, "Nonce đã dùng hoặc yêu cầu đã hết hạn/kết thúc")
        checks = check(item)
        if not all(checks[k] for k in ("database", "not_issued", "nonce", "proof")):
            raise HTTPException(409, "Không thể ký: CSDL, trạng thái đã cấp, nonce hoặc ZK proof không hợp lệ")
        item["signature"] = issuer.sign_blindly(item["attributes"], item["proof"])
        item["status"] = "signed"
        persist()
        tasks.add_task(registry_publish.publish)
        return view(item, True)


@router.post("/api/issuance/requests/{request_id}/complete")
def complete(request_id: str, account: auth.Account = Depends(auth.wallet_account)):
    with lock:
        item = get_request(request_id)
        if item["wallet_id"] != account.wallet_id:
            raise HTTPException(403, "Yêu cầu không thuộc ví này")
        if item["status"] == "issued":
            return view(item)
        if item["status"] != "signed":
            raise HTTPException(409, "Issuer chưa ký yêu cầu này")
        existing = wallet.get_credential(account.wallet_id)
        if existing is None:
            sig = item["signature"]
            wallet.unblind_signature(sig["a"], sig["e"], sig["v_prime_prime"], item["nonce"],
                                     item["attributes"], item["public_key"], account.wallet_id)
        elif not wallet.verify_credential(existing, item["attributes"], item["public_key"],
                                          wallet.get_link_secret(account.wallet_id)):
            raise HTTPException(409, "Credential trong ví không khớp yêu cầu đã ký")
        # Recover if the process stopped after unblinding but before identity/state was saved.
        wallet.save_identity(item["attributes"], account.wallet_id)
        item["status"] = "issued"
        persist()
        return view(item)


class Rejection(BaseModel):
    model_config = ConfigDict(str_max_length=500)
    reason: str = "Issuer từ chối hồ sơ"


@router.post("/api/issuer/requests/{request_id}/reject", dependencies=[Depends(operator)])
def reject(request_id: str, body: Rejection):
    with lock:
        item = get_request(request_id)
        if item["status"] != "pending":
            raise HTTPException(409, "Yêu cầu đã kết thúc")
        issuer._pending_nonces.pop(item["nonce"], None)
        item.update(status="rejected", reason=body.reason[:500])
        persist()
        return view(item, True)


@router.get("/api/issuer/registry", dependencies=[Depends(operator)])
def registry():
    return registry_publish.status()


@router.post("/api/issuer/registry/publish", dependencies=[Depends(operator)])
def publish(tasks: BackgroundTasks):
    tasks.add_task(registry_publish.publish)
    return {"queued": True}
