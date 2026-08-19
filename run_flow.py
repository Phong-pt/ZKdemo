import threading
import time

import httpx
import uvicorn

from issuer import issuer
from wallet import wallet
from wallet.client import IssuerClient

issuer.setup(bits=1024)

server = uvicorn.Server(uvicorn.Config("issuer.api:app", host="127.0.0.1", port=8000, log_level="warning"))
thread = threading.Thread(target=server.run, daemon=True)
thread.start()

client = IssuerClient()
for _ in range(50):
    try:
        client.request_nonce(wallet.EKYC_DATA)
        break
    except httpx.ConnectError:
        time.sleep(0.2)
else:
    raise RuntimeError("Issuer server không khởi động được")

nonce = client.request_nonce(wallet.EKYC_DATA)
assert nonce, "eKYC không hợp lệ"

cred_def = client.get_public_cred_def()
n = cred_def["n"]
S = cred_def["S"]
R = cred_def["R"]

ls = wallet.get_link_secret()
v_prime = wallet.generate_blinding_factor()
u = wallet.compute_commitment(S, R, n, v_prime, ls)

l = v_prime.bit_length() + 128
v_tilde, ls_tilde = wallet.generate_random_exponents(l)
u_prime = wallet.compute_commitment_prime(S, R, n, v_tilde, ls_tilde)
c = wallet.compute_challenge(u, u_prime, nonce)
v_hat, ls_hat = wallet.compute_responses(c, v_tilde, ls_tilde, v_prime, ls)

proof = {
    "u": str(u),
    "c": str(c),
    "v_hat": str(v_hat),
    "ls_hat": str(ls_hat),
    "nonce": nonce,
    "ls_id": wallet.compute_link_secret_id(R, n),
}
signed = client.request_credential(proof, wallet.EKYC_DATA)

credential = wallet.unblind_signature(
    signed["a"], signed["e"], v_prime, signed["v_prime_prime"]
)
print("Credential hoàn chỉnh:")
for k, val in credential.items():
    print(f"  {k}: {val}")

server.should_exit = True
