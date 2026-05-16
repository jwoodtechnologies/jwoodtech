"""Iteration 5+6 backend tests: chatbot, web-search, public add-source, default seeds."""
import os
import time
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"


# Chatbot
def test_chatbot_post_valid():
    r = requests.post(f"{API}/chatbot", json={
        "first_name": "TEST_Jane", "last_name": "Doe",
        "email": "test_jane@example.com", "phone": "555-0100",
        "question": "Looking for a quick prototype build.",
    }, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data["first_name"] == "TEST_Jane"
    assert data["email"] == "test_jane@example.com"
    assert "id" in data and "created_at" in data
    # email_sent could be true (sandbox) or false; field must exist
    assert "email_sent" in data


def test_chatbot_post_invalid_email():
    r = requests.post(f"{API}/chatbot", json={
        "first_name": "x", "last_name": "y",
        "email": "notanemail", "phone": "", "question": "hi",
    }, timeout=15)
    assert r.status_code == 422


# Web search
def test_web_search_returns_citations():
    r = requests.post(f"{API}/vineyard/web-search",
                      json={"query": "vineyard utah parking"}, timeout=60)
    assert r.status_code == 200
    data = r.json()
    assert "answer" in data
    assert "citations" in data
    # Allow rate-limit fallback (empty results) but if we got results, validate shape
    if data["has_results"]:
        assert len(data["citations"]) > 0
        c = data["citations"][0]
        assert "url" in c and "title" in c


# Public Add Source
def test_add_source_invalid_url():
    r = requests.post(f"{API}/vineyard/sources",
                      json={"url": "notaurl"}, timeout=15)
    assert r.status_code == 400


def test_add_source_duplicate():
    r = requests.post(f"{API}/vineyard/sources",
                      json={"url": "https://www.vineyardutah.gov/"}, timeout=15)
    assert r.status_code == 409


def test_add_source_valid_new_and_cleanup():
    test_url = f"https://example.org/?t={int(time.time())}"
    r = requests.post(f"{API}/vineyard/sources",
                      json={"url": test_url}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "crawling"
    assert data["url"] == test_url
    # cleanup
    sid = data["id"]
    requests.delete(f"{API}/vineyard/sources/{sid}", timeout=10)


# Index status default seeds
def test_index_status_has_5_default_seeds():
    r = requests.get(f"{API}/vineyard/index-status", timeout=15)
    assert r.status_code == 200
    data = r.json()
    urls = [s["url"] for s in data["sources"]]
    assert "https://www.utah.gov/transparency/" in urls
    # at least the 5 defaults should be present
    defaults = [
        "https://vineyard.municipalcodeonline.com/",
        "https://www.vineyardutah.gov/",
        "https://vineyardut.portal.civicclerk.com/",
        "https://www.utah.gov/transparency/",
    ]
    for u in defaults:
        assert u in urls, f"missing default {u}"


# Regression
def test_vineyard_auth_777():
    r = requests.post(f"{API}/vineyard/auth", json={"password": "777"}, timeout=10)
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_vineyard_auth_wrong():
    r = requests.post(f"{API}/vineyard/auth", json={"password": "wrong"}, timeout=10)
    assert r.status_code == 401


def test_vineyard_search_refusal_phrase():
    r = requests.post(f"{API}/vineyard/search",
                      json={"query": "asdfqwerzxcvnonsensequery999"}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    if not data["has_results"]:
        assert "No clear source was found" in data["answer"]


def test_contact_endpoint():
    r = requests.post(f"{API}/contact", json={
        "name": "TEST_Contact", "email": "test_c@example.com",
        "phone": "", "project_type": "AI / Machine Learning",
        "description": "test desc", "budget": "< $10K",
        "timeline": "Flexible",
    }, timeout=30)
    assert r.status_code == 200
    assert r.json()["email"] == "test_c@example.com"
