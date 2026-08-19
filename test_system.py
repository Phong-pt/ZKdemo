import threading
import time

import httpx
import uvicorn

from issuer import issuer
from wallet import wallet
from wallet.client import IssuerClient

OK = "\u2705"
FAIL = "\u274c"

print("=== BƯỚC 1: GEN LINK SECRET ===")
ls1 = wallet.get_link_secret()
ls2 = wallet.get_link_secret()
print(f"{OK} link_secret: {ls1}")
print(f"{OK} ≤ 256 bit (trong [0, 2^256)):", 0 <= ls1 < 2**256, f"(bit_length={ls1.bit_length()})")
print(f"{OK} chỉ tạo 1 lần (lần 2 trả giá trị cũ):", ls1 == ls2)
v_prime = wallet.generate_blinding_factor()
print(f"{OK} blinding factor v' bit:", v_prime.bit_length())

print()
print("=== BƯỚC 2: SETUP ISSUER + START SERVER ===")
cd = issuer.setup(bits=1024)
print(f"{OK} setup xong, n bit:", cd["n"].bit_length())

server = uvicorn.Server(
    uvicorn.Config("issuer.api:app", host="127.0.0.1", port=8000, log_level="warning")
)
threading.Thread(target=server.run, daemon=True).start()
client = IssuerClient()
for _ in range(50):
    try:
        client.request_nonce(wallet.EKYC_DATA)
        break
    except httpx.ConnectError:
        time.sleep(0.2)
print(f"{OK} server chạy trên 127.0.0.1:8000")


def run_session(ekyc_data, label):
    print()
    print(f"=== {label} ===")
    cred_def = client.get_public_cred_def()
    n, S, R = cred_def["n"], cred_def["S"], cred_def["R"]
    try:
        nonce = client.request_nonce(ekyc_data)
        print(f"{OK} nonce nhận từ issuer: {nonce[:16]}...")
    except httpx.HTTPStatusError:
        print(f"{OK} eKYC bị issuer TỪ CHỐI (kỳ vọng đúng) — không cấp nonce")
        return False

    ls = wallet.get_link_secret()
    v_prime = wallet.generate_blinding_factor()
    u = wallet.compute_commitment(S, R, n, v_prime, ls)
    l = v_prime.bit_length() + 128
    v_tilde, ls_tilde = wallet.generate_random_exponents(l)
    u_prime = wallet.compute_commitment_prime(S, R, n, v_tilde, ls_tilde)
    c = wallet.compute_challenge(u, u_prime, nonce)
    v_hat, ls_hat = wallet.compute_responses(c, v_tilde, ls_tilde, v_prime, ls)
    proof = {"u": str(u), "c": str(c), "v_hat": str(v_hat), "ls_hat": str(ls_hat), "nonce": nonce}

    try:
        signed = client.request_credential(proof, ekyc_data)
    except httpx.HTTPStatusError:
        print(f"{FAIL} ký bị từ chối")
        return False
    cred = wallet.unblind_signature(signed["a"], signed["e"], v_prime, signed["v_prime_prime"])
    print(f"{OK} ký thành công: e = {cred['e'].bit_length()} bit")
    print(f"{OK} v = v' + v'':", cred["v"] == v_prime + signed["v_prime_prime"])
    return True


print()
print("=== BƯỚC 3: FLOW ĐÚNG (cccd 012205007445) ===")
ok = run_session(wallet.EKYC_DATA, "eKYC HỢP LỆ")

print()
print("=== BƯỚC 4: VERIFY CREDENTIAL ĐỘC LẬP ===")
cred = wallet.get_credential()
cd = issuer.get_public_cred_def()
n, S, R, Z, R_attrs = cd["n"], cd["S"], cd["R"], cd["Z"], cd["R_attrs"]
ls = wallet.get_link_secret()
product = 1
for attr, gen in R_attrs.items():
    product = product * pow(gen, issuer.encode_attribute(wallet.EKYC_DATA[attr]), n) % n
lhs = pow(cred["a"], cred["e"], n) * pow(S, cred["v"], n) % n
lhs = lhs * pow(R, ls, n) % n * product % n
print(f"{OK} Z == a^e·S^v·R^ls·∏R_i^mi:", lhs == Z)

print()
print("=== BƯỚC 5: THAY ĐỔI CCCD (sai) ===")
bad_ekyc = dict(wallet.EKYC_DATA)
bad_ekyc["cccd"] = "000000000000"
run_session(bad_ekyc, "eKYC SAI (cccd không tồn tại)")

print()
print("=== BƯỚC 6: THAY ĐỔI CCCD (đúng cccd, sai các trường khác) ===")
bad_ekyc2 = dict(wallet.EKYC_DATA)
bad_ekyc2["name"] = "Nguyễn Văn A"
bad_ekyc2["dob"] = "01/01/1990"
run_session(bad_ekyc2, "eKYC SAI (đúng cccd, sai họ tên + dob)")

server.should_exit = True
