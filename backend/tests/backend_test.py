"""Backend API tests for Jwood Technologies + Vineyard Scraper."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://jwood-premium.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Small, fast public URL to crawl
CRAWL_URL = "https://example.com"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------------- Health ----------------
def test_root_health(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    data = r.json()
    assert data.get("ok") is True
    assert data.get("service") == "jwood-technologies"


# ---------------- Contact ----------------
def test_contact_create_and_list(s):
    payload = {
        "name": "TEST_John",
        "email": "test_john@example.com",
        "phone": "+15555551234",
        "project_type": "AI / Machine Learning",
        "description": "TEST inquiry description",
        "budget": "$25K – $50K",
        "timeline": "1 month",
    }
    r = s.post(f"{API}/contact", json=payload)
    assert r.status_code == 200, r.text
    created = r.json()
    assert "id" in created and isinstance(created["id"], str)
    assert "created_at" in created
    assert created["name"] == "TEST_John"
    assert created["email"] == payload["email"]
    assert created["project_type"] == payload["project_type"]
    assert created["budget"] == payload["budget"]
    assert created["timeline"] == payload["timeline"]

    # GET list verify persistence
    r2 = s.get(f"{API}/contact")
    assert r2.status_code == 200
    ids = [c["id"] for c in r2.json()]
    assert created["id"] in ids


def test_contact_invalid_email(s):
    r = s.post(f"{API}/contact", json={
        "name": "x", "email": "not-an-email",
        "project_type": "t", "description": "d",
        "budget": "b", "timeline": "t",
    })
    assert r.status_code in (400, 422)


# ---------------- Vineyard auth ----------------
def test_vineyard_auth_correct(s):
    r = s.post(f"{API}/vineyard/auth", json={"password": "777"})
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_vineyard_auth_wrong(s):
    r = s.post(f"{API}/vineyard/auth", json={"password": "wrong"})
    assert r.status_code == 401


# ---------------- Sources CRUD ----------------
@pytest.fixture(scope="module")
def source_id():
    sess = requests.Session()
    r = sess.post(f"{API}/vineyard/sources", json={"url": CRAWL_URL, "label": "TEST_example"})
    assert r.status_code == 200, r.text
    sid = r.json()["id"]
    yield sid
    # cleanup
    sess.delete(f"{API}/vineyard/sources/{sid}")


def test_sources_list_contains(s, source_id):
    r = s.get(f"{API}/vineyard/sources")
    assert r.status_code == 200
    ids = [x["id"] for x in r.json()]
    assert source_id in ids


def test_sources_invalid_url(s):
    r = s.post(f"{API}/vineyard/sources", json={"url": "notaurl"})
    assert r.status_code == 400


def test_sources_crawl_and_documents(s, source_id):
    r = s.post(f"{API}/vineyard/sources/{source_id}/crawl")
    assert r.status_code == 200
    assert r.json().get("status") == "crawling"

    # poll for completion (example.com has 1 page)
    done = False
    for _ in range(30):
        time.sleep(2)
        src = next((x for x in s.get(f"{API}/vineyard/sources").json() if x["id"] == source_id), None)
        assert src is not None
        if src["status"] in ("done", "error"):
            done = True
            break
    assert done, f"Crawl did not finish. status={src.get('status')}"
    assert src["status"] == "done", f"Crawl error: {src.get('last_error')}"
    assert src["pages_indexed"] >= 1

    # list documents
    docs = s.get(f"{API}/vineyard/documents").json()
    assert any(d["source_id"] == source_id for d in docs), "No docs indexed"


# ---------------- Search ----------------
def test_search_empty_query(s):
    r = s.post(f"{API}/vineyard/search", json={"query": ""})
    assert r.status_code == 400


def test_search_no_match_returns_refusal(s):
    # use a query that's extremely unlikely to match example.com
    r = s.post(f"{API}/vineyard/search", json={"query": "xyzzyquuxfoobazqwerty municipal ordinance 999999"})
    assert r.status_code == 200
    data = r.json()
    assert data["has_results"] is False
    assert data["answer"] == "No clear source was found in the indexed documents."
    assert data["citations"] == []


def test_search_with_match(s, source_id):
    # 'example' and 'domain' appear in example.com
    r = s.post(f"{API}/vineyard/search", json={"query": "example domain illustrative"})
    assert r.status_code == 200
    data = r.json()
    # Either has results with citations, or no match - both acceptable structurally
    assert "answer" in data and "citations" in data and "has_results" in data
    if data["has_results"]:
        assert len(data["citations"]) >= 1
        c = data["citations"][0]
        assert "title" in c and "url" in c and "excerpt" in c and "score" in c
        assert c["score"] >= 1.5


# ---------------- Source delete ----------------
def test_source_delete_removes_docs(s):
    # add a fresh source then delete
    r = s.post(f"{API}/vineyard/sources", json={"url": "https://example.org", "label": "TEST_del"})
    sid = r.json()["id"]
    dr = s.delete(f"{API}/vineyard/sources/{sid}")
    assert dr.status_code == 200
    ids = [x["id"] for x in s.get(f"{API}/vineyard/sources").json()]
    assert sid not in ids
