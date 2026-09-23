import json
import os
import secrets
from pathlib import Path
from threading import RLock

import gmpy2

from common import encode_attribute, hash_three

ISSUER_DIR = Path(__file__).resolve().parent
_key_lock = RLock()
PUBLIC_CREDDEF_FILE = ISSUER_DIR / "cred_def_public.json"
PRIVATE_KEY_FILE = ISSUER_DIR / "issuer_private_key.json"
EKYC_DB_FILE = ISSUER_DIR / "ekyc_db.json"

# Đúng những gì in trên MẶT TRƯỚC thẻ căn cước công dân, theo đúng thứ tự trên thẻ. Issuer không ký
# thứ gì ngoài danh sách này, và verifier cũng không hỏi được gì ngoài danh sách này.
ATTRIBUTE_NAMES = [
    "cccd",         # Số / No.
    "name",         # Họ và tên / Full name
    "dob",          # Ngày sinh / Date of birth
    "sex",          # Giới tính / Sex
    "nationality",  # Quốc tịch / Nationality
    "origin",       # Quê quán / Place of origin
    "residence",    # Nơi thường trú / Place of residence
    "expiry",       # Có giá trị đến / Date of expiry
]

# Cơ sở dữ liệu căn cước giả lập của issuer. Số CCCD dựng theo đúng cấu trúc thật: 3 số mã tỉnh
# nơi đăng ký khai sinh, 1 số thế kỷ + giới tính (0/1 = nam/nữ sinh 1900s, 2/3 = nam/nữ sinh
# 2000s), 2 số cuối năm sinh, 6 số ngẫu nhiên. Bản ghi đầu là thẻ thật dùng để quét demo, chín
# bản ghi còn lại là người ảo.
EKYC_DB = [
    {
        "cccd": "012205007445",
        "name": "Phạm Thế Phong",
        "dob": "05/05/2005",
        "sex": "Nam",
        "nationality": "Việt Nam",
        "origin": "Lai Châu",
        "residence": "Tổ 1, Phường Đoàn Kết, Thành phố Lai Châu",
        "expiry": "05/05/2030",
        "credential_issued": False,
    },
    {
        "cccd": "001190024518",
        "name": "Nguyễn Thị Mai Anh",
        "dob": "14/03/1990",
        "sex": "Nữ",
        "nationality": "Việt Nam",
        "origin": "Hà Nội",
        "residence": "Số 27, Phố Hàng Bông, Phường Hàng Gai, Quận Hoàn Kiếm, Hà Nội",
        "expiry": "14/03/2030",
        "credential_issued": False,
    },
    {
        "cccd": "079098117632",
        "name": "Trần Quốc Bảo",
        "dob": "02/09/1998",
        "sex": "Nam",
        "nationality": "Việt Nam",
        "origin": "Bến Tre",
        "residence": "Số 145, Đường Nguyễn Thị Minh Khai, Phường Bến Nghé, Quận 1, TP Hồ Chí Minh",
        "expiry": "02/09/2038",
        "credential_issued": False,
    },
    {
        "cccd": "031303456189",
        "name": "Lê Thị Hồng Nhung",
        "dob": "21/11/2003",
        "sex": "Nữ",
        "nationality": "Việt Nam",
        "origin": "Hải Phòng",
        "residence": "Số 8, Ngõ 45, Phố Lạch Tray, Phường Đằng Giang, Quận Ngô Quyền, Hải Phòng",
        "expiry": "21/11/2028",
        "credential_issued": False,
    },
    {
        "cccd": "048087334271",
        "name": "Võ Minh Hoàng",
        "dob": "30/06/1987",
        "sex": "Nam",
        "nationality": "Việt Nam",
        "origin": "Quảng Nam",
        "residence": "Số 62, Đường Lê Duẩn, Phường Thạch Thang, Quận Hải Châu, Đà Nẵng",
        "expiry": "30/06/2027",
        "credential_issued": False,
    },
    {
        "cccd": "040195778420",
        "name": "Hoàng Thị Thu Hà",
        "dob": "08/02/1995",
        "sex": "Nữ",
        "nationality": "Việt Nam",
        "origin": "Nghệ An",
        "residence": "Xóm 5, Xã Nghi Phú, Thành phố Vinh, Nghệ An",
        "expiry": "08/02/2035",
        "credential_issued": False,
    },
    {
        "cccd": "092202669537",
        "name": "Đặng Gia Huy",
        "dob": "17/07/2002",
        "sex": "Nam",
        "nationality": "Việt Nam",
        "origin": "Cần Thơ",
        "residence": "Số 12, Đường 3 Tháng 2, Phường Xuân Khánh, Quận Ninh Kiều, Cần Thơ",
        "expiry": "17/07/2027",
        "credential_issued": False,
    },
    {
        "cccd": "025093812064",
        "name": "Bùi Văn Khánh",
        "dob": "25/12/1993",
        "sex": "Nam",
        "nationality": "Việt Nam",
        "origin": "Phú Thọ",
        "residence": "Khu 3, Xã Sơn Vi, Huyện Lâm Thao, Phú Thọ",
        "expiry": "25/12/2033",
        "credential_issued": False,
    },
    {
        "cccd": "056196045983",
        "name": "Ngô Thị Lan Phương",
        "dob": "03/08/1996",
        "sex": "Nữ",
        "nationality": "Việt Nam",
        "origin": "Khánh Hòa",
        "residence": "Số 90, Đường Trần Phú, Phường Lộc Thọ, Thành phố Nha Trang, Khánh Hòa",
        "expiry": "03/08/2036",
        "credential_issued": False,
    },
    {
        "cccd": "027304551728",
        "name": "Dương Thị Ngọc Ánh",
        "dob": "12/04/2004",
        "sex": "Nữ",
        "nationality": "Việt Nam",
        "origin": "Bắc Ninh",
        "residence": "Khu phố Tiền An, Phường Tiền An, Thành phố Bắc Ninh, Bắc Ninh",
        "expiry": "12/04/2029",
        "credential_issued": False,
    },
]

SEED_EKYC_DB = [dict(record) for record in EKYC_DB]


def save_ekyc_db() -> None:
    EKYC_DB_FILE.write_text(json.dumps(EKYC_DB, ensure_ascii=False), encoding="utf-8")


def load_ekyc_db() -> None:
    # Hồ sơ eKYC phải sống sót qua restart cùng với credential đã cấp; nếu không, khởi động lại
    # server là cờ "đã cấp" mất sạch trong khi ví vẫn giữ credential.
    if EKYC_DB_FILE.exists():
        EKYC_DB[:] = json.loads(EKYC_DB_FILE.read_text(encoding="utf-8"))


load_ekyc_db()

_pending_nonces: dict[str, dict] = {}


ATTRIBUTE_LABELS = {
    "cccd": "Số CCCD",
    "name": "Họ và tên",
    "dob": "Ngày sinh",
    "sex": "Giới tính",
    "nationality": "Quốc tịch",
    "origin": "Quê quán",
    "residence": "Nơi thường trú",
    "expiry": "Có giá trị đến",
}


# Thông báo ra ngoài tuyệt đối không nêu trường nào bị lệch. Nói "sai nơi thường trú" là
# xác nhận luôn rằng các trường còn lại đã đúng, biến thông báo lỗi thành một oracle: kẻ dò
# chỉ cần thử lần lượt từng trường là dựng lại được cả hồ sơ mà không phải xâm nhập gì.
# Danh sách trường lệch vẫn giữ trong self.mismatched cho log nội bộ.
class EkycMismatchError(ValueError):
    def __init__(self, mismatched: list[str]) -> None:
        super().__init__("Thông tin không khớp dữ liệu căn cước. Vui lòng quét lại.")
        self.mismatched = mismatched


DEFAULT_TRUSTED_VERIFIER_DOMAINS = {
    "ntq-solution.com.vn": "NTQ Solution",
}


def _load_trusted_verifier_domains() -> dict[str, str]:
    domains = dict(DEFAULT_TRUSTED_VERIFIER_DOMAINS)
    override = os.environ.get("VERIFIER_TRUSTED_DOMAINS_JSON")
    if override:
        domains.update(json.loads(override))
    return domains


TRUSTED_VERIFIER_DOMAINS = _load_trusted_verifier_domains()


def find_verifier_org(email: str) -> str | None:
    if "@" not in email:
        return None
    domain = email.rsplit("@", 1)[-1].strip().lower()
    return TRUSTED_VERIFIER_DOMAINS.get(domain)

SMALL_PRIMES = [p for p in range(3, 5000) if gmpy2.is_prime(p)]
_RANDOM_STATE = gmpy2.random_state(secrets.randbits(256))


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
    with _key_lock:
        if not PUBLIC_CREDDEF_FILE.exists():
            if PRIVATE_KEY_FILE.exists():
                raise RuntimeError("Thiếu khóa công khai; cần khôi phục cặp khóa issuer")
            setup(bits)
        return json.loads(PUBLIC_CREDDEF_FILE.read_text(encoding="utf-8"))


def get_private_key() -> dict:
    with _key_lock:
        if not PRIVATE_KEY_FILE.exists():
            if PUBLIC_CREDDEF_FILE.exists():
                raise RuntimeError("Thiếu khóa riêng; không thể ký với khóa issuer đã công bố")
            setup()
        return json.loads(PRIVATE_KEY_FILE.read_text(encoding="utf-8"))


def find_ekyc_record(**attributes) -> dict | None:
    for record in EKYC_DB:
        if all(record[name] == attributes[name] for name in ATTRIBUTE_NAMES):
            return record
    return None


def find_by_cccd(cccd: str) -> dict | None:
    for record in EKYC_DB:
        if record["cccd"] == cccd:
            return record
    return None


def register_ekyc(ekyc: dict) -> dict:
    record = find_by_cccd(ekyc["cccd"])
    if record is None:
        record = {**ekyc, "credential_issued": False}
        EKYC_DB.append(record)
        save_ekyc_db()
        return record
    mismatched = [name for name in ATTRIBUTE_NAMES if record[name] != ekyc[name]]
    if mismatched:
        raise EkycMismatchError(mismatched)
    return record


def issue_challenge(ekyc: dict) -> str | None:
    record = register_ekyc(ekyc)
    if record["credential_issued"]:
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

    if find_ekyc_record(**attributes)["credential_issued"]:
        _pending_nonces.pop(nonce, None)
        raise ValueError("CCCD này đã được cấp credential")

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
    save_ekyc_db()
    return {"a": a, "e": e, "v_prime_prime": v2}
