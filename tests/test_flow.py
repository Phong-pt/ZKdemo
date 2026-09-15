import copy
import os
import shutil
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

import api
import auth
from issuer import issuer
from wallet import wallet
from verifier import verifier


HOLDER_A = "holder-a"
HOLDER_B = "holder-b"
VERIFIER = "verifier"


def headers(account):
    return {"Authorization": f"Bearer demo:{account}"}


def wallet_id(account):
    return auth._wallet_id(f"demo:{account}")


class ThreePartyFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.patches = []
        for name in ["PUBLIC_CREDDEF_FILE", "PRIVATE_KEY_FILE"]:
            item = patch.object(issuer, name, Path(cls.temp.name) / (name + ".json"))
            item.start()
            cls.patches.append(item)
        item = patch.object(wallet, "WALLETS_DIR", Path(cls.temp.name) / "wallets")
        item.start()
        cls.patches.append(item)
        # Tài khoản demo mang email @demo.local; cho domain đó vào danh sách verifier tin cậy để
        # chạy được gate đăng nhập mà không cần ID-token Google thật.
        item = patch.dict(issuer.TRUSTED_VERIFIER_DOMAINS, {"demo.local": "Demo Verifier"})
        item.start()
        cls.patches.append(item)
        item = patch.dict(os.environ, {"GOOGLE_CLIENT_ID": ""})
        item.start()
        cls.patches.append(item)
        # Small test-only keys keep integration tests fast; production setup is unchanged.
        issuer.setup(bits=128)
        cls.client = TestClient(api.app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        for item in reversed(cls.patches):
            item.stop()
        cls.temp.cleanup()

    def setUp(self):
        api._verification_requests.clear()
        issuer._pending_nonces.clear()
        verifier._pending_sessions.clear()
        issuer.EKYC_DB[:] = [{**wallet.EKYC_DATA, "credential_issued": False}]
        if wallet.WALLETS_DIR.exists():
            shutil.rmtree(wallet.WALLETS_DIR)

    def issue(self, account=HOLDER_A, attributes=None):
        response = self.client.post("/api/issue", json=attributes or wallet.EKYC_DATA, headers=headers(account))
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def request(self, attrs=None):
        response = self.client.post("/api/requests", json={
            "name": "Identity check", "purpose": "Test consent",
            "revealed_attrs": attrs or [], "conditions": ["credValid"],
        }, headers=headers(VERIFIER))
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["id"]

    def test_issue_approve_poll_and_replay(self):
        self.issue()
        session = self.request(["name", "dob", "address"])
        response = self.client.post(f"/api/requests/{session}/approve", json={"revealed_attrs": ["name"]}, headers=headers(HOLDER_A))
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "verified")
        self.assertEqual(response.json()["result"]["revealed"], {"name": wallet.EKYC_DATA["name"]})
        self.assertEqual(self.client.get(f"/api/requests/{session}").json(), response.json())
        self.assertEqual(self.client.post(f"/api/requests/{session}/approve", json={"revealed_attrs": []}, headers=headers(HOLDER_A)).status_code, 409)

    def test_fully_hidden_presentation(self):
        self.issue()
        session = self.request(["name"])
        result = self.client.post(f"/api/requests/{session}/approve", json={"revealed_attrs": []}, headers=headers(HOLDER_A)).json()
        self.assertEqual(result["result"], {"verified": True, "revealed": {}})

    def test_decline_and_expiry(self):
        session = self.request()
        self.assertEqual(self.client.post(f"/api/requests/{session}/decline", headers=headers(HOLDER_A)).json()["status"], "declined")
        self.assertEqual(self.client.post(f"/api/requests/{session}/approve", json={}, headers=headers(HOLDER_A)).status_code, 409)
        expired = self.request()
        api._verification_requests[expired]["expires_at"] = time.time() - 1
        self.assertEqual(self.client.get(f"/api/requests/{expired}").json()["status"], "expired")
        self.assertEqual(self.client.post(f"/api/requests/{expired}/approve", json={}, headers=headers(HOLDER_A)).status_code, 409)

    def test_missing_credential_and_extra_disclosure(self):
        session = self.request(["name"])
        self.assertEqual(self.client.post(f"/api/requests/{session}/approve", json={}, headers=headers(HOLDER_A)).status_code, 400)
        self.issue()
        self.assertEqual(self.client.post(f"/api/requests/{session}/approve", json={"revealed_attrs": ["dob"]}, headers=headers(HOLDER_A)).status_code, 400)
        self.assertEqual(self.client.get(f"/api/requests/{session}").json()["status"], "pending")

    def test_unsupported_conditions_and_attributes(self):
        for condition in ["age", "notRevoked", "nationalityVN", "residencyVN", "student"]:
            response = self.client.post("/api/requests", json={"name": "Test", "conditions": [condition]}, headers=headers(VERIFIER))
            self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.post("/api/requests", json={"name": "Test", "revealed_attrs": ["cccd", "cccd"]}, headers=headers(VERIFIER)).status_code, 400)
        self.assertEqual(self.client.post("/api/requests", json={"name": "Test", "revealed_attrs": ["khong-ton-tai"]}, headers=headers(VERIFIER)).status_code, 400)

    def test_existing_identity_is_not_silently_replaced(self):
        original = self.issue()
        self.assertEqual(self.issue(), original)
        response = self.client.post("/api/issue", json={**wallet.EKYC_DATA, "name": "Another person"}, headers=headers(HOLDER_A))
        self.assertEqual(response.status_code, 409)
        self.assertEqual(wallet.get_identity(wallet_id(HOLDER_A)), wallet.EKYC_DATA)

    def test_tampered_and_replayed_crypto_proofs(self):
        self.issue()
        request = verifier.create_presentation_request(["name"])
        holder = wallet_id(HOLDER_A)
        proof = wallet.create_presentation(wallet.get_credential(holder), wallet.get_identity(holder), wallet.get_link_secret(holder), issuer.get_public_cred_def(), request)
        changed = copy.deepcopy(proof)
        changed["revealed"]["name"]["raw"] = "Forged name"
        self.assertFalse(verifier.verify_presentation(changed, request["nonce"]))
        self.assertFalse(verifier.verify_presentation(proof, request["nonce"]))
        for value in [None, {}, {"a_prime": "invalid"}]:
            request = verifier.create_presentation_request([])
            self.assertFalse(verifier.verify_presentation(value, request["nonce"]))

    def test_independent_requests(self):
        self.issue()
        first, second = self.request(["name"]), self.request(["dob"])
        self.assertNotEqual(first, second)
        self.client.post(f"/api/requests/{first}/decline", headers=headers(HOLDER_A))
        response = self.client.post(f"/api/requests/{second}/approve", json={"revealed_attrs": ["dob"]}, headers=headers(HOLDER_A))
        self.assertEqual(response.json()["result"]["revealed"], {"dob": wallet.EKYC_DATA["dob"]})


class MultiAccountTests(ThreePartyFlowTests):
    def test_second_account_cannot_reuse_the_same_cccd(self):
        self.issue(HOLDER_A)
        response = self.client.post("/api/issue", json=wallet.EKYC_DATA, headers=headers(HOLDER_B))
        self.assertEqual(response.status_code, 400)
        self.assertIn("đã được cấp credential", response.json()["detail"])
        self.assertIsNone(wallet.get_credential(wallet_id(HOLDER_B)))

    def test_each_account_keeps_its_own_link_secret(self):
        self.issue(HOLDER_A)
        other = {**wallet.EKYC_DATA, "cccd": "099999999999", "name": "Người thứ hai"}
        self.issue(HOLDER_B, other)
        self.assertNotEqual(
            wallet.get_link_secret(wallet_id(HOLDER_A)), wallet.get_link_secret(wallet_id(HOLDER_B))
        )
        self.assertEqual(wallet.get_identity(wallet_id(HOLDER_B)), other)

    def test_ekyc_mismatch_is_refused(self):
        response = self.client.post(
            "/api/issue", json={**wallet.EKYC_DATA, "name": "Kẻ mạo danh"}, headers=headers(HOLDER_A)
        )
        self.assertEqual(response.status_code, 409)
        self.assertIn("name", response.json()["detail"])

    def test_endpoints_require_a_token(self):
        self.assertEqual(self.client.post("/api/issue", json=wallet.EKYC_DATA).status_code, 401)
        self.assertEqual(self.client.post("/api/requests", json={"name": "T"}).status_code, 401)

    def test_verifier_login_rejects_untrusted_domain(self):
        with patch.dict(issuer.TRUSTED_VERIFIER_DOMAINS, {}, clear=True):
            response = self.client.post("/api/requests", json={"name": "T"}, headers=headers(VERIFIER))
            self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main()
