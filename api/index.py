"""Vercel serverless entry point for Jwood Technologies backend.

Mangum wraps the FastAPI app for Vercel's Python serverless runtime.
All imports are self-contained — no dependency on server.py (which has
heavy imports like Playwright/PyMuPDF that don't work in serverless).
"""
import os
import sys

os.environ.setdefault("BACKEND_URL", "https://jwoodtech.vercel.app")
os.environ.setdefault("FRONTEND_URL", "https://jwoodtechnologies.com")
os.environ.setdefault(
    "GOOGLE_REDIRECT_URI",
    "https://jwoodtech.vercel.app/api/auth/google/callback",
)
os.environ.setdefault("CORS_ORIGINS", "https://jwoodtechnologies.com")

# ---- FastAPI app ----
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

app = FastAPI(title="Jwood Technologies API")

cors_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- MongoDB ----
MONGO_URL = os.environ.get("MONGO_URL", "")
DB_NAME = os.environ.get("DB_NAME", "jwoodtech")
_mongo = AsyncIOMotorClient(MONGO_URL) if MONGO_URL else None
db = _mongo[DB_NAME] if _mongo else None

# ---- Import and mount routers from backend modules ----
# We import the module files directly to avoid loading server.py's heavy imports
import importlib.util

def _load_module(name, path):
    """Load a module from a file path without triggering server.py imports."""
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    # Don't add to sys.modules to avoid pollution
    spec.loader.exec_module(mod)
    return mod

_backend = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")

if db is not None:
    try:
        ga = _load_module("google_auth", os.path.join(_backend, "google_auth.py"))
        app.include_router(ga.build_google_auth_router(db), prefix="/api")
    except Exception as e:
        print(f"google_auth failed: {e}")

    try:
        ea = _load_module("eon_app", os.path.join(_backend, "eon_app.py"))
        app.include_router(ea.build_eon_router(db), prefix="/api")
    except Exception as e:
        print(f"eon_app failed: {e}")

    try:
        wc = _load_module("woodchat", os.path.join(_backend, "woodchat.py"))
        app.include_router(wc.build_woodchat_router(db), prefix="/api")
    except Exception as e:
        print(f"woodchat failed: {e}")

# ---- Health check ----
@app.get("/api/")
async def root():
    return {"service": "jwood-technologies-vercel", "ok": True, "db": db is not None}

# ---- Not found handler ----
@app.get("/api/{path:path}")
async def not_found(path: str):
    return {"error": f"Not found: /api/{path}"}


# ---- Vercel handler (Mangum wraps ASGI for serverless) ----
from mangum import Mangum
handler = Mangum(app, lifespan="off")
