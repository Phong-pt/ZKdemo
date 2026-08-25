# Trạm Xác Minh — standalone Verifier portal

An independent third-party site that checks a credential issued by the
same demo — deliberately **unrelated** to the landing page (`docs/` on
`landing-page`) and the Holder wallet (`webapp/` on `webapp`): own branch,
own branding (amber, not the wallet's emerald), own deploy. The only
coupling to the wallet is two public HTTP calls, matching the real
Issuer/Holder/Verifier model in `CLAUDE.md` where these are three
independent parties.

Calls straight into `verifier/verifier.py`'s real
`create_presentation_request` / `verify_presentation` — no proof logic
duplicated here.

## How it talks to the wallet

- Fetches the Issuer's public cred-def from the wallet's
  `GET /api/issuer/cred-def` (server-to-server, cached 5 min) — this
  mirrors fetching it from a public chain/ledger in the real model.
- Builds a `wallet_link` (`{WALLET_APP_URL}/present?verifier=...&n_v=...`)
  shown as a QR code / copyable link. The Holder opens it on their own
  logged-in wallet, reviews what's being asked, and their **browser**
  (not this server) POSTs the built presentation directly to
  `POST /api/check/{n_v}/submit` here — cross-origin, CORS enabled.

## Run locally

```bash
pip install -r verifier_app/requirements.txt
WALLET_APP_URL=https://zkdemo.onrender.com \
PUBLIC_BASE_URL=http://localhost:8004 \
python -m uvicorn verifier_app.main:app --reload --port 8004
```

`WALLET_APP_URL` defaults to the deployed wallet demo already; only
override it for local end-to-end testing (see below). `PUBLIC_BASE_URL`
must match wherever this service is actually reachable — the wallet's
browser needs it to send the presentation back.

## Local end-to-end test (both services on one machine)

```bash
# terminal 1 — the wallet, from a checkout of the `webapp` branch
python -m uvicorn webapp.main:app --port 8003

# terminal 2 — this app, pointed at that local wallet
WALLET_APP_URL=http://localhost:8003 PUBLIC_BASE_URL=http://localhost:8004 \
python -m uvicorn verifier_app.main:app --port 8004
```

Verified this way already: a real presentation built by the wallet for a
logged-in user with an issued credential, submitted to this app, correctly
verifies (`{"ok": true}`), reveals only the requested attributes, and a
replayed/tampered submission is correctly rejected.

## Deploying

Same story as the wallet (see `webapp/README.md`) — GitHub Pages can't run
this, it's a real Python server. Render free tier works the same way:
Build command `pip install -r verifier_app/requirements.txt`, start command
`python -m uvicorn verifier_app.main:app --host 0.0.0.0 --port $PORT`, env
vars `WALLET_APP_URL` (the deployed wallet's URL) and `PUBLIC_BASE_URL`
(this service's own assigned URL, known only after the first deploy —
same chicken-and-egg note as the wallet's README).

## What's not implemented

- Only full reveal vs. full hide per attribute — `wallet.py`'s
  `create_presentation` doesn't support predicate/range proofs (e.g.
  "prove age ≥ 18 without revealing the birth date"), so this portal can't
  ask for that either.
- Sessions are in-memory (`store.py`), same pattern as `issuer.py` /
  `verifier.py`'s own pending-session dicts — resets on restart, fine for
  a demo.
