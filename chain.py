import hashlib
import json
import os
import time
from pathlib import Path

ARTIFACT_FILE = Path(__file__).resolve().parent / "contracts" / "CredentialRegistry.json"
REGISTRY_FILE = Path(__file__).resolve().parent / "contracts" / "deployment.json"

CACHE_TTL_SECONDS = 60

_cache: dict[str, tuple[float, dict]] = {}


class ChainNotConfigured(RuntimeError):
    pass


def _deployment() -> dict:
    stored = json.loads(REGISTRY_FILE.read_text(encoding="utf-8")) if REGISTRY_FILE.exists() else {}
    return {
        "rpc_url": os.environ.get("SEPOLIA_RPC_URL") or stored.get("rpc_url", ""),
        "address": os.environ.get("CREDENTIAL_REGISTRY_ADDRESS") or stored.get("address", ""),
        "schema_id": os.environ.get("SCHEMA_ID") or stored.get("schema_id", ""),
        "cred_def_id": os.environ.get("CREDENTIAL_DEFINITION_ID") or stored.get("cred_def_id", ""),
        "chain_id": stored.get("chain_id", 11155111),
        "explorer": stored.get("explorer", "https://sepolia.etherscan.io"),
    }


def is_configured() -> bool:
    config = _deployment()
    return bool(config["rpc_url"] and config["address"] and config["cred_def_id"])


def abi() -> list:
    return json.loads(ARTIFACT_FILE.read_text(encoding="utf-8"))["abi"]


def _contract():
    from web3 import Web3

    config = _deployment()
    if not (config["rpc_url"] and config["address"]):
        raise ChainNotConfigured("Chưa cấu hình SEPOLIA_RPC_URL / CREDENTIAL_REGISTRY_ADDRESS")
    web3 = Web3(Web3.HTTPProvider(config["rpc_url"], request_kwargs={"timeout": 20}))
    return web3.eth.contract(address=Web3.to_checksum_address(config["address"]), abi=abi()), config


def _cached(key: str, build):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_TTL_SECONDS:
        return hit[1]
    value = build()
    _cache[key] = (time.time(), value)
    return value


def clear_cache() -> None:
    _cache.clear()


def _read_schema() -> dict:
    contract, config = _contract()
    if not config["schema_id"]:
        raise ChainNotConfigured("Chưa cấu hình SCHEMA_ID")
    name, version, attributes, issuer, registered_at = contract.functions.getSchema(
        bytes.fromhex(config["schema_id"].removeprefix("0x"))
    ).call()
    return {
        "id": config["schema_id"],
        "name": name,
        "version": version,
        "attributes": list(attributes),
        "issuer": issuer,
        "registered_at": registered_at,
    }


def _read_cred_def() -> dict:
    contract, config = _contract()
    (
        schema_id,
        modulus,
        s,
        link_secret_base,
        z,
        attribute_names,
        attribute_bases,
        issuer,
        registered_at,
    ) = contract.functions.getCredentialDefinition(
        bytes.fromhex(config["cred_def_id"].removeprefix("0x"))
    ).call()
    return {
        "id": config["cred_def_id"],
        "schema_id": "0x" + schema_id.hex(),
        "n": int(modulus),
        "S": int(s),
        "R": int(link_secret_base),
        "Z": int(z),
        "R_attrs": {name: int(base) for name, base in zip(attribute_names, attribute_bases)},
        "issuer": issuer,
        "registered_at": registered_at,
    }


def get_schema() -> dict:
    return _cached("schema", _read_schema)


def get_cred_def() -> dict:
    return _cached("cred_def", _read_cred_def)


def schema_fingerprint(name: str, version: str, attributes: list[str], issuer_address: str) -> str:
    canonical = json.dumps(
        {"issuer": issuer_address.lower(), "name": name, "version": version,
         "attributes": list(attributes)},
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    return "sha256:" + hashlib.sha256(canonical).hexdigest()


def list_registered_schemas() -> dict:
    """Enumerate every issuer/schema and public credential definition in the shared registry."""
    from web3 import Web3

    contract, config = _contract()
    schemas: list[dict] = []
    cred_defs: dict[str, list[dict]] = {}
    for index in range(contract.functions.credentialDefinitionCount().call()):
        cred_id = contract.functions.credentialDefinitionIds(index).call()
        record = contract.functions.getCredentialDefinition(cred_id).call()
        schema_id = Web3.to_hex(record[0])
        cred_defs.setdefault(schema_id.lower(), []).append({
            "id": Web3.to_hex(cred_id),
            "issuer": record[7],
            "registered_at": record[8],
            "attributes": list(record[5]),
        })

    for index in range(contract.functions.schemaCount().call()):
        schema_id = contract.functions.schemaIds(index).call()
        name, version, attributes, issuer_address, registered_at = contract.functions.getSchema(schema_id).call()
        schema_key = Web3.to_hex(schema_id)
        schemas.append({
            "id": schema_key,
            "name": name,
            "version": version,
            "attributes": list(attributes),
            "issuer": issuer_address,
            "registered_at": registered_at,
            "fingerprint": schema_fingerprint(name, version, list(attributes), issuer_address),
            "credential_definitions": cred_defs.get(schema_key.lower(), []),
        })

    return {
        "chain": "Ethereum Sepolia",
        "chain_id": config["chain_id"],
        "registry_address": config["address"],
        "schemas": schemas,
    }


def resolve_cred_def() -> tuple[dict, str]:
    """Khoá công khai dùng để kiểm proof. Ưu tiên bản trên chain — đó mới là bản issuer đã công bố
    và không sửa được; file cục bộ chỉ là đường lui khi chưa cấu hình chain."""
    from issuer import issuer

    if is_configured():
        return get_cred_def(), "chain"
    return issuer.get_public_cred_def(), "local"


def resolve_attributes() -> tuple[list[str], str]:
    """Danh sách thuộc tính mà một credential loại này được phép có. Verifier chỉ được hỏi trong
    phạm vi này — schema trên chain là giới hạn trên, không phải gợi ý."""
    from issuer import issuer

    if is_configured():
        return get_schema()["attributes"], "chain"
    return list(issuer.ATTRIBUTE_NAMES), "local"


def status() -> dict:
    config = _deployment()
    if not is_configured():
        return {"configured": False}
    info = {
        "configured": True,
        "chain": "Ethereum Sepolia",
        "chain_id": config["chain_id"],
        "address": config["address"],
        "schema_id": config["schema_id"],
        "cred_def_id": config["cred_def_id"],
        "explorer_url": f"{config['explorer']}/address/{config['address']}",
    }
    try:
        schema = get_schema()
        info["schema_name"] = f"{schema['name']}:{schema['version']}"
        info["attributes"] = schema["attributes"]
        info["issuer_address"] = schema["issuer"]
        info["reachable"] = True

        from issuer import issuer

        published = get_cred_def()
        local = issuer.get_public_cred_def()
        info["matches_local_key"] = all(published[k] == local[k] for k in ("n", "S", "R", "Z", "R_attrs"))
    except Exception as error:
        info["reachable"] = False
        info["error"] = str(error)
    return info
