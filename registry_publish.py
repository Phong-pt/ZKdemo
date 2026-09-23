"""Deploy/register the shared public schema, with a persisted transaction journal."""
import json
import os
from pathlib import Path
from threading import Lock

import chain
from issuer import issuer

JOURNAL = Path(__file__).resolve().parent / "contracts" / "issuer-publication.json"
_lock = Lock()


class PublicationError(Exception):
    pass


def read():
    return json.loads(JOURNAL.read_text()) if JOURNAL.exists() else {"state": "not_published", "transactions": {}}


def save(data):
    JOURNAL.parent.mkdir(parents=True, exist_ok=True)
    temp = JOURNAL.with_suffix(".tmp")
    temp.write_text(json.dumps(data, indent=2))
    temp.replace(JOURNAL)


def status():
    data = read()
    return {**data, "busy": _lock.locked(), "configured": bool(os.environ.get("SEPOLIA_RPC_URL") and os.environ.get("ISSUER_PRIVATE_KEY")),
            "chain": "Ethereum Sepolia", "chain_id": 11155111,
            "schema_name": "nationalIdentity", "schema_version": "1.0", "attributes": issuer.ATTRIBUTE_NAMES}


def artifact():
    if chain.ARTIFACT_FILE.exists():
        return json.loads(chain.ARTIFACT_FILE.read_text())
    import solcx
    version = "0.8.24"
    if version not in [str(v) for v in solcx.get_installed_solc_versions()]:
        solcx.install_solc(version)
    compiled = solcx.compile_files([str(chain.ARTIFACT_FILE.with_suffix(".sol"))],
                                  output_values=["abi", "bin"], solc_version=version, optimize=True)
    value = next(v for k, v in compiled.items() if k.endswith(":CredentialRegistry"))
    result = {"abi": value["abi"], "bytecode": value["bin"]}
    chain.ARTIFACT_FILE.write_text(json.dumps(result))
    return result


def publish():
    if not _lock.acquire(blocking=False):
        return
    data = {"state": "not_published", "transactions": {}}
    try:
        data = read()
        from web3 import Web3
        from web3.exceptions import ContractLogicError
        rpc, key = os.environ.get("SEPOLIA_RPC_URL"), os.environ.get("ISSUER_PRIVATE_KEY")
        if not rpc or not key:
            raise PublicationError("Chưa có SEPOLIA_RPC_URL / ISSUER_PRIVATE_KEY. Credential được ký off-chain; schema chưa được công bố.")
        data.update(state="publishing", error=None)
        save(data)
        w3 = Web3(Web3.HTTPProvider(rpc, request_kwargs={"timeout": 25}))
        if w3.eth.chain_id != 11155111:
            raise PublicationError("RPC phải kết nối Ethereum Sepolia, chain id 11155111")
        account = w3.eth.account.from_key(key)
        if data.get("issuer_address") and data["issuer_address"] != account.address:
            raise PublicationError("Ví ký giao dịch đã đổi; không thể dùng lại nhật ký của issuer cũ")
        data["issuer_address"] = account.address
        save(data)
        compiled = artifact()
        public = issuer.get_public_cred_def()

        def transaction(stage, builder):
            item = data["transactions"].get(stage)
            if not item or item["state"] == "failed":
                tx = builder.build_transaction({"from": account.address,
                    "nonce": w3.eth.get_transaction_count(account.address, "pending"), "chainId": 11155111})
                tx["gas"] = int(w3.eth.estimate_gas(tx) * 1.2)
                signed = account.sign_transaction(tx)
                tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
                item = {"hash": Web3.to_hex(tx_hash), "state": "pending"}
                data["transactions"][stage] = item
                save(data)
            receipt = w3.eth.wait_for_transaction_receipt(item["hash"], timeout=180)
            item.update(state="confirmed" if receipt["status"] == 1 else "failed",
                        block=receipt["blockNumber"], gas=receipt["gasUsed"])
            save(data)
            if receipt["status"] != 1:
                raise PublicationError(f"Giao dịch {stage} thất bại; xem receipt trên Etherscan rồi thử lại")
            return receipt

        # A receipt may have arrived after an earlier RPC timeout. Refresh the journal even
        # when getSchema/getCredentialDefinition will now find the already-mined record.
        for stage, item in list(data["transactions"].items()):
            if stage != "deploy" and item["state"] == "pending":
                transaction(stage, None)

        config = chain._deployment()
        address = data.get("address") or config["address"]
        if not address:
            factory = w3.eth.contract(abi=compiled["abi"], bytecode=compiled["bytecode"])
            receipt = transaction("deploy", factory.constructor())
            address = receipt["contractAddress"]
            data["address"] = address
            save(data)
        address = Web3.to_checksum_address(address)
        if not w3.eth.get_code(address):
            raise PublicationError("Địa chỉ registry không có smart contract trên Sepolia")
        contract = w3.eth.contract(address=address, abi=compiled["abi"])
        attrs = list(issuer.ATTRIBUTE_NAMES)
        sid = contract.functions.schemaId(account.address, "nationalIdentity", "1.0").call()
        try:
            schema = contract.functions.getSchema(sid).call()
        except ContractLogicError:
            transaction("schema", contract.functions.registerSchema("nationalIdentity", "1.0", attrs))
            schema = contract.functions.getSchema(sid).call()
        if list(schema[2]) != attrs or schema[3] != account.address:
            raise PublicationError("Schema hiện có không khớp issuer hoặc thuộc tính CCCD")
        cid = contract.functions.credentialDefinitionId(account.address, sid, "default").call()
        expected = (sid, str(public["n"]), str(public["S"]), str(public["R"]), str(public["Z"]),
                    attrs, [str(public["R_attrs"][name]) for name in attrs], account.address)
        try:
            cred = contract.functions.getCredentialDefinition(cid).call()
        except ContractLogicError:
            transaction("credential_definition", contract.functions.registerCredentialDefinition(
                (sid, "default", *expected[1:7])))
            cred = contract.functions.getCredentialDefinition(cid).call()
        if tuple(cred[:8]) != expected:
            raise PublicationError("Khóa công khai trên chain khác khóa issuer đang dùng; không thể ghi đè khóa cũ")
        deployment = {"chain": "Ethereum Sepolia", "chain_id": 11155111, "address": address,
                      "issuer_address": account.address, "schema_id": Web3.to_hex(sid),
                      "cred_def_id": Web3.to_hex(cid), "explorer": "https://sepolia.etherscan.io"}
        temp = chain.REGISTRY_FILE.with_suffix(".tmp")
        temp.write_text(json.dumps(deployment, indent=2))
        temp.replace(chain.REGISTRY_FILE)
        chain.clear_cache()
        data.update(deployment, state="published", error=None)
        save(data)
    except Exception as exc:
        # Provider exceptions may contain an RPC URL/API key: never send them to the portal.
        data.update(state="error", error=str(exc) if isinstance(exc, PublicationError)
                    else f"Không thể hoàn tất công bố ({type(exc).__name__}). Kiểm tra RPC, số dư ETH testnet và thử lại; giao dịch đang chờ sẽ được kiểm tra lại.")
        save(data)
    finally:
        _lock.release()
