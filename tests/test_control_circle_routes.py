# tests/test_control_circle_routes.py
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.routers import control_circle_routes as cc


# Fake query result for control-circle tests.
class FakeResult:
    def __init__(self, rows=None):
        self._rows = rows or []

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return self._rows


# Fake database for control-circle tests.
class FakeDB:
    def __init__(self, responses=None):
        self.responses = list(responses or [])
        self.executed = []
        self.committed = 0

    def execute(self, query, params=None):
        self.executed.append((str(query), params))

        if self.responses:
            return self.responses.pop(0)

        return FakeResult()

    def commit(self):
        self.committed += 1


# Builds a fake app client for control-circle routes.
def build_client(db):
    app = FastAPI()
    app.include_router(cc.router)

    def override_db():
        yield db

    app.dependency_overrides[cc.get_db] = override_db
    app.dependency_overrides[cc._user_id_from_authorization] = lambda: "u1"

    return TestClient(app)


# Checks default can-control message includes the custom card text.
def test_default_message_can_control_returns_template(monkeypatch):
    monkeypatch.setattr(cc.random, "choice", lambda templates: templates[0])

    msg = cc._default_message("School pressure", "can_control")

    assert "School pressure" in msg
    assert "small step" in msg.lower()


# Checks default cannot-control message includes the custom card text.
def test_default_message_cannot_control_returns_template(monkeypatch):
    monkeypatch.setattr(cc.random, "choice", lambda templates: templates[0])

    msg = cc._default_message("Fear of future", "cannot_control")

    assert "Fear of future" in msg
    assert "not be fully in your control" in msg


# Checks random.choice is used for custom default messages.
def test_default_message_uses_random_choice(monkeypatch):
    called = {"value": False}

    def fake_choice(templates):
        called["value"] = True
        return templates[-1]

    monkeypatch.setattr(cc.random, "choice", fake_choice)

    msg = cc._default_message("Custom worry", "can_control")

    assert called["value"] is True
    assert "Custom worry" in msg


# Checks prompts endpoint returns active prompt cards.
def test_list_control_circle_prompts_success():
    rows = [
        SimpleNamespace(
            prompt_id="p1",
            label="Fear of the future",
            category_hint="anxiety",
            can_control_message="Choose one small action.",
            cannot_control_message="Focus on the present.",
        ),
        SimpleNamespace(
            prompt_id="p2",
            label="News overload",
            category_hint="stress",
            can_control_message="Limit news checking.",
            cannot_control_message="Step away when needed.",
        ),
    ]

    db = FakeDB(responses=[FakeResult(rows)])
    client = build_client(db)

    res = client.get("/control-circle/prompts")

    assert res.status_code == 200
    body = res.json()

    assert len(body) == 2
    assert body[0]["prompt_id"] == "p1"
    assert body[0]["label"] == "Fear of the future"
    assert body[0]["category_hint"] == "anxiety"
    assert body[0]["can_control_message"] == "Choose one small action."
    assert body[0]["cannot_control_message"] == "Focus on the present."

    assert any("SELECT TOP 8" in q for q, _ in db.executed)
    assert any("ORDER BY NEWID()" in q for q, _ in db.executed)


# Checks prompts endpoint returns empty list when no prompts exist.
def test_list_control_circle_prompts_empty():
    db = FakeDB(responses=[FakeResult([])])
    client = build_client(db)

    res = client.get("/control-circle/prompts")

    assert res.status_code == 200
    assert res.json() == []


# Checks invalid selected_zone is rejected.
def test_create_entry_rejects_invalid_zone():
    db = FakeDB()
    client = build_client(db)

    res = client.post(
        "/control-circle/entries",
        json={
            "prompt_id": None,
            "prompt_text": "School pressure",
            "selected_zone": "bad_zone",
        },
    )

    assert res.status_code == 400
    assert "selected_zone" in res.text
    assert db.committed == 0


# Checks empty prompt_text is rejected.
def test_create_entry_rejects_empty_prompt_text():
    db = FakeDB()
    client = build_client(db)

    res = client.post(
        "/control-circle/entries",
        json={
            "prompt_id": None,
            "prompt_text": "   ",
            "selected_zone": "can_control",
        },
    )

    assert res.status_code == 400
    assert "prompt_text is required" in res.text
    assert db.committed == 0


# Checks existing database prompt uses can_control_message.
def test_create_entry_with_existing_prompt_can_control_success():
    prompt_row = SimpleNamespace(
        prompt_id="p1",
        label="Fear of the future",
        can_control_message="Choose one small action today.",
        cannot_control_message="Bring attention back to the present.",
    )

    inserted_row = SimpleNamespace(
        entry_id="e1",
        user_id="u1",
        prompt_id="p1",
        prompt_text="Fear of the future",
        selected_zone="can_control",
        feedback_message="Choose one small action today.",
        created_at="2026-04-01T10:00:00",
    )

    db = FakeDB(
        responses=[
            FakeResult([prompt_row]),
            FakeResult([inserted_row]),
        ]
    )
    client = build_client(db)

    res = client.post(
        "/control-circle/entries",
        json={
            "prompt_id": "p1",
            "prompt_text": "ignored because DB label is used",
            "selected_zone": "can_control",
        },
    )

    assert res.status_code == 200
    body = res.json()

    assert body["entry_id"] == "e1"
    assert body["user_id"] == "u1"
    assert body["prompt_id"] == "p1"
    assert body["prompt_text"] == "Fear of the future"
    assert body["selected_zone"] == "can_control"
    assert body["feedback_message"] == "Choose one small action today."
    assert db.committed == 1


# Checks existing database prompt uses cannot_control_message.
def test_create_entry_with_existing_prompt_cannot_control_success():
    prompt_row = SimpleNamespace(
        prompt_id="p1",
        label="Uncertainty",
        can_control_message="Make a small plan.",
        cannot_control_message="You do not need to solve everything today.",
    )

    inserted_row = SimpleNamespace(
        entry_id="e2",
        user_id="u1",
        prompt_id="p1",
        prompt_text="Uncertainty",
        selected_zone="cannot_control",
        feedback_message="You do not need to solve everything today.",
        created_at="2026-04-01T10:00:00",
    )

    db = FakeDB(
        responses=[
            FakeResult([prompt_row]),
            FakeResult([inserted_row]),
        ]
    )
    client = build_client(db)

    res = client.post(
        "/control-circle/entries",
        json={
            "prompt_id": "p1",
            "prompt_text": "Uncertainty",
            "selected_zone": "cannot_control",
        },
    )

    assert res.status_code == 200
    body = res.json()

    assert body["prompt_text"] == "Uncertainty"
    assert body["selected_zone"] == "cannot_control"
    assert body["feedback_message"] == "You do not need to solve everything today."
    assert db.committed == 1


# Checks missing prompt_id returns 404.
def test_create_entry_with_missing_prompt_returns_404():
    db = FakeDB(responses=[FakeResult([])])
    client = build_client(db)

    res = client.post(
        "/control-circle/entries",
        json={
            "prompt_id": "missing",
            "prompt_text": "Missing prompt",
            "selected_zone": "can_control",
        },
    )

    assert res.status_code == 404
    assert "Prompt not found" in res.text
    assert db.committed == 0


# Checks custom card uses default message when prompt_id is null.
def test_create_entry_with_custom_prompt_uses_default_message(monkeypatch):
    monkeypatch.setattr(
        cc,
        "_default_message",
        lambda prompt_text, selected_zone: f"default message for {prompt_text} in {selected_zone}",
    )

    inserted_row = SimpleNamespace(
        entry_id="e3",
        user_id="u1",
        prompt_id=None,
        prompt_text="My custom worry",
        selected_zone="can_control",
        feedback_message="default message for My custom worry in can_control",
        created_at="2026-04-01T10:00:00",
    )

    db = FakeDB(responses=[FakeResult([inserted_row])])
    client = build_client(db)

    res = client.post(
        "/control-circle/entries",
        json={
            "prompt_id": None,
            "prompt_text": "  My custom worry  ",
            "selected_zone": "can_control",
        },
    )

    assert res.status_code == 200
    body = res.json()

    assert body["prompt_id"] is None
    assert body["prompt_text"] == "My custom worry"
    assert body["feedback_message"] == "default message for My custom worry in can_control"
    assert db.committed == 1


# Checks custom card can also be saved in cannot_control zone.
def test_create_entry_custom_prompt_cannot_control_success(monkeypatch):
    monkeypatch.setattr(
        cc,
        "_default_message",
        lambda prompt_text, selected_zone: f"default cannot message for {prompt_text}",
    )

    inserted_row = SimpleNamespace(
        entry_id="e4",
        user_id="u1",
        prompt_id=None,
        prompt_text="Another worry",
        selected_zone="cannot_control",
        feedback_message="default cannot message for Another worry",
        created_at="2026-04-01T10:00:00",
    )

    db = FakeDB(responses=[FakeResult([inserted_row])])
    client = build_client(db)

    res = client.post(
        "/control-circle/entries",
        json={
            "prompt_text": "Another worry",
            "selected_zone": "cannot_control",
        },
    )

    assert res.status_code == 200
    body = res.json()

    assert body["prompt_text"] == "Another worry"
    assert body["selected_zone"] == "cannot_control"
    assert body["feedback_message"] == "default cannot message for Another worry"
    assert db.committed == 1


# Checks insert params are sent correctly.
def test_create_entry_sends_expected_insert_params(monkeypatch):
    monkeypatch.setattr(cc, "_default_message", lambda prompt_text, selected_zone: "mock message")

    inserted_row = SimpleNamespace(
        entry_id="e5",
        user_id="u1",
        prompt_id=None,
        prompt_text="Exam stress",
        selected_zone="can_control",
        feedback_message="mock message",
        created_at="2026-04-01T10:00:00",
    )

    db = FakeDB(responses=[FakeResult([inserted_row])])
    client = build_client(db)

    res = client.post(
        "/control-circle/entries",
        json={
            "prompt_id": None,
            "prompt_text": "Exam stress",
            "selected_zone": "can_control",
        },
    )

    assert res.status_code == 200

    insert_calls = [
        params
        for q, params in db.executed
        if "INSERT INTO dbo.UserControlCircleEntries" in q
    ]

    assert len(insert_calls) == 1
    assert insert_calls[0]["user_id"] == "u1"
    assert insert_calls[0]["prompt_id"] is None
    assert insert_calls[0]["prompt_text"] == "Exam stress"
    assert insert_calls[0]["selected_zone"] == "can_control"
    assert insert_calls[0]["feedback_message"] == "mock message"


# Checks history endpoint returns saved entries.
def test_list_control_circle_history_success():
    rows = [
        SimpleNamespace(
            entry_id="e1",
            user_id="u1",
            prompt_id="p1",
            prompt_text="Fear of the future",
            selected_zone="can_control",
            feedback_message="Choose one small step.",
            created_at="2026-04-01T10:00:00",
        ),
        SimpleNamespace(
            entry_id="e2",
            user_id="u1",
            prompt_id=None,
            prompt_text="Custom worry",
            selected_zone="can_control",
            feedback_message="Default custom message.",
            created_at="2026-04-02T10:00:00",
        ),
    ]

    db = FakeDB(responses=[FakeResult(rows)])
    client = build_client(db)

    res = client.get("/control-circle/history")

    assert res.status_code == 200
    body = res.json()

    assert len(body) == 2
    assert body[0]["entry_id"] == "e1"
    assert body[0]["prompt_id"] == "p1"
    assert body[0]["prompt_text"] == "Fear of the future"
    assert body[1]["prompt_id"] is None
    assert body[1]["prompt_text"] == "Custom worry"

    assert any("SELECT TOP 30" in q for q, _ in db.executed)
    assert any("WHERE user_id = :uid" in q for q, _ in db.executed)


# Checks history endpoint returns empty list when user has no entries.
def test_list_control_circle_history_empty():
    db = FakeDB(responses=[FakeResult([])])
    client = build_client(db)

    res = client.get("/control-circle/history")

    assert res.status_code == 200
    assert res.json() == []