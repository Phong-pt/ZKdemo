"""FastAPI entrypoint. Run with:

    python -m uvicorn webapp.main:app --reload --port 8003

from the repo root (so `import issuer`, `import wallet` resolve).
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import db
from .routes import auth, capture, issuance, wallet as wallet_routes

WEB_DIR = Path(__file__).resolve().parent / "web"

app = FastAPI(title="Minh Chứng — Webapp Wallet")


@app.on_event("startup")
def on_startup() -> None:
    db.init_db()


app.include_router(auth.router)
app.include_router(wallet_routes.router)
app.include_router(capture.router)
app.include_router(issuance.router)

app.mount("/static", StaticFiles(directory=WEB_DIR / "static"), name="static")


def _page(name: str) -> FileResponse:
    return FileResponse(WEB_DIR / name)


@app.get("/")
def landing_page():
    return _page("landing.html")


@app.get("/auth")
def auth_page():
    return _page("auth.html")


@app.get("/wallet")
def wallet_page():
    return _page("wallet.html")


@app.get("/issue")
def issue_page():
    return _page("issue.html")


@app.get("/capture/{capture_id}")
def capture_page(capture_id: str):
    return _page("capture.html")
