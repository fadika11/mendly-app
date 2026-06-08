from datetime import date
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.routers import screenings_routes as sr


# Fake query result for screening tests.
class FakeResult:
    def __init__(self, rows=None, rowcount=1):
        self._rows = rows or []
        self.rowcount = rowcount

    def fetchone(self):
        return self._rows[0] if self._rows else None


# Fake database for screening tests.
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


# Builds a fake app client for screening tests.
def build_client(db):
    app = FastAPI()
    app.include_router(sr.router)

    def override_db():
        yield db

    app.dependency_overrides[sr.get_db] = override_db
    app.dependency_overrides[sr._user_id_from_authorization] = lambda: "u1"
    return TestClient(app)


# Checks invalid PHQ-2 answers are rejected.
def test_submit_phq2_rejects_invalid_answers():
    client = build_client(FakeDB())
    res = client.post(
        "/screenings/phq2",
        json={"type": "PHQ-2", "totalScore": 3, "answers": [0, 5]},
    )
    assert res.status_code == 400


# Checks PHQ-2 updates settings.
def test_submit_phq2_updates_settings():
    db = FakeDB(responses=[FakeResult(rowcount=1)])
    client = build_client(db)

    res = client.post(
        "/screenings/phq2",
        json={"type": "PHQ-2", "totalScore": 3, "answers": [1, 2]},
    )

    assert res.status_code == 204
    assert db.committed == 1


# Checks PHQ-2 inserts settings if missing.
def test_submit_phq2_inserts_settings_if_missing():
    db = FakeDB(responses=[FakeResult(rowcount=0)])
    client = build_client(db)

    res = client.post(
        "/screenings/phq2",
        json={"type": "PHQ-2", "totalScore": 2, "answers": [1, 1]},
    )

    assert res.status_code == 204
    assert db.committed == 1
    assert len(db.executed) >= 2


# Checks empty screening status fallback.
def test_screening_status_fallback_when_missing_row():
    client = build_client(FakeDB(responses=[FakeResult([])]))
    res = client.get("/screenings/status")
    assert res.status_code == 200
    assert res.json()["last_phq2_date"] is None
    assert res.json()["last_photo_memory_date"] is None


# Checks screening status returns saved dates.
def test_screening_status_returns_dates():
    row = SimpleNamespace(
        last_phq2_date=date(2026, 4, 1),
        last_photo_memory_date=date(2026, 4, 2),
    )
    client = build_client(FakeDB(responses=[FakeResult([row])]))
    res = client.get("/screenings/status")
    assert res.status_code == 200
    assert res.json()["last_phq2_date"] == "2026-04-01"
    assert res.json()["last_photo_memory_date"] == "2026-04-02"


# Checks photo popup seen is saved.
def test_mark_photo_popup_seen_success():
    db = FakeDB()
    client = build_client(db)

    res = client.post("/screenings/photo-popup-seen")

    assert res.status_code == 200
    assert res.json()["ok"] is True
    assert db.committed == 1