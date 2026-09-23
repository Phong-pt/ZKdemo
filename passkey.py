import base64
import json
import os
import time
import secrets

import webauthn
from fastapi import HTTPException
from webauthn.helpers import base64url_to_bytes
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from wallet import wallet

RP_NAME = "NX Cred"
# rp_id phải đúng tên miền đang phục vụ trang, còn origin phải khớp tuyệt đối cả scheme lẫn cổng —
# trình duyệt ký hai giá trị này vào chữ ký nên sai là hỏng xác thực.
RP_ID = os.environ.get("WEBAUTHN_RP_ID", "zkp-demo.onrender.com")
ORIGINS = [
    origin.strip()
    for origin in os.environ.get("WEBAUTHN_ORIGIN", f"https://{RP_ID}").split(",")
    if origin.strip()
]

# Challenge do máy chủ phát, mỗi cái chỉ dùng được một lần. Đây là thứ khiến chữ ký không phát lại
# được: không có nó thì kẻ bắt được một lần xác thực cũ có thể gửi lại y nguyên để vào ví.
_challenges: dict[str, tuple[bytes, str, float]] = {}
_unlocks: dict[str, tuple[str, float]] = {}


def grant(wallet_id: str) -> str:
    for token, (_, expiry) in list(_unlocks.items()):
        if expiry <= time.monotonic():
            del _unlocks[token]
    token = secrets.token_urlsafe(32)
    _unlocks[token] = (wallet_id, time.monotonic() + 1800)
    return token


def is_unlocked(wallet_id: str, token: str) -> bool:
    value = _unlocks.get(token)
    return bool(value and value[0] == wallet_id and value[1] > time.monotonic())


def _challenge(wallet_id: str, purpose: str) -> bytes:
    value = _challenges.pop(wallet_id, None)
    if not value or value[1] != purpose or time.monotonic() >= value[2]:
        raise HTTPException(400, "Challenge đã hết hạn, sai thao tác hoặc đã dùng; thử lại")
    return value[0]


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _stored(wallet_id: str) -> dict | None:
    record = wallet.get_passkey(wallet_id)
    return record["passkey"] if record else None


def registration_options(wallet_id: str, user_name: str) -> dict:
    if _stored(wallet_id):
        raise HTTPException(409, "Ví đã có passkey; hãy mở khóa bằng passkey đã đăng ký")
    options = webauthn.generate_registration_options(
        rp_id=RP_ID,
        rp_name=RP_NAME,
        user_id=wallet_id.encode("utf-8"),
        user_name=user_name,
        user_display_name=user_name,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
    )
    _challenges[wallet_id] = (options.challenge, "registration", time.monotonic() + 300)
    return json.loads(webauthn.options_to_json(options))


def verify_registration(wallet_id: str, credential: dict) -> None:
    if _stored(wallet_id):
        raise HTTPException(409, "Không thể ghi đè passkey đã đăng ký")
    challenge = _challenge(wallet_id, "registration")
    try:
        verified = webauthn.verify_registration_response(
            credential=credential,
            expected_challenge=challenge,
            expected_rp_id=RP_ID,
            expected_origin=ORIGINS,
        )
    except Exception as error:
        raise HTTPException(400, f"Passkey không hợp lệ: {error}") from error

    wallet.save_passkey(
        {
            "credential_id": _b64(verified.credential_id),
            "public_key": _b64(verified.credential_public_key),
            "sign_count": verified.sign_count,
        },
        wallet_id,
    )


def authentication_options(wallet_id: str) -> dict:
    record = _stored(wallet_id)
    if not record:
        raise HTTPException(400, "Tài khoản này chưa đăng ký passkey nào")
    options = webauthn.generate_authentication_options(
        rp_id=RP_ID,
        allow_credentials=[
            PublicKeyCredentialDescriptor(id=base64url_to_bytes(record["credential_id"]))
        ],
        user_verification=UserVerificationRequirement.PREFERRED,
    )
    _challenges[wallet_id] = (options.challenge, "authentication", time.monotonic() + 300)
    return json.loads(webauthn.options_to_json(options))


def verify_authentication(wallet_id: str, credential: dict) -> None:
    challenge = _challenge(wallet_id, "authentication")
    record = _stored(wallet_id)
    if not record:
        raise HTTPException(400, "Tài khoản này chưa đăng ký passkey nào")
    try:
        verified = webauthn.verify_authentication_response(
            credential=credential,
            expected_challenge=challenge,
            expected_rp_id=RP_ID,
            expected_origin=ORIGINS,
            credential_public_key=base64url_to_bytes(record["public_key"]),
            credential_current_sign_count=record["sign_count"],
        )
    except Exception as error:
        raise HTTPException(401, f"Không mở được ví bằng passkey này: {error}") from error

    # Bộ đếm tăng dần do chính thiết bị giữ; lưu lại để lần sau phát hiện chữ ký cũ bị phát lại.
    record["sign_count"] = verified.new_sign_count
    wallet.save_passkey(record, wallet_id)
