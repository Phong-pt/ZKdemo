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
import issuance
import registry_publish
import passkey
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
        for name in ["PUBLIC_CREDDEF_FILE", "PRIVATE_KEY_FILE", "EKYC_DB_FILE"]:
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
        item = patch.dict(os.environ, {"GOOGLE_CLIENT_ID": "", "ISSUER_PORTAL_TOKEN": "test-operator"})
        item.start()
        cls.patches.append(item)
        for item in [patch.object(issuance, "STATE_FILE", Path(cls.temp.name) / "requests.json"),
                     patch.object(registry_publish, "publish")]:
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
        issuance.requests.clear()
        passkey._unlocks.clear()
        passkey._challenges.clear()
        issuer._pending_nonces.clear()
        verifier._pending_sessions.clear()
        issuer.EKYC_DB[:] = [{**wallet.EKYC_DATA, "credential_issued": False}]
        if wallet.WALLETS_DIR.exists():
            shutil.rmtree(wallet.WALLETS_DIR)

    def issue(self, account=HOLDER_A, attributes=None):
        response = self.client.post("/api/issue", json=attributes or wallet.EKYC_DATA, headers=headers(account))
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        if data["status"] == "pending":
            approved = self.client.post(f"/api/issuer/requests/{data['id']}/approve", headers={"X-Issuer-Token": "test-operator"})
            self.assertEqual(approved.status_code, 200, approved.text)
            response = self.client.post(f"/api/issuance/requests/{data['id']}/complete", headers=headers(account))
            self.assertEqual(response.status_code, 200, response.text)
            data = response.json()
        return data

    def request(self, attrs=None):
        response = self.client.post("/api/requests", json={
            "name": "Identity check", "purpose": "Test consent",
            "revealed_attrs": attrs or [], "conditions": ["credValid"],
        }, headers=headers(VERIFIER))
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["id"]

    def test_issue_approve_poll_and_replay(self):
        self.issue()
        session = self.request(["name", "dob", "residence"])
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
        self.assertEqual(response.status_code, 200)
        response = self.client.post(f"/api/issuer/requests/{response.json()['id']}/approve", headers={"X-Issuer-Token": "test-operator"})
        self.assertEqual(response.status_code, 409)
        self.assertIsNone(wallet.get_credential(wallet_id(HOLDER_B)))

    def test_each_account_keeps_its_own_link_secret(self):
        self.issue(HOLDER_A)
        other = {**wallet.EKYC_DATA, "cccd": "099999999999", "name": "Người thứ hai"}
        issuer.EKYC_DB.append({**other, "credential_issued": False})
        self.issue(HOLDER_B, other)
        self.assertNotEqual(
            wallet.get_link_secret(wallet_id(HOLDER_A)), wallet.get_link_secret(wallet_id(HOLDER_B))
        )
        self.assertEqual(wallet.get_identity(wallet_id(HOLDER_B)), other)

    def test_ekyc_mismatch_is_refused(self):
        response = self.client.post(
            "/api/issue", json={**wallet.EKYC_DATA, "name": "Kẻ mạo danh"}, headers=headers(HOLDER_A)
        )
        self.assertEqual(response.status_code, 200)
        request_id = response.json()['id']
        response = self.client.post(f"/api/issuer/requests/{request_id}/approve", headers={"X-Issuer-Token": "test-operator"})
        self.assertEqual(response.status_code, 409)
        self.assertFalse(issuance.requests[request_id]['checks']['database'])
        self.assertIsNone(wallet.get_credential(wallet_id(HOLDER_A)))

    def test_issued_flag_survives_a_restart(self):
        self.issue(HOLDER_A)
        issuer.EKYC_DB[:] = [dict(record) for record in issuer.SEED_EKYC_DB]
        issuer.load_ekyc_db()
        self.assertTrue(issuer.find_by_cccd(wallet.EKYC_DATA["cccd"])["credential_issued"])
        response = self.client.post("/api/issue", json=wallet.EKYC_DATA, headers=headers(HOLDER_B))
        self.assertEqual(response.status_code, 200)
        response = self.client.post(f"/api/issuer/requests/{response.json()['id']}/approve", headers={"X-Issuer-Token": "test-operator"})
        self.assertEqual(response.status_code, 409)

    def test_document_outside_the_registered_schema_is_refused(self):
        response = self.client.post(
            "/api/issue", json={**wallet.EKYC_DATA, "document_type": "drivingLicence"}, headers=headers(HOLDER_A)
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("drivingLicence", response.json()["detail"])
        self.assertIsNone(wallet.get_credential(wallet_id(HOLDER_A)))

    def test_verifier_cannot_ask_outside_the_schema(self):
        response = self.client.post(
            "/api/requests",
            json={"name": "T", "revealed_attrs": ["so_gplx"], "conditions": ["credValid"]},
            headers=headers(VERIFIER),
        )
        self.assertEqual(response.status_code, 400)

    def test_endpoints_require_a_token(self):
        self.assertEqual(self.client.post("/api/issue", json=wallet.EKYC_DATA).status_code, 401)
        self.assertEqual(self.client.post("/api/requests", json={"name": "T"}).status_code, 401)

    def test_verifier_login_rejects_untrusted_domain(self):
        with patch.dict(issuer.TRUSTED_VERIFIER_DOMAINS, {}, clear=True):
            response = self.client.post("/api/requests", json={"name": "T"}, headers=headers(VERIFIER))
            self.assertEqual(response.status_code, 403)


class IssuerApprovalTests(ThreePartyFlowTests):
    operator_headers = {"X-Issuer-Token": "test-operator"}

    def pending(self, attributes=None):
        response = self.client.post('/api/issuance/requests', json=attributes or wallet.EKYC_DATA,
                                    headers=headers(HOLDER_A))
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['id']

    def approve(self, request_id):
        return self.client.post(f'/api/issuer/requests/{request_id}/approve', headers=self.operator_headers)

    def test_wallet_waits_for_issuer_and_unblinds_only_after_approval(self):
        rid = self.pending()
        self.assertEqual(issuance.requests[rid]['status'], 'pending')
        self.assertIsNone(wallet.get_credential(wallet_id(HOLDER_A)))
        self.assertEqual(self.client.post(f'/api/issuance/requests/{rid}/complete', headers=headers(HOLDER_A)).status_code, 409)
        signed = self.approve(rid)
        self.assertEqual(signed.status_code, 200, signed.text)
        self.assertEqual(signed.json()['status'], 'signed')
        self.assertNotIn(issuance.requests[rid]['nonce'], issuer._pending_nonces)
        self.assertIsNone(wallet.get_credential(wallet_id(HOLDER_A)))
        self.assertEqual(self.approve(rid).status_code, 409)
        result = self.client.post(f'/api/issuance/requests/{rid}/complete', headers=headers(HOLDER_A))
        self.assertEqual(result.json()['status'], 'issued')
        self.assertTrue(wallet.verify_credential(wallet.get_credential(wallet_id(HOLDER_A)), wallet.EKYC_DATA,
                       issuer.get_public_cred_def(), wallet.get_link_secret(wallet_id(HOLDER_A))))
        self.assertEqual(self.client.post(f'/api/issuance/requests/{rid}/complete', headers=headers(HOLDER_A)).json(), result.json())

    def test_issuer_sees_public_proof_but_not_wallet_secrets(self):
        rid = self.pending()
        response = self.client.get('/api/issuer/requests', headers=self.operator_headers)
        self.assertEqual(response.status_code, 200)
        public = response.json()[0]
        self.assertEqual(set(public['proof']), {'nonce', 'u', 'c', 'v_hat', 'ls_hat'})
        self.assertTrue(all(isinstance(value, str) for value in public['proof'].values()))
        secret_v, secret_ls = wallet.load_pending_request(issuance.requests[rid]['nonce'], wallet_id(HOLDER_A))
        self.assertNotIn(str(secret_v), response.text)
        self.assertNotIn(str(secret_ls), response.text)
        self.assertEqual(self.client.get('/api/issuer/requests', headers=headers(HOLDER_A)).status_code, 401)
        self.assertEqual(self.client.get(f'/api/issuance/requests/{rid}', headers=headers(HOLDER_B)).status_code, 403)
        self.assertEqual(self.client.post(f'/api/issuance/requests/{rid}/complete', headers=headers(HOLDER_B)).status_code, 403)

    def test_tampered_nonce_or_proof_cannot_be_signed(self):
        rid = self.pending()
        request = issuance.requests[rid]
        valid_proof = dict(request['proof'])
        for field in ('nonce', 'c', 'u', 'v_hat', 'ls_hat'):
            request['proof'] = dict(valid_proof)
            request['proof'][field] = 'another-nonce' if field == 'nonce' else request['proof'][field] + 1
            self.assertEqual(self.approve(rid).status_code, 409, field)
            self.assertFalse(issuer.find_by_cccd(wallet.EKYC_DATA['cccd'])['credential_issued'])
        request['proof'] = valid_proof
        self.assertEqual(self.approve(rid).status_code, 200)

    def test_unknown_database_record_is_not_auto_created(self):
        rid = self.pending({**wallet.EKYC_DATA, 'cccd': '000000000000'})
        self.assertEqual(self.approve(rid).status_code, 409)
        self.assertIsNone(issuer.find_by_cccd('000000000000'))

    def test_reject_and_expire_invalidate_nonce_and_allow_retry(self):
        rid = self.pending()
        nonce = issuance.requests[rid]['nonce']
        result = self.client.post(f'/api/issuer/requests/{rid}/reject', json={'reason': 'Sai hồ sơ'}, headers=self.operator_headers)
        self.assertEqual(result.json()['status'], 'rejected')
        self.assertNotIn(nonce, issuer._pending_nonces)
        fresh = self.pending()
        self.assertNotEqual(fresh, rid)
        issuance.requests[fresh]['expires_at'] = time.time() - 1
        self.assertEqual(self.approve(fresh).status_code, 409)
        self.assertNotIn(issuance.requests[fresh]['nonce'], issuer._pending_nonces)

    def test_duplicate_submission_preserves_nonce_and_blinding_state(self):
        rid = self.pending()
        pending_file = wallet.pending_request_file(wallet_id(HOLDER_A)).read_text()
        self.assertEqual(self.pending(), rid)
        self.assertEqual(wallet.pending_request_file(wallet_id(HOLDER_A)).read_text(), pending_file)

    def test_resume_and_cancel_are_scoped_to_wallet(self):
        rid = self.pending()
        mine = self.client.get('/api/issuance/current', headers=headers(HOLDER_A)).json()
        self.assertEqual(mine['id'], rid)
        self.assertEqual(mine['attributes'], wallet.EKYC_DATA)
        self.assertIsNone(self.client.get('/api/issuance/current', headers=headers(HOLDER_B)).json())
        self.assertEqual(self.client.post(f'/api/issuance/requests/{rid}/cancel', headers=headers(HOLDER_B)).status_code, 403)
        self.assertEqual(self.client.post(f'/api/issuance/requests/{rid}/cancel', headers=headers(HOLDER_A)).status_code, 200)
        self.assertNotIn(issuance.requests[rid]['nonce'], issuer._pending_nonces)
        self.assertEqual(self.approve(rid).status_code, 409)
        self.assertNotEqual(self.pending(), rid)

    def test_completion_recovers_after_unblinding_before_state_save(self):
        rid = self.pending()
        self.assertEqual(self.approve(rid).status_code, 200)
        item = issuance.requests[rid]
        sig = item['signature']
        wallet.unblind_signature(sig['a'], sig['e'], sig['v_prime_prime'], item['nonce'],
                                 item['attributes'], item['public_key'], wallet_id(HOLDER_A))
        self.assertFalse(wallet.pending_request_file(wallet_id(HOLDER_A)).exists())
        result = self.client.post(f'/api/issuance/requests/{rid}/complete', headers=headers(HOLDER_A))
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()['status'], 'issued')
        self.assertEqual(wallet.get_identity(wallet_id(HOLDER_A)), wallet.EKYC_DATA)

    def test_passkey_cannot_be_skipped_or_replaced_and_guards_wallet_api(self):
        owner = wallet_id(HOLDER_A)
        wallet.save_passkey({'credential_id': 'test', 'public_key': 'test', 'sign_count': 0}, owner)
        self.assertEqual(self.client.post('/api/passkey/skip', headers=headers(HOLDER_A)).status_code, 409)
        self.assertEqual(self.client.post('/api/passkey/register/options', headers=headers(HOLDER_A)).status_code, 409)
        self.assertEqual(self.client.post('/api/issue', json=wallet.EKYC_DATA, headers=headers(HOLDER_A)).status_code, 403)
        token = passkey.grant(wallet_id(HOLDER_B))
        bad = {**headers(HOLDER_A), 'X-Wallet-Unlock': token}
        self.assertEqual(self.client.post('/api/issue', json=wallet.EKYC_DATA, headers=bad).status_code, 403)
        token = passkey.grant(owner)
        good = {**headers(HOLDER_A), 'X-Wallet-Unlock': token}
        self.assertEqual(self.client.post('/api/issue', json=wallet.EKYC_DATA, headers=good).status_code, 200)
        passkey._unlocks[token] = (owner, time.monotonic() - 1)
        self.assertEqual(self.client.get('/api/issuance/current', headers=good).status_code, 403)

    def test_reset_requires_issuer_and_preserves_public_key(self):
        self.assertEqual(self.client.post('/api/reset').status_code, 401)
        key = issuer.get_public_cred_def()
        self.pending()
        self.assertEqual(self.client.post('/api/reset', headers=self.operator_headers).status_code, 200)
        self.assertEqual(issuance.requests, {})
        self.assertEqual(issuer.get_public_cred_def(), key)

    def test_approval_rechecks_database_after_inspection(self):
        rid = self.pending()
        result = self.client.post(f'/api/issuer/requests/{rid}/check', headers=self.operator_headers)
        self.assertTrue(result.json()['checks']['database'])
        issuer.find_by_cccd(wallet.EKYC_DATA['cccd'])['name'] = 'Updated record'
        self.assertEqual(self.approve(rid).status_code, 409)

    def test_wallet_does_not_receive_issuer_database_fields(self):
        rid = self.pending({**wallet.EKYC_DATA, 'name': 'Wrong name'})
        self.assertEqual(self.approve(rid).status_code, 409)
        result = self.client.get(f'/api/issuance/requests/{rid}', headers=headers(HOLDER_A))
        self.assertNotIn(wallet.EKYC_DATA['name'], result.text)
        self.assertNotIn('stored', result.text)


if __name__ == "__main__":
    unittest.main()
