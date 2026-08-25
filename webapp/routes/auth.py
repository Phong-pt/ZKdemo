"""Screens [1]/[2]/[2b] of prompt-webapp-wallet.md: passkey registration,
passkey login, session cookie, and an optional Google email-verification
step (Google confirms the email is real; the passkey remains the actual
login credential — see config.py's comment on GOOGLE_CLIENT_ID).
"""

import re
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from webauthn import (
    base64url_to_bytes,
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers.structs import (
    AttestationConveyancePreference,
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from .. import config, db, sessions, wallet_store

router = APIRouter(prefix="/api/auth", tags=["auth"])

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

# email -> {"challenge": bytes, "user_id": str, "expires": float}
_pending_registration: dict[str, dict] = {}
# email -> {"challenge": bytes, "expires": float}
_pending_login: dict[str, dict] = {}


def _prune(store: dict) -> None:
    now = time.time()
    for key in [k for k, v in store.items() if v["expires"] < now]:
        del store[key]


def _normalize_email(email: str) -> str:
    email = (email or "").strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(400, "Email không hợp lệ.")
    return email


def _set_session_cookie(response: Response, user_id: str) -> None:
    response.set_cookie(
        config.SESSION_COOKIE_NAME,
        sessions.create_session_cookie(user_id),
        max_age=config.SESSION_TTL_SECONDS,
        httponly=True,
        samesite="lax",
        secure=config.ORIGIN.startswith("https://"),
    )


def get_current_user_id(request: Request) -> str:
    cookie = request.cookies.get(config.SESSION_COOKIE_NAME)
    user_id = sessions.verify_session_cookie(cookie) if cookie else None
    if not user_id:
        raise HTTPException(401, "Chưa đăng nhập.")
    return user_id


class EmailBody(BaseModel):
    email: str


class RegisterVerifyBody(BaseModel):
    email: str
    credential: dict


class LoginVerifyBody(BaseModel):
    email: str
    credential: dict


class GoogleVerifyBody(BaseModel):
    credential: str


@router.post("/register/options")
def register_options(body: EmailBody):
    email = _normalize_email(body.email)
    if db.get_user_by_email(email) is not None:
        raise HTTPException(409, "Email này đã có tài khoản. Hãy đăng nhập.")

    _prune(_pending_registration)
    user_id = secrets.token_urlsafe(16)
    options = generate_registration_options(
        rp_id=config.RP_ID,
        rp_name=config.RP_NAME,
        user_name=email,
        user_id=user_id.encode("utf-8"),
        user_display_name=email,
        attestation=AttestationConveyancePreference.NONE,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.REQUIRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
    )
    _pending_registration[email] = {
        "challenge": options.challenge,
        "user_id": user_id,
        "expires": time.time() + config.WEBAUTHN_CHALLENGE_TTL_SECONDS,
    }
    return Response(content=options_to_json(options), media_type="application/json")


@router.post("/register/verify")
def register_verify(body: RegisterVerifyBody, response: Response):
    email = _normalize_email(body.email)
    pending = _pending_registration.get(email)
    if not pending or pending["expires"] < time.time():
        raise HTTPException(400, "Phiên đăng ký đã hết hạn. Thử lại.")

    try:
        verification = verify_registration_response(
            credential=body.credential,
            expected_challenge=pending["challenge"],
            expected_rp_id=config.RP_ID,
            expected_origin=config.ORIGIN,
            require_user_verification=True,
        )
    except Exception as exc:  # noqa: BLE001 — surfaced as a plain 400 for the UI
        raise HTTPException(400, f"Không tạo được Passkey: {exc}") from exc

    user_id = pending["user_id"]
    db.create_user(
        user_id=user_id,
        email=email,
        credential_id=verification.credential_id,
        public_key=verification.credential_public_key,
    )
    del _pending_registration[email]

    _set_session_cookie(response, user_id)
    return {"user_id": user_id, "email": email}


@router.post("/login/options")
def login_options(body: EmailBody):
    email = _normalize_email(body.email)
    user = db.get_user_by_email(email)
    if user is None:
        raise HTTPException(404, "Không tìm thấy tài khoản với email này.")

    _prune(_pending_login)
    options = generate_authentication_options(
        rp_id=config.RP_ID,
        user_verification=UserVerificationRequirement.REQUIRED,
        allow_credentials=[PublicKeyCredentialDescriptor(id=user["credential_id"])],
    )
    _pending_login[email] = {
        "challenge": options.challenge,
        "expires": time.time() + config.WEBAUTHN_CHALLENGE_TTL_SECONDS,
    }
    return Response(content=options_to_json(options), media_type="application/json")


@router.post("/login/verify")
def login_verify(body: LoginVerifyBody, response: Response):
    email = _normalize_email(body.email)
    pending = _pending_login.get(email)
    if not pending or pending["expires"] < time.time():
        raise HTTPException(400, "Phiên đăng nhập đã hết hạn. Thử lại.")

    user = db.get_user_by_email(email)
    if user is None:
        raise HTTPException(404, "Không tìm thấy tài khoản với email này.")

    try:
        verification = verify_authentication_response(
            credential=body.credential,
            expected_challenge=pending["challenge"],
            expected_rp_id=config.RP_ID,
            expected_origin=config.ORIGIN,
            credential_public_key=user["public_key"],
            credential_current_sign_count=user["sign_count"],
            require_user_verification=True,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"Xác thực Passkey thất bại: {exc}") from exc

    del _pending_login[email]
    db.update_sign_count(user["user_id"], verification.new_sign_count)

    _set_session_cookie(response, user["user_id"])
    return {"user_id": user["user_id"], "email": email}


@router.post("/google/verify")
def google_verify(body: GoogleVerifyBody):
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    try:
        claims = google_id_token.verify_oauth2_token(
            body.credential, google_requests.Request(), config.GOOGLE_CLIENT_ID
        )
    except ValueError as exc:
        raise HTTPException(400, "Token Google không hợp lệ.") from exc

    if not claims.get("email_verified"):
        raise HTTPException(400, "Email Google chưa được xác minh.")

    return {"email": claims["email"].lower()}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(config.SESSION_COOKIE_NAME)
    return {"ok": True}


@router.get("/me")
def me(user_id: str = Depends(get_current_user_id)):
    user = db.get_user_by_id(user_id)
    if user is None:
        raise HTTPException(401, "Chưa đăng nhập.")
    return {"email": user["email"], "has_credential": wallet_store.has_credential(user_id)}
