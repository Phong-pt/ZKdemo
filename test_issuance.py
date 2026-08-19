import threading
import time

import httpx
import uvicorn

from wallet import wallet
from wallet.client import IssuerClient, AlreadyIssuedError


def full_session(client, ekyc, ls_id_fn=None):
    cd = client.get_public_cred_def()
    n, S, R = cd["n"], cd["S"], cd["R"]
    nonce = client.request_nonce(ekyc)
    ls = wallet.get_link_secret()
    v = wallet.generate_blinding_factor()
    u = wallet.compute_commitment(S, R, n, v, ls)
    l = v.bit_length() + 128
    vt, lst = wallet.generate_random_exponents(l)
    up = wallet.compute_commitment_prime(S, R, n, vt, lst)
    c = wallet.compute_challenge(u, up, nonce)
    vh, lsh = wallet.compute_responses(c, vt, lst, v, ls)
    if ls_id_fn is None:
        ls_id = wallet.compute_link_secret_id(R, n)
    else:
        ls_id = ls_id_fn(R, n)
    proof = {"u": str(u), "c": str(c), "v_hat": str(vh), "ls_hat": str(lsh), "nonce": nonce, "ls_id": ls_id}
    return client.request_credential(proof, ekyc)


server = uvicorn.Server(uvicorn.Config("issuer.api:app", host="127.0.0.1", port=8000, log_level="warning"))
threading.Thread(target=server.run, daemon=True).start()
client = IssuerClient()
for _ in range(50):
    try:
        client.request_nonce(wallet.EKYC_DATA)
        break
    except httpx.ConnectError:
        time.sleep(0.2)

import secrets

def fake_wallet_ls_id(R, n):
    fake_ls = secrets.randbits(256)
    return str(pow(R, fake_ls, n))


print("=== Test 1: Lần đầu xin credential (cccd mới, ls mới) ===")
full_session(client, wallet.EKYC_DATA)
print("OK - cho qua, ghi nhận ánh xạ cccd->ls")

print()
print("=== Test 2: Cùng người, cùng wallet (cùng ls), xin credential tiếp ===")
full_session(client, wallet.EKYC_DATA)
print("OK - cho qua (cccd khớp ls_id cũ)")

print()
print("=== Test 3: Cùng CCCD nhưng link_secret mới (cài app mới) ===")
try:
    full_session(client, wallet.EKYC_DATA, ls_id_fn=fake_wallet_ls_id)
    print("LỖI: wallet mới cùng cccd vẫn được cấp!")
except AlreadyIssuedError as ex:
    print("ĐÚNG - chặn:", ex)

server.should_exit = True
