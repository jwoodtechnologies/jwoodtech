"""Backend tests for EON personal AI agent endpoints (/api/eon-app/*)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://bubble-repo.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api/eon-app"

TS = int(time.time())
TEST_EMAIL = f"eon-qa-{TS}@example.com"
TEST_PASSWORD = "Test123!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth(session):
    # Sign up a fresh user
    r = session.post(f"{API}/auth/signup", json={
        "first_name": "Eon",
        "last_name": "QA",
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
    }, timeout=30)
    assert r.status_code == 200, f"Signup failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and data["user"]["email"] == TEST_EMAIL
    return {"token": data["token"], "user": data["user"]}


@pytest.fixture(scope="module")
def authed_session(session, auth):
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth['token']}",
    })
    return s


# --- agents (public)
def test_agents_list_returns_four(session):
    r = session.get(f"{API}/agents", timeout=15)
    assert r.status_code == 200
    data = r.json()
    agents = data.get("agents", [])
    names = sorted(a["name"] for a in agents)
    assert names == ["Analyst", "Planner", "Researcher", "Writer"], f"Got: {names}"


# --- auth
def test_signup_and_login(session, auth):
    # signup happens in fixture; verify login works for it
    r = session.post(f"{API}/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
    }, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["user"]["email"] == TEST_EMAIL
    assert d["user"]["is_admin"] is False
    assert d["user"]["remaining"] == 5


# --- 401 protection
@pytest.mark.parametrize("path,method", [
    ("/me", "get"),
    ("/chat", "post"),
    ("/tasks", "get"),
    ("/dashboard", "get"),
    ("/activity", "get"),
])
def test_endpoints_require_auth(session, path, method):
    fn = getattr(session, method)
    kwargs = {"timeout": 15}
    if method == "post":
        kwargs["json"] = {"message": "hi"}
    r = fn(f"{API}{path}", **kwargs)
    assert r.status_code == 401, f"{path} {method} returned {r.status_code}"


# --- dashboard
def test_dashboard_returns_stats_and_agents(authed_session):
    r = authed_session.get(f"{API}/dashboard", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "stats" in d and "agents" in d and "recent_activity" in d
    assert len(d["agents"]) == 4
    assert "messages_sent" in d["stats"]


# --- tasks CRUD + run
@pytest.fixture(scope="module")
def created_task(authed_session):
    r = authed_session.post(f"{API}/tasks", json={
        "title": "TEST_research_eon",
        "description": "Briefly explain what EON is in 2 sentences.",
        "agent_id": "researcher",
        "priority": "high",
    }, timeout=15)
    assert r.status_code == 200, r.text
    t = r.json()["task"]
    assert t["status"] == "queued" and t["agent_id"] == "researcher"
    return t


def test_task_list_contains_created(authed_session, created_task):
    r = authed_session.get(f"{API}/tasks", timeout=15)
    assert r.status_code == 200
    ids = [t["id"] for t in r.json()["tasks"]]
    assert created_task["id"] in ids


def test_task_run_executes_via_llm(authed_session, created_task):
    r = authed_session.post(f"{API}/tasks/{created_task['id']}/run", timeout=90)
    assert r.status_code == 200, r.text
    t = r.json()["task"]
    assert t["status"] == "done", f"status={t['status']}"
    assert isinstance(t["result"], str) and len(t["result"].strip()) > 0
    # Result should not be the error fallback string
    assert "model error" not in t["result"].lower(), f"LLM error: {t['result']}"


def test_task_patch_updates_fields(authed_session, created_task):
    r = authed_session.patch(f"{API}/tasks/{created_task['id']}", json={
        "title": "TEST_research_eon_updated",
        "priority": "low",
    }, timeout=15)
    assert r.status_code == 200
    t = r.json()["task"]
    assert t["title"] == "TEST_research_eon_updated"
    assert t["priority"] == "low"


def test_task_delete_removes(authed_session, created_task):
    r = authed_session.delete(f"{API}/tasks/{created_task['id']}", timeout=15)
    assert r.status_code == 200
    # verify gone
    r2 = authed_session.get(f"{API}/tasks", timeout=15)
    ids = [t["id"] for t in r2.json()["tasks"]]
    assert created_task["id"] not in ids


# --- activity
def test_activity_contains_task_events(authed_session):
    r = authed_session.get(f"{API}/activity", timeout=15)
    assert r.status_code == 200
    kinds = {a.get("kind") for a in r.json().get("activity", [])}
    assert "task_created" in kinds
    assert "task_done" in kinds


# --- chat + free limit
def test_chat_replies_and_increments_count(session):
    # Use a brand-new user to control the free-limit budget cleanly
    email = f"eon-chat-{int(time.time())}@example.com"
    r = session.post(f"{API}/auth/signup", json={
        "first_name": "Chat", "last_name": "User",
        "email": email, "password": TEST_PASSWORD,
    }, timeout=15)
    assert r.status_code == 200
    token = r.json()["token"]
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    r = requests.post(f"{API}/chat", json={"message": "Say hi in one short sentence."}, headers=h, timeout=90)
    assert r.status_code == 200, r.text
    d = r.json()
    assert isinstance(d.get("reply"), str) and len(d["reply"].strip()) > 0
    assert d["message_count"] == 1
    assert d["remaining"] == 4

    # Hit free limit (4 more) → 6th call should 402
    for _ in range(4):
        rr = requests.post(f"{API}/chat", json={"message": "ping"}, headers=h, timeout=90)
        assert rr.status_code == 200, rr.text

    rr = requests.post(f"{API}/chat", json={"message": "over limit"}, headers=h, timeout=30)
    assert rr.status_code == 402, f"Expected 402, got {rr.status_code} {rr.text}"


# --- activity includes chat after chat occurred
def test_chat_activity_logged(authed_session):
    # send one chat from the main test user (still has budget remaining)
    r = authed_session.post(f"{API}/chat", json={"message": "hi EON"}, timeout=90)
    assert r.status_code == 200, r.text
    a = authed_session.get(f"{API}/activity", timeout=15)
    kinds = {x.get("kind") for x in a.json().get("activity", [])}
    assert "chat" in kinds
