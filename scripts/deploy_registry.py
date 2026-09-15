"""Deploy CredentialRegistry lên Sepolia rồi công bố schema CCCD + khoá công khai của issuer.

Chạy từ thư mục gốc repo, cần ba biến môi trường:

    SEPOLIA_RPC_URL     endpoint RPC (Infura/Alchemy/công cộng)
    ISSUER_PRIVATE_KEY  khoá riêng của ví issuer — dùng ví rác, chỉ có ETH testnet
    SCHEMA_VERSION      tuỳ chọn, mặc định 1.0

    python scripts/deploy_registry.py

Kết quả ghi vào contracts/deployment.json; api.py và verifier đọc file đó để biết phải hỏi hợp đồng
nào. Chạy lại với SCHEMA_VERSION khác nếu muốn đăng ký một phiên bản schema mới.
"""

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import solcx
from web3 import Web3

import chain
from issuer import issuer

SOLC_VERSION = "0.8.24"
CONTRACT_FILE = ROOT / "contracts" / "CredentialRegistry.sol"
EXPLORER = "https://sepolia.etherscan.io"


def compile_contract() -> dict:
    if SOLC_VERSION not in [str(v) for v in solcx.get_installed_solc_versions()]:
        print(f"Tải solc {SOLC_VERSION}…")
        solcx.install_solc(SOLC_VERSION)
    compiled = solcx.compile_files(
        [str(CONTRACT_FILE)], output_values=["abi", "bin"], solc_version=SOLC_VERSION, optimize=True
    )
    key = next(k for k in compiled if k.endswith("CredentialRegistry"))
    artifact = {"abi": compiled[key]["abi"], "bytecode": compiled[key]["bin"]}
    chain.ARTIFACT_FILE.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    print(f"Biên dịch xong: {len(artifact['bytecode']) // 2} bytes bytecode")
    return artifact


def send(web3: Web3, account, transaction) -> dict:
    transaction.update(
        {
            "from": account.address,
            "nonce": web3.eth.get_transaction_count(account.address),
            "chainId": web3.eth.chain_id,
        }
    )
    transaction.setdefault("gas", int(web3.eth.estimate_gas(transaction) * 1.2))
    transaction.setdefault("maxFeePerGas", web3.eth.gas_price * 2)
    transaction.setdefault("maxPriorityFeePerGas", web3.to_wei(1.5, "gwei"))
    signed = account.sign_transaction(transaction)
    tx_hash = web3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"  tx {tx_hash.hex()} — chờ xác nhận…")
    receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
    if receipt["status"] != 1:
        raise SystemExit(f"Giao dịch thất bại: {EXPLORER}/tx/{tx_hash.hex()}")
    print(f"  block {receipt['blockNumber']}, gas {receipt['gasUsed']}")
    return receipt


def main() -> None:
    rpc_url = os.environ.get("SEPOLIA_RPC_URL", "")
    private_key = os.environ.get("ISSUER_PRIVATE_KEY", "")
    if not rpc_url or not private_key:
        raise SystemExit("Thiếu SEPOLIA_RPC_URL hoặc ISSUER_PRIVATE_KEY")

    artifact = compile_contract()
    web3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 60}))
    account = web3.eth.account.from_key(private_key)
    balance = web3.from_wei(web3.eth.get_balance(account.address), "ether")
    print(f"Issuer {account.address} — số dư {balance} ETH trên chain id {web3.eth.chain_id}")
    if balance == 0:
        raise SystemExit("Ví không có ETH testnet — xin ở faucet Sepolia trước")

    cred_def = issuer.get_public_cred_def()
    attributes = issuer.ATTRIBUTE_NAMES
    version = os.environ.get("SCHEMA_VERSION", "1.0")

    registry = web3.eth.contract(abi=artifact["abi"], bytecode=artifact["bytecode"])
    print("\n1/3 Deploy CredentialRegistry…")
    receipt = send(web3, account, registry.constructor().build_transaction({}))
    address = receipt["contractAddress"]
    contract = web3.eth.contract(address=address, abi=artifact["abi"])
    print(f"  địa chỉ {address}")

    print(f"\n2/3 Đăng ký schema nationalIdentity:{version} với {len(attributes)} thuộc tính…")
    send(
        web3,
        account,
        contract.functions.registerSchema("nationalIdentity", version, attributes).build_transaction({}),
    )
    schema_id = contract.functions.schemaId(account.address, "nationalIdentity", version).call()

    print("\n3/3 Công bố khoá công khai issuer (credential definition)…")
    send(
        web3,
        account,
        contract.functions.registerCredentialDefinition(
            (
                schema_id,
                "default",
                str(cred_def["n"]),
                str(cred_def["S"]),
                str(cred_def["R"]),
                str(cred_def["Z"]),
                attributes,
                [str(cred_def["R_attrs"][name]) for name in attributes],
            )
        ).build_transaction({}),
    )
    cred_def_id = contract.functions.credentialDefinitionId(account.address, schema_id, "default").call()

    deployment = {
        "chain": "Ethereum Sepolia",
        "chain_id": web3.eth.chain_id,
        "address": address,
        "issuer_address": account.address,
        "schema_id": "0x" + schema_id.hex(),
        "cred_def_id": "0x" + cred_def_id.hex(),
        "explorer": EXPLORER,
    }
    chain.REGISTRY_FILE.write_text(json.dumps(deployment, indent=2), encoding="utf-8")

    print("\nXong. Đã ghi contracts/deployment.json")
    print(f"  Hợp đồng   {EXPLORER}/address/{address}")
    print(f"  Schema     {deployment['schema_id']}")
    print(f"  Cred-def   {deployment['cred_def_id']}")
    print("\nĐặt SEPOLIA_RPC_URL cho service api để verifier đọc được chain.")


if __name__ == "__main__":
    main()
