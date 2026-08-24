import hashlib


def encode_attribute(value) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isascii() and value.isdigit():
        return int(value)
    return int(hashlib.sha256(str(value).encode()).hexdigest(), 16)


def hash_three(x: int, y: int, nonce: str) -> int:
    return int(hashlib.sha256(f"{x}|{y}|{nonce}".encode()).hexdigest(), 16)
