import hashlib
import math
import secrets
import json
from pathlib import Path

SHARED_DIR = Path(__file__).resolve().parent.parent / "shared"
ISSUER_DIR = Path(__file__).resolve().parent
EKYC_FILE = SHARED_DIR / "ekyc.json"
NONCE_FILE = SHARED_DIR / "nonce.json"
PROOF_FILE = SHARED_DIR / "proof.json"
PUBLIC_CREDDEF_FILE = SHARED_DIR / "cred_def_public.json"
PRIVATE_KEY_FILE = ISSUER_DIR / "issuer_private_key.json"

EKYC_DB = [
    {
        "cccd": "012205007445",
        "name": "Phạm Thế Phong",
        "dob": "05/05/2005",
        "nationality": "Việt Nam",
        "address": "Tổ 1, Phường Đoàn Kết, Thành phố Lai Châu",
    }
]


def generate_nonce() -> str:
    return secrets.token_hex(16)


def generate_issuer_blinding_factor(bits: int = 2724) -> int:
    return secrets.randbits(bits)


def is_probable_prime(n: int, k: int = 40) -> bool:
    if n < 2:
        return False
    for p in (2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37):
        if n % p == 0:
            return n == p
    d, r = n - 1, 0
    while d % 2 == 0:
        d //= 2
        r += 1
    for _ in range(k):
        a = secrets.randbelow(n - 3) + 2
        x = pow(a, d, n)
        if x == 1 or x == n - 1:
            continue
        for _ in range(r - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True


def generate_safe_prime(bits: int) -> int:
    while True:
        p_prime = secrets.randbits(bits) | (1 << (bits - 1)) | 1
        if not is_probable_prime(p_prime):
            continue
        p = 2 * p_prime + 1
        if is_probable_prime(p):
            return p


def setup(bits: int = 512) -> dict:
    p = generate_safe_prime(bits)
    q = generate_safe_prime(bits)
    n = p * q
    a = secrets.randbelow(n)
    b = secrets.randbelow(n)
    z = secrets.randbelow(n)
    S = pow(a, 2, n)
    R = pow(b, 2, n)
    Z = pow(z, 2, n)
    R_attrs = {}
    for attr in EKYC_DB[0].keys():
        r = secrets.randbelow(n)
        R_attrs[attr] = pow(r, 2, n)
    private_key = {"p": p, "q": q}
    public_creddef = {"n": n, "S": S, "R": R, "Z": Z, "R_attrs": R_attrs}
    ISSUER_DIR.mkdir(exist_ok=True)
    PRIVATE_KEY_FILE.write_text(json.dumps(private_key), encoding="utf-8")
    SHARED_DIR.mkdir(exist_ok=True)
    PUBLIC_CREDDEF_FILE.write_text(
        json.dumps(public_creddef, ensure_ascii=False), encoding="utf-8"
    )
    return {**private_key, **public_creddef}


def get_public_cred_def(bits: int = 512) -> dict:
    if not PUBLIC_CREDDEF_FILE.exists():
        setup(bits)
    return json.loads(PUBLIC_CREDDEF_FILE.read_text(encoding="utf-8"))


def get_private_key() -> dict:
    if not PRIVATE_KEY_FILE.exists():
        setup()
    return json.loads(PRIVATE_KEY_FILE.read_text(encoding="utf-8"))


def verify_cccd(cccd: str, name: str, dob: str, nationality: str, address: str) -> bool:
    return any(
        record["cccd"] == cccd
        and record["name"] == name
        and record["dob"] == dob
        and record["nationality"] == nationality
        and record["address"] == address
        for record in EKYC_DB
    )


def receive_ekyc() -> dict | None:
    if not EKYC_FILE.exists():
        return None
    return json.loads(EKYC_FILE.read_text(encoding="utf-8"))


def send_nonce_to_wallet() -> str | None:
    SHARED_DIR.mkdir(exist_ok=True)
    ekyc = receive_ekyc()
    if not ekyc:
        return None
    if not verify_cccd(
        cccd=ekyc["cccd"],
        name=ekyc["name"],
        dob=ekyc["dob"],
        nationality=ekyc["nationality"],
        address=ekyc["address"],
    ):
        return None
    nonce = generate_nonce()
    NONCE_FILE.write_text(json.dumps({"nonce": nonce}), encoding="utf-8")
    return nonce


def get_nonce() -> str | None:
    if not NONCE_FILE.exists():
        return None
    return json.loads(NONCE_FILE.read_text(encoding="utf-8"))["nonce"]


def hash_attribute(value: str) -> int:
    return int(hashlib.sha256(value.encode()).hexdigest(), 16)


def generate_prime(bits: int) -> int:
    while True:
        candidate = secrets.randbits(bits) | (1 << (bits - 1)) | 1
        if is_probable_prime(candidate):
            return candidate


def verify_proof() -> dict | None:
    nonce = get_nonce()
    if not nonce:
        return None
    if not PROOF_FILE.exists():
        return None
    proof = json.loads(PROOF_FILE.read_text(encoding="utf-8"))
    if proof["nonce"] != nonce:
        return None

    public_creddef = get_public_cred_def()
    n = public_creddef["n"]
    S = public_creddef["S"]
    R = public_creddef["R"]

    u = int(proof["u"])
    c = int(proof["c"])
    v_hat = int(proof["v_hat"])
    ls_hat = int(proof["ls_hat"])

    u_prime = (pow(S, v_hat, n) * pow(R, ls_hat, n) % n) * pow(u, -c, n) % n
    c_prime = int(
        hashlib.sha256(f"{u}|{u_prime}|{nonce}".encode()).hexdigest(), 16
    )
    if c_prime != c:
        return None

    NONCE_FILE.unlink()
    PROOF_FILE.unlink()
    return proof


def sign_blindly(attributes: dict) -> dict:
    proof = verify_proof()
    if not proof:
        raise ValueError("ZK proof hoặc nonce không hợp lệ")
    u = int(proof["u"])

    public_creddef = get_public_cred_def()
    private_key = get_private_key()
    n = public_creddef["n"]
    p = private_key["p"]
    q = private_key["q"]
    S = public_creddef["S"]
    Z = public_creddef["Z"]
    R_attrs = public_creddef["R_attrs"]
    phi = (p - 1) * (q - 1)

    e = generate_prime(17)
    while math.gcd(e, phi) != 1:
        e = generate_prime(17)

    v2 = generate_issuer_blinding_factor()
    d = pow(e, -1, phi)

    product = 1
    for attr, gen in R_attrs.items():
        m = hash_attribute(attributes[attr])
        product = (product * pow(gen, m, n)) % n

    q_val = (u * pow(S, v2, n) % n) * product % n
    q_val = Z * pow(q_val, -1, n) % n

    a = pow(q_val, d, n)
    return {"a": a, "e": e, "v_prime_prime": v2}
