from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.routers import journey_routes as jr
from datetime import date


# Fake database result for journey tests.
class _ExecResult:
    def __init__(self, fetchone_val=None, fetchall_val=None, mappings_first=None, mappings_all=None):
        self._fetchone_val = fetchone_val
        self._fetchall_val = fetchall_val or []
        self._mappings_first = mappings_first
        self._mappings_all = mappings_all or []

    def fetchone(self):
        return self._fetchone_val

    def fetchall(self):
        return self._fetchall_val

    def mappings(self):
        parent = self
        class M:
            def first(self2):
                return parent._mappings_first
            def all(self2):
                return parent._mappings_all
        return M()


# Fake database for journey tests.
class FakeDB:
    def __init__(self):
        self.calls = []
        self.commits = 0

    def execute(self, stmt, params=None):
        s = str(stmt)
        self.calls.append((s, params))
        if "SELECT TOP 1 checkin_frequency, motivation_enabled" in s:
            row = type("R", (), {"checkin_frequency": 3, "motivation_enabled": 1})()
            return _ExecResult(fetchone_val=row)
        if "FROM dbo.MoodEntries" in s and "GROUP BY CAST(captured_at AS date)" in s:
            return _ExecResult(fetchall_val=[])
        if "FROM dbo.AdherenceStats" in s:
            return _ExecResult(mappings_first={})
        if "checkins_today" in s:
            return _ExecResult(mappings_first={"checkins_today": 0, "avg_today": None})
        if "FROM dbo.CheckinSchedule" in s:
            return _ExecResult(mappings_all=[])
        if "TOP 6 label" in s:
            return _ExecResult(mappings_all=[])
        if "FROM dbo.Recommendations" in s:
            return _ExecResult(mappings_all=[])
        if "FROM dbo.AIInteractions" in s:
            return _ExecResult(mappings_first=None)
        if "WITH Today AS" in s:
            row = type("R", (), {"d": "2026-01-01", "avg_score": None})()
            return _ExecResult(fetchall_val=[row])
        return _ExecResult(fetchone_val=None)

    def commit(self):
        self.commits += 1


# Checks journey series response shape.
def test_journey_series_returns_expected_shape():
    app = FastAPI()
    app.include_router(jr.router)
    db = FakeDB()
    app.dependency_overrides[jr.get_db] = lambda: db
    app.dependency_overrides[jr._user_id_from_authorization] = lambda: "user-1"
    client = TestClient(app)

    res = client.get("/journey/series")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
    assert "date" in res.json()[0]


# Checks journey overview main sections.
def test_journey_overview_returns_expected_sections():
    app = FastAPI()
    app.include_router(jr.router)
    db = FakeDB()
    app.dependency_overrides[jr.get_db] = lambda: db
    app.dependency_overrides[jr._user_id_from_authorization] = lambda: "user-1"
    client = TestClient(app)

    res = client.get("/journey/overview")
    assert res.status_code == 200
    body = res.json()
    assert "settings" in body
    assert "adherence" in body
    assert "today" in body



# Checks date formatting to YYYY-MM-DD.
def test_iso_formats_date_as_yyyy_mm_dd():
    assert jr._iso(date(2026, 4, 27)) == "2026-04-27"