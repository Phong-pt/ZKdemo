"""Ba vai chạy trọn một vòng trên chain thật, không mock bước công bố.

test_flow.py đã kiểm luồng ba vai nhưng nó `patch.object(registry_publish, "publish")`, nên chain
không hề được chạy ở đó. File này bù đúng chỗ thiếu: holder đăng ký → issuer đối chiếu CSDL rồi ký
→ việc ký kích hoạt deploy contract và đăng ký schema + khoá công khai → verifier kiểm proof bằng
khoá đọc ngược từ chain.

Chain ở đây là một EVM in-memory (eth-tester) đóng vai Sepolia: contract được compile bằng solc
thật, deploy thật, giao dịch có receipt thật. Chỉ có endpoint RPC là cục bộ nên test không cần
ETH testnet hay mạng.
"""
import os
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import PropertyMock, patch

from eth_tester.exceptions import TransactionFailed
from fastapi.testclient import TestClient
from web3 import EthereumTesterProvider, Web3
from web3.eth import Eth
from web3.exceptions import ContractLogicError

import api
import auth
import chain
import issuance
import registry_publish
from issuer import issuer
from verifier import verifier
from wallet import wallet

HOLDER = "holder-a"
VERIFIER = "verifier"
OPERATOR = {"X-Issuer-Token": "test-operator"}
REAL_CONTRACT = Path(__file__).resolve().parent.parent / "contracts" / "CredentialRegistry.sol"


class RpcLikeProvider(EthereumTesterProvider):
    """registry_publish dựa vào ContractLogicError để biết schema chưa được đăng ký; eth-tester bắn
    TransactionFailed nên phải dịch lại cho giống một RPC node thật."""

    def make_request(self, method, params):
        try:
            return super().make_request(method, params)
        except TransactionFailed as exc:
            raise ContractLogicError(str(exc)) from exc


def headers(account: str) -> dict:
    return {"Authorization": f"Bearer demo:{account}"}


def wallet_id(account: str) -> str:
    return auth._wallet_id(f"demo:{account}")


def string_leaves(value) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        return [leaf for item in value.values() for leaf in string_leaves(item)]
    if isinstance(value, (list, tuple)):
        return [leaf for item in value for leaf in string_leaves(item)]
    return []


class EndToEndOnChainTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        # registry_publish.artifact() compile từ ARTIFACT_FILE.with_suffix(".sol"), nên đưa bản
        # .sol thật vào temp để đường compile cũng được chạy chứ không chỉ đường đọc cache.
        shutil.copy(REAL_CONTRACT, root / "CredentialRegistry.sol")

        self.provider = RpcLikeProvider()
        self.web3 = Web3(self.provider)
        private_key = self.provider.ethereum_tester.backend.account_keys[0].to_hex()
        self.issuer_address = self.web3.eth.accounts[0]

        for item in [
            patch.object(issuer, "PUBLIC_CREDDEF_FILE", root / "cred_def_public.json"),
            patch.object(issuer, "PRIVATE_KEY_FILE", root / "issuer_private_key.json"),
            patch.object(issuer, "EKYC_DB_FILE", root / "ekyc_db.json"),
            patch.object(issuance, "STATE_FILE", root / "requests.json"),
            patch.object(wallet, "WALLETS_DIR", root / "wallets"),
            patch.object(registry_publish, "JOURNAL", root / "journal.json"),
            patch.object(chain, "ARTIFACT_FILE", root / "CredentialRegistry.json"),
            patch.object(chain, "REGISTRY_FILE", root / "deployment.json"),
            patch.object(Web3, "HTTPProvider", return_value=self.provider),
            patch.object(Eth, "chain_id", new_callable=PropertyMock, return_value=11155111),
            patch.dict(issuer.TRUSTED_VERIFIER_DOMAINS, {"demo.local": "Demo Verifier"}),
            patch.dict(os.environ, {
                "GOOGLE_CLIENT_ID": "",
                "ISSUER_PORTAL_TOKEN": "test-operator",
                "SEPOLIA_RPC_URL": "test-only",
                "ISSUER_PRIVATE_KEY": private_key,
                # Buộc chain.py đọc cấu hình từ deployment.json trong temp, không phải env của máy.
                "CREDENTIAL_REGISTRY_ADDRESS": "",
                "SCHEMA_ID": "",
                "CREDENTIAL_DEFINITION_ID": "",
            }),
        ]:
            item.start()
            self.addCleanup(item.stop)

        chain.clear_cache()
        self.addCleanup(chain.clear_cache)
        issuer.setup(bits=128)  # khoá nhỏ chỉ để test nhanh; luồng không đổi
        issuance.requests.clear()
        api._verification_requests.clear()
        issuer._pending_nonces.clear()
        verifier._pending_sessions.clear()
        issuer.EKYC_DB[:] = [{**wallet.EKYC_DATA, "credential_issued": False}]
        self.client = TestClient(api.app)
        self.addCleanup(self.client.close)

    # --- các bước của luồng, tách ra để test thứ hai dùng lại ---

    def holder_registers(self) -> str:
        """Vai 1 — ví gửi hồ sơ kèm commitment mù và proof biết link secret."""
        response = self.client.post(
            "/api/issuance/requests", json=wallet.EKYC_DATA, headers=headers(HOLDER)
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "pending")
        self.assertIsNone(wallet.get_credential(wallet_id(HOLDER)))
        return response.json()["id"]

    def issuer_signs(self, request_id: str) -> dict:
        """Vai 2 — issuer đối chiếu CSDL, ký mù, và công bố schema + khoá lên chain."""
        response = self.client.post(f"/api/issuer/requests/{request_id}/approve", headers=OPERATOR)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def holder_completes(self, request_id: str) -> None:
        response = self.client.post(
            f"/api/issuance/requests/{request_id}/complete", headers=headers(HOLDER)
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "issued")

    def verifier_asks(self, revealed: list[str]) -> str:
        """Vai 3 — verifier tạo phiên yêu cầu proof."""
        response = self.client.post("/api/requests", json={
            "name": "Identity verification", "purpose": "Mở tài khoản",
            "revealed_attrs": revealed, "conditions": ["credValid"],
        }, headers=headers(VERIFIER))
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["id"]

    # --- test ---

    def test_three_roles_complete_a_round_on_a_live_chain(self):
        request_id = self.holder_registers()

        # Issuer thấy bảng đối chiếu từng trường với CSDL căn cước trước khi ký.
        queue = self.client.get("/api/issuer/requests", headers=OPERATOR)
        self.assertEqual(queue.status_code, 200, queue.text)
        database = queue.json()[0]["database"]
        self.assertTrue(database["found"])
        self.assertTrue(database["matches"])
        self.assertFalse(database["already_issued"])
        self.assertEqual([field["name"] for field in database["fields"]], issuer.ATTRIBUTE_NAMES)
        self.assertTrue(all(field["matches"] for field in database["fields"]))

        # Trước khi ký, chưa có gì trên chain.
        self.assertFalse(chain.is_configured())
        self.assertEqual(registry_publish.status()["state"], "not_published")

        signed = self.issuer_signs(request_id)
        self.assertEqual(signed["status"], "signed")
        for name in ("database", "not_issued", "nonce", "proof"):
            self.assertTrue(signed["checks"][name], name)

        # Việc ký đã kéo theo công bố: deploy + đăng ký schema + đăng ký khoá công khai.
        published = registry_publish.status()
        self.assertEqual(published["state"], "published", published)
        self.assertEqual(set(published["transactions"]), {"deploy", "schema", "credential_definition"})
        for stage, transaction in published["transactions"].items():
            self.assertEqual(transaction["state"], "confirmed", stage)
            receipt = self.web3.eth.get_transaction_receipt(transaction["hash"])
            self.assertEqual(receipt["status"], 1, stage)
        address = Web3.to_checksum_address(published["address"])
        self.assertTrue(self.web3.eth.get_code(address), "registry không có bytecode")
        self.assertTrue(chain.is_configured())

        # Đọc ngược từ chain: schema và khoá công khai phải khớp issuer đang dùng.
        schema = chain.get_schema()
        self.assertEqual(schema["attributes"], issuer.ATTRIBUTE_NAMES)
        self.assertEqual(schema["name"], "nationalIdentity")
        self.assertEqual(schema["issuer"], self.issuer_address)
        on_chain_key = chain.get_cred_def()
        local_key = issuer.get_public_cred_def()
        for field in ("n", "S", "R", "Z", "R_attrs"):
            self.assertEqual(on_chain_key[field], local_key[field], field)
        self.assertTrue(chain.status()["matches_local_key"])

        # Không một giá trị cá nhân nào nằm trong calldata của hai giao dịch đăng ký.
        registry = self.web3.eth.contract(address=address, abi=chain.abi())
        for stage in ("schema", "credential_definition"):
            transaction = self.web3.eth.get_transaction(published["transactions"][stage]["hash"])
            _, arguments = registry.decode_function_input(transaction["input"])
            leaves = string_leaves(arguments)
            for name, value in wallet.EKYC_DATA.items():
                self.assertNotIn(value, leaves, f"{stage} mang theo giá trị {name}")
            allowed = {"nationalIdentity", "1.0", "default", *issuer.ATTRIBUTE_NAMES}
            for leaf in leaves:
                self.assertTrue(leaf in allowed or leaf.isdigit(), f"{stage} có chuỗi lạ: {leaf!r}")

        # Ví giải mù và tự kiểm chữ ký bằng khoá công khai lấy từ chain.
        self.holder_completes(request_id)
        holder = wallet_id(HOLDER)
        self.assertTrue(wallet.verify_credential(
            wallet.get_credential(holder), wallet.EKYC_DATA, chain.get_cred_def(),
            wallet.get_link_secret(holder),
        ))

        # Verifier lấy cả danh sách thuộc tính được hỏi và khoá kiểm proof từ chain.
        self.assertEqual(chain.resolve_attributes(), (issuer.ATTRIBUTE_NAMES, "chain"))
        self.assertEqual(chain.resolve_cred_def()[1], "chain")

        session = self.verifier_asks(["name", "dob"])
        result = self.client.post(
            f"/api/requests/{session}/approve", json={"revealed_attrs": ["name"]},
            headers=headers(HOLDER),
        )
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()["status"], "verified")
        self.assertEqual(result.json()["result"], {
            "verified": True, "revealed": {"name": wallet.EKYC_DATA["name"]},
        })

    def test_chain_key_is_what_gates_verification(self):
        """Nếu khoá trên chain không phải khoá đã ký credential thì proof phải bị từ chối — đó là
        bằng chứng verifier thật sự tin chain chứ không tin file cục bộ của issuer."""
        request_id = self.holder_registers()
        self.issuer_signs(request_id)
        self.holder_completes(request_id)

        tampered = dict(chain.get_cred_def())
        tampered["Z"] = tampered["Z"] + 2
        session = self.verifier_asks(["name"])
        with patch.object(chain, "get_cred_def", return_value=tampered):
            result = self.client.post(
                f"/api/requests/{session}/approve", json={"revealed_attrs": ["name"]},
                headers=headers(HOLDER),
            )
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()["status"], "rejected")
        self.assertEqual(result.json()["result"], {"verified": False, "revealed": {}})


if __name__ == "__main__":
    unittest.main()
