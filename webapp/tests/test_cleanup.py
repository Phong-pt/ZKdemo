"""Task C.3's required check: after a successful issuance,
webapp/data/wallets/{user_id}/ must contain exactly link_secret.json,
credential.json, attributes.json — nothing else left behind
(no pending_request.json, no stray temp files).

This also doubles as an end-to-end smoke test of the real crypto path:
it drives issuance_service.run_issuance() directly (no WebAuthn, no HTTP —
those need a real browser/authenticator) against the one seeded EKYC_DB
record, calling straight into the actual issuer.py / wallet.py functions.

Run from the repo root:  python -m webapp.tests.test_cleanup
"""

import secrets
import shutil
import sys

sys.path.insert(0, ".")

from issuer.issuer import EKYC_DB  # noqa: E402
from webapp import config, wallet_store  # noqa: E402
from webapp.issuance_service import IssuanceError, run_issuance  # noqa: E402


def log(*args):
    print("[test_cleanup]", *args)


def main() -> None:
    user_id = "test_" + secrets.token_hex(4)
    attributes = {k: EKYC_DB[0][k] for k in ["cccd", "name", "dob", "nationality", "address"]}

    events = []
    run_issuance(user_id, attributes, lambda step, done, error, tech: events.append((step, done, error)))

    assert events[-1] == (5, True, None), f"expected a clean finish, got {events}"
    log("issuance steps:", events)

    files = sorted(p.name for p in wallet_store.wallet_dir(user_id).iterdir())
    expected = ["attributes.json", "credential.json", "link_secret.json"]
    assert files == expected, f"expected exactly {expected}, found {files}"
    log("wallet dir contains exactly:", files)

    cred = wallet_store.get_credential(user_id)
    assert set(cred.keys()) == {"a", "e", "v"}
    log("credential fields:", list(cred.keys()))

    # second attempt with the same CCCD must be rejected (already issued)
    try:
        run_issuance(user_id + "_2", attributes, lambda *a: None)
        raise AssertionError("expected IssuanceError(already_issued)")
    except IssuanceError as exc:
        assert exc.code == "already_issued", exc.code
        log("re-issuance correctly rejected:", exc.code)

    # unknown CCCD must be rejected too
    bad_attrs = dict(attributes, cccd="000000000000")
    try:
        run_issuance("test_bad", bad_attrs, lambda *a: None)
        raise AssertionError("expected IssuanceError(no_match)")
    except IssuanceError as exc:
        assert exc.code == "no_match", exc.code
        log("unknown CCCD correctly rejected:", exc.code)

    shutil.rmtree(wallet_store.wallet_dir(user_id))
    shutil.rmtree(wallet_store.wallet_dir("test_bad"), ignore_errors=True)
    log("OK")


if __name__ == "__main__":
    main()
