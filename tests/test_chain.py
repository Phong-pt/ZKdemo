import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import solcx
from web3 import EthereumTesterProvider, Web3

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import chain

SOLC_VERSION = "0.8.24"
CONTRACT = Path(__file__).resolve().parent.parent / "contracts" / "CredentialRegistry.sol"
ATTRIBUTES = ["cccd", "name", "dob", "sex", "nationality", "origin", "residence", "expiry"]
CRED_DEF = {
    "n": 2**2047 + 11,
    "S": 2**2040 + 7,
    "R": 2**2039 + 3,
    "Z": 2**2038 + 5,
    "R_attrs": {name: 2**2030 + index for index, name in enumerate(ATTRIBUTES)},
}


def compile_registry() -> dict:
    if SOLC_VERSION not in [str(v) for v in solcx.get_installed_solc_versions()]:
        solcx.install_solc(SOLC_VERSION)
    compiled = solcx.compile_files(
        [str(CONTRACT)], output_values=["abi", "bin"], solc_version=SOLC_VERSION, optimize=True
    )
    key = next(k for k in compiled if k.endswith("CredentialRegistry"))
    return {"abi": compiled[key]["abi"], "bytecode": compiled[key]["bin"]}


class RegistryOnChainTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.artifact = compile_registry()
        cls.web3 = Web3(EthereumTesterProvider())
        cls.issuer_address = cls.web3.eth.accounts[0]
        cls.outsider = cls.web3.eth.accounts[1]

        factory = cls.web3.eth.contract(abi=cls.artifact["abi"], bytecode=cls.artifact["bytecode"])
        tx = factory.constructor().transact({"from": cls.issuer_address})
        receipt = cls.web3.eth.wait_for_transaction_receipt(tx)
        cls.contract = cls.web3.eth.contract(address=receipt["contractAddress"], abi=cls.artifact["abi"])

        cls.contract.functions.registerSchema("nationalIdentity", "1.0", ATTRIBUTES).transact(
            {"from": cls.issuer_address}
        )
        cls.schema_id = cls.contract.functions.schemaId(cls.issuer_address, "nationalIdentity", "1.0").call()
        cls.contract.functions.registerCredentialDefinition(
            (
                cls.schema_id,
                "default",
                str(CRED_DEF["n"]),
                str(CRED_DEF["S"]),
                str(CRED_DEF["R"]),
                str(CRED_DEF["Z"]),
                ATTRIBUTES,
                [str(CRED_DEF["R_attrs"][name]) for name in ATTRIBUTES],
            )
        ).transact({"from": cls.issuer_address})
        cls.cred_def_id = cls.contract.functions.credentialDefinitionId(
            cls.issuer_address, cls.schema_id, "default"
        ).call()

        cls.temp = tempfile.TemporaryDirectory()
        artifact_path = Path(cls.temp.name) / "CredentialRegistry.json"
        artifact_path.write_text(json.dumps(cls.artifact), encoding="utf-8")
        deployment_path = Path(cls.temp.name) / "deployment.json"
        deployment_path.write_text(
            json.dumps(
                {
                    "chain_id": 131277322940537,
                    "address": cls.contract.address,
                    "schema_id": "0x" + cls.schema_id.hex(),
                    "cred_def_id": "0x" + cls.cred_def_id.hex(),
                    "rpc_url": "memory://tester",
                    "explorer": "https://sepolia.etherscan.io",
                }
            ),
            encoding="utf-8",
        )
        cls.patches = [
            patch.object(chain, "ARTIFACT_FILE", artifact_path),
            patch.object(chain, "REGISTRY_FILE", deployment_path),
            patch.object(chain, "_contract", lambda: (cls.contract, chain._deployment())),
        ]
        for item in cls.patches:
            item.start()

    @classmethod
    def tearDownClass(cls):
        for item in reversed(cls.patches):
            item.stop()
        cls.temp.cleanup()

    def setUp(self):
        chain.clear_cache()

    def test_schema_read_back_from_chain(self):
        schema = chain.get_schema()
        self.assertEqual(schema["name"], "nationalIdentity")
        self.assertEqual(schema["version"], "1.0")
        self.assertEqual(schema["attributes"], ATTRIBUTES)
        self.assertEqual(schema["issuer"], self.issuer_address)

    def test_verifier_can_discover_schemas_from_multiple_issuers(self):
        self.contract.functions.registerSchema("drivingLicence", "1.0", ["licence_number"]).transact(
            {"from": self.outsider}
        )
        catalog = chain.list_registered_schemas()
        # Lọc theo cả issuer: một test khác cũng đăng ký tên drivingLicence từ ví issuer, và việc
        # hai ví dùng chung một tên schema mà không đụng nhau chính là điều cần kiểm ở đây.
        discovered = next(
            schema for schema in catalog["schemas"]
            if schema["name"] == "drivingLicence" and schema["issuer"] == self.outsider
        )
        self.assertEqual(discovered["issuer"], self.outsider)
        self.assertEqual(discovered["attributes"], ["licence_number"])
        self.assertTrue(discovered["fingerprint"].startswith("sha256:"))
        self.assertEqual(discovered["credential_definitions"], [])

    def test_public_key_survives_the_round_trip(self):
        cred_def = chain.get_cred_def()
        self.assertEqual(cred_def["n"], CRED_DEF["n"])
        self.assertEqual(cred_def["S"], CRED_DEF["S"])
        self.assertEqual(cred_def["R"], CRED_DEF["R"])
        self.assertEqual(cred_def["Z"], CRED_DEF["Z"])
        self.assertEqual(cred_def["R_attrs"], CRED_DEF["R_attrs"])
        self.assertEqual(cred_def["schema_id"], "0x" + self.schema_id.hex())

    def test_registered_schema_cannot_be_overwritten(self):
        with self.assertRaises(Exception):
            self.contract.functions.registerSchema("nationalIdentity", "1.0", ATTRIBUTES).transact(
                {"from": self.issuer_address}
            )

    def test_only_the_schema_issuer_can_publish_its_public_key(self):
        with self.assertRaises(Exception):
            self.contract.functions.registerCredentialDefinition(
                (self.schema_id, "forged", "1", "2", "3", "4", ATTRIBUTES, ["1"] * len(ATTRIBUTES))
            ).transact({"from": self.outsider})

    def test_public_key_must_cover_every_schema_attribute(self):
        self.contract.functions.registerSchema("drivingLicence", "1.0", ["so_gplx", "hang"]).transact(
            {"from": self.issuer_address}
        )
        licence_schema = self.contract.functions.schemaId(self.issuer_address, "drivingLicence", "1.0").call()
        with self.assertRaises(Exception):
            self.contract.functions.registerCredentialDefinition(
                (licence_schema, "default", "1", "2", "3", "4", ["so_gplx"], ["1"])
            ).transact({"from": self.issuer_address})

    def test_unknown_id_is_rejected(self):
        with self.assertRaises(Exception):
            self.contract.functions.getSchema(b"\x00" * 32).call()


if __name__ == "__main__":
    unittest.main()
