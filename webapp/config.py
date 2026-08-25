"""Runtime configuration, all overridable via environment variables.

RP_ID / ORIGIN must match the domain the browser actually sees, or WebAuthn
will reject every ceremony. PUBLIC_BASE_URL is what gets baked into the QR
code the phone scans — on localhost that's the same as ORIGIN, but once you
tunnel through cloudflared (see checklist in prompt-webapp-wallet.md) it
needs to be the tunnel's https URL.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
WALLETS_DIR = DATA_DIR / "wallets"
DB_PATH = DATA_DIR / "app.db"
SESSION_SECRET_FILE = DATA_DIR / "session_secret.txt"

RP_ID = os.environ.get("RP_ID", "localhost")
RP_NAME = "Minh Chứng"
ORIGIN = os.environ.get("ORIGIN", "http://localhost:8003")
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", ORIGIN)
PORT = int(os.environ.get("PORT", "8003"))

# Same OAuth Client ID already wired up on the static landing page
# (docs/unlock.js). Used server-side only to verify the ID token's
# signature — Google confirms the email, the passkey remains the real
# login credential (see Part A of prompt-webapp-wallet.md).
GOOGLE_CLIENT_ID = os.environ.get(
    "GOOGLE_CLIENT_ID",
    "477011472862-pcc371j0kpd2fe17a2unqujou7iffgr2.apps.googleusercontent.com",
)

SESSION_COOKIE_NAME = "mc_session"
SESSION_TTL_SECONDS = 30 * 24 * 3600  # 30 days

CAPTURE_TTL_SECONDS = 5 * 60
WEBAUTHN_CHALLENGE_TTL_SECONDS = 5 * 60

DATA_DIR.mkdir(parents=True, exist_ok=True)
WALLETS_DIR.mkdir(parents=True, exist_ok=True)
