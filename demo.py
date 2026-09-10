import sys

from issuer import issuer
from wallet import wallet
from verifier import verifier

sys.stdout.reconfigure(encoding="utf-8")


def run_issuance(cred_def: dict) -> dict:
    nonce = issuer.issue_challenge(wallet.EKYC_DATA)
    if nonce is None:
        raise RuntimeError("issuer từ chối phát nonce (eKYC không khớp hoặc CCCD đã có credential)")

    ls = wallet.get_link_secret()
    v_prime = wallet.generate_blinding_factor()
    u = wallet.compute_commitment(cred_def["S"], cred_def["R"], cred_def["n"], v_prime, ls)
    wallet.save_pending_request(nonce, v_prime, ls)

    v_tilde, ls_tilde = wallet.generate_random_exponents()
    u_prime = wallet.compute_commitment_prime(cred_def["S"], cred_def["R"], cred_def["n"], v_tilde, ls_tilde)
    c = wallet.compute_challenge(u, u_prime, nonce)
    v_hat, ls_hat = wallet.compute_responses(c, v_tilde, ls_tilde, v_prime, ls)

    proof = {"nonce": nonce, "u": u, "c": c, "v_hat": v_hat, "ls_hat": ls_hat}
    signed = issuer.sign_blindly(wallet.EKYC_DATA, proof)
    return wallet.unblind_signature(
        signed["a"], signed["e"], signed["v_prime_prime"], nonce, wallet.EKYC_DATA, cred_def
    )


def run_presentation(credential: dict, cred_def: dict, revealed_attrs: list[str]) -> bool:
    ls = wallet.get_link_secret()
    req = verifier.create_presentation_request(revealed_attrs)
    pres = wallet.create_presentation(credential, wallet.EKYC_DATA, ls, cred_def, req)
    return verifier.verify_presentation(pres, req["nonce"])


def main() -> None:
    print("== 1. Issuer setup (sinh cred-def CL nếu chưa có) ==")
    cred_def = issuer.get_public_cred_def()
    print("n bits:", cred_def["n"].bit_length())

    print("\n== 2. Issuance (Holder xin cấp credential qua blind signing) ==")
    credential = run_issuance(cred_def)
    print("Credential đã cấp:", {k: str(v)[:24] + "…" for k, v in credential.items()})

    print("\n== 3. Presentation (Holder chứng minh cho Verifier, tiết lộ 'nationality') ==")
    ok = run_presentation(credential, cred_def, ["nationality"])
    print("Verifier xác minh proof:", "HỢP LỆ" if ok else "THẤT BẠI")


if __name__ == "__main__":
    main()
