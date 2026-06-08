from server.routers import positive_notifications_routes as pr
from types import SimpleNamespace
from fastapi import FastAPI
from fastapi.testclient import TestClient


# Fake settings row for notification tests.
class Row:
    def __init__(self, enabled=None, freq=None):
        self.positive_notif_enabled = enabled
        self.positive_notif_interval_minutes = freq


# Checks default settings when row is missing.
def test_row_to_settings_defaults_when_none():
    settings = pr._row_to_settings(None)
    assert settings.enabled is True
    assert settings.frequency_minutes == 60


# Checks settings are read from row.
def test_row_to_settings_reads_values():
    settings = pr._row_to_settings(Row(0, 90))
    assert settings.enabled is False
    assert settings.frequency_minutes == 90



# Fake query result for notification tests.
class FakeResult:
    def __init__(self, rows=None, rowcount=1):
        self._rows = rows or []
        self.rowcount = rowcount

    def fetchone(self):
        return self._rows[0] if self._rows else None


# Fake database for notification tests.
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


# Builds a fake app client for notification tests.
def build_client(db):
    app = FastAPI()
    app.include_router(pr.router)

    def override_db():
        yield db

    app.dependency_overrides[pr.get_db] = override_db
    app.dependency_overrides[pr._user_id_from_authorization] = lambda: "u1"
    return TestClient(app)


# Checks default notification settings are returned.
def test_get_positive_notifications_settings_defaults():
    db = FakeDB(responses=[FakeResult([])])
    client = build_client(db)
    res = client.get("/positive-notifications/settings")
    assert res.status_code == 200
    assert res.json()["enabled"] is True


# Checks notification settings insert works.
def test_update_positive_notifications_settings_insert_path():
    db = FakeDB(responses=[FakeResult(rowcount=0)])
    client = build_client(db)
    res = client.post(
        "/positive-notifications/settings",
        json={"enabled": False, "frequency_minutes": 120},
    )
    assert res.status_code == 200
    assert db.committed == 1


# Checks test notification is queued successfully.
def test_send_test_positive_notification_success():
    db = FakeDB(responses=[FakeResult([SimpleNamespace(token_id="t1")])])
    client = build_client(db)
    res = client.post("/positive-notifications/send-test", json={"body": "hello"})
    assert res.status_code == 204
    assert db.committed == 1