from wallet import wallet
from issuer import issuer

issuer.setup(bits=128)

wallet.send_ekyc_to_issuer()

nonce = issuer.send_nonce_to_wallet()
assert nonce, "eKYC không hợp lệ"

cred_def = wallet.get_public_cred_def()
n = cred_def["n"]
S = cred_def["S"]
R = cred_def["R"]

ls = wallet.get_link_secret()
v_prime = wallet.generate_blinding_factor()
u = wallet.compute_commitment(S, R, n, v_prime, ls)

l = v_prime.bit_length() + 128
v_tilde, ls_tilde = wallet.generate_random_exponents(l)
u_prime = wallet.compute_commitment_prime(S, R, n, v_tilde, ls_tilde)
c = wallet.compute_challenge(u, u_prime)
v_hat, ls_hat = wallet.compute_responses(c, v_tilde, ls_tilde, v_prime, ls)
wallet.send_proof_to_issuer(u, c, v_hat, ls_hat)

ekyc = issuer.receive_ekyc()
signed = issuer.sign_blindly(ekyc)

credential = wallet.unblind_signature(
    signed["a"], signed["e"], v_prime, signed["v_prime_prime"]
)
print("Credential hoàn chỉnh:")
for k, val in credential.items():
    print(f"  {k}: {val}")
