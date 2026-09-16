import json
import secrets
from pathlib import Path

from common import encode_attribute, hash_three

WALLET_DIR = Path(__file__).resolve().parent
WALLETS_DIR = WALLET_DIR / "wallets"
DEFAULT_WALLET_ID = "demo"


def wallet_dir(wallet_id: str) -> Path:
    directory = WALLETS_DIR / wallet_id
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def link_secret_file(wallet_id: str) -> Path:
    return wallet_dir(wallet_id) / "link_secret.json"


def credential_file(wallet_id: str) -> Path:
    return wallet_dir(wallet_id) / "credential.json"


def pending_request_file(wallet_id: str) -> Path:
    return wallet_dir(wallet_id) / "pending_request.json"


def identity_file(wallet_id: str) -> Path:
    return wallet_dir(wallet_id) / "identity.json"

EKYC_DATA = {
    "cccd": "012205007445",
    "name": "Phạm Thế Phong",
    "dob": "05/05/2005",
    "sex": "Nam",
    "nationality": "Việt Nam",
    "origin": "Lai Châu",
    "residence": "Tổ 1, Phường Đoàn Kết, Thành phố Lai Châu",
    "expiry": "05/05/2030",
}


def get_link_secret(wallet_id: str = DEFAULT_WALLET_ID, bits: int = 256) -> int:
    path = link_secret_file(wallet_id)
    if path.exists():
        return int(json.loads(path.read_text(encoding="utf-8"))["link_secret"], 16)
    link_secret = secrets.randbits(bits)
    path.write_text(json.dumps({"link_secret": format(link_secret, "x")}), encoding="utf-8")
    return link_secret


def generate_blinding_factor(bits: int = 2048) -> int:
    return secrets.randbits(bits)


def compute_commitment(S: int, R: int, n: int, v_prime: int, ls: int) -> int:
    return int(pow(S, v_prime, n) * pow(R, ls, n) % n)


def save_pending_request(nonce: str, v_prime: int, ls: int, wallet_id: str = DEFAULT_WALLET_ID) -> None:
    pending_request_file(wallet_id).write_text(
        json.dumps({"nonce": nonce, "v_prime": format(v_prime, "x"), "ls": format(ls, "x")}),
        encoding="utf-8",
    )


def load_pending_request(nonce: str, wallet_id: str = DEFAULT_WALLET_ID) -> tuple[int, int]:
    data = json.loads(pending_request_file(wallet_id).read_text(encoding="utf-8"))
    if data["nonce"] != nonce:
        raise ValueError("nonce không khớp yêu cầu đang chờ giải mù")
    return int(data["v_prime"], 16), int(data["ls"], 16)


def clear_pending_request(wallet_id: str = DEFAULT_WALLET_ID) -> None:
    path = pending_request_file(wallet_id)
    if path.exists():
        path.unlink()


def generate_random_exponents() -> tuple[int, int]:
    return secrets.randbits(3488), secrets.randbits(593)


def compute_commitment_prime(S: int, R: int, n: int, v_tilde: int, ls_tilde: int) -> int:
    return int(pow(S, v_tilde, n) * pow(R, ls_tilde, n) % n)


def compute_responses(
    c: int, v_tilde: int, ls_tilde: int, v_prime: int, ls: int
) -> tuple[int, int]:
    return v_tilde + c * v_prime, ls_tilde + c * ls


def compute_challenge(u: int, u_prime: int, nonce: str) -> int:
    return hash_three(u, u_prime, nonce)


def verify_credential(credential: dict, attributes: dict, cred_def: dict, ls: int) -> bool:
    n, S, R, Z = cred_def["n"], cred_def["S"], cred_def["R"], cred_def["Z"]
    R_attrs = cred_def["R_attrs"]
    a, e, v = credential["a"], credential["e"], credential["v"]

    product = 1
    for attr, gen in R_attrs.items():
        m = encode_attribute(attributes[attr])
        product = product * pow(gen, m, n) % n

    denom = (pow(S, v, n) * pow(R, ls, n) % n) * product % n
    q_check = Z * pow(denom, -1, n) % n
    return pow(a, e, n) == q_check


def unblind_signature(
    a: int, e: int, v_prime_prime: int, nonce: str, attributes: dict, cred_def: dict,
    wallet_id: str = DEFAULT_WALLET_ID,
) -> dict:
    v_prime, ls = load_pending_request(nonce, wallet_id)
    v = v_prime + v_prime_prime
    credential = {"a": a, "e": e, "v": v}

    if not verify_credential(credential, attributes, cred_def, ls):
        raise ValueError("chữ ký issuer trả về không hợp lệ với credential vừa giải mù")

    credential_file(wallet_id).write_text(
        json.dumps({k: str(val) for k, val in credential.items()}), encoding="utf-8"
    )
    clear_pending_request(wallet_id)
    return credential


def get_credential(wallet_id: str = DEFAULT_WALLET_ID) -> dict | None:
    path = credential_file(wallet_id)
    if not path.exists():
        return None
    cred = json.loads(path.read_text(encoding="utf-8"))
    return {k: int(v) for k, v in cred.items()}


def save_identity(attributes: dict, wallet_id: str = DEFAULT_WALLET_ID) -> None:
    identity_file(wallet_id).write_text(json.dumps(attributes, ensure_ascii=False), encoding="utf-8")


def get_identity(wallet_id: str = DEFAULT_WALLET_ID) -> dict | None:
    path = identity_file(wallet_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def receive_presentation_nonce(n_v: str) -> str:
    if not n_v.isdigit() or not (0 <= int(n_v) < (1 << 80)):
        raise ValueError("n_v không hợp lệ")
    return n_v


R_BITS = 2128
E_START = 1 << 596
E_TILDE_BITS = 456
V_TILDE_BITS = 3060
M_TILDE_BITS = 593


def create_presentation(
    credential: dict, attributes: dict, ls: int, cred_def: dict, presentation_request: dict
) -> dict:
    n, S, R, R_attrs = cred_def["n"], cred_def["S"], cred_def["R"], cred_def["R_attrs"]
    a, e, v = credential["a"], credential["e"], credential["v"]
    n_v = receive_presentation_nonce(presentation_request["nonce"])
    revealed = set(presentation_request["revealed_attrs"])
    hidden = [attr for attr in R_attrs if attr not in revealed]

    r = secrets.randbits(R_BITS)
    a_prime = a * pow(S, r, n) % n
    v_star = v - e * r
    e_star = e - E_START

    e_tilde = secrets.randbits(E_TILDE_BITS)
    v_tilde = secrets.randbits(V_TILDE_BITS)
    m_ls_tilde = secrets.randbits(M_TILDE_BITS)
    m_tildes = {attr: secrets.randbits(M_TILDE_BITS) for attr in hidden}

    T = pow(a_prime, e_tilde, n)
    T = T * pow(S, v_tilde, n) % n
    T = T * pow(R, m_ls_tilde, n) % n
    for attr in hidden:
        T = T * pow(R_attrs[attr], m_tildes[attr], n) % n

    c = hash_three(T, a_prime, n_v)

    e_hat = e_tilde + c * e_star
    v_hat = v_tilde + c * v_star
    m_ls_hat = m_ls_tilde + c * ls
    m_hats = {attr: m_tildes[attr] + c * encode_attribute(attributes[attr]) for attr in hidden}
    revealed_values = {
        attr: {"raw": attributes[attr], "encoded": encode_attribute(attributes[attr])}
        for attr in revealed
    }

    return {
        "a_prime": a_prime,
        "c": c,
        "e_hat": e_hat,
        "v_hat": v_hat,
        "m_ls_hat": m_ls_hat,
        "m_hats": m_hats,
        "revealed": revealed_values,
    }
