import hashlib
import json
import secrets
from pathlib import Path

WALLET_DIR = Path(__file__).resolve().parent
LINK_SECRET_FILE = WALLET_DIR / "link_secret.json"
CREDENTIAL_FILE = WALLET_DIR / "credential.json"

EKYC_DATA = {
    "cccd": "012205007445",
    "name": "Phạm Thế Phong",
    "dob": "05/05/2005",
    "nationality": "Việt Nam",
    "address": "Tổ 1, Phường Đoàn Kết, Thành phố Lai Châu",
}


def get_link_secret(bits: int = 256) -> int:
    if LINK_SECRET_FILE.exists():
        return int(json.loads(LINK_SECRET_FILE.read_text(encoding="utf-8"))["link_secret"], 16)
    link_secret = secrets.randbits(bits)
    LINK_SECRET_FILE.write_text(
        json.dumps({"link_secret": format(link_secret, "x")}), encoding="utf-8"
    )
    return link_secret


def generate_blinding_factor(bits: int = 2048) -> int:
    return secrets.randbits(bits)


def compute_commitment(S: int, R: int, n: int, v_prime: int, ls: int) -> int:
    return int(pow(S, v_prime, n) * pow(R, ls, n) % n)


def generate_random_exponents(l: int) -> tuple[int, int]:
    return secrets.randbits(l), secrets.randbits(l)


def compute_commitment_prime(S: int, R: int, n: int, v_tilde: int, ls_tilde: int) -> int:
    return int(pow(S, v_tilde, n) * pow(R, ls_tilde, n) % n)


def compute_responses(
    c: int, v_tilde: int, ls_tilde: int, v_prime: int, ls: int
) -> tuple[int, int]:
    return v_tilde + c * v_prime, ls_tilde + c * ls


def compute_link_secret_id(R: int, n: int) -> str:
    return str(pow(R, get_link_secret(), n))


def hash_challenge(u: str, u_prime: str, nonce: str) -> str:
    return hashlib.sha256(f"{u}|{u_prime}|{nonce}".encode()).hexdigest()


def compute_challenge(u: int, u_prime: int, nonce: str) -> int:
    return int(hash_challenge(str(u), str(u_prime), nonce), 16)


def unblind_signature(a: int, e: int, v_prime: int, v_prime_prime: int) -> dict:
    v = v_prime + v_prime_prime
    credential = {"a": a, "e": e, "v": v}
    CREDENTIAL_FILE.write_text(
        json.dumps({k: str(val) for k, val in credential.items()}), encoding="utf-8"
    )
    return credential


def get_credential() -> dict | None:
    if not CREDENTIAL_FILE.exists():
        return None
    cred = json.loads(CREDENTIAL_FILE.read_text(encoding="utf-8"))
    return {k: int(v) for k, v in cred.items()}
