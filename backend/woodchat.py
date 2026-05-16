"""WoodChat — premium messaging module.

Auth: JWT Bearer (email + password). Storage: MongoDB (collections prefixed
`wc_`). Data model kept intentionally flat so the React client can render
everything from a handful of endpoints.
"""
from __future__ import annotations

import os
import re
import secrets
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, EmailStr, Field, field_validator

logger = logging.getLogger("jwood.woodchat")

JWT_ALGO = "HS256"
ACCESS_TTL_HOURS = 24 * 7  # 1-week token — messaging apps keep users signed in


def _secret() -> str:
    s = os.environ.get("JWT_SECRET")
    if not s:
        raise RuntimeError("JWT_SECRET is not configured")
    return s


USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,24}$")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    username: str = Field(min_length=3, max_length=24)
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)

    @field_validator("username")
    @classmethod
    def _valid_username(cls, v: str) -> str:
        v = v.strip()
        if not USERNAME_RE.match(v):
            raise ValueError(
                "Username must be 3-24 letters, numbers or underscores."
            )
        return v.lower()


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    username: str
    first_name: str
    last_name: str
    email: EmailStr
    avatar_url: Optional[str] = None
    created_at: str


class AuthOut(BaseModel):
    token: str
    user: UserOut


class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=10)
    new_password: str = Field(min_length=6)


class ChatCreate(BaseModel):
    type: Literal["direct", "group", "room"]
    name: Optional[str] = None
    member_usernames: List[str] = []
    avatar_url: Optional[str] = None


class ChatUpdate(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    pinned: Optional[bool] = None
    muted: Optional[bool] = None
    tags: Optional[List[str]] = None
    disappearing_seconds: Optional[int] = None  # 0 = off


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class MemberIn(BaseModel):
    username: str


class AiIn(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Password / JWT helpers
# ---------------------------------------------------------------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=ACCESS_TTL_HOURS),
        "type": "access",
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGO)


def _user_to_out(u: dict) -> dict:
    return {
        "id": u["id"],
        "username": u.get("username", ""),
        "first_name": u.get("first_name", ""),
        "last_name": u.get("last_name", ""),
        "email": u["email"],
        "avatar_url": u.get("avatar_url"),
        "created_at": u.get("created_at", ""),
    }


# ---------------------------------------------------------------------------
# Router factory
# ---------------------------------------------------------------------------
def build_woodchat_router(
    db: AsyncIOMotorDatabase,
    *,
    openai_client=None,
    summary_model: str = "gpt-4o-mini",
) -> APIRouter:
    r = APIRouter(prefix="/woodchat", tags=["woodchat"])

    # Collections
    users = db.wc_users
    chats = db.wc_chats
    messages = db.wc_messages

    # ---- auth dependency ----------------------------------------------------
    async def current_user(request: Request) -> dict:
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Not authenticated")
        token = auth[7:]
        try:
            payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGO])
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Session expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
        u = await users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not u:
            raise HTTPException(status_code=401, detail="User not found")
        return u

    # ---- registration / login ----------------------------------------------
    # CometChat provisioning helper (server-side, uses Auth Key as apikey).
    async def _comet_provision(uid: str, name: str) -> str:
        """Idempotently create the CometChat user. Returns the safe uid."""
        import re
        safe = re.sub(r"[^a-z0-9_-]", "_", uid.lower())[:80]
        app_id = os.environ.get("COMETCHAT_APP_ID", "")
        region = os.environ.get("COMETCHAT_REGION", "us")
        api_key = os.environ.get("COMETCHAT_AUTH_KEY", "")
        if not (app_id and api_key):
            return safe  # nothing to do — caller still gets the uid
        url = f"https://{app_id}.api-{region}.cometchat.io/v3/users"
        try:
            import httpx  # type: ignore
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    url,
                    headers={
                        "Content-Type": "application/json",
                        "apikey": api_key,
                    },
                    json={"uid": safe, "name": name[:100] or safe},
                )
                if resp.status_code not in (200, 201, 409):
                    body = (resp.text or "")[:200]
                    logger.warning(
                        "CometChat provision failed (%s): %s",
                        resp.status_code,
                        body,
                    )
        except Exception as exc:  # pragma: no cover
            logger.warning("CometChat provision exception: %s", exc)
        return safe

    @r.get("/comet/config")
    async def comet_config(u=Depends(current_user)):
        """Provision the CometChat user for the signed-in WoodX user and
        return the public config the frontend needs to log them in."""
        display = " ".join(filter(None, [u.get("first_name"), u.get("last_name")])).strip()
        if not display:
            display = u.get("username") or u.get("email") or "WoodX user"
        uid = await _comet_provision(u["id"], display)
        return {
            "uid": uid,
            "display_name": display,
            "app_id": os.environ.get("COMETCHAT_APP_ID", ""),
            "region": os.environ.get("COMETCHAT_REGION", "us"),
            "auth_key": os.environ.get("COMETCHAT_AUTH_KEY", ""),
        }

    @r.post("/auth/register", response_model=AuthOut)
    async def register(body: RegisterIn):
        email = body.email.lower()
        username = body.username.lower()
        if await users.find_one({"email": email}):
            raise HTTPException(
                status_code=409, detail="An account with that email already exists."
            )
        if await users.find_one({"username": username}):
            raise HTTPException(
                status_code=409, detail="That username is already taken."
            )
        now = datetime.now(timezone.utc).isoformat()
        uid = str(uuid.uuid4())
        doc = {
            "id": uid,
            "email": email,
            "username": username,
            "first_name": body.first_name.strip(),
            "last_name": body.last_name.strip(),
            "password_hash": hash_password(body.password),
            "avatar_url": None,
            "created_at": now,
        }
        await users.insert_one(doc)
        return {"token": create_token(uid, email), "user": _user_to_out(doc)}

    @r.post("/auth/login", response_model=AuthOut)
    async def login(body: LoginIn):
        email = body.email.lower()
        u = await users.find_one({"email": email})
        if not u or not verify_password(body.password, u["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        return {"token": create_token(u["id"], email), "user": _user_to_out(u)}

    @r.post("/auth/forgot")
    async def forgot_password(body: PasswordResetRequest):
        """Generate a reset token. Always returns 200 to prevent enumeration;
        if the email matches an account, a token is written to
        `wc_password_resets` (valid 30 min). This beta does NOT auto-email
        — the token is returned in dev when `DEBUG_RESET_TOKENS=1`, and
        surfaced to the admin otherwise.
        """
        email = body.email.lower()
        u = await users.find_one({"email": email})
        response = {"ok": True}
        if u:
            token = secrets.token_urlsafe(24)
            await db.wc_password_resets.insert_one(
                {
                    "token": token,
                    "user_id": u["id"],
                    "email": email,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "expires_at": (
                        datetime.now(timezone.utc) + timedelta(minutes=30)
                    ).isoformat(),
                    "used": False,
                }
            )
            if os.environ.get("DEBUG_RESET_TOKENS") == "1":
                response["reset_token"] = token
        return response

    @r.post("/auth/reset")
    async def reset_password(body: PasswordResetConfirm):
        now = datetime.now(timezone.utc).isoformat()
        rec = await db.wc_password_resets.find_one(
            {
                "token": body.token,
                "used": False,
                "expires_at": {"$gt": now},
            }
        )
        if not rec:
            raise HTTPException(
                status_code=400, detail="Reset token is invalid or expired."
            )
        await users.update_one(
            {"id": rec["user_id"]},
            {"$set": {"password_hash": hash_password(body.new_password)}},
        )
        await db.wc_password_resets.update_one(
            {"token": body.token}, {"$set": {"used": True, "used_at": now}}
        )
        return {"ok": True}

    @r.get("/me", response_model=UserOut)
    async def me(u=Depends(current_user)):
        return _user_to_out(u)

    @r.patch("/me", response_model=UserOut)
    async def update_me(body: ProfileUpdate, u=Depends(current_user)):
        changes = {k: v for k, v in body.model_dump().items() if v is not None}
        if changes:
            await users.update_one({"id": u["id"]}, {"$set": changes})
        fresh = await users.find_one({"id": u["id"]}, {"_id": 0})
        return _user_to_out(fresh)

    @r.post("/me/password")
    async def change_password(body: PasswordUpdate, u=Depends(current_user)):
        if not verify_password(body.current_password, u["password_hash"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect.")
        await users.update_one(
            {"id": u["id"]},
            {"$set": {"password_hash": hash_password(body.new_password)}},
        )
        return {"ok": True}

    @r.delete("/me")
    async def delete_account(u=Depends(current_user)):
        uid = u["id"]
        await users.delete_one({"id": uid})
        # Strip from chats but preserve history for other members
        await chats.update_many({"members": uid}, {"$pull": {"members": uid}})
        return {"ok": True}

    # ---- chats --------------------------------------------------------------
    async def _chat_summary(chat: dict, uid: str) -> dict:
        # Derive display name for direct chats
        if chat.get("type") == "direct":
            other_id = next(
                (m for m in chat.get("members", []) if m != uid), None
            )
            other = (
                await users.find_one({"id": other_id}, {"_id": 0}) if other_id else None
            )
            display_name = (
                f"{other['first_name']} {other['last_name']}" if other else "Chat"
            )
            display_avatar = other.get("avatar_url") if other else None
        else:
            display_name = chat.get("name") or "Chat"
            display_avatar = chat.get("avatar_url")

        last = await messages.find_one(
            {"chat_id": chat["id"], "deleted": {"$ne": True}},
            {"_id": 0},
            sort=[("created_at", -1)],
        )
        unread_after = chat.get("read_at", {}).get(uid) or chat.get("created_at")
        unread = await messages.count_documents(
            {
                "chat_id": chat["id"],
                "created_at": {"$gt": unread_after},
                "sender_id": {"$ne": uid},
                "deleted": {"$ne": True},
            }
        )
        return {
            "id": chat["id"],
            "type": chat["type"],
            "name": display_name,
            "avatar_url": display_avatar,
            "members": chat.get("members", []),
            "tags": chat.get("tags", []),
            "pinned": uid in chat.get("pinned_by", []),
            "muted": uid in chat.get("muted_by", []),
            "disappearing_seconds": chat.get("disappearing_seconds", 0),
            "last_message_text": last.get("text") if last else "",
            "last_message_at": last.get("created_at") if last else chat.get("created_at"),
            "unread": unread,
            "created_by": chat.get("created_by"),
            "created_at": chat.get("created_at"),
        }

    @r.get("/chats")
    async def list_chats(u=Depends(current_user)):
        out = await chats.find(
            {"members": u["id"]}, {"_id": 0}
        ).sort("last_message_at", -1).to_list(200)
        summaries = [await _chat_summary(c, u["id"]) for c in out]
        # pinned chats float to the top
        summaries.sort(
            key=lambda c: (
                not c["pinned"],
                -(c.get("last_message_at") or "").__hash__(),
            )
        )
        return summaries

    @r.post("/chats")
    async def create_chat(body: ChatCreate, u=Depends(current_user)):
        member_ids = [u["id"]]
        unknown: list[str] = []
        for raw in body.member_usernames:
            uname = (raw or "").strip().lstrip("@").lower()
            if not uname:
                continue
            other = await users.find_one({"username": uname})
            if not other:
                unknown.append(raw)
                continue
            if other["id"] not in member_ids:
                member_ids.append(other["id"])
        if unknown:
            raise HTTPException(
                status_code=404,
                detail=f"No WoodChat user with username: {', '.join(unknown)}",
            )
        if body.type == "direct" and len(member_ids) < 2:
            raise HTTPException(
                status_code=400,
                detail="Direct chats need exactly one other registered user.",
            )
        if body.type == "direct":
            existing = await chats.find_one(
                {
                    "type": "direct",
                    "members": {"$all": member_ids, "$size": len(member_ids)},
                },
                {"_id": 0},
            )
            if existing:
                return await _chat_summary(existing, u["id"])
        now = datetime.now(timezone.utc).isoformat()
        chat_doc = {
            "id": str(uuid.uuid4()),
            "type": body.type,
            "name": (body.name or "").strip() or None,
            "avatar_url": body.avatar_url,
            "members": member_ids,
            "created_by": u["id"],
            "created_at": now,
            "last_message_at": now,
            "pinned_by": [],
            "muted_by": [],
            "tags": [],
            "disappearing_seconds": 0,
            "read_at": {u["id"]: now},
        }
        await chats.insert_one(chat_doc)
        return await _chat_summary(chat_doc, u["id"])

    @r.get("/chats/{chat_id}")
    async def get_chat(chat_id: str, u=Depends(current_user)):
        c = await chats.find_one(
            {"id": chat_id, "members": u["id"]}, {"_id": 0}
        )
        if not c:
            raise HTTPException(status_code=404, detail="Chat not found")
        # expand members
        member_docs = await users.find(
            {"id": {"$in": c.get("members", [])}}, {"_id": 0, "password_hash": 0}
        ).to_list(100)
        summary = await _chat_summary(c, u["id"])
        summary["member_profiles"] = [_user_to_out(m) for m in member_docs]
        return summary

    @r.patch("/chats/{chat_id}")
    async def update_chat(
        chat_id: str, body: ChatUpdate, u=Depends(current_user)
    ):
        c = await chats.find_one({"id": chat_id, "members": u["id"]}, {"_id": 0})
        if not c:
            raise HTTPException(status_code=404, detail="Chat not found")
        sets: dict = {}
        adds: dict = {}
        pulls: dict = {}
        if body.name is not None:
            sets["name"] = body.name.strip() or None
        if body.avatar_url is not None:
            sets["avatar_url"] = body.avatar_url
        if body.tags is not None:
            sets["tags"] = list({t.strip() for t in body.tags if t.strip()})
        if body.disappearing_seconds is not None:
            sets["disappearing_seconds"] = max(0, body.disappearing_seconds)
        if body.pinned is not None:
            if body.pinned:
                adds["pinned_by"] = u["id"]
            else:
                pulls["pinned_by"] = u["id"]
        if body.muted is not None:
            if body.muted:
                adds["muted_by"] = u["id"]
            else:
                pulls["muted_by"] = u["id"]
        update: dict = {}
        if sets:
            update["$set"] = sets
        if adds:
            update["$addToSet"] = adds
        if pulls:
            update["$pull"] = pulls
        if update:
            await chats.update_one({"id": chat_id}, update)
        fresh = await chats.find_one({"id": chat_id}, {"_id": 0})
        return await _chat_summary(fresh, u["id"])

    @r.delete("/chats/{chat_id}")
    async def delete_chat(chat_id: str, u=Depends(current_user)):
        c = await chats.find_one({"id": chat_id, "members": u["id"]}, {"_id": 0})
        if not c:
            raise HTTPException(status_code=404, detail="Chat not found")
        # creator / direct peer → hard delete; otherwise leave chat
        if c.get("type") == "direct" or c.get("created_by") == u["id"]:
            await chats.delete_one({"id": chat_id})
            await messages.delete_many({"chat_id": chat_id})
        else:
            await chats.update_one(
                {"id": chat_id}, {"$pull": {"members": u["id"]}}
            )
        return {"ok": True}

    @r.post("/chats/{chat_id}/members")
    async def add_member(
        chat_id: str, body: MemberIn, u=Depends(current_user)
    ):
        c = await chats.find_one({"id": chat_id, "members": u["id"]}, {"_id": 0})
        if not c:
            raise HTTPException(status_code=404, detail="Chat not found")
        if c["type"] == "direct":
            raise HTTPException(
                status_code=400,
                detail="Direct chats are 1:1. Create a group instead.",
            )
        uname = body.username.strip().lstrip("@").lower()
        other = await users.find_one({"username": uname})
        if not other:
            raise HTTPException(
                status_code=404, detail="No WoodChat user with that username."
            )
        await chats.update_one(
            {"id": chat_id}, {"$addToSet": {"members": other["id"]}}
        )
        return {"ok": True}

    # ---- messages ----------------------------------------------------------
    @r.get("/chats/{chat_id}/messages")
    async def list_messages(chat_id: str, u=Depends(current_user)):
        c = await chats.find_one({"id": chat_id, "members": u["id"]}, {"_id": 0})
        if not c:
            raise HTTPException(status_code=404, detail="Chat not found")
        # Expire disappearing messages lazily.
        now_iso = datetime.now(timezone.utc).isoformat()
        await messages.delete_many(
            {"chat_id": chat_id, "expires_at": {"$lt": now_iso}}
        )
        # Mark read
        await chats.update_one(
            {"id": chat_id}, {"$set": {f"read_at.{u['id']}": now_iso}}
        )
        docs = await messages.find(
            {"chat_id": chat_id, "deleted": {"$ne": True}}, {"_id": 0}
        ).sort("created_at", 1).to_list(500)
        return docs

    @r.post("/chats/{chat_id}/messages")
    async def send_message(
        chat_id: str, body: MessageIn, u=Depends(current_user)
    ):
        c = await chats.find_one({"id": chat_id, "members": u["id"]}, {"_id": 0})
        if not c:
            raise HTTPException(status_code=404, detail="Chat not found")
        now = datetime.now(timezone.utc)
        expires_at = None
        ds = c.get("disappearing_seconds", 0)
        if ds and ds > 0:
            expires_at = (now + timedelta(seconds=ds)).isoformat()
        msg = {
            "id": str(uuid.uuid4()),
            "chat_id": chat_id,
            "sender_id": u["id"],
            "sender_name": f"{u['first_name']} {u['last_name']}",
            "sender_avatar": u.get("avatar_url"),
            "text": body.text,
            "created_at": now.isoformat(),
            "expires_at": expires_at,
            "deleted": False,
        }
        await messages.insert_one(msg)
        await chats.update_one(
            {"id": chat_id}, {"$set": {"last_message_at": now.isoformat()}}
        )
        msg.pop("_id", None)
        return msg

    @r.delete("/messages/{message_id}")
    async def delete_message(message_id: str, u=Depends(current_user)):
        m = await messages.find_one({"id": message_id}, {"_id": 0})
        if not m:
            raise HTTPException(status_code=404, detail="Message not found")
        # Sender can delete; anyone in chat can delete for themselves → we
        # keep it simple: sender or chat creator only.
        c = await chats.find_one({"id": m["chat_id"]}, {"_id": 0})
        if not c:
            await messages.delete_one({"id": message_id})
            return {"ok": True}
        if u["id"] not in (m.get("sender_id"), c.get("created_by")):
            raise HTTPException(
                status_code=403, detail="You can only delete your own messages."
            )
        await messages.update_one(
            {"id": message_id},
            {"$set": {"deleted": True, "text": "", "deleted_at": datetime.now(timezone.utc).isoformat()}},
        )
        return {"ok": True}

    # ---- Wood AI ------------------------------------------------------------
    @r.post("/ai/chat")
    async def wood_ai(body: AiIn, u=Depends(current_user)):
        if not openai_client:
            return {
                "reply": (
                    "Wood AI is in BETA and isn't connected to a model yet. "
                    "Once the admin wires an API key, I'll answer here."
                )
            }
        system = (
            "You are Wood AI, a concise assistant inside the WoodChat messaging "
            "app. Answer in 1-3 short sentences. Plain prose. No markdown "
            "headings. No legal advice."
        )
        try:
            resp = await openai_client.chat.completions.create(
                model=summary_model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": body.message[:2000]},
                ],
                temperature=0.4,
                max_tokens=220,
            )
            reply = resp.choices[0].message.content.strip()
        except Exception as exc:
            reply = f"Wood AI is unavailable right now ({exc.__class__.__name__})."
        return {"reply": reply}

    # ---- Admin (password-gated via /admin/stats, not auth-required) --------
    @r.get("/admin/stats")
    async def admin_stats(password: str):
        if password != os.environ.get("ADMIN_PASSWORD", "7607"):
            raise HTTPException(status_code=401, detail="Invalid password")
        now = datetime.now(timezone.utc)
        day_ago = (now - timedelta(hours=24)).isoformat()
        week_ago = (now - timedelta(days=7)).isoformat()

        total_users = await users.count_documents({})
        users_24h = await users.count_documents({"created_at": {"$gt": day_ago}})
        users_7d = await users.count_documents({"created_at": {"$gt": week_ago}})
        total_chats = await chats.count_documents({})
        direct = await chats.count_documents({"type": "direct"})
        groups = await chats.count_documents({"type": "group"})
        rooms = await chats.count_documents({"type": "room"})
        total_messages = await messages.count_documents({})
        messages_24h = await messages.count_documents({"created_at": {"$gt": day_ago}})
        messages_7d = await messages.count_documents({"created_at": {"$gt": week_ago}})
        active_users_7d = len(
            await messages.distinct("sender_id", {"created_at": {"$gt": week_ago}})
        )

        user_list = await users.find(
            {}, {"_id": 0, "password_hash": 0}
        ).sort("created_at", -1).to_list(200)

        recent_activity = await messages.find(
            {"deleted": {"$ne": True}}, {"_id": 0, "embedding": 0}
        ).sort("created_at", -1).to_list(20)
        # keep recent_activity small — strip the text for privacy
        recent_activity = [
            {
                "id": m["id"],
                "chat_id": m["chat_id"],
                "sender_name": m.get("sender_name"),
                "created_at": m["created_at"],
                "text_preview": (m.get("text") or "")[:60],
            }
            for m in recent_activity
        ]

        return {
            "users": {
                "total": total_users,
                "new_24h": users_24h,
                "new_7d": users_7d,
                "active_7d": active_users_7d,
                "list": user_list,
            },
            "chats": {
                "total": total_chats,
                "direct": direct,
                "groups": groups,
                "rooms": rooms,
            },
            "messages": {
                "total": total_messages,
                "last_24h": messages_24h,
                "last_7d": messages_7d,
            },
            "recent_activity": recent_activity,
            "system": {
                "status": "ok",
                "checked_at": now.isoformat(),
            },
        }

    # ---- Markets (live CoinGecko + cached) ---------------------------------
    @r.get("/markets")
    async def markets():
        """Live crypto top-list from CoinGecko (no API key required).
        We cache for 60s in MongoDB so we never hammer the public endpoint.
        """
        now = datetime.now(timezone.utc)
        cached = await db.wc_markets_cache.find_one({"_id": "top"})
        if cached:
            try:
                ts = datetime.fromisoformat(cached.get("ts"))
            except Exception:
                ts = None
            if ts and (now - ts).total_seconds() < 60:
                return {"items": cached["items"], "cached": True}

        url = (
            "https://api.coingecko.com/api/v3/coins/markets"
            "?vs_currency=usd&order=market_cap_desc&per_page=12&page=1"
            "&sparkline=true&price_change_percentage=24h"
        )
        try:
            async with _httpx.AsyncClient(
                timeout=8.0, headers={"User-Agent": "WoodChat/1.0"}
            ) as http:
                resp = await http.get(url)
                if resp.status_code != 200:
                    raise RuntimeError(f"coingecko {resp.status_code}")
                raw = resp.json()
        except Exception as exc:
            # On failure, return last cache if we have one — otherwise an empty
            # list with an error flag.
            if cached:
                return {"items": cached["items"], "cached": True, "stale": True}
            return {"items": [], "error": str(exc)[:120]}

        items = [
            {
                "id": c.get("id"),
                "symbol": (c.get("symbol") or "").upper(),
                "name": c.get("name"),
                "image": c.get("image"),
                "price": c.get("current_price"),
                "change_24h_pct": c.get("price_change_percentage_24h"),
                "market_cap": c.get("market_cap"),
                "sparkline": (c.get("sparkline_in_7d") or {}).get("price")
                or [],
            }
            for c in raw
        ]
        await db.wc_markets_cache.update_one(
            {"_id": "top"},
            {"$set": {"items": items, "ts": now.isoformat()}},
            upsert=True,
        )
        return {"items": items, "cached": False}

    # ---- News (real RSS feeds aggregated server-side) ----------------------
    import feedparser  # local import keeps startup fast
    import html as _html_lib
    import httpx as _httpx
    from bs4 import BeautifulSoup as _BS

    FEEDS = {
        "fox": [
            ("Fox News", "https://moxie.foxnews.com/google-publisher/latest.xml"),
        ],
        "msnbc": [
            ("MSNBC", "https://www.msnbc.com/feeds/latest"),
            ("NBC News", "https://feeds.nbcnews.com/nbcnews/public/news"),
        ],
        "nyt": [
            ("New York Times", "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"),
        ],
        "general": [
            ("Reuters", "https://feeds.reuters.com/reuters/topNews"),
            ("AP", "https://feeds.apnews.com/rss/apf-topnews"),
            ("BBC", "https://feeds.bbci.co.uk/news/world/rss.xml"),
        ],
        "tech": [
            ("The Verge", "https://www.theverge.com/rss/index.xml"),
            ("TechCrunch", "https://techcrunch.com/feed/"),
        ],
    }

    def _first_image_from_entry(entry) -> Optional[str]:
        media = entry.get("media_content") or []
        if media and isinstance(media, list):
            u = media[0].get("url")
            if u:
                return u
        thumb = entry.get("media_thumbnail") or []
        if thumb and isinstance(thumb, list):
            u = thumb[0].get("url")
            if u:
                return u
        # sniff <img> in summary HTML
        html = entry.get("summary") or entry.get("description") or ""
        if html:
            try:
                img = _BS(html, "lxml").find("img")
                if img and img.get("src"):
                    return img["src"]
            except Exception:
                pass
        # enclosures
        for enc in entry.get("links", []):
            if enc.get("type", "").startswith("image/") and enc.get("href"):
                return enc["href"]
        return None

    def _clean_excerpt(entry) -> str:
        html = entry.get("summary") or entry.get("description") or ""
        if not html:
            return ""
        try:
            text = _BS(html, "lxml").get_text(" ", strip=True)
        except Exception:
            text = _html_lib.unescape(html)
        return text[:240].rstrip() + ("…" if len(text) > 240 else "")

    async def _fetch_feed(url: str) -> list[dict]:
        async with _httpx.AsyncClient(
            timeout=8.0, follow_redirects=True, headers={"User-Agent": "WoodChat/1.0"}
        ) as http:
            try:
                resp = await http.get(url)
                if resp.status_code >= 400:
                    return []
                parsed = feedparser.parse(resp.content)
            except Exception:
                return []
        return parsed.entries[:10]

    @r.get("/news")
    async def news(category: str = "general", u=Depends(current_user)):
        cat = (category or "general").lower()
        key = {
            "fox": "fox",
            "fox news": "fox",
            "msnbc": "msnbc",
            "nytimes": "nyt",
            "new york times": "nyt",
            "nyt": "nyt",
            "tech": "tech",
            "mainstream": "general",
            "general": "general",
        }.get(cat, "general")

        feeds = FEEDS.get(key, FEEDS["general"])
        items: list[dict] = []
        import asyncio as _aio

        results = await _aio.gather(
            *[_fetch_feed(url) for _, url in feeds], return_exceptions=True
        )

        for (source_label, _), entries in zip(feeds, results):
            if isinstance(entries, Exception):
                continue
            for e in entries:
                link = e.get("link")
                title = e.get("title")
                if not link or not title:
                    continue
                published = (
                    e.get("published") or e.get("updated") or ""
                )
                items.append(
                    {
                        "id": str(uuid.uuid5(uuid.NAMESPACE_URL, link)),
                        "title": _html_lib.unescape(title),
                        "source": source_label,
                        "category": key,
                        "url": link,
                        "excerpt": _clean_excerpt(e),
                        "image": _first_image_from_entry(e),
                        "published_at": published,
                    }
                )

        # Sort newest first when possible; fall back to source order
        def _ts(s: str) -> float:
            try:
                from email.utils import parsedate_to_datetime
                return parsedate_to_datetime(s).timestamp()
            except Exception:
                return 0.0

        items.sort(key=lambda x: _ts(x.get("published_at", "")), reverse=True)
        return {"category": key, "items": items[:30]}

    return r
