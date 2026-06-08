from server.routers import checkin_routes as cr
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient


# Checks text normalization.
def test_normalize_text_handles_none_and_case():
    assert cr._normalize_text(None) == ""
    assert cr._normalize_text("  HeLLo ") == "hello"


# Checks score from negative words.
def test_estimate_score_from_text_matches_negative_keywords():
    assert cr.estimate_score_from_text("I feel hopeless and depressed") == 1
    assert cr.estimate_score_from_text("I am sad and lonely") == 3


# Checks score from positive words.
def test_estimate_score_from_text_matches_positive_keywords():
    assert cr.estimate_score_from_text("I feel amazing today") == 10
    assert cr.estimate_score_from_text("I feel happy and grateful") == 9


# Checks no score is returned for unrelated text.
def test_estimate_score_from_text_returns_none_when_no_match():
    assert cr.estimate_score_from_text("just writing random text") is None


# Checks that numeric score is used first.
def test_compute_final_score_prefers_numeric_score():
    payload = cr.CheckinPayload(score=8, label="anxious", note="depressed")
    assert cr.compute_final_score(payload) == 8


# Checks that label is used when score is missing.
def test_compute_final_score_uses_label_when_score_missing():
    payload = cr.CheckinPayload(score=None, label="happy", note="depressed")
    assert cr.compute_final_score(payload) == 10


# Checks that note text is used when score and label are missing.
def test_compute_final_score_uses_note_when_score_and_label_missing():
    payload = cr.CheckinPayload(score=None, label=None, note="I feel overwhelmed")
    assert cr.compute_final_score(payload) == 3


# Checks fallback to neutral score.
def test_compute_final_score_falls_back_to_neutral():
    payload = cr.CheckinPayload(score=None, label=None, note="nothing specific")
    assert cr.compute_final_score(payload) == 5


# Fake query result for check-in tests.
class FakeResult:
    def __init__(self, rows=None):
        self._rows = rows or []

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return self._rows

    def mappings(self):
        return self

    def first(self):
        return self.fetchone()


# Fake database for check-in tests.
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


# Builds a fake app client for check-in tests.
def build_client(db):
    app = FastAPI()
    app.include_router(cr.router)

    def override_db():
        yield db

    app.dependency_overrides[cr.get_db] = override_db
    app.dependency_overrides[cr._user_id_from_authorization] = lambda: "u1"
    return TestClient(app)


# Checks check-in save with direct score.
def test_create_checkin_success_from_explicit_score():
    db = FakeDB(
        responses=[
            FakeResult(),  # insert
            FakeResult([]),  # streak fetchall
            FakeResult([SimpleNamespace(a=5.0)]),  # avg7
            FakeResult([SimpleNamespace(a=5.0)]),  # avg14
            FakeResult([SimpleNamespace(a=5.0)]),  # avg30
            FakeResult(),  # merge
        ]
    )
    client = build_client(db)

    res = client.post("/checkin", json={"score": 7, "label": "calm", "note": "ok"})

    assert res.status_code == 201
    assert res.json()["saved"] is True
    assert db.committed == 2


# Checks check-in save using label only.
def test_create_checkin_success_from_label_only():
    db = FakeDB(
        responses=[
            FakeResult(),
            FakeResult([]),
            FakeResult([SimpleNamespace(a=7.0)]),
            FakeResult([SimpleNamespace(a=7.0)]),
            FakeResult([SimpleNamespace(a=7.0)]),
            FakeResult(),
        ]
    )
    client = build_client(db)

    res = client.post("/checkin", json={"label": "happy", "note": None})

    assert res.status_code == 201
    assert res.json()["saved"] is True