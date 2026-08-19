from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from issuer import issuer

app = FastAPI(title="Issuer Service")


class EkycRequest(BaseModel):
    cccd: str
    name: str
    dob: str
    nationality: str
    address: str


class ProofRequest(BaseModel):
    u: str
    c: str
    v_hat: str
    ls_hat: str
    nonce: str
    ls_id: str
    attributes: dict


@app.post("/ekyc")
def request_challenge(ekyc: EkycRequest):
    nonce = issuer.issue_challenge(ekyc.model_dump())
    if not nonce:
        raise HTTPException(status_code=400, detail="eKYC không hợp lệ")
    return {"nonce": nonce}


@app.get("/cred-def")
def cred_def():
    return issuer.get_public_cred_def()


@app.post("/credential-request")
def credential_request(req: ProofRequest):
    proof = {
        "u": req.u,
        "c": req.c,
        "v_hat": req.v_hat,
        "ls_hat": req.ls_hat,
        "nonce": req.nonce,
        "ls_id": req.ls_id,
    }
    try:
        return issuer.sign_blindly(req.attributes, proof)
    except ValueError as ex:
        raise HTTPException(status_code=409, detail=str(ex))
