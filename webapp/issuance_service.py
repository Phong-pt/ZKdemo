"""Orchestrates one issuance (screens [5]-[9] in prompt-webapp-wallet.md),
calling straight into the real crypto in issuer/issuer.py and wallet/wallet.py
— no cryptographic logic is reimplemented here, only the per-user file
handoff (see wallet_store.py) and step sequencing / progress reporting.

Step numbering matches the doc's 5-step display exactly:
  1  Đối chiếu cơ sở dữ liệu        -> issuer_core.find_ekyc_record / issue_challenge
  2  Tạo commitment che link secret -> wallet_core.generate_blinding_factor / compute_commitment
  3  Chứng minh zero-knowledge      -> wallet_core sigma-protocol helpers
  4  Nhận chữ ký mù từ issuer       -> issuer_core.sign_blindly (slowest: 596-bit prime gen)
  5  Giải mù và kiểm tra chữ ký     -> wallet_core.verify_credential
"""

from typing import Callable, Optional

from issuer import issuer as issuer_core
from wallet import wallet as wallet_core

from . import wallet_store

# step, done, error_code, tech_values (e.g. {"u": "8A3F1C..."} truncated hex)
ProgressCB = Callable[[int, bool, Optional[str], Optional[dict]], None]


def _trunc_hex(value: int) -> str:
    hex_str = format(value, "X")
    return hex_str[:20] + ("..." if len(hex_str) > 20 else "")


class IssuanceError(Exception):
    """code is a stable machine-readable reason, mapped to Vietnamese
    user-facing text in routes/issuance.py per Task C.6's error table."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def run_issuance(user_id: str, attributes: dict, on_progress: ProgressCB) -> dict:
    # ---- Step 1: đối chiếu cơ sở dữ liệu ----
    record = issuer_core.find_ekyc_record(**attributes)
    if record is None:
        on_progress(1, False, "no_match", None)
        raise IssuanceError("no_match", "Không tìm thấy thông tin trong cơ sở dữ liệu. Kiểm tra lại các trường đã nhập.")
    if record["credential_issued"]:
        on_progress(1, False, "already_issued", None)
        raise IssuanceError("already_issued", "CCCD này đã được cấp credential trước đó.")

    nonce = issuer_core.issue_challenge(attributes)
    if nonce is None:
        on_progress(1, False, "no_match", None)
        raise IssuanceError("no_match", "Không tìm thấy thông tin trong cơ sở dữ liệu. Kiểm tra lại các trường đã nhập.")
    on_progress(1, True, None, None)

    # ---- Step 2: tạo commitment che link secret ----
    cred_def = issuer_core.get_public_cred_def()
    n, S, R = cred_def["n"], cred_def["S"], cred_def["R"]
    ls = wallet_store.get_or_create_link_secret(user_id)
    v_prime = wallet_core.generate_blinding_factor()
    u = wallet_core.compute_commitment(S, R, n, v_prime, ls)
    on_progress(2, True, None, {"u": _trunc_hex(u)})

    # ---- Step 3: chứng minh zero-knowledge (sigma protocol) ----
    v_tilde, ls_tilde = wallet_core.generate_random_exponents()
    u_prime = wallet_core.compute_commitment_prime(S, R, n, v_tilde, ls_tilde)
    c = wallet_core.compute_challenge(u, u_prime, nonce)
    v_hat, ls_hat = wallet_core.compute_responses(c, v_tilde, ls_tilde, v_prime, ls)
    proof = {"nonce": nonce, "u": u, "c": c, "v_hat": v_hat, "ls_hat": ls_hat}
    on_progress(3, True, None, {"c": _trunc_hex(c)})

    wallet_store.save_pending_request(user_id, nonce, v_prime, ls)

    # ---- Step 4: nhận chữ ký mù từ issuer (chậm nhất) ----
    try:
        signed = issuer_core.sign_blindly(attributes, proof)
    except ValueError:
        on_progress(4, False, "bad_proof", None)
        raise IssuanceError("bad_proof", "Lỗi xác thực. Vui lòng thử lại.")
    on_progress(4, True, None, {"a": _trunc_hex(signed["a"])})

    # ---- Step 5: giải mù và kiểm tra chữ ký ----
    v = v_prime + signed["v_prime_prime"]
    credential = {"a": signed["a"], "e": signed["e"], "v": v}
    if not wallet_core.verify_credential(credential, attributes, cred_def, ls):
        on_progress(5, False, "bad_signature", None)
        raise IssuanceError("bad_signature", "Chữ ký nhận được không hợp lệ. Vui lòng thử lại.")

    wallet_store.save_credential(user_id, credential)
    wallet_store.save_attributes(user_id, attributes)
    wallet_store.clear_pending_request(user_id)
    on_progress(5, True, None, None)

    return credential
