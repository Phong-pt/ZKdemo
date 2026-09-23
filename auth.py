import hashlib
import os

from fastapi import Depends, Header, HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from issuer import issuer

_GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")
_request_session = google_requests.Request()


class Account:
    def __init__(self, wallet_id: str, email: str, name: str, is_demo: bool) -> None:
        self.wallet_id = wallet_id
        self.email = email
        self.name = name
        self.is_demo = is_demo


def _client_id() -> str:
    return os.environ.get("GOOGLE_CLIENT_ID", "")


def _wallet_id(subject: str) -> str:
    return hashlib.sha256(subject.encode("utf-8")).hexdigest()[:16]


def _bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Thiếu ID-token — hãy đăng nhập lại")
    return authorization.split(" ", 1)[1].strip()


def account_from_token(token: str) -> Account:
    client_id = _client_id()
    # Nút "tài khoản demo" chỉ dùng được khi chưa cấu hình OAuth; có Client ID thật thì mọi phiên
    # đều phải là ID-token do Google ký, không có đường vòng.
    if token.startswith("demo:"):
        if client_id:
            raise HTTPException(401, "Máy chủ đã bật Google Sign-In — hãy đăng nhập bằng Google")
        label = token.split(":", 1)[1].strip() or "demo"
        email = label if "@" in label else f"{label}@demo.local"
        return Account(_wallet_id("demo:" + label), email, label.split("@", 1)[0], True)

    if not client_id:
        raise HTTPException(503, "Máy chủ chưa cấu hình GOOGLE_CLIENT_ID")
    try:
        claims = id_token.verify_oauth2_token(token, _request_session, client_id)
    except ValueError as error:
        # ID-token của Google sống một giờ. Hết hạn là chuyện bình thường chứ không phải
        # tấn công, nên tách riêng để giao diện biết đường mời đăng nhập lại thay vì hiện
        # nguyên văn thông báo của thư viện kèm hai mốc thời gian.
        if "expired" in str(error).lower():
            raise HTTPException(401, "Phiên đăng nhập đã hết hạn. Đăng nhập lại.") from error
        raise HTTPException(401, "Đăng nhập không hợp lệ. Đăng nhập lại.") from error
    if claims.get("iss") not in _GOOGLE_ISSUERS:
        raise HTTPException(401, "ID-token không do Google phát hành")
    return Account(
        wallet_id=_wallet_id(claims["sub"]),
        email=claims.get("email", ""),
        name=claims.get("name", ""),
        is_demo=False,
    )


def current_account(authorization: str | None = Header(default=None)) -> Account:
    return account_from_token(_bearer(authorization))


def wallet_account(account: Account = Depends(current_account),
                   x_wallet_unlock: str = Header(default="")) -> Account:
    import passkey
    from wallet import wallet
    stored = wallet.get_passkey(account.wallet_id)
    if stored and stored["passkey"] and not passkey.is_unlocked(account.wallet_id, x_wallet_unlock):
        raise HTTPException(403, "Ví đang khóa; hãy xác thực passkey để tiếp tục")
    return account


def verifier_account(authorization: str | None = Header(default=None)) -> tuple[Account, str]:
    account = current_account(authorization)
    org_name = issuer.find_verifier_org(account.email)
    if org_name is None:
        raise HTTPException(
            403, f"{account.email} không thuộc tổ chức verifier nào đã đăng ký với issuer"
        )
    return account, org_name
