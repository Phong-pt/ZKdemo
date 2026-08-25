"""Run with: python -m uvicorn verifier_app.main:app --reload --port 8004
from the repo root (so `import verifier` resolves)."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import routes

WEB_DIR = Path(__file__).resolve().parent / "web"

app = FastAPI(title="Trạm Xác Minh")

# Public, cookie-less endpoints only (no session/credentials involved) —
# any origin can call them, matching the fact that any Holder wallet
# should be able to respond to a request, not just one specific one.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(routes.router)
app.mount("/static", StaticFiles(directory=WEB_DIR / "static"), name="static")


@app.get("/")
def index_page():
    return FileResponse(WEB_DIR / "index.html")
