"""Per-user file storage under webapp/data/wallets/{user_id}/.

wallet/wallet.py's own get_link_secret / save_pending_request /
load_pending_request / clear_pending_request / get_credential are hardcoded
to a single fixed directory (WALLET_DIR = the wallet/ package folder) —
fine for the CLI demo, not usable for a multi-user server without either
editing that file (not allowed — see prompt-webapp-wallet.md) or
monkeypatching its module-level globals per request (a real race condition
under concurrent requests).

So this module re-implements just the file I/O, byte-for-byte the same JSON
shape wallet.py uses, scoped to one user's directory. The actual cryptography
(compute_commitment, generate_blinding_factor, verify_credential, …) is never
duplicated here — callers import those straight from wallet.wallet.
"""

import json
import secrets
from pathlib import Path

from . import config

ATTRIBUTE_NAMES = ["cccd", "name", "dob", "nationality", "address"]


def wallet_dir(user_id: str) -> Path:
    d = config.WALLETS_DIR / user_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_or_create_link_secret(user_id: str, bits: int = 256) -> int:
    path = wallet_dir(user_id) / "link_secret.json"
    if path.exists():
        return int(json.loads(path.read_text(encoding="utf-8"))["link_secret"], 16)
    link_secret = secrets.randbits(bits)
    path.write_text(json.dumps({"link_secret": format(link_secret, "x")}), encoding="utf-8")
    return link_secret


def save_pending_request(user_id: str, nonce: str, v_prime: int, ls: int) -> None:
    path = wallet_dir(user_id) / "pending_request.json"
    path.write_text(
        json.dumps({"nonce": nonce, "v_prime": format(v_prime, "x"), "ls": format(ls, "x")}),
        encoding="utf-8",
    )


def load_pending_request(user_id: str, nonce: str) -> tuple[int, int]:
    path = wallet_dir(user_id) / "pending_request.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    if data["nonce"] != nonce:
        raise ValueError("nonce không khớp yêu cầu đang chờ giải mù")
    return int(data["v_prime"], 16), int(data["ls"], 16)


def clear_pending_request(user_id: str) -> None:
    path = wallet_dir(user_id) / "pending_request.json"
    if path.exists():
        path.unlink()


def save_credential(user_id: str, credential: dict) -> None:
    path = wallet_dir(user_id) / "credential.json"
    path.write_text(
        json.dumps({k: str(v) for k, v in credential.items()}), encoding="utf-8"
    )


def get_credential(user_id: str) -> dict | None:
    path = wallet_dir(user_id) / "credential.json"
    if not path.exists():
        return None
    return {k: int(v) for k, v in json.loads(path.read_text(encoding="utf-8")).items()}


def save_attributes(user_id: str, attributes: dict) -> None:
    path = wallet_dir(user_id) / "attributes.json"
    path.write_text(json.dumps(attributes, ensure_ascii=False), encoding="utf-8")


def get_attributes(user_id: str) -> dict | None:
    path = wallet_dir(user_id) / "attributes.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def has_credential(user_id: str) -> bool:
    return (wallet_dir(user_id) / "credential.json").exists()


def credential_issued_at(user_id: str) -> float | None:
    """No separate metadata file — Task C.3 requires wallets/{user_id}/ to
    hold exactly link_secret.json, credential.json, attributes.json once
    issuance is done, so issued_at is read from credential.json's mtime
    instead of being stored again."""
    path = wallet_dir(user_id) / "credential.json"
    return path.stat().st_mtime if path.exists() else None
