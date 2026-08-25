# Webapp Wallet

Implements the screens and tasks in `prompt-webapp-wallet.md`, on top of the
existing crypto core (`issuer/issuer.py`, `wallet/wallet.py`,
`verifier/verifier.py`, `common.py` — untouched, only called into).

## Run locally

```bash
pip install -r webapp/requirements.txt
python -m uvicorn webapp.main:app --reload --port 8003
```

Open `http://localhost:8003`. Passkey registration/login needs a real
browser with a platform authenticator (Windows Hello, Touch ID, a security
key, or a phone acting as one) — `RP_ID`/`ORIGIN` default to `localhost`,
which WebAuthn treats as a secure context without HTTPS.

## Testing the QR → phone capture flow

The phone needs to reach the same server over HTTPS (WebAuthn/camera
require a secure context off `localhost`). Tunnel it, e.g. with
[cloudflared](https://github.com/cloudflare/cloudflared):

```bash
cloudflared tunnel --url http://localhost:8003
```

Then run the server with the tunnel's URL:

```bash
RP_ID=your-tunnel.trycloudflare.com \
ORIGIN=https://your-tunnel.trycloudflare.com \
PUBLIC_BASE_URL=https://your-tunnel.trycloudflare.com \
python -m uvicorn webapp.main:app --port 8003
```

`RP_ID` must be the bare hostname (no scheme); `ORIGIN`/`PUBLIC_BASE_URL`
need the full `https://` URL.

## What's simulated, on purpose

- **OCR**: `issuer/issuer.py`'s `EKYC_DB` has exactly one seeded record, so
  `routes/capture.py` always "recognizes" that record's fields instead of
  running a real OCR/MRZ engine — labeled clearly in code comments, not a
  stubbed-out integration.
- **Google Sign-In**: verifies the ID token server-side (confirms the email
  is real) but does not replace the passkey. Per Part A of the spec,
  `1 email == 1 passkey == 1 link secret`; Google only pre-fills/verifies the
  email before the actual WebAuthn ceremony.

## Tests

```bash
python -m webapp.tests.test_cleanup
```

Drives a full issuance through the real crypto path (no HTTP, no WebAuthn —
those need a browser) and checks Task C.3's requirement: after a successful
issuance, `webapp/data/wallets/{user_id}/` holds exactly `link_secret.json`,
`credential.json`, `attributes.json`.

## Known gaps vs. the full checklist in `prompt-webapp-wallet.md`

- Real WebAuthn registration/login (D's first item) needs manual testing in
  an actual browser — cannot be scripted here.
- Concurrency: `wallet_store.py`'s per-user file I/O assumes a given user
  isn't hitting the API from two tabs at once. Fine for a demo, not a
  guarantee for production.
