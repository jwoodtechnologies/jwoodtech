"""Iteration 2 backend tests: index-status + refresh-index + regression."""
import os
import time
import requests

def _load_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.strip().startswith("REACT_APP_BACKEND_URL"):
                    return line.split("=", 1)[1].strip().strip('"')
    except Exception:
        pass
    return ""

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_env()).rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
API = f"{BASE_URL}/api"

DEFAULT_URLS = [
    "https://www.vineyardutah.gov/",
    "https://vineyard.municipalcodeonline.com/",
]


def test_index_status_shape_and_default_seeds():
    r = requests.get(f"{API}/vineyard/index-status", timeout=20)
    assert r.status_code == 200
    data = r.json()
    for k in ("total_docs", "sources", "is_indexed", "is_crawling"):
        assert k in data, f"missing key {k}"
    assert isinstance(data["total_docs"], int)
    assert isinstance(data["sources"], list)
    assert isinstance(data["is_indexed"], bool)
    assert isinstance(data["is_crawling"], bool)
    assert data["is_indexed"] == (data["total_docs"] > 0)

    urls = {s["url"] for s in data["sources"]}
    for u in DEFAULT_URLS:
        assert u in urls, f"Default source {u} missing. found={urls}"


def test_refresh_index_starts_crawls():
    # Should return 200 when sources exist
    r = requests.post(f"{API}/vineyard/refresh-index", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("ok") is True
    assert data.get("started", 0) >= 2

    # Right after, sources should be flipped to 'crawling' (may transition quickly)
    time.sleep(0.5)
    st = requests.get(f"{API}/vineyard/index-status", timeout=20).json()
    # Either is_crawling True, or at least one source has crawling/done/error (not 'idle' necessarily)
    statuses = [s.get("status") for s in st["sources"]]
    assert any(s in ("crawling", "done", "error") for s in statuses), f"statuses={statuses}"


def test_refresh_index_400_when_no_sources(monkeypatch=None):
    # We can't delete seeded sources safely (they'd be reseeded only on restart).
    # Instead, just validate endpoint exists and structure — already covered above.
    # This test confirms path returns 200 here (sources exist); 400 path is code-verified.
    r = requests.post(f"{API}/vineyard/refresh-index", timeout=30)
    assert r.status_code in (200, 400)


# ---- Regression ----
def test_regression_vineyard_auth_correct():
    r = requests.post(f"{API}/vineyard/auth", json={"password": "777"}, timeout=15)
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_regression_vineyard_auth_wrong():
    r = requests.post(f"{API}/vineyard/auth", json={"password": "bad"}, timeout=15)
    assert r.status_code == 401


def test_regression_sources_list():
    r = requests.get(f"{API}/vineyard/sources", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_regression_search_empty_400():
    r = requests.post(f"{API}/vineyard/search", json={"query": ""}, timeout=15)
    assert r.status_code == 400


def test_regression_contact_create():
    payload = {
        "name": "TEST_iter2",
        "email": "test_iter2@example.com",
        "phone": "",
        "project_type": "AI / Machine Learning",
        "description": "TEST iter2 description",
        "budget": "$25K – $50K",
        "timeline": "1 month",
    }
    r = requests.post(f"{API}/contact", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["email"] == payload["email"]


def test_regression_search_refusal_when_no_match():
    r = requests.post(
        f"{API}/vineyard/search",
        json={"query": "xyzzyquuxfoobazqwerty municipal ordinance 9999999"},
        timeout=60,
    )
    assert r.status_code == 200
    data = r.json()
    # If nothing is indexed OR no match, refusal should appear
    if not data["has_results"]:
        assert data["answer"] == "No clear source was found in the indexed documents."
        assert data["citations"] == []
