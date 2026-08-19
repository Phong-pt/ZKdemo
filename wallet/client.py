import httpx

DEFAULT_BASE_URL = "http://127.0.0.1:8000"


class IssuerClient:
    def __init__(self, base_url: str = DEFAULT_BASE_URL):
        self.base_url = base_url.rstrip("/")

    def request_nonce(self, ekyc: dict) -> str:
        resp = httpx.post(f"{self.base_url}/ekyc", json=ekyc)
        resp.raise_for_status()
        return resp.json()["nonce"]

    def get_public_cred_def(self) -> dict:
        resp = httpx.get(f"{self.base_url}/cred-def")
        resp.raise_for_status()
        return resp.json()

    def request_credential(self, proof: dict, attributes: dict) -> dict:
        payload = {**proof, "attributes": attributes}
        resp = httpx.post(f"{self.base_url}/credential-request", json=payload)
        if resp.status_code == 409:
            raise AlreadyIssuedError(resp.json().get("detail", "Đã cấp credential"))
        resp.raise_for_status()
        return resp.json()


class AlreadyIssuedError(Exception):
    pass
