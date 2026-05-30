"""Vercel serverless entry point for Jwood Technologies backend.

This is a standalone WSGI/ASGI handler that mounts only the essential
API routes (auth, chat) without the heavy dependencies (Playwright, PyMuPDF, etc.)
that don't work well in serverless environments.
"""
import os
import sys

# Add backend dir to path so we can import modules from it
BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
sys.path.insert(0, BACKEND_DIR)

os.environ.setdefault("BACKEND_URL", "https://jwoodtech.vercel.app")
os.environ.setdefault("FRONTEND_URL", "https://jwoodtechnologies.com")
os.environ.setdefault(
    "GOOGLE_REDIRECT_URI",
    "https://jwoodtech.vercel.app/api/auth/google/callback",
)

# ---- Build a minimal FastAPI app with only the routes we need ----
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(os.path.join(BACKEND_DIR, ".env"))

vercel_app = FastAPI(title="Jwood Technologies API (Vercel)")

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "https://jwoodtechnologies.com")
vercel_app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- MongoDB ----
MONGO_URL = os.environ.get("MONGO_URL", "")
DB_NAME = os.environ.get("DB_NAME", "jwoodtech")
mongo_client = AsyncIOMotorClient(MONGO_URL) if MONGO_URL else None
db = mongo_client[DB_NAME] if mongo_client else None

# ---- Mount Google Auth router ----
from google_auth import build_google_auth_router
if db is not None:
    google_router = build_google_auth_router(db)
    vercel_app.include_router(google_router, prefix="/api")

# ---- Mount EON router ----
from eon_app import build_eon_router
if db is not None:
    eon_router = build_eon_router(db)
    vercel_app.include_router(eon_router, prefix="/api")

# ---- Mount WoodChat router ----
from woodchat import build_woodchat_router
if db is not None:
    wc_router = build_woodchat_router(db)
    vercel_app.include_router(wc_router, prefix="/api")

# ---- Health check ----
@vercel_app.get("/api/")
async def root():
    return {"service": "jwood-technologies-vercel", "ok": True}


# ---- Vercel handler ----
from mangum import Mangum
handler = Mangum(vercel_app, lifespan="off")
