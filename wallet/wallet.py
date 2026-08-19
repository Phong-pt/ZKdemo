import hashlib
import json
import secrets
from pathlib import Path

SHARED_DIR = Path(__file__).resolve().parent.parent / "shared"
WALLET_DIR = Path(__file__).resolve().parent
EKYC_FILE = SHARED_DIR / "ekyc.json"
NONCE_FILE = SHARED_DIR / "nonce.json"
PROOF_FILE = SHARED_DIR / "proof.json"
PUBLIC_CREDDEF_FILE = SHARED_DIR / "cred_def_public.json"
LINK_SECRET_FILE = WALLET_DIR / "link_secret.json"
CREDENTIAL_FILE = WALLET_DIR / "credential.json"

EKYC_DATA = {
    "cccd": "012205007445",
    "name": "Phạm Thế Phong",
    "dob": "05/05/2005",
    "nationality": "Việt Nam",
    "address": "Tổ 1, Phường Đoàn Kết, Thành phố Lai Châu",
}


def get_public_cred_def() -> dict:
    return json.loads(PUBLIC_CREDDEF_FILE.read_text(encoding="utf-8"))


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
    return (pow(S, v_prime, n) * pow(R, ls, n)) % n


def generate_random_exponents(l: int) -> tuple[int, int]:
    return secrets.randbits(l), secrets.randbits(l)


def compute_commitment_prime(S: int, R: int, n: int, v_tilde: int, ls_tilde: int) -> int:
    return (pow(S, v_tilde, n) * pow(R, ls_tilde, n)) % n


def compute_responses(
    c: int, v_tilde: int, ls_tilde: int, v_prime: int, ls: int
) -> tuple[int, int]:
    return v_tilde + c * v_prime, ls_tilde + c * ls


def send_ekyc_to_issuer() -> None:
    SHARED_DIR.mkdir(exist_ok=True)
    EKYC_FILE.write_text(json.dumps(EKYC_DATA, ensure_ascii=False), encoding="utf-8")


def receive_nonce() -> str | None:
    if not NONCE_FILE.exists():
        return None
    return json.loads(NONCE_FILE.read_text(encoding="utf-8"))["nonce"]


def hash_challenge(u: str, u_prime: str, nonce: str) -> str:
    return hashlib.sha256(f"{u}|{u_prime}|{nonce}".encode()).hexdigest()


def compute_challenge(u: int, u_prime: int) -> int | None:
    nonce = receive_nonce()
    if not nonce:
        return None
    return int(hash_challenge(str(u), str(u_prime), nonce), 16)


def send_proof_to_issuer(u: int, c: int, v_hat: int, ls_hat: int) -> bool:
    nonce = receive_nonce()
    if not nonce:
        return False
    SHARED_DIR.mkdir(exist_ok=True)
    PROOF_FILE.write_text(
        json.dumps(
            {
                "u": str(u),
                "c": str(c),
                "v_hat": str(v_hat),
                "ls_hat": str(ls_hat),
                "nonce": nonce,
            }
        ),
        encoding="utf-8",
    )
    return True


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
