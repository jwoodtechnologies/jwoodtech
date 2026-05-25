"""Google OAuth 2.0 — white-label sign-in for EON + WoodX.

Flow:
  1. Frontend hits  GET /api/auth/google/login?app=eon|woodchat  → 302 to
     Google's OAuth consent screen with the correct state (carries app tag).
  2. Google redirects back to /api/auth/google/callback with code+state.
  3. We exchange the code for an id_token, fetch the profile, upsert the
     user into either `eon_users` or `wc_users`, mint our existing JWT,
     and redirect to the frontend with the token in the URL hash.

No Emergent branding anywhere — the consent page shows the customer's
Google Cloud project ("jwood-tech") with their own app name / logo.
"""
from __future__ import annotations

import logging
import os
import secrets
import time
import uuid
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

logger = logging.getLogger("jwood.google_auth")

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"

JWT_SECRET = os.environ.get("JWT_SECRET", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "").rstrip("/")
BACKEND_URL = os.environ.get("BACKEND_URL", "").rstrip("/")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "").rstrip("/")
JWT_ALGO = "HS256"
ACCESS_TTL_HOURS = 24 * 14  # 14 days

# Simple in-memory state cache (single replica). Maps state->{app, ts}.
_state_cache: dict[str, dict] = {}
_STATE_TTL = 600  # 10 minutes


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _prune_state():
    now = time.time()
    expired = [k for k, v in _state_cache.items() if now - v["ts"] > _STATE_TTL]
    for k in expired:
        _state_cache.pop(k, None)


def _mint_jwt(user_id: str, email: str) -> str:
    if not JWT_SECRET:
        raise HTTPException(500, "JWT_SECRET not configured")
    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(time.time()),
        "exp": int(time.time()) + ACCESS_TTL_HOURS * 3600,
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def _redirect_uri() -> str:
    """Return the canonical Google callback configured for this deployment."""
    if GOOGLE_REDIRECT_URI:
        return GOOGLE_REDIRECT_URI
    if BACKEND_URL:
        return f"{BACKEND_URL}/api/auth/google/callback"
    raise HTTPException(500, "BACKEND_URL or GOOGLE_REDIRECT_URI not configured")


def _configured_redirect_uri() -> str:
    if GOOGLE_REDIRECT_URI:
        return GOOGLE_REDIRECT_URI
    if BACKEND_URL:
        return f"{BACKEND_URL}/api/auth/google/callback"
    return ""


def _frontend_url(path: str = "") -> str:
    if not FRONTEND_URL:
        raise HTTPException(500, "FRONTEND_URL not configured")
    if not path:
        return FRONTEND_URL
    normalized = path if path.startswith("/") else f"/{path}"
    return f"{FRONTEND_URL}{normalized}"


def build_google_auth_router(db) -> APIRouter:
    router = APIRouter(prefix="/auth/google", tags=["google-auth"])

    eon_users = db.eon_users
    wc_users = db.wc_users

    @router.get("/config")
    async def config():
        """Tells the frontend whether Google Sign-In is available."""
        return {
            "enabled": bool(
                GOOGLE_CLIENT_ID
                and GOOGLE_CLIENT_SECRET
                and FRONTEND_URL
                and (GOOGLE_REDIRECT_URI or BACKEND_URL)
            ),
            "redirect_uri": _configured_redirect_uri(),
            "frontend_url": FRONTEND_URL,
        }

    @router.get("/login")
    async def login(
        request: Request,
        app: str = Query("eon", pattern="^(eon|woodchat)$"),
        next: Optional[str] = None,
    ):
        if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
            raise HTTPException(500, "Google Sign-In is not configured")
        _prune_state()
        state = secrets.token_urlsafe(24)
        _state_cache[state] = {
            "app": app,
            "next": next or "",
            "ts": time.time(),
        }
        params = {
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": _redirect_uri(),
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "online",
            "include_granted_scopes": "true",
            "state": state,
            "prompt": "select_account",
        }
        return RedirectResponse(
            url=f"{GOOGLE_AUTH_URL}?{urlencode(params)}",
            status_code=302,
        )

    @router.get("/callback")
    async def callback(
        request: Request,
        code: Optional[str] = None,
        state: Optional[str] = None,
        error: Optional[str] = None,
    ):
        if error:
            return _error_redirect(request, f"Google returned: {error}")
        if not code or not state:
            return _error_redirect(request, "Missing code or state")
        entry = _state_cache.pop(state, None)
        if not entry:
            return _error_redirect(request, "Invalid or expired state")
        app_tag = entry["app"]

        # 1. Exchange code for tokens
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                tr = await client.post(
                    GOOGLE_TOKEN_URL,
                    data={
                        "code": code,
                        "client_id": GOOGLE_CLIENT_ID,
                        "client_secret": GOOGLE_CLIENT_SECRET,
                        "redirect_uri": _redirect_uri(),
                        "grant_type": "authorization_code",
                    },
                )
                tr.raise_for_status()
                tokens = tr.json()
                access_token = tokens.get("access_token")
                if not access_token:
                    raise RuntimeError("No access_token in Google response")
                # 2. Fetch userinfo
                ur = await client.get(
                    GOOGLE_USERINFO_URL,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                ur.raise_for_status()
                profile = ur.json()
        except Exception as exc:
            logger.warning("Google OAuth exchange failed: %s", exc)
            return _error_redirect(request, "Google sign-in failed")

        email = (profile.get("email") or "").strip().lower()
        if not email:
            return _error_redirect(request, "Google profile missing email")
        google_sub = profile.get("sub") or ""
        given_name = profile.get("given_name") or ""
        family_name = profile.get("family_name") or ""
        full_name = profile.get("name") or email.split("@")[0]
        picture = profile.get("picture") or ""

        # 3. Upsert into BOTH collections so the same JWT works on EON + WoodX.
        # Shared user-id pattern: one canonical id per email across apps.
        existing_eon = await eon_users.find_one({"email": email}, {"_id": 0})
        existing_wc = await wc_users.find_one({"email": email}, {"_id": 0})
        # Reuse an existing id if either side already knows this user;
        # prefer the app the user is currently signing into.
        primary = (existing_eon if app_tag == "eon" else existing_wc) or existing_eon or existing_wc
        user_id = (primary or {}).get("id") or str(uuid.uuid4())
        now = _now_iso()

        # --- EON record ---
        if existing_eon:
            eon_update = {
                "last_login_at": now,
                "google_sub": google_sub,
                "picture": picture or existing_eon.get("picture", ""),
                "auth_provider": "google",
            }
            if not existing_eon.get("first_name") and given_name:
                eon_update["first_name"] = given_name
            if not existing_eon.get("last_name") and family_name:
                eon_update["last_name"] = family_name
            await eon_users.update_one({"id": existing_eon["id"]}, {"$set": eon_update})
        else:
            await eon_users.insert_one({
                "id": user_id,
                "email": email,
                "first_name": given_name,
                "last_name": family_name,
                "name": full_name,
                "picture": picture,
                "google_sub": google_sub,
                "auth_provider": "google",
                "is_admin": False,
                "message_count": 0,
                "created_at": now,
                "last_login_at": now,
            })

        # --- WoodX record ---
        if existing_wc:
            wc_update = {
                "last_login_at": now,
                "google_sub": google_sub,
                "picture": picture or existing_wc.get("picture", ""),
                "auth_provider": "google",
            }
            if not existing_wc.get("first_name") and given_name:
                wc_update["first_name"] = given_name
            if not existing_wc.get("last_name") and family_name:
                wc_update["last_name"] = family_name
            await wc_users.update_one({"id": existing_wc["id"]}, {"$set": wc_update})
        else:
            # Derive a unique username for WoodX
            base_handle = email.split("@")[0][:20].lower().replace(".", "_")
            handle = base_handle
            suffix = 0
            while await wc_users.find_one({"username": handle}):
                suffix += 1
                handle = f"{base_handle}{suffix}"
            await wc_users.insert_one({
                "id": user_id,
                "email": email,
                "username": handle,
                "first_name": given_name,
                "last_name": family_name,
                "display_name": full_name,
                "picture": picture,
                "google_sub": google_sub,
                "auth_provider": "google",
                "created_at": now,
                "last_login_at": now,
            })

        # 4. Mint JWT compatible with existing eon/woodchat JWT auth
        token = _mint_jwt(user_id, email)

        # 5. Redirect back to the right app with token in hash (so URL does
        # not leak into server logs).
        landing = "/eon" if app_tag == "eon" else "/woodchat"
        if entry.get("next"):
            landing = entry["next"]
        return RedirectResponse(
            url=f"{_frontend_url(landing)}#token={token}&email={email}",
            status_code=302,
        )

    return router


def _error_redirect(request: Request, msg: str) -> RedirectResponse:
    try:
        base = _frontend_url()
    except HTTPException:
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
        base = f"{proto}://{host}"
    return RedirectResponse(
        url=f"{base}/eon#auth_error={msg.replace(' ', '+')}",
        status_code=302,
    )
