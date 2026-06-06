"""Vineyard search/auth router — importable by both server.py and api/index.py.

Exposes:  build_vineyard_router(db) -> APIRouter
All read-heavy operations (auth, search, sources, admin health) live here.
Crawling still runs only on server.py (requires Playwright/PyMuPDF).
"""
from __future__ import annotations

import logging
import math
import os
import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, BackgroundTasks, HTTPException
from openai import AsyncOpenAI
from pydantic import BaseModel, ConfigDict, Field
from rank_bm25 import BM25Okapi

logger = logging.getLogger("jwood.vineyard")

EMBED_MODEL = "text-embedding-3-small"
SUMMARY_MODEL = "gpt-4o-mini"
REFUSAL = "No clear source was found in the indexed documents."

HIDDEN_SOURCE_LABELS: set[str] = {"RDA Past Meetings Index"}

DOC_TYPE_BOOST = {
    "resolution": 1.30,
    "ordinance": 1.25,
    "minutes": 1.20,
    "agenda": 1.18,
    "attachment": 1.10,
    "transparency": 1.10,
    "rda": 1.10,
    "pdf": 1.05,
    "xlsx": 1.05,
    "page": 1.00,
}

WORD_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9\-]+")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class AuthRequest(BaseModel):
    password: str


class SourceRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    url: str
    label: str = ""
    status: str = "idle"
    pages_indexed: int = 0
    last_error: str = ""
    last_crawled_at: Optional[str] = None
    discovered: int = 0
    indexed: int = 0
    sections_indexed: int = 0
    pdfs_indexed: int = 0
    failed: int = 0
    max_depth_reached: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SearchRequest(BaseModel):
    query: str
    site: Optional[str] = None
    source_id: Optional[str] = None
    doc_type: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None


class Citation(BaseModel):
    title: str
    source_label: str
    source_site: str = "other"
    doc_type: str = "page"
    meeting_date: Optional[str] = None
    url: str
    pdf_url: Optional[str] = None
    section_ref: Optional[str] = None
    excerpt: str
    score: float


class SearchResponse(BaseModel):
    answer: str
    citations: List[Citation]
    has_results: bool
    query: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def tokenize(text: str) -> list[str]:
    return [w.lower() for w in WORD_RE.findall(text)]


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = na = nb = 0.0
    for x, y in zip(a, b):
        dot += x * y; na += x * x; nb += y * y
    denom = math.sqrt(na) * math.sqrt(nb)
    return dot / denom if denom > 0 else 0.0


def _clean_source_name(label: str, url: str) -> str:
    label = (label or "").strip()
    low = label.lower()
    if "civicclerk" in low or "meetings" in low:
        return "CivicClerk Meetings"
    if "municipal code" in low or "municode" in low:
        return "Municipal Code"
    if "transparent" in low:
        return "Utah Transparency"
    if "utah.gov" in low or low.startswith("utah ") or "state" in low:
        return "Utah.gov"
    if "vineyard utah" in low or "vineyardutah" in low or "official" in low:
        return "Vineyard Official Site"
    if label:
        if "(" in label:
            label = label.split("(")[0].strip(" ·-")
        return label or "Source"
    try:
        return urlparse(url).netloc.replace("www.", "") or "Source"
    except Exception:
        return "Source"


def _build_filter(req: SearchRequest) -> dict:
    f: dict = {}
    if req.source_id:
        f["source_id"] = req.source_id
    elif req.site:
        f["source_site"] = req.site
    if req.doc_type:
        f["doc_type"] = req.doc_type
    if req.date_from or req.date_to:
        rng: dict = {}
        if req.date_from:
            rng["$gte"] = req.date_from
        if req.date_to:
            rng["$lte"] = req.date_to
        f["meeting_date"] = rng
    return f


def _highlight_snippet(content: str, query: str, span: int = 280) -> str:
    text = re.sub(r"\s+", " ", content or "").strip()
    if not text:
        return ""
    tokens = [t for t in re.findall(r"[\w]+", query.lower()) if len(t) > 1]
    lower = text.lower()
    pos = -1
    for tok in tokens:
        i = lower.find(tok)
        if i != -1 and (pos == -1 or i < pos):
            pos = i
    if pos == -1:
        snippet = text[:span]
    else:
        start = max(0, pos - span // 3)
        snippet = text[start: start + span]
        if start > 0:
            snippet = "…" + snippet
        if start + span < len(text):
            snippet = snippet + "…"
    if tokens:
        pat = re.compile("(" + "|".join(re.escape(t) for t in tokens) + ")", re.IGNORECASE)
        snippet = pat.sub(r"<mark>\1</mark>", snippet)
    return snippet


# ---------------------------------------------------------------------------
# Router factory
# ---------------------------------------------------------------------------

def build_vineyard_router(db):  # noqa: ANN001
    """Return a configured APIRouter.  `db` is a Motor AsyncIOMotorDatabase."""

    VINEYARD_PASSWORD = os.environ.get("VINEYARD_PASSWORD", "555")
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "7607")
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
    openai_client: Optional[AsyncOpenAI] = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

    router = APIRouter()

    # ------------------------------------------------------------------
    # Internal helpers that close over db / openai_client
    # ------------------------------------------------------------------

    async def _metric_inc(key: str, n: int = 1) -> None:
        try:
            await db.metrics.update_one({"_id": "global"}, {"$inc": {key: int(n)}}, upsert=True)
        except Exception:
            pass

    async def _get_active_index() -> dict:
        meta = await db.index_meta.find_one({"kind": "active"}, {"_id": 0})
        if meta:
            return meta
        existing = await db.documents.count_documents({})
        if existing > 0:
            await db.documents.update_many(
                {"index_version": {"$exists": False}},
                {"$set": {"index_version": "v1"}},
            )
            meta = {
                "kind": "active",
                "version": "v1",
                "doc_count": existing,
                "locked_at": datetime.now(timezone.utc).isoformat(),
                "locked_by": "bootstrap",
            }
            await db.index_meta.update_one({"kind": "active"}, {"$set": meta}, upsert=True)
            return meta
        return {"kind": "active", "version": None, "doc_count": 0}

    async def _get_active_filter() -> dict:
        meta = await _get_active_index()
        v = meta.get("version")
        return {"index_version": v} if v else {"index_version": "__none__"}

    async def _hidden_source_ids() -> list[str]:
        rows = await db.sources.find(
            {"label": {"$in": list(HIDDEN_SOURCE_LABELS)}}, {"_id": 0, "id": 1}
        ).to_list(50)
        return [r["id"] for r in rows if r.get("id")]

    async def _embed_texts(texts: list[str]) -> list[list[float]]:
        if not openai_client or not texts:
            return [[] for _ in texts]
        out: list[list[float]] = []
        try:
            for i in range(0, len(texts), 96):
                batch = texts[i: i + 96]
                resp = await openai_client.embeddings.create(model=EMBED_MODEL, input=batch)
                out.extend([d.embedding for d in resp.data])
                await _metric_inc("openai_embed_calls", 1)
                await _metric_inc("openai_embed_tokens", resp.usage.total_tokens)
            return out
        except Exception as exc:
            logger.warning("embedding failed: %s", exc)
            return [[] for _ in texts]

    async def _short_summary(query: str, top_docs: list[dict]) -> str:
        if not openai_client or not top_docs:
            return ""
        ctx_blocks = []
        for i, d in enumerate(top_docs[:5], start=1):
            ctx_blocks.append(
                f"[S{i}] {d.get('title', '')}\n"
                f"Source: {d.get('source_label') or d.get('url')}\n"
                f"Type: {d.get('doc_type') or 'page'}\n"
                f"{d['content'][:1100]}"
            )
        ctx = "\n\n".join(ctx_blocks)
        system = (
            "You summarise municipal document search results. "
            "Use ONLY the supplied sources. Do not invent section numbers, "
            "ordinance numbers, dates, or facts not present in the text. "
            "Stay neutral — no editorialising, no legal advice, no speculation. "
            "If a document explicitly states it was adopted/approved/passed/denied, "
            "you may report that. Otherwise do not speculate on approval status. "
            "Write 2–4 plain sentences. No headings, no lists, no filler."
        )
        user = (
            f"Question: {query}\n\n"
            f"Top sources from the Vineyard archive:\n{ctx}\n\n"
            "Plain summary of what these sources actually say:"
        )
        try:
            resp = await openai_client.chat.completions.create(
                model=SUMMARY_MODEL,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                temperature=0.1,
                max_tokens=220,
            )
            await _metric_inc("openai_chat_calls", 1)
            if resp.usage:
                await _metric_inc("openai_chat_tokens", resp.usage.total_tokens)
            return (resp.choices[0].message.content or "").strip()
        except Exception as exc:
            logger.warning("summary failed: %s", exc)
            return ""

    async def _search_impl(req: SearchRequest, query: str) -> SearchResponse:
        active_filter = await _get_active_filter()
        user_filter = _build_filter(req)
        mongo_filter = {**active_filter, **user_filter}
        if not req.source_id:
            hidden = await _hidden_source_ids()
            if hidden:
                mongo_filter["source_id"] = {"$nin": hidden}

        docs: list[dict] = []
        text_q = " ".join(t for t in tokenize(query) if len(t) >= 2)[:500]
        if text_q:
            try:
                docs = (
                    await db.documents.find(
                        {**mongo_filter, "$text": {"$search": text_q}},
                        {"_id": 0, "embedding": 0, "score": {"$meta": "textScore"}},
                    )
                    .sort([("score", {"$meta": "textScore"})])
                    .limit(500)
                    .to_list(500)
                )
            except Exception as exc:
                logger.warning("text-search prefilter failed: %s", exc)
        if not docs:
            docs = await db.documents.find(mongo_filter, {"_id": 0, "embedding": 0}).to_list(5000)
        if not docs:
            return SearchResponse(answer=REFUSAL, citations=[], has_results=False, query=query)

        corpus_tokens = [tokenize(d["content"]) for d in docs]
        bm25 = BM25Okapi(corpus_tokens)
        q_tokens = tokenize(query)
        if not q_tokens:
            raise HTTPException(status_code=400, detail="Query too short")

        bm_scores = bm25.get_scores(q_tokens)
        idx_scored = sorted(enumerate(bm_scores), key=lambda x: x[1], reverse=True)[:30]
        if not idx_scored or idx_scored[0][1] <= 0.0:
            return SearchResponse(answer=REFUSAL, citations=[], has_results=False, query=query)

        candidate_docs = [docs[i] for i, _ in idx_scored]
        candidate_ids = [d["id"] for d in candidate_docs]
        emb_rows = await db.documents.find(
            {**mongo_filter, "id": {"$in": candidate_ids}}, {"_id": 0, "id": 1, "embedding": 1}
        ).to_list(len(candidate_ids))
        emb_by_id = {r["id"]: r.get("embedding") or [] for r in emb_rows}

        q_emb: list[float] = []
        try:
            q_emb_list = await _embed_texts([query])
            q_emb = q_emb_list[0] if q_emb_list else []
        except Exception as exc:
            logger.warning("query embed failed: %s", exc)

        max_bm = max(s for _, s in idx_scored) or 1.0
        scored: list[tuple[float, dict]] = []
        for (i, bm), d in zip(idx_scored, candidate_docs):
            emb = emb_by_id.get(d["id"]) or []
            cos = cosine(q_emb, emb) if emb else 0.0
            combined = (0.45 * (bm / max_bm)) + (0.55 * max(cos, 0.0))
            combined *= DOC_TYPE_BOOST.get(d.get("doc_type") or "page", 1.0)
            scored.append((combined, d))
        scored.sort(key=lambda x: x[0], reverse=True)

        top: list[tuple[float, dict]] = []
        seen_urls: set[str] = set()
        for combined, d in scored:
            if d["url"] in seen_urls:
                continue
            seen_urls.add(d["url"])
            top.append((combined, d))
            if len(top) >= 5:
                break

        citations: list[Citation] = []
        for combined, d in top:
            excerpt = _highlight_snippet(d["content"], query)
            citations.append(Citation(
                title=d.get("title") or d["url"],
                source_label=d.get("source_label") or urlparse(d["url"]).netloc,
                source_site=d.get("source_site", "other"),
                doc_type=d.get("doc_type", "page"),
                meeting_date=d.get("meeting_date"),
                url=d["url"],
                pdf_url=d.get("pdf_url"),
                section_ref=d.get("section_ref"),
                excerpt=excerpt,
                score=float(combined),
            ))

        answer = await _short_summary(query, [d for _, d in top])
        if not answer or REFUSAL.lower() in answer.lower():
            top_d = top[0][1]
            dtype_label = (top_d.get("doc_type") or "page").replace("_", " ").title()
            title = top_d.get("title") or top_d.get("url")
            src = top_d.get("source_label") or "the Vineyard archive"
            answer = f"Top match: {dtype_label} — \"{title}\" from {src}. See the cited sources below for the full text."

        return SearchResponse(answer=answer, citations=citations, has_results=True, query=query)

    # ------------------------------------------------------------------
    # Routes
    # ------------------------------------------------------------------

    @router.post("/vineyard/auth")
    async def vineyard_auth(req: AuthRequest):
        if req.password.strip() != VINEYARD_PASSWORD:
            raise HTTPException(status_code=401, detail="Invalid password")
        return {"ok": True, "token": "vineyard-session"}

    @router.post("/admin/auth")
    async def admin_auth(req: AuthRequest):
        if req.password.strip() != ADMIN_PASSWORD:
            raise HTTPException(status_code=401, detail="Invalid password")
        return {"ok": True}

    @router.get("/vineyard/sources", response_model=List[SourceRecord])
    async def list_sources():
        docs = await db.sources.find({}, {"_id": 0}).sort("created_at", 1).to_list(200)
        return docs

    @router.get("/vineyard/sources/status")
    async def sources_status():
        meta = await _get_active_index()
        active_v = meta.get("version") or "v1"
        pipeline = [
            {"$match": {"index_version": active_v}},
            {"$group": {"_id": "$source_id", "n": {"$sum": 1}}},
        ]
        counts: dict[str, int] = {}
        async for r in db.documents.aggregate(pipeline):
            if r["_id"]:
                counts[r["_id"]] = r["n"]

        raw = await db.sources.find({}, {"_id": 0}).sort("created_at", 1).to_list(200)
        out = []
        for s in raw:
            label = (s.get("label") or "").strip()
            if label in HIDDEN_SOURCE_LABELS:
                continue
            n = int(counts.get(s.get("id"), 0))
            if n == 0 and s.get("status") != "crawling":
                continue
            out.append({
                "id": s.get("id"),
                "url": s.get("url"),
                "label": label,
                "display_name": _clean_source_name(label, s.get("url") or ""),
                "status": s.get("status") or "idle",
                "indexed_count": n,
                "created_at": s.get("created_at"),
            })
        return {
            "active_version": active_v,
            "total_indexed": int(meta.get("doc_count") or 0),
            "sources": out,
        }

    @router.get("/vineyard/search-ready")
    async def search_ready():
        meta = await _get_active_index()
        v = meta.get("version")
        count = int(meta.get("doc_count") or 0)
        if not v:
            count = await db.documents.count_documents({})
        return {
            "ready": bool(v or count),
            "doc_count": count,
            "version": v,
            "locked_at": meta.get("locked_at"),
        }

    @router.post("/vineyard/search", response_model=SearchResponse)
    async def vineyard_search(req: SearchRequest):
        query = req.query.strip()
        if not query:
            raise HTTPException(status_code=400, detail="Query is required")
        await _metric_inc("vineyard_search_count", 1)
        try:
            return await _search_impl(req, query)
        except Exception as exc:
            logger.exception("vineyard_search failed: %s", exc)
            return SearchResponse(
                answer="Search hit an internal error. Please try a slightly different query.",
                citations=[], has_results=False, query=query,
            )

    @router.post("/vineyard/search-all")
    async def vineyard_search_all(req: SearchRequest, page: int = 1, limit: int = 20):
        query = req.query.strip()
        active_filter = await _get_active_filter()
        user_filter = _build_filter(req)
        mongo_filter = {**active_filter, **user_filter}
        if not req.source_id:
            hidden = await _hidden_source_ids()
            if hidden:
                mongo_filter["source_id"] = {"$nin": hidden}

        total = await db.documents.count_documents(mongo_filter)
        skip = (max(page, 1) - 1) * limit
        rows = (
            await db.documents.find(mongo_filter, {"_id": 0, "embedding": 0, "content": 0})
            .skip(skip)
            .limit(limit)
            .to_list(limit)
        )
        pages_total = max(1, math.ceil(total / limit))
        results = []
        for d in rows:
            results.append({
                "id": d.get("id"),
                "title": d.get("title") or d.get("url"),
                "url": d.get("url"),
                "pdf_url": d.get("pdf_url"),
                "source_label": d.get("source_label"),
                "source_site": d.get("source_site", "other"),
                "doc_type": d.get("doc_type", "page"),
                "meeting_date": d.get("meeting_date"),
                "section_ref": d.get("section_ref"),
                "excerpt": _highlight_snippet(d.get("excerpt") or "", query, 200),
                "is_pdf": d.get("is_pdf", False),
                "depth": d.get("depth", 0),
            })
        return {"results": results, "total": total, "page": page, "pages": pages_total}

    @router.get("/vineyard/stats")
    async def vineyard_stats():
        meta = await _get_active_index()
        active_v = meta.get("version") or "v1"
        pipeline = [
            {"$match": {"index_version": active_v}},
            {"$group": {"_id": "$doc_type", "n": {"$sum": 1}}},
        ]
        by_type: dict = {}
        async for r in db.documents.aggregate(pipeline):
            if r["_id"]:
                by_type[r["_id"]] = r["n"]
        return {"version": active_v, "total": int(meta.get("doc_count") or 0), "by_type": by_type}

    @router.get("/admin/health")
    async def admin_health():
        meta = await _get_active_index()
        sources = await db.sources.find({}, {"_id": 0}).to_list(50)
        metrics = await db.metrics.find_one({"_id": "global"}) or {}
        metrics.pop("_id", None)
        return {
            "ok": True,
            "index": meta,
            "source_count": len(sources),
            "sources": sources,
            "metrics": metrics,
        }

    @router.post("/admin/sources/{source_id}/reset")
    async def admin_reset_source(source_id: str, password: str):
        if password != ADMIN_PASSWORD:
            raise HTTPException(status_code=401, detail="Invalid password")
        await db.sources.update_one(
            {"id": source_id},
            {"$set": {"status": "idle", "last_error": "manually reset"}, "$unset": {"current_run_id": "", "current_run_started_at": ""}},
        )
        return {"ok": True}

    @router.get("/vineyard/admin/index-versions")
    async def admin_index_versions(password: str):
        if password != ADMIN_PASSWORD:
            raise HTTPException(status_code=401, detail="Invalid password")
        versions = await db.index_meta.find({}, {"_id": 0}).to_list(20)
        return {"versions": versions}

    @router.post("/vineyard/admin/lock-index")
    async def admin_lock_index(password: str, version: str):
        if password != ADMIN_PASSWORD:
            raise HTTPException(status_code=401, detail="Invalid password")
        count = await db.documents.count_documents({"index_version": version})
        await db.index_meta.update_one(
            {"kind": "active"},
            {"$set": {"version": version, "doc_count": count, "locked_at": datetime.now(timezone.utc).isoformat(), "locked_by": "admin"}},
            upsert=True,
        )
        return {"ok": True, "version": version, "doc_count": count}

    @router.post("/vineyard/admin/rollback-index")
    async def admin_rollback_index(password: str):
        if password != ADMIN_PASSWORD:
            raise HTTPException(status_code=401, detail="Invalid password")
        prev = await db.index_meta.find_one({"kind": "previous"}, {"_id": 0})
        if not prev:
            raise HTTPException(status_code=404, detail="No previous version to roll back to")
        await db.index_meta.update_one(
            {"kind": "active"},
            {"$set": {"version": prev["version"], "doc_count": prev.get("doc_count", 0), "locked_at": datetime.now(timezone.utc).isoformat(), "locked_by": "rollback"}},
            upsert=True,
        )
        return {"ok": True, "rolled_back_to": prev["version"]}

    @router.post("/vineyard/admin/rebuild-index")
    async def admin_rebuild_index(password: str, background: BackgroundTasks):
        if password != ADMIN_PASSWORD:
            raise HTTPException(status_code=401, detail="Invalid password")
        raise HTTPException(
            status_code=501,
            detail="Crawling is only available on the full Render backend. Use the Render admin panel to trigger a rebuild.",
        )

    @router.post("/vineyard/sources/{source_id}/crawl")
    async def trigger_source_crawl(source_id: str):
        raise HTTPException(
            status_code=501,
            detail="Crawling is only available on the full Render backend.",
        )

    return router
