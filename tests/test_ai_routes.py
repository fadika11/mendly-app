# tests/test_ai_routes.py
from datetime import datetime
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.routers import ai_routes


# Fake database result for tests.
class FakeResult:
    def __init__(self, rows=None):
        self._rows = rows or []

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return self._rows

    def first(self):
        return self._rows[0] if self._rows else None


# Fake database used in tests.
class FakeDB:
    def __init__(self, responses=None):
        self.responses = list(responses or [])
        self.executed = []
        self.committed = 0
        self.rolled_back = 0

    def execute(self, query, params=None):
        self.executed.append((str(query), params))

        if self.responses:
            item = self.responses.pop(0)
            if isinstance(item, Exception):
                raise item
            return item

        return FakeResult()

    def commit(self):
        self.committed += 1

    def rollback(self):
        self.rolled_back += 1


# Builds a fake app client for testing AI routes.
def build_client(db=None, monkeypatch=None, ask_reply="mocked reply"):
    app = FastAPI()
    app.include_router(ai_routes.router)

    fake_db = db or FakeDB()

    def override_db():
        yield fake_db

    def override_user():
        return SimpleNamespace(user_id="u1", is_admin=False)

    app.dependency_overrides[ai_routes.get_db] = override_db
    app.dependency_overrides[ai_routes.get_current_user] = override_user

    if monkeypatch is not None:
        monkeypatch.setattr(
            ai_routes,
            "ask_local_ai",
            lambda message, history: ask_reply,
        )

    return TestClient(app), fake_db


# =========================
# Mood helper tests
# =========================

def test_normalize_handles_empty_and_spaces():
    assert ai_routes.normalize("") == ""
    assert ai_routes.normalize("  HeLLo  ") == "hello"


def test_estimate_mood_score_all_branches():
    assert ai_routes.estimate_mood_score("I feel amazing and wonderful") == 9
    assert ai_routes.estimate_mood_score("I am happy and grateful") == 7
    assert ai_routes.estimate_mood_score("I feel hopeless and miserable") == 1
    assert ai_routes.estimate_mood_score("I am angry and frustrated") == 2
    assert ai_routes.estimate_mood_score("I feel stressed and overwhelmed") == 4
    assert ai_routes.estimate_mood_score("I feel sad and lonely") == 3
    assert ai_routes.estimate_mood_score("I am exhausted and burnt out") == 4
    assert ai_routes.estimate_mood_score("I feel bored and meh") == 5
    assert ai_routes.estimate_mood_score("I am confused and lost") == 4
    assert ai_routes.estimate_mood_score("plain neutral text") == 5


def test_mood_label_from_score_all_branches():
    assert ai_routes.mood_label_from_score(9) == "Very positive"
    assert ai_routes.mood_label_from_score(6) == "Positive"
    assert ai_routes.mood_label_from_score(4) == "Neutral / mixed"
    assert ai_routes.mood_label_from_score(2) == "Low / sad"
    assert ai_routes.mood_label_from_score(1) == "Very low"


# =========================
# GET /ai/chat/history
# =========================

def test_get_chat_history_success():
    db = FakeDB(
        responses=[
            FakeResult(
                [
                    SimpleNamespace(
                        role="user",
                        content="hello",
                        created_at=datetime(2026, 4, 1, 10, 0, 0),
                    ),
                    SimpleNamespace(
                        role="assistant",
                        content="hi there",
                        created_at=datetime(2026, 4, 1, 10, 1, 0),
                    ),
                ]
            )
        ]
    )

    client, _ = build_client(db=db)

    res = client.get("/ai/chat/history")

    assert res.status_code == 200
    body = res.json()

    assert len(body) == 2
    assert body[0]["role"] == "user"
    assert body[0]["content"] == "hello"
    assert body[0]["created_at"] == "2026-04-01T10:00:00"
    assert body[1]["role"] == "assistant"
    assert body[1]["content"] == "hi there"


def test_get_chat_history_empty():
    db = FakeDB(responses=[FakeResult([])])
    client, _ = build_client(db=db)

    res = client.get("/ai/chat/history")

    assert res.status_code == 200
    assert res.json() == []


def test_get_chat_history_formats_created_at_none():
    db = FakeDB(
        responses=[
            FakeResult(
                [
                    SimpleNamespace(
                        role="user",
                        content="hello",
                        created_at=None,
                    )
                ]
            )
        ]
    )

    client, _ = build_client(db=db)

    res = client.get("/ai/chat/history")

    assert res.status_code == 200
    assert res.json()[0]["created_at"] is None


# =========================
# DELETE /ai/chat/history
# =========================

def test_clear_chat_history_success():
    db = FakeDB()
    client, _ = build_client(db=db)

    res = client.delete("/ai/chat/history")

    assert res.status_code == 200
    assert res.json()["ok"] is True
    assert db.committed == 1
    assert any("DELETE FROM dbo.AiChatMessages" in q for q, _ in db.executed)


# =========================
# POST /ai/chat
# =========================

def test_chat_route_returns_reply_and_saves_mood(monkeypatch):
    client, fake_db = build_client(monkeypatch=monkeypatch)

    res = client.post(
        "/ai/chat",
        json={"message": "I feel stressed today", "history": []},
    )

    assert res.status_code == 200
    assert res.json()["reply"] == "mocked reply"
    assert fake_db.committed >= 1
    assert any("INSERT INTO dbo.AiChatMessages" in q for q, _ in fake_db.executed)
    assert any("INSERT INTO dbo.MoodEntries" in q for q, _ in fake_db.executed)


def test_chat_route_sends_bounded_last_20_history_messages(monkeypatch):
    captured = {}

    def fake_ask(message, history):
        captured["message"] = message
        captured["history"] = history
        return "bounded reply"

    monkeypatch.setattr(ai_routes, "ask_local_ai", fake_ask)

    db = FakeDB()
    client, _ = build_client(db=db)

    history = [
        {
            "role": "user" if i % 2 == 0 else "assistant",
            "content": f"message {i}",
        }
        for i in range(25)
    ]

    res = client.post(
        "/ai/chat",
        json={"message": "I feel okay", "history": history},
    )

    assert res.status_code == 200
    assert res.json()["reply"] == "bounded reply"
    assert captured["message"] == "I feel okay"
    assert len(captured["history"]) == 20
    assert captured["history"][0]["content"] == "message 5"
    assert captured["history"][-1]["content"] == "message 24"


def test_chat_route_saves_user_and_assistant_messages(monkeypatch):
    client, fake_db = build_client(monkeypatch=monkeypatch, ask_reply="assistant reply")

    res = client.post(
        "/ai/chat",
        json={"message": "hello AI", "history": []},
    )

    assert res.status_code == 200

    insert_params = [
        params
        for q, params in fake_db.executed
        if "INSERT INTO dbo.AiChatMessages" in q
    ]

    assert len(insert_params) == 2
    assert insert_params[0]["role"] == "user"
    assert insert_params[0]["content"] == "hello AI"
    assert insert_params[1]["role"] == "assistant"
    assert insert_params[1]["content"] == "assistant reply"


def test_chat_route_uses_recent_user_history_for_mood_note(monkeypatch):
    client, fake_db = build_client(monkeypatch=monkeypatch)

    history = [
        {"role": "user", "content": f"user note {i}"}
        for i in range(12)
    ]

    res = client.post(
        "/ai/chat",
        json={"message": "I feel happy", "history": history},
    )

    assert res.status_code == 200

    mood_params = [
        params
        for q, params in fake_db.executed
        if "INSERT INTO dbo.MoodEntries" in q
    ][0]

    assert "user note 2" not in mood_params["note"]
    assert "user note 3" in mood_params["note"]
    assert "I feel happy" in mood_params["note"]
    assert mood_params["label"] == "Positive"


def test_chat_route_db_save_failure_rolls_back_but_still_returns_reply(monkeypatch):
    db = FakeDB(responses=[RuntimeError("db save failed")])
    client, fake_db = build_client(db=db, monkeypatch=monkeypatch, ask_reply="reply even if save fails")

    res = client.post(
        "/ai/chat",
        json={"message": "I feel anxious", "history": []},
    )

    assert res.status_code == 200
    assert res.json()["reply"] == "reply even if save fails"
    assert fake_db.rolled_back == 1


def test_chat_route_returns_500_when_local_ai_fails(monkeypatch):
    db = FakeDB()

    def boom(message, history):
        raise RuntimeError("ollama down")

    monkeypatch.setattr(ai_routes, "ask_local_ai", boom)

    client, _ = build_client(db=db)

    res = client.post("/ai/chat", json={"message": "hello", "history": []})

    assert res.status_code == 500
    assert "Local AI is unavailable" in res.text