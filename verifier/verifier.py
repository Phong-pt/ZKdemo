import secrets
import time

from common import encode_attribute, hash_three

_pending_sessions: dict[str, dict] = {}

E_HAT_BITS = 456
E_START = 1 << 596
SESSION_TTL_SECONDS = 300


def _prune_expired_sessions() -> None:
    now = time.time()
    expired = [n_v for n_v, s in _pending_sessions.items() if now - s["created_at"] > SESSION_TTL_SECONDS]
    for n_v in expired:
        del _pending_sessions[n_v]


def create_presentation_request(revealed_attrs: list[str]) -> dict:
    _prune_expired_sessions()
    n_v = str(secrets.randbits(80))
    request = {"nonce": n_v, "revealed_attrs": revealed_attrs}
    _pending_sessions[n_v] = {**request, "created_at": time.time()}
    return request


def _check_presentation(presentation: dict, cred_def: dict, session: dict) -> bool:
    n, S, R, Z = cred_def["n"], cred_def["S"], cred_def["R"], cred_def["Z"]
    R_attrs = cred_def["R_attrs"]
    n_v = session["nonce"]

    a_prime = presentation["a_prime"]
    c = presentation["c"]
    e_hat = presentation["e_hat"]
    v_hat = presentation["v_hat"]
    m_ls_hat = presentation["m_ls_hat"]
    m_hats = presentation["m_hats"]
    revealed = presentation["revealed"]

    if not (1 < a_prime < n):
        return False
    if not (0 <= e_hat < (1 << E_HAT_BITS)):
        return False
    if v_hat < 0:
        return False

    revealed_attrs = set(session["revealed_attrs"])
    if set(revealed.keys()) != revealed_attrs:
        return False

    hidden_attrs = [attr for attr in R_attrs if attr not in revealed_attrs]
    if set(m_hats.keys()) != set(hidden_attrs):
        return False

    for attr, pair in revealed.items():
        if encode_attribute(pair["raw"]) != pair["encoded"]:
            return False

    revealed_product = 1
    for attr, pair in revealed.items():
        revealed_product = revealed_product * pow(R_attrs[attr], pair["encoded"], n) % n

    D = Z * pow(revealed_product, -1, n) % n
    D = D * pow(a_prime, -E_START, n) % n

    T_hat = pow(D, -c, n)
    T_hat = T_hat * pow(a_prime, e_hat, n) % n
    T_hat = T_hat * pow(S, v_hat, n) % n
    T_hat = T_hat * pow(R, m_ls_hat, n) % n
    for attr in hidden_attrs:
        T_hat = T_hat * pow(R_attrs[attr], m_hats[attr], n) % n

    c_prime = hash_three(T_hat, a_prime, n_v)
    return c_prime == c


def verify_presentation(presentation: dict, cred_def: dict, n_v: str) -> bool:
    session = _pending_sessions.get(n_v)
    if session is None:
        return False
    if time.time() - session["created_at"] > SESSION_TTL_SECONDS:
        _pending_sessions.pop(n_v, None)
        return False
    try:
        return _check_presentation(presentation, cred_def, session)
    except (KeyError, ValueError, ZeroDivisionError):
        return False
    finally:
        _pending_sessions.pop(n_v, None)
