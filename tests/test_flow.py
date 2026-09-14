import copy
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

import api
from issuer import issuer
from wallet import wallet
from verifier import verifier


class ThreePartyFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.patches = []
        for module, names in [
            (issuer, ["PUBLIC_CREDDEF_FILE", "PRIVATE_KEY_FILE"]),
            (wallet, ["LINK_SECRET_FILE", "PENDING_REQUEST_FILE", "CREDENTIAL_FILE", "IDENTITY_FILE"]),
        ]:
            for name in names:
                item = patch.object(module, name, Path(cls.temp.name) / (name + ".json"))
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
        for path in [wallet.CREDENTIAL_FILE, wallet.IDENTITY_FILE, wallet.PENDING_REQUEST_FILE, wallet.LINK_SECRET_FILE]:
            path.unlink(missing_ok=True)

    def issue(self):
        response = self.client.post("/api/issue", json=wallet.EKYC_DATA)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def request(self, attrs=None):
        response = self.client.post("/api/requests", json={
            "name": "Identity check", "purpose": "Test consent",
            "revealed_attrs": attrs or [], "conditions": ["credValid"],
        })
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["id"]

    def test_issue_approve_poll_and_replay(self):
        self.issue()
        session = self.request(["name", "dob", "address"])
        response = self.client.post(f"/api/requests/{session}/approve", json={"revealed_attrs": ["name"]})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "verified")
        self.assertEqual(response.json()["result"]["revealed"], {"name": wallet.EKYC_DATA["name"]})
        self.assertEqual(self.client.get(f"/api/requests/{session}").json(), response.json())
        self.assertEqual(self.client.post(f"/api/requests/{session}/approve", json={"revealed_attrs": []}).status_code, 409)

    def test_fully_hidden_presentation(self):
        self.issue()
        session = self.request(["name"])
        result = self.client.post(f"/api/requests/{session}/approve", json={"revealed_attrs": []}).json()
        self.assertEqual(result["result"], {"verified": True, "revealed": {}})

    def test_decline_and_expiry(self):
        session = self.request()
        self.assertEqual(self.client.post(f"/api/requests/{session}/decline").json()["status"], "declined")
        self.assertEqual(self.client.post(f"/api/requests/{session}/approve", json={}).status_code, 409)
        expired = self.request()
        api._verification_requests[expired]["expires_at"] = time.time() - 1
        self.assertEqual(self.client.get(f"/api/requests/{expired}").json()["status"], "expired")
        self.assertEqual(self.client.post(f"/api/requests/{expired}/approve", json={}).status_code, 409)

    def test_missing_credential_and_extra_disclosure(self):
        session = self.request(["name"])
        self.assertEqual(self.client.post(f"/api/requests/{session}/approve", json={}).status_code, 400)
        self.issue()
        self.assertEqual(self.client.post(f"/api/requests/{session}/approve", json={"revealed_attrs": ["dob"]}).status_code, 400)
        self.assertEqual(self.client.get(f"/api/requests/{session}").json()["status"], "pending")

    def test_unsupported_conditions_and_attributes(self):
        for condition in ["age", "notRevoked", "nationalityVN", "residencyVN", "student"]:
            response = self.client.post("/api/requests", json={"name": "Test", "conditions": [condition]})
            self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.post("/api/requests", json={"name": "Test", "revealed_attrs": ["cccd"]}).status_code, 400)
        self.assertEqual(self.client.post("/api/requests", json={"name": "Test", "revealed_attrs": ["name", "name"]}).status_code, 400)

    def test_existing_identity_is_not_silently_replaced(self):
        original = self.issue()
        self.assertEqual(self.issue(), original)
        response = self.client.post("/api/issue", json={**wallet.EKYC_DATA, "name": "Another person"})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(wallet.get_identity(), wallet.EKYC_DATA)

    def test_tampered_and_replayed_crypto_proofs(self):
        self.issue()
        request = verifier.create_presentation_request(["name"])
        proof = wallet.create_presentation(wallet.get_credential(), wallet.get_identity(), wallet.get_link_secret(), issuer.get_public_cred_def(), request)
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
        self.client.post(f"/api/requests/{first}/decline")
        response = self.client.post(f"/api/requests/{second}/approve", json={"revealed_attrs": ["dob"]})
        self.assertEqual(response.json()["result"]["revealed"], {"dob": wallet.EKYC_DATA["dob"]})


if __name__ == "__main__":
    unittest.main()
