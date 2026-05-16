"""EON — standalone premium AI assistant.

Own user table (`eon_users`), own conversation log (`eon_messages`).
Free tier: 5 messages. Admin: unlimited.

Admin can be set via either:
  • Signup with email `admin@jwoodtechnologies.com` + password `7607`
  • Signup with optional `access_code = 7607` (any email)
  • Login with email `admin@jwoodtechnologies.com` + password `7607` auto-creates
    the admin account on first sign-in.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger("jwood.eon")

JWT_ALGO = "HS256"
ACCESS_TTL_HOURS = 24 * 30  # 30 days
FREE_LIMIT = 5
ADMIN_EMAIL = "admin@jwoodtechnologies.com"
ADMIN_CODE = "7607"

EON_SYSTEM_PROMPT = (
    "You are EON, a premium AI assistant by Jwood Technologies. You are calm, "
    "sharp, and helpful. Default to plain prose. No markdown headings, no "
    "bullet lists unless the user explicitly asks. Keep replies tight: 1–4 "
    "short sentences for casual prompts, longer only when the question "
    "demands it. Never claim to be human. Powered by Wood AI."
)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class SignupIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)
    access_code: Optional[str] = None  # 7607 → admin


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: EmailStr
    is_admin: bool
    message_count: int
    free_limit: int
    remaining: int  # messages left (or -1 for unlimited)
    created_at: str


class AuthOut(BaseModel):
    token: str
    user: UserOut


class EonChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    thread_id: Optional[str] = None  # if omitted, use/create current thread


class ThreadOut(BaseModel):
    id: str
    title: str
    created_at: str
    last_msg_at: str
    message_count: int
    archived: bool


class ThreadCreateIn(BaseModel):
    title: Optional[str] = None


class ThreadUpdateIn(BaseModel):
    title: Optional[str] = None
    archived: Optional[bool] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _secret() -> str:
    s = os.environ.get("JWT_SECRET")
    if not s:
        raise RuntimeError("JWT_SECRET is not configured")
    return s


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def _verify(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def _create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=ACCESS_TTL_HOURS),
        "type": "access",
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGO)


def _user_out(u: dict) -> dict:
    is_admin = bool(u.get("is_admin"))
    count = int(u.get("message_count", 0))
    remaining = -1 if is_admin else max(0, FREE_LIMIT - count)
    return {
        "id": u["id"],
        "first_name": u.get("first_name", ""),
        "last_name": u.get("last_name", ""),
        "email": u["email"],
        "is_admin": is_admin,
        "message_count": count,
        "free_limit": FREE_LIMIT,
        "remaining": remaining,
        "created_at": u.get("created_at", ""),
    }


# ---------------------------------------------------------------------------
# Router factory
# ---------------------------------------------------------------------------
def build_eon_router(
    db: AsyncIOMotorDatabase,
    *,
    openai_client=None,
    chat_model: str = "gpt-4o-mini",
) -> APIRouter:
    r = APIRouter(prefix="/eon-app", tags=["eon"])

    users = db.eon_users
    msgs = db.eon_messages
    threads = db.eon_threads

    # ---- thread helpers ----------------------------------------------------
    async def _ensure_default_thread(uid: str) -> dict:
        """Return the user's current (newest non-archived) thread, creating
        one if none exist. Also migrates any pre-thread messages into it."""
        cur = await threads.find_one(
            {"user_id": uid, "archived": {"$ne": True}},
            {"_id": 0},
            sort=[("last_msg_at", -1)],
        )
        if cur:
            return cur
        now = datetime.now(timezone.utc).isoformat()
        tid = str(uuid.uuid4())
        thread = {
            "id": tid,
            "user_id": uid,
            "title": "New thread",
            "created_at": now,
            "last_msg_at": now,
            "archived": False,
        }
        await threads.insert_one(thread)
        # Migrate legacy messages (no thread_id) to this thread
        await msgs.update_many(
            {"user_id": uid, "thread_id": {"$exists": False}},
            {"$set": {"thread_id": tid}},
        )
        return thread

    def _thread_out(t: dict, count: int) -> dict:
        return {
            "id": t["id"],
            "title": t.get("title") or "New thread",
            "created_at": t.get("created_at", ""),
            "last_msg_at": t.get("last_msg_at", t.get("created_at", "")),
            "message_count": count,
            "archived": bool(t.get("archived")),
        }

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

    @r.post("/auth/signup", response_model=AuthOut)
    async def signup(body: SignupIn):
        email = body.email.lower().strip()
        if await users.find_one({"email": email}):
            raise HTTPException(
                status_code=409,
                detail="An account with that email already exists.",
            )
        is_admin = (
            (email == ADMIN_EMAIL and body.password == ADMIN_CODE)
            or (body.access_code or "").strip() == ADMIN_CODE
        )
        now = datetime.now(timezone.utc).isoformat()
        uid = str(uuid.uuid4())
        doc = {
            "id": uid,
            "email": email,
            "first_name": body.first_name.strip(),
            "last_name": body.last_name.strip(),
            "password_hash": _hash(body.password),
            "is_admin": is_admin,
            "message_count": 0,
            "created_at": now,
        }
        await users.insert_one(doc)
        return {"token": _create_token(uid, email), "user": _user_out(doc)}

    @r.post("/auth/login", response_model=AuthOut)
    async def login(body: LoginIn):
        email = body.email.lower().strip()
        u = await users.find_one({"email": email})

        # Magic admin: if the canonical admin email + 7607 is used and no
        # account exists, create one on the fly.
        if not u and email == ADMIN_EMAIL and body.password == ADMIN_CODE:
            now = datetime.now(timezone.utc).isoformat()
            uid = str(uuid.uuid4())
            u = {
                "id": uid,
                "email": email,
                "first_name": "Admin",
                "last_name": "",
                "password_hash": _hash(ADMIN_CODE),
                "is_admin": True,
                "message_count": 0,
                "created_at": now,
            }
            await users.insert_one(u)

        if not u or not _verify(body.password, u["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password.")

        # Self-heal: if the admin email logs in successfully but the row is
        # not flagged admin (e.g. created via wrong path), promote it.
        if email == ADMIN_EMAIL and not u.get("is_admin"):
            await users.update_one(
                {"id": u["id"]}, {"$set": {"is_admin": True}}
            )
            u["is_admin"] = True

        return {"token": _create_token(u["id"], email), "user": _user_out(u)}

    @r.get("/me", response_model=UserOut)
    async def me(u=Depends(current_user)):
        return _user_out(u)

    @r.get("/conversation")
    async def conversation(u=Depends(current_user)):
        """Return the messages in the user's CURRENT (newest non-archived) thread."""
        thread = await _ensure_default_thread(u["id"])
        rows = (
            await msgs.find(
                {"user_id": u["id"], "thread_id": thread["id"]},
                {"_id": 0},
            )
            .sort("created_at", 1)
            .to_list(500)
        )
        return {"thread": _thread_out(thread, len(rows)), "messages": rows}

    @r.delete("/conversation")
    async def clear_current_thread(u=Depends(current_user)):
        """Clear messages in the current thread (does NOT delete the thread)."""
        thread = await _ensure_default_thread(u["id"])
        await msgs.delete_many({"user_id": u["id"], "thread_id": thread["id"]})
        await threads.update_one(
            {"id": thread["id"]},
            {"$set": {"last_msg_at": datetime.now(timezone.utc).isoformat()}},
        )
        return {"ok": True}

    # ---- threads -----------------------------------------------------------
    @r.get("/threads")
    async def list_threads(
        archived: bool = False, u=Depends(current_user)
    ):
        rows = (
            await threads.find(
                {"user_id": u["id"], "archived": archived}, {"_id": 0}
            )
            .sort("last_msg_at", -1)
            .to_list(500)
        )
        out = []
        for t in rows:
            count = await msgs.count_documents(
                {"user_id": u["id"], "thread_id": t["id"]}
            )
            out.append(_thread_out(t, count))
        return {"threads": out}

    @r.post("/threads")
    async def create_thread(body: ThreadCreateIn, u=Depends(current_user)):
        now = datetime.now(timezone.utc).isoformat()
        tid = str(uuid.uuid4())
        thread = {
            "id": tid,
            "user_id": u["id"],
            "title": (body.title or "New thread").strip()[:120] or "New thread",
            "created_at": now,
            "last_msg_at": now,
            "archived": False,
        }
        await threads.insert_one(thread)
        return {"thread": _thread_out(thread, 0)}

    @r.get("/threads/{thread_id}")
    async def get_thread(thread_id: str, u=Depends(current_user)):
        t = await threads.find_one(
            {"id": thread_id, "user_id": u["id"]}, {"_id": 0}
        )
        if not t:
            raise HTTPException(status_code=404, detail="Thread not found")
        rows = (
            await msgs.find(
                {"user_id": u["id"], "thread_id": thread_id}, {"_id": 0}
            )
            .sort("created_at", 1)
            .to_list(500)
        )
        return {"thread": _thread_out(t, len(rows)), "messages": rows}

    @r.patch("/threads/{thread_id}")
    async def update_thread(
        thread_id: str,
        body: ThreadUpdateIn,
        u=Depends(current_user),
    ):
        t = await threads.find_one(
            {"id": thread_id, "user_id": u["id"]}, {"_id": 0}
        )
        if not t:
            raise HTTPException(status_code=404, detail="Thread not found")
        update = {}
        if body.title is not None:
            update["title"] = body.title.strip()[:120] or "New thread"
        if body.archived is not None:
            update["archived"] = bool(body.archived)
        if update:
            await threads.update_one({"id": thread_id}, {"$set": update})
        merged = {**t, **update}
        count = await msgs.count_documents(
            {"user_id": u["id"], "thread_id": thread_id}
        )
        return {"thread": _thread_out(merged, count)}

    @r.delete("/threads/{thread_id}")
    async def delete_thread(
        thread_id: str,
        permanent: bool = False,
        u=Depends(current_user),
    ):
        """Default: soft-delete (archive). With ?permanent=true also wipes
        the thread's messages."""
        t = await threads.find_one(
            {"id": thread_id, "user_id": u["id"]}, {"_id": 0}
        )
        if not t:
            raise HTTPException(status_code=404, detail="Thread not found")
        if permanent:
            await msgs.delete_many(
                {"user_id": u["id"], "thread_id": thread_id}
            )
            await threads.delete_one({"id": thread_id})
            return {"ok": True, "permanent": True}
        await threads.update_one(
            {"id": thread_id}, {"$set": {"archived": True}}
        )
        return {"ok": True, "permanent": False}

    @r.post("/chat")
    async def chat(body: EonChatIn, u=Depends(current_user)):
        is_admin = bool(u.get("is_admin"))
        count = int(u.get("message_count", 0))
        if not is_admin and count >= FREE_LIMIT:
            raise HTTPException(
                status_code=402,
                detail="You've reached your free access limit.",
            )

        # Resolve target thread
        if body.thread_id:
            thread = await threads.find_one(
                {"id": body.thread_id, "user_id": u["id"]}, {"_id": 0}
            )
            if not thread:
                raise HTTPException(status_code=404, detail="Thread not found")
            if thread.get("archived"):
                # Auto-unarchive on use
                await threads.update_one(
                    {"id": thread["id"]}, {"$set": {"archived": False}}
                )
        else:
            thread = await _ensure_default_thread(u["id"])

        text = body.message.strip()
        now = datetime.now(timezone.utc).isoformat()

        # Persist the user message
        await msgs.insert_one(
            {
                "id": str(uuid.uuid4()),
                "user_id": u["id"],
                "thread_id": thread["id"],
                "role": "user",
                "text": text,
                "created_at": now,
            }
        )

        # Auto-title: if thread is still "New thread" and this is the first
        # user message, derive a short title from it.
        if (thread.get("title") or "New thread").lower() in (
            "new thread",
            "",
        ):
            existing = await msgs.count_documents(
                {"user_id": u["id"], "thread_id": thread["id"]}
            )
            if existing == 1:  # only the message we just inserted
                snippet = text.strip().split("\n")[0][:48]
                if len(text) > 48:
                    snippet = snippet.rstrip(" ,.;:") + "…"
                await threads.update_one(
                    {"id": thread["id"]},
                    {"$set": {"title": snippet or "New thread"}},
                )

        # Build history (last 20 msgs in this thread)
        history_docs = (
            await msgs.find(
                {"user_id": u["id"], "thread_id": thread["id"]}, {"_id": 0}
            )
            .sort("created_at", -1)
            .to_list(20)
        )
        history_docs.reverse()
        convo = [{"role": "system", "content": EON_SYSTEM_PROMPT}]
        for m in history_docs:
            convo.append(
                {
                    "role": "assistant" if m["role"] == "assistant" else "user",
                    "content": m["text"][:2000],
                }
            )

        if not openai_client:
            reply = (
                "EON is in BETA and isn't connected to a model right now. "
                "Please try again shortly."
            )
        else:
            try:
                resp = await openai_client.chat.completions.create(
                    model=chat_model,
                    messages=convo,
                    temperature=0.5,
                    max_tokens=420,
                )
                reply = (resp.choices[0].message.content or "").strip()
            except Exception as exc:  # pragma: no cover
                logger.warning("EON chat failed: %s", exc)
                reply = "EON is unavailable right now. Please try again in a moment."

        reply_now = datetime.now(timezone.utc).isoformat()
        # Persist assistant reply
        await msgs.insert_one(
            {
                "id": str(uuid.uuid4()),
                "user_id": u["id"],
                "thread_id": thread["id"],
                "role": "assistant",
                "text": reply,
                "created_at": reply_now,
            }
        )
        # Bump thread last_msg_at
        await threads.update_one(
            {"id": thread["id"]}, {"$set": {"last_msg_at": reply_now}}
        )

        # Bump count for non-admins only
        new_count = count
        if not is_admin:
            new_count = count + 1
            await users.update_one(
                {"id": u["id"]}, {"$set": {"message_count": new_count}}
            )

        remaining = -1 if is_admin else max(0, FREE_LIMIT - new_count)
        return {
            "reply": reply,
            "thread_id": thread["id"],
            "message_count": new_count,
            "remaining": remaining,
            "is_admin": is_admin,
        }

    return r
