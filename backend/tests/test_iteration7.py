"""Iteration 7 — Admin dashboard backend tests."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://jwood-premium.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Admin auth ---
class TestAdminAuth:
    def test_admin_auth_correct(self, session):
        r = session.post(f"{API}/admin/auth", json={"password": "7607"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert "token" in data

    def test_admin_auth_wrong(self, session):
        r = session.post(f"{API}/admin/auth", json={"password": "wrong"})
        assert r.status_code == 401

    def test_vineyard_auth_still_works(self, session):
        r = session.post(f"{API}/vineyard/auth", json={"password": "777"})
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_vineyard_auth_wrong(self, session):
        r = session.post(f"{API}/vineyard/auth", json={"password": "bad"})
        assert r.status_code == 401


# --- Admin health shape ---
class TestAdminHealth:
    def test_health_shape(self, session):
        r = session.get(f"{API}/admin/health")
        assert r.status_code == 200
        d = r.json()
        # Top-level keys
        for k in [
            "system_status", "uptime_started_at", "indexed_documents",
            "sources_count", "sources_detail", "crawl_status",
            "last_crawl_at", "next_scheduled_crawl", "metrics",
        ]:
            assert k in d, f"missing {k}"
        assert d["system_status"] == "online"
        assert d["indexed_documents"] > 0, "expected indexed_documents > 0"
        assert d["sources_count"] >= 5
        assert d["crawl_status"] in {"ok", "in_progress", "partial", "error"}
        assert isinstance(d["sources_detail"], list) and len(d["sources_detail"]) >= 5
        for s in d["sources_detail"]:
            assert "status" in s
            assert "last_crawled_at" in s
        m = d["metrics"]
        for k in [
            "openai_embed_calls", "openai_embed_tokens",
            "openai_chat_calls", "openai_chat_tokens",
            "vineyard_search_count", "web_search_count",
            "chatbot_submissions", "contact_submissions",
        ]:
            assert k in m, f"metric missing: {k}"
            assert isinstance(m[k], int)


def _metrics(session):
    r = session.get(f"{API}/admin/health")
    return r.json()["metrics"]


# --- Metric increments ---
class TestMetricIncrements:
    def test_chatbot_submission_increments(self, session):
        before = _metrics(session)
        r = session.post(f"{API}/chatbot", json={
            "first_name": "TEST", "last_name": "Iter7",
            "email": "test_iter7@example.com",
            "phone": "", "question": "iteration7 metric ping",
        })
        assert r.status_code == 200
        time.sleep(1)
        after = _metrics(session)
        assert after["chatbot_submissions"] >= before["chatbot_submissions"] + 1

    def test_contact_submission_increments(self, session):
        before = _metrics(session)
        r = session.post(f"{API}/contact", json={
            "name": "TEST Iter7",
            "email": "test_iter7_contact@example.com",
            "phone": "",
            "project_type": "Web App",
            "description": "metric test",
            "budget": "$5k",
            "timeline": "1 month",
        })
        assert r.status_code == 200
        time.sleep(1)
        after = _metrics(session)
        assert after["contact_submissions"] >= before["contact_submissions"] + 1

    def test_vineyard_search_increments_embed_and_chat(self, session):
        # search counter is not incremented in server code separately — check embed/chat
        before = _metrics(session)
        r = session.post(f"{API}/vineyard/search", json={"query": "zoning ordinance vineyard"})
        assert r.status_code == 200
        time.sleep(1)
        after = _metrics(session)
        # Query embedding call should have happened
        assert after["openai_embed_calls"] >= before["openai_embed_calls"] + 1
        # chat call only if has_results
        data = r.json()
        if data.get("has_results"):
            assert after["openai_chat_calls"] >= before["openai_chat_calls"] + 1

    def test_web_search_increments(self, session):
        before = _metrics(session)
        r = session.post(f"{API}/vineyard/web-search", json={"query": "vineyard utah city council"})
        assert r.status_code == 200
        time.sleep(1)
        after = _metrics(session)
        assert after["web_search_count"] >= before["web_search_count"] + 1


# --- Regression ---
class TestRegression:
    def test_list_sources(self, session):
        r = session.get(f"{API}/vineyard/sources")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_add_source_invalid(self, session):
        r = session.post(f"{API}/vineyard/sources", json={"url": "not-a-url", "label": ""})
        assert r.status_code == 400

    def test_add_source_duplicate(self, session):
        r = session.post(f"{API}/vineyard/sources", json={
            "url": "https://www.vineyardutah.gov/", "label": ""
        })
        assert r.status_code == 409
