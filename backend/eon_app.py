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

import asyncio

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
    "You are EON — a personal AI agent system built to help users research, "
    "organize information, automate workflows, and execute tasks faster. "
    "You think in steps and you act. When the user gives you a goal, briefly "
    "acknowledge it, outline the steps you'd take, then deliver the result. "
    "You can delegate to specialist agents: Researcher (gathers facts + sources), "
    "Planner (breaks goals into tasks), Writer (drafts and rewrites), and "
    "Analyst (numbers, comparisons, decisions). When useful, mention which "
    "agent handled the work. Default to clean plain prose. Use lists only "
    "when the answer is genuinely a list. Be sharp, honest, and useful. "
    "Never claim to be human."
)

# Static specialist-agent roster surfaced on the dashboard.
EON_AGENTS = [
    {
        "id": "researcher",
        "name": "Researcher",
        "tagline": "Gathers facts, sources, and context.",
        "icon": "search",
        "color": "#7aa9ff",
        "tools": ["web_search", "summarize", "citations"],
    },
    {
        "id": "planner",
        "name": "Planner",
        "tagline": "Breaks goals into clear, ordered steps.",
        "icon": "list",
        "color": "#a78bfa",
        "tools": ["task_breakdown", "calendar", "priorities"],
    },
    {
        "id": "writer",
        "name": "Writer",
        "tagline": "Drafts, rewrites, and polishes copy.",
        "icon": "pen",
        "color": "#34d399",
        "tools": ["draft", "rewrite", "tone_shift"],
    },
    {
        "id": "analyst",
        "name": "Analyst",
        "tagline": "Compares options and crunches numbers.",
        "icon": "chart",
        "color": "#f59e0b",
        "tools": ["compare", "summarize_data", "decision_matrix"],
    },
]


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


class ResetIn(BaseModel):
    email: EmailStr


class ResetConfirmIn(BaseModel):
    email: EmailStr
    token: str
    new_password: str = Field(min_length=6, max_length=200)


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


class TaskCreateIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    agent_id: Optional[str] = None  # researcher / planner / writer / analyst
    priority: Optional[str] = Field(default="normal")  # low | normal | high


class TaskUpdateIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None  # queued | running | done | failed
    agent_id: Optional[str] = None
    priority: Optional[str] = None
    result: Optional[str] = None


class ContactLeadIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    message: str = Field(min_length=1, max_length=2000)
    phone: Optional[str] = Field(default=None, max_length=40)


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
    tasks_col = db.eon_tasks
    activity_col = db.eon_activity

    # ---- LLM (Emergent universal key, default: Anthropic Claude Sonnet 4.5)
    EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
    LLM_PROVIDER = os.environ.get("EON_LLM_PROVIDER", "anthropic")
    LLM_MODEL = os.environ.get("EON_LLM_MODEL", "claude-sonnet-4-5-20250929")
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://jwoodtechnologies.com").rstrip("/")

    async def _llm_reply(session_id: str, system: str, history: list[dict], user_text: str) -> str:
        """Send a user message through emergentintegrations with multi-turn
        history. `history` is the prior messages list of {role, content}."""
        if not EMERGENT_KEY:
            return (
                "EON's model brain isn't connected yet. Add EMERGENT_LLM_KEY "
                "(or your own provider key) in backend/.env and try again."
            )
        try:
            # Lazy import so the module loads even if the lib is missing locally.
            from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore

            chat = (
                LlmChat(
                    api_key=EMERGENT_KEY,
                    session_id=session_id,
                    system_message=system,
                )
                .with_model(LLM_PROVIDER, LLM_MODEL)
            )
            # Replay history so multi-turn context is preserved.
            for m in history:
                role = m.get("role")
                txt = (m.get("content") or "")[:4000]
                if not txt or role not in ("user", "assistant"):
                    continue
                # send_message handles its own history internally, so we feed
                # the prior turns by sending them one by one is wasteful — we
                # instead rely on the system + the explicit user message for
                # the current turn, prefixed with a compact recap if history
                # exists. Keep it simple and effective.
                pass

            # Build a single combined turn: include a compact recap of the
            # last few turns so the model has context without per-message
            # round-trips.
            if history:
                recap_lines = []
                for m in history[-8:]:
                    tag = "User" if m["role"] == "user" else "EON"
                    recap_lines.append(f"{tag}: {(m['content'] or '')[:600]}")
                recap = "Conversation so far:\n" + "\n".join(recap_lines) + "\n\nUser now says:\n" + user_text
                payload = recap
            else:
                payload = user_text

            resp = await chat.send_message(UserMessage(text=payload))
            return (resp or "").strip() or "(EON had no reply.)"
        except Exception as exc:
            logger.warning("EON LLM call failed: %s", exc, exc_info=True)
            return "EON ran into a model error. Please try again in a moment."

    async def _log_activity(uid: str, kind: str, summary: str, meta: Optional[dict] = None) -> None:
        try:
            await activity_col.insert_one(
                {
                    "id": str(uuid.uuid4()),
                    "user_id": uid,
                    "kind": kind,
                    "summary": summary[:300],
                    "meta": meta or {},
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            )
        except Exception as exc:  # pragma: no cover
            logger.debug("activity log failed: %s", exc)

    async def _web_search(query: str, n: int = 6) -> list[dict]:
        """DuckDuckGo text search (sync lib → run in thread). Returns
        [{title, url, snippet}, ...]."""
        def _q() -> list[dict]:
            try:
                from ddgs import DDGS  # type: ignore
                with DDGS() as d:
                    raw = list(d.text(query, max_results=n))
                # ddgs returns dicts with keys title/href/body. Normalize.
                out = []
                for r in raw:
                    out.append(
                        {
                            "title": (r.get("title") or "")[:200],
                            "url": r.get("href") or r.get("url") or "",
                            "snippet": (r.get("body") or "")[:400],
                        }
                    )
                return out
            except Exception as exc:
                logger.warning("EON web search failed: %s", exc)
                return []
        return await asyncio.to_thread(_q)

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

    @r.post("/auth/reset-password")
    async def reset_password(body: ResetIn):
        """Send password reset email. Always returns success to prevent email enumeration."""
        email = body.email.lower().strip()
        u = await users.find_one({"email": email})
        if u:
            import secrets as _secrets
            token = _secrets.token_urlsafe(32)
            from datetime import timedelta
            await users.update_one(
                {"email": email},
                {"$set": {
                    "reset_token": token,
                    "reset_expires": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                }},
            )
            # Generate reset link — user clicks and sets new password
            reset_link = f"{FRONTEND_URL}/eon#reset={token}&email={email}"
            try:
                import resend as _resend
                if os.environ.get("RESEND_API_KEY"):
                    await asyncio.to_thread(
                        _resend.Emails.send,
                        {
                            "from": os.environ.get("SENDER_EMAIL", "EON <onboarding@resend.dev>"),
                            "to": [email],
                            "subject": "EON — Reset your password",
                            "html": f"<p>Click to reset your EON password:</p><p><a href='{reset_link}'>{reset_link}</a></p><p>Link expires in 1 hour.</p>",
                        },
                    )
            except Exception:
                pass  # Don't leak whether email exists
        return {"ok": True, "message": "If an account exists, a reset link has been sent."}

    @r.post("/auth/reset-password/confirm")
    async def reset_password_confirm(body: ResetConfirmIn):
        """Confirm password reset with token and new password."""
        email = body.email.lower().strip()
        u = await users.find_one({"email": email})
        if not u or u.get("reset_token") != body.token:
            raise HTTPException(400, detail="Invalid or expired token")
        from datetime import timedelta
        expires = u.get("reset_expires", "")
        if expires:
            try:
                if datetime.fromisoformat(expires) < datetime.now(timezone.utc):
                    raise HTTPException(400, detail="Reset link expired")
            except ValueError:
                pass
        await users.update_one(
            {"email": email},
            {"$set": {"password_hash": _hash(body.new_password), "reset_token": "", "reset_expires": ""}},
        )
        return {"ok": True, "message": "Password updated. Please sign in."}

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
            # No OpenAI key — fall back to Emergent universal-key path.
            reply = await _llm_reply(
                session_id=f"{u['id']}:{thread['id']}",
                system=EON_SYSTEM_PROMPT,
                history=[
                    {"role": ("assistant" if m["role"] == "assistant" else "user"), "content": m["text"]}
                    for m in history_docs[:-1]  # exclude the just-inserted user msg
                ],
                user_text=text,
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
                # Fallback to Emergent universal key on OpenAI failure.
                reply = await _llm_reply(
                    session_id=f"{u['id']}:{thread['id']}",
                    system=EON_SYSTEM_PROMPT,
                    history=[
                        {"role": ("assistant" if m["role"] == "assistant" else "user"), "content": m["text"]}
                        for m in history_docs[:-1]
                    ],
                    user_text=text,
                )

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
        await _log_activity(
            u["id"], "chat", f"Sent a message in {thread.get('title') or 'thread'}",
            {"thread_id": thread["id"], "agent_id": "eon"},
        )
        return {
            "reply": reply,
            "thread_id": thread["id"],
            "message_count": new_count,
            "remaining": remaining,
            "is_admin": is_admin,
        }

    # ---- Agents / Tasks / Dashboard / Activity ----------------------------
    @r.get("/agents")
    async def list_agents():
        return {"agents": EON_AGENTS}

    def _task_out(t: dict) -> dict:
        return {
            "id": t["id"],
            "title": t.get("title", ""),
            "description": t.get("description", ""),
            "status": t.get("status", "queued"),
            "agent_id": t.get("agent_id"),
            "priority": t.get("priority", "normal"),
            "result": t.get("result", ""),
            "sources": t.get("sources", []),
            "created_at": t.get("created_at", ""),
            "updated_at": t.get("updated_at", ""),
        }

    @r.get("/tasks")
    async def list_tasks(u=Depends(current_user)):
        rows = (
            await tasks_col.find({"user_id": u["id"]}, {"_id": 0})
            .sort("created_at", -1)
            .to_list(200)
        )
        return {"tasks": [_task_out(t) for t in rows]}

    @r.post("/tasks")
    async def create_task(body: TaskCreateIn, u=Depends(current_user)):
        agent_id = body.agent_id
        if agent_id and not any(a["id"] == agent_id for a in EON_AGENTS):
            raise HTTPException(status_code=400, detail="Unknown agent_id")
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": u["id"],
            "title": body.title.strip()[:200],
            "description": (body.description or "").strip()[:2000],
            "status": "queued",
            "agent_id": agent_id,
            "priority": body.priority or "normal",
            "result": "",
            "created_at": now,
            "updated_at": now,
        }
        await tasks_col.insert_one(doc)
        await _log_activity(
            u["id"], "task_created",
            f"New task: {doc['title']}",
            {"task_id": doc["id"], "agent_id": agent_id},
        )
        return {"task": _task_out(doc)}

    @r.patch("/tasks/{task_id}")
    async def update_task(task_id: str, body: TaskUpdateIn, u=Depends(current_user)):
        t = await tasks_col.find_one({"id": task_id, "user_id": u["id"]}, {"_id": 0})
        if not t:
            raise HTTPException(status_code=404, detail="Task not found")
        update = {}
        if body.title is not None:
            update["title"] = body.title.strip()[:200]
        if body.description is not None:
            update["description"] = body.description.strip()[:2000]
        if body.status is not None:
            if body.status not in ("queued", "running", "done", "failed"):
                raise HTTPException(status_code=400, detail="Invalid status")
            update["status"] = body.status
        if body.agent_id is not None:
            if body.agent_id and not any(a["id"] == body.agent_id for a in EON_AGENTS):
                raise HTTPException(status_code=400, detail="Unknown agent_id")
            update["agent_id"] = body.agent_id
        if body.priority is not None:
            update["priority"] = body.priority
        if body.result is not None:
            update["result"] = body.result[:5000]
        if update:
            update["updated_at"] = datetime.now(timezone.utc).isoformat()
            await tasks_col.update_one({"id": task_id}, {"$set": update})
            await _log_activity(
                u["id"], "task_updated", f"Task '{t['title']}' → {update.get('status', t.get('status'))}",
                {"task_id": task_id},
            )
        merged = {**t, **update}
        return {"task": _task_out(merged)}

    @r.delete("/tasks/{task_id}")
    async def delete_task(task_id: str, u=Depends(current_user)):
        t = await tasks_col.find_one({"id": task_id, "user_id": u["id"]}, {"_id": 0})
        if not t:
            raise HTTPException(status_code=404, detail="Task not found")
        await tasks_col.delete_one({"id": task_id})
        await _log_activity(u["id"], "task_deleted", f"Deleted: {t.get('title','')}", {"task_id": task_id})
        return {"ok": True}

    @r.post("/tasks/{task_id}/run")
    async def run_task(task_id: str, u=Depends(current_user)):
        """Execute a task by delegating to its specialist agent via the LLM."""
        t = await tasks_col.find_one({"id": task_id, "user_id": u["id"]}, {"_id": 0})
        if not t:
            raise HTTPException(status_code=404, detail="Task not found")

        is_admin = bool(u.get("is_admin"))
        count = int(u.get("message_count", 0))
        if not is_admin and count >= FREE_LIMIT:
            raise HTTPException(status_code=402, detail="Free access limit reached.")

        await tasks_col.update_one(
            {"id": task_id},
            {"$set": {"status": "running", "updated_at": datetime.now(timezone.utc).isoformat()}},
        )

        agent = next((a for a in EON_AGENTS if a["id"] == t.get("agent_id")), None)
        agent_name = agent["name"] if agent else "EON"
        agent_brief = agent["tagline"] if agent else "general assistant"

        # For the Researcher agent: fetch live web results first so the reply
        # is grounded with real sources instead of hallucinated.
        sources_block = ""
        sources_meta = []
        if t.get("agent_id") == "researcher":
            search_query = f"{t['title']} {t.get('description') or ''}".strip()[:200]
            results = await _web_search(search_query, n=6)
            sources_meta = results
            if results:
                lines = []
                for i, r in enumerate(results, 1):
                    lines.append(
                        f"[{i}] {r['title']}\n    {r['url']}\n    {r['snippet']}"
                    )
                sources_block = (
                    "\n\nLive web results (use these; cite as [1], [2] inline):\n"
                    + "\n".join(lines)
                )

        system = (
            f"You are the EON {agent_name} sub-agent — {agent_brief} "
            "Execute the user's task end-to-end. Produce the deliverable directly, "
            "not a description of how you'd do it. Keep it tight and useful."
        )
        if t.get("agent_id") == "researcher":
            system += (
                " You have live web results. Synthesize them into a clean answer "
                "with inline [n] citations matching the numbered sources, then list "
                "the sources at the bottom as 'Sources:\\n[1] title — url'."
            )

        prompt = (
            f"Task: {t['title']}\n\nDetails: {t.get('description') or '(none)'}"
            f"{sources_block}\n\nDeliver the result now."
        )

        reply = await _llm_reply(
            session_id=f"{u['id']}:task:{task_id}",
            system=system,
            history=[],
            user_text=prompt,
        )

        now = datetime.now(timezone.utc).isoformat()
        update_doc = {"status": "done", "result": reply, "updated_at": now}
        if sources_meta:
            update_doc["sources"] = sources_meta
        await tasks_col.update_one({"id": task_id}, {"$set": update_doc})
        if not is_admin:
            await users.update_one({"id": u["id"]}, {"$inc": {"message_count": 1}})

        await _log_activity(
            u["id"], "task_done",
            f"{agent_name} finished: {t['title']}",
            {"task_id": task_id, "agent_id": t.get("agent_id")},
        )
        merged = {**t, "status": "done", "result": reply, "updated_at": now}
        if sources_meta:
            merged["sources"] = sources_meta
        return {"task": _task_out(merged)}

    @r.get("/activity")
    async def list_activity(limit: int = 25, u=Depends(current_user)):
        rows = (
            await activity_col.find({"user_id": u["id"]}, {"_id": 0})
            .sort("created_at", -1)
            .to_list(min(max(limit, 1), 100))
        )
        return {"activity": rows}

    @r.get("/dashboard")
    async def dashboard(u=Depends(current_user)):
        uid = u["id"]
        total_msgs = await msgs.count_documents({"user_id": uid, "role": "user"})
        total_threads = await threads.count_documents({"user_id": uid, "archived": {"$ne": True}})
        total_tasks = await tasks_col.count_documents({"user_id": uid})
        done_tasks = await tasks_col.count_documents({"user_id": uid, "status": "done"})
        running_tasks = await tasks_col.count_documents({"user_id": uid, "status": "running"})
        queued_tasks = await tasks_col.count_documents({"user_id": uid, "status": "queued"})
        recent_activity = (
            await activity_col.find({"user_id": uid}, {"_id": 0})
            .sort("created_at", -1)
            .to_list(8)
        )
        # Per-agent task counts
        agent_stats = []
        for a in EON_AGENTS:
            c = await tasks_col.count_documents({"user_id": uid, "agent_id": a["id"]})
            agent_stats.append({**a, "task_count": c})
        return {
            "stats": {
                "messages_sent": total_msgs,
                "active_threads": total_threads,
                "tasks_total": total_tasks,
                "tasks_done": done_tasks,
                "tasks_running": running_tasks,
                "tasks_queued": queued_tasks,
            },
            "agents": agent_stats,
            "recent_activity": recent_activity,
        }

    @r.post("/contact-lead")
    async def create_contact_lead(body: ContactLeadIn):
        """Public endpoint — the homepage orb contact form posts here.
        Stores a lead in `eon_contact_leads` and returns ok."""
        doc = {
            "id": str(uuid.uuid4()),
            "first_name": body.first_name.strip()[:80],
            "last_name": body.last_name.strip()[:80],
            "email": body.email.lower().strip(),
            "phone": (body.phone or "").strip()[:40],
            "message": body.message.strip()[:2000],
            "status": "new",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            await db.eon_contact_leads.insert_one(doc)
        except Exception as exc:  # pragma: no cover
            logger.warning("contact lead store failed: %s", exc)
            raise HTTPException(status_code=500, detail="Could not save your request.")
        return {"ok": True}

    return r
