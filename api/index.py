"""Vercel serverless entry point for Jwood Technologies backend."""
import os
import sys
import importlib.util

os.environ.setdefault("BACKEND_URL", "https://jwoodtech.vercel.app")
os.environ.setdefault("FRONTEND_URL", "https://jwoodtechnologies.com")
os.environ.setdefault("GOOGLE_REDIRECT_URI", "https://jwoodtech.vercel.app/api/auth/google/callback")
os.environ.setdefault("CORS_ORIGINS", "https://jwoodtechnologies.com")

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

MONGO_URL = os.environ.get("MONGO_URL", "")
DB_NAME = os.environ.get("DB_NAME", "jwoodtech")
_mongo = AsyncIOMotorClient(MONGO_URL) if MONGO_URL else None
db = _mongo[DB_NAME] if _mongo else None

_backend = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")

if db is not None:
    for mod_name in ["google_auth", "eon_app", "woodchat"]:
        try:
            spec = importlib.util.spec_from_file_location(mod_name, os.path.join(_backend, f"{mod_name}.py"))
            if spec and spec.loader:
                mod = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod)
                builder = getattr(mod, f"build_{mod_name.replace('_app', '')}_router" if mod_name == "eon_app" else f"build_{mod_name}_router" if mod_name != "woodchat" else "build_woodchat_router")
                app.include_router(builder(db), prefix="/api")
                print(f"✅ Loaded {mod_name}")
        except Exception as e:
            print(f"❌ {mod_name}: {e}")

@app.get("/api/")
async def root():
    return {"service": "jwood-technologies-vercel", "ok": True, "db": db is not None}

from mangum import Mangum
handler = Mangum(app, lifespan="off")
