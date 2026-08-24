import secrets
import json
from pathlib import Path

import gmpy2

from common import encode_attribute, hash_three

ISSUER_DIR = Path(__file__).resolve().parent
PUBLIC_CREDDEF_FILE = ISSUER_DIR / "cred_def_public.json"
PRIVATE_KEY_FILE = ISSUER_DIR / "issuer_private_key.json"

ATTRIBUTE_NAMES = ["cccd", "name", "dob", "nationality", "address"]

EKYC_DB = [
    {
        "cccd": "012205007445",
        "name": "Phạm Thế Phong",
        "dob": "05/05/2005",
        "nationality": "Việt Nam",
        "address": "Tổ 1, Phường Đoàn Kết, Thành phố Lai Châu",
        "credential_issued": False,
    }
]

_pending_nonces: dict[str, dict] = {}

SMALL_PRIMES = [p for p in range(3, 5000) if gmpy2.is_prime(p)]
_RANDOM_STATE = gmpy2.random_state()


def generate_nonce() -> str:
    return secrets.token_hex(16)


def generate_issuer_blinding_factor(bits: int = 2724) -> int:
    return int(gmpy2.mpz_random(_RANDOM_STATE, 1 << bits)) | (1 << (bits - 1))


def generate_safe_prime(bits: int) -> int:
    while True:
        p_prime = int(gmpy2.mpz_random(_RANDOM_STATE, 1 << bits)) | (
            1 << (bits - 1)
        ) | 1
        skip = False
        for r in SMALL_PRIMES:
            if p_prime % r == 0 or (2 * p_prime + 1) % r == 0:
                skip = True
                break
        if skip:
            continue
        if gmpy2.is_prime(p_prime) and gmpy2.is_prime(2 * p_prime + 1):
            return 2 * p_prime + 1


def setup(bits: int = 1024) -> dict:
    p = generate_safe_prime(bits)
    q = generate_safe_prime(bits)
    n = p * q
    a = int(gmpy2.mpz_random(_RANDOM_STATE, n))
    b = int(gmpy2.mpz_random(_RANDOM_STATE, n))
    z = int(gmpy2.mpz_random(_RANDOM_STATE, n))
    S = pow(a, 2, n)
    R = pow(b, 2, n)
    Z = pow(z, 2, n)
    R_attrs = {}
    for attr in ATTRIBUTE_NAMES:
        r = int(gmpy2.mpz_random(_RANDOM_STATE, n))
        R_attrs[attr] = pow(r, 2, n)
    private_key = {"p": p, "q": q}
    public_creddef = {"n": n, "S": S, "R": R, "Z": Z, "R_attrs": R_attrs}
    ISSUER_DIR.mkdir(exist_ok=True)
    PRIVATE_KEY_FILE.write_text(json.dumps(private_key), encoding="utf-8")
    PUBLIC_CREDDEF_FILE.write_text(
        json.dumps(public_creddef, ensure_ascii=False), encoding="utf-8"
    )
    return {**private_key, **public_creddef}


def get_public_cred_def(bits: int = 1024) -> dict:
    if not PUBLIC_CREDDEF_FILE.exists():
        setup(bits)
    return json.loads(PUBLIC_CREDDEF_FILE.read_text(encoding="utf-8"))


def get_private_key() -> dict:
    if not PRIVATE_KEY_FILE.exists():
        setup()
    return json.loads(PRIVATE_KEY_FILE.read_text(encoding="utf-8"))


def find_ekyc_record(cccd: str, name: str, dob: str, nationality: str, address: str) -> dict | None:
    for record in EKYC_DB:
        if (
            record["cccd"] == cccd
            and record["name"] == name
            and record["dob"] == dob
            and record["nationality"] == nationality
            and record["address"] == address
        ):
            return record
    return None


def issue_challenge(ekyc: dict) -> str | None:
    record = find_ekyc_record(
        cccd=ekyc["cccd"],
        name=ekyc["name"],
        dob=ekyc["dob"],
        nationality=ekyc["nationality"],
        address=ekyc["address"],
    )
    if record is None or record["credential_issued"]:
        return None
    nonce = generate_nonce()
    _pending_nonces[nonce] = ekyc
    return nonce


def generate_prime_in_range(lo: int, hi: int) -> int:
    while True:
        candidate = secrets.randbelow(hi - lo) + lo
        if gmpy2.is_prime(candidate):
            return candidate


def verify_proof(proof: dict) -> bool:
    nonce = proof["nonce"]
    if nonce not in _pending_nonces:
        return False

    public_creddef = get_public_cred_def()
    n = public_creddef["n"]
    S = public_creddef["S"]
    R = public_creddef["R"]

    u = int(proof["u"])
    c = int(proof["c"])
    v_hat = int(proof["v_hat"])
    ls_hat = int(proof["ls_hat"])

    if not (1 < u < n) or gmpy2.gcd(u, n) != 1:
        return False

    u_prime = (pow(S, v_hat, n) * pow(R, ls_hat, n) % n) * pow(u, -c, n) % n
    c_prime = hash_three(u, u_prime, nonce)
    if c_prime != c:
        return False

    return True


def sign_blindly(attributes: dict, proof: dict) -> dict:
    if not verify_proof(proof):
        raise ValueError("ZK proof hoặc nonce không hợp lệ")

    nonce = proof["nonce"]
    verified_ekyc = _pending_nonces[nonce]
    if attributes != verified_ekyc:
        raise ValueError("attributes không khớp dữ liệu eKYC đã xác thực")

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

    e = generate_prime_in_range(2**596, 2**596 + 2**119)
    while gmpy2.gcd(e, phi) != 1:
        e = generate_prime_in_range(2**596, 2**596 + 2**119)

    v2 = generate_issuer_blinding_factor()
    d = int(gmpy2.invert(e, phi))

    product = 1
    for attr, gen in R_attrs.items():
        m = encode_attribute(attributes[attr])
        product = (product * pow(gen, m, n)) % n

    q_val = (u * pow(S, v2, n) % n) * product % n
    q_val = Z * int(gmpy2.invert(q_val, n)) % n

    a = pow(q_val, d, n)

    del _pending_nonces[nonce]
    find_ekyc_record(**attributes)["credential_issued"] = True
    return {"a": a, "e": e, "v_prime_prime": v2}
