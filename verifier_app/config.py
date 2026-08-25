"""Config for the Verifier portal — a standalone service, deployed and
branded completely separately from the Holder wallet (`webapp/` branch).
The only coupling is these two URLs, both overridable via env vars.
"""

import os

# The Holder wallet this Verifier sends people to / fetches the public
# Issuer cred-def from. Defaults to the deployed wallet demo.
WALLET_APP_URL = os.environ.get("WALLET_APP_URL", "https://zkdemo.onrender.com").rstrip("/")

# This service's own public URL — baked into the wallet_link so the wallet
# knows where to call back. Must match whatever domain this is actually
# deployed on.
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "http://localhost:8004").rstrip("/")

VERIFIER_NAME = os.environ.get("VERIFIER_NAME", "Trạm Xác Minh")

PORT = int(os.environ.get("PORT", "8004"))

SESSION_TTL_SECONDS = 5 * 60
CRED_DEF_CACHE_SECONDS = 5 * 60
