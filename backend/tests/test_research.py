"""Backend tests for Research Mode (iteration 5 - fork session)."""
import os
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://jwoodtechnologies-com.onrender.com").rstrip("/")
API = f"{BASE_URL}/api"

RESEARCH_PW = "555"
ADMIN_PW = "7607"
VINEYARD_PW = "777"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------- Auth ----------------
class TestResearchAuth:
    def test_auth_correct(self, client):
        r = client.post(f"{API}/research/auth", json={"password": RESEARCH_PW}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True

    def test_auth_wrong(self, client):
        r = client.post(f"{API}/research/auth", json={"password": "WRONG"}, timeout=30)
        assert r.status_code == 401


# ---------------- Stats ----------------
class TestResearchStats:
    def test_stats_shape(self, client):
        r = client.get(f"{API}/research/stats", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "total_docs" in body
        assert body["total_docs"] >= 711, f"expected >=711 docs got {body['total_docs']}"
        assert "by_entity" in body and isinstance(body["by_entity"], dict)
        assert "by_source" in body and isinstance(body["by_source"], dict)
        assert "atlas" in body
        atlas = body["atlas"]
        for k in ("data_mb", "storage_mb", "free_tier_limit_mb"):
            assert k in atlas


# ---------------- Search ----------------
class TestResearchSearch:
    def test_search_basic(self, client):
        r = client.post(f"{API}/research/search", json={"query": "audit anomaly", "limit": 5}, timeout=120)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "results" in body and isinstance(body["results"], list)
        assert "answer" in body
        if body["results"]:
            first = body["results"][0]
            for key in ("id", "title", "entity", "source", "doc_type", "snippet", "score"):
                assert key in first, f"missing {key} in result"

    def test_search_entity_filter(self, client):
        r = client.post(f"{API}/research/search", json={"query": "appeal", "entity": "pacificorp", "limit": 10}, timeout=120)
        assert r.status_code == 200
        for row in r.json().get("results", []):
            assert row.get("entity") == "pacificorp"

    def test_search_source_filter(self, client):
        r = client.post(f"{API}/research/search", json={"query": "vendor", "source": "proservices_xlsx", "limit": 10}, timeout=120)
        assert r.status_code == 200
        for row in r.json().get("results", []):
            assert row.get("source") == "proservices_xlsx"


# ---------------- Document fetch ----------------
class TestResearchDocument:
    def test_get_document_by_id(self, client):
        # find an id via search first
        r = client.post(f"{API}/research/search", json={"query": "audit", "limit": 1}, timeout=120)
        results = r.json().get("results", [])
        if not results:
            pytest.skip("no results available for doc fetch")
        doc_id = results[0]["id"]
        r2 = client.get(f"{API}/research/document/{doc_id}", timeout=30)
        assert r2.status_code == 200
        d = r2.json()
        assert d.get("id") == doc_id
        assert "content" in d
        assert "_id" not in d  # Mongo ObjectId must be excluded

    def test_get_doc_not_found(self, client):
        r = client.get(f"{API}/research/document/does-not-exist-xyz", timeout=30)
        assert r.status_code == 404


# ---------------- Compare ----------------
class TestResearchCompare:
    def test_compare_two_docs(self, client):
        r = client.post(f"{API}/research/search", json={"query": "pacificorp", "limit": 3}, timeout=120)
        results = r.json().get("results", [])
        if len(results) < 2:
            pytest.skip("need >=2 docs")
        ids = [results[0]["id"], results[1]["id"]]
        r2 = client.post(f"{API}/research/compare", json={"doc_ids": ids, "question": "Compare these"}, timeout=120)
        assert r2.status_code == 200, r2.text
        body = r2.json()
        assert "answer" in body
        assert len(body["answer"]) > 10


# ---------------- Export ----------------
class TestResearchExport:
    def _get_ids(self, client, n=2):
        r = client.post(f"{API}/research/search", json={"query": "vineyard", "limit": n}, timeout=120)
        return [x["id"] for x in r.json().get("results", [])][:n]

    def test_export_claude(self, client):
        ids = self._get_ids(client)
        if not ids:
            pytest.skip("no docs")
        r = client.post(f"{API}/research/export", json={"doc_ids": ids, "target": "claude"}, timeout=60)
        assert r.status_code == 200
        p = r.json().get("prompt", "")
        assert "<task>" in p and "<context>" in p and "<instructions>" in p

    def test_export_chatgpt(self, client):
        ids = self._get_ids(client)
        if not ids:
            pytest.skip("no docs")
        r = client.post(f"{API}/research/export", json={"doc_ids": ids, "target": "chatgpt"}, timeout=60)
        assert r.status_code == 200
        p = r.json().get("prompt", "")
        assert "<task>" not in p
        assert "research analyst" in p.lower()

    def test_export_plain(self, client):
        ids = self._get_ids(client)
        if not ids:
            pytest.skip("no docs")
        r = client.post(f"{API}/research/export", json={"doc_ids": ids, "target": "plain"}, timeout=60)
        assert r.status_code == 200
        p = r.json().get("prompt", "")
        assert "<task>" not in p
        assert "DOCUMENT 1" in p


# ---------------- Ingest seed uploads ----------------
class TestResearchIngest:
    def test_ingest_wrong_pw(self, client):
        r = client.post(f"{API}/research/ingest/seed-uploads?password=nope", timeout=30)
        assert r.status_code == 401


# ---------------- SEC crawl ----------------
class TestResearchSecCrawl:
    def test_crawl_wrong_pw(self, client):
        r = client.post(f"{API}/research/crawl/sec?password=bad&max_per_entity=2", timeout=30)
        assert r.status_code == 401

    def test_crawl_start_and_status(self, client):
        r = client.post(f"{API}/research/crawl/sec?password={ADMIN_PW}&max_per_entity=2", timeout=30)
        assert r.status_code == 200, r.text
        run_id = r.json().get("run_id")
        assert run_id
        # poll status up to 90s
        deadline = time.time() + 90
        final = None
        while time.time() < deadline:
            s = client.get(f"{API}/research/crawl/status", timeout=30)
            assert s.status_code == 200
            runs = s.json().get("runs", {})
            final = runs.get(run_id)
            if final and final.get("status") in ("done", "error"):
                break
            time.sleep(3)
        assert final is not None
        # accept running if slow, but prefer done; require indexed>=0 at minimum
        assert "indexed" in final


# ---------------- Graph + Entity detail (iter 6) ----------------
class TestResearchGraph:
    def test_graph_shape(self, client):
        r = client.get(f"{API}/research/graph", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("nodes", "edges", "summary"):
            assert k in body
        nodes = body["nodes"]
        assert isinstance(nodes, list) and len(nodes) > 0
        # must have both entity and source nodes
        types = {n.get("type") for n in nodes}
        assert "entity" in types
        assert "source" in types
        for n in nodes:
            for key in ("id", "type", "label", "count"):
                assert key in n
            assert n["id"].startswith("e:") or n["id"].startswith("s:")
        edges = body["edges"]
        assert isinstance(edges, list)
        if edges:
            e = edges[0]
            for key in ("from", "to", "kind", "weight"):
                assert key in e
        summary = body["summary"]
        assert "total_docs" in summary
        assert summary["total_docs"] >= 700

    def test_entity_detail(self, client):
        r = client.get(f"{API}/research/entity/geneva-steel?limit=10", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("entity") == "geneva-steel"
        assert "total" in body
        assert "by_source" in body and isinstance(body["by_source"], dict)
        # Check each grouped doc has the expected shape
        for src, docs in body["by_source"].items():
            assert isinstance(docs, list)
            for d in docs:
                for key in ("id", "title", "source", "doc_type"):
                    assert key in d, f"missing {key} in entity doc"
                assert "_id" not in d

    def test_entity_detail_unknown(self, client):
        r = client.get(f"{API}/research/entity/does-not-exist?limit=5", timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body.get("total") == 0
        assert body.get("by_source") == {}


# ---------------- Isolation from /vineyard ----------------
class TestVineyardIsolation:
    def test_vineyard_search_excludes_research_docs(self, client):
        r = client.post(f"{API}/vineyard/search", json={"query": "audit anomaly", "limit": 50}, timeout=60)
        assert r.status_code == 200
        body = r.json()
        results = body.get("results", [])
        # Research docs use sources: rda_xlsx / pacificorp_csv / proservices_xlsx / sec_edgar
        research_sources = {"rda_xlsx", "pacificorp_csv", "proservices_xlsx", "sec_edgar"}
        for row in results:
            src = row.get("source", "")
            assert src not in research_sources, f"Vineyard result leaked research source: {src}"

    def test_vineyard_search_ready_unchanged(self, client):
        r = client.get(f"{API}/vineyard/search-ready", timeout=30)
        assert r.status_code == 200
        body = r.json()
        # ~45,828 docs in original archive
        total = body.get("total_docs") or body.get("total") or body.get("count")
        assert total is not None, body
        assert total >= 40000, f"vineyard total_docs dropped to {total} — isolation broken"

    def test_vineyard_auth_still_works(self, client):
        r = client.post(f"{API}/vineyard/auth", json={"password": VINEYARD_PW}, timeout=30)
        assert r.status_code == 200
