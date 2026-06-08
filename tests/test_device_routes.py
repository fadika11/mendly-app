from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.routers import device_routes as dr


# Fake query object for device tests.
class FakeQuery:
    def __init__(self, token=None):
        self._token = token

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._token


# Fake database for device tests.
class FakeDB:
    def __init__(self, existing=None):
        self.existing = existing
        self.added = []
        self.committed = 0

    def query(self, model):
        return FakeQuery(self.existing)

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        self.committed += 1


# Builds a fake app client for device tests.
def build_client(db):
    app = FastAPI()
    app.include_router(dr.router)

    def override_db():
        yield db

    app.dependency_overrides[dr.deps.get_db] = override_db
    app.dependency_overrides[dr.auth.get_current_user] = lambda: SimpleNamespace(user_id="u1")
    return TestClient(app)


# Checks invalid platform is rejected.
def test_register_device_rejects_invalid_platform():
    client = build_client(FakeDB())
    res = client.post(
        "/devices/register",
        json={"platform": "web", "fcm_token": "abc", "app_version": "1"},
    )
    assert res.status_code == 400


# Checks new device token is added.
def test_register_device_adds_new_token():
    db = FakeDB(existing=None)
    client = build_client(db)

    res = client.post(
        "/devices/register",
        json={"platform": "android", "fcm_token": "abc", "app_version": "1"},
    )

    assert res.status_code == 200
    assert len(db.added) == 1
    assert db.committed == 1


# Checks existing device token is updated.
def test_register_device_updates_existing_token():
    existing = SimpleNamespace(
        user_id="old",
        platform="ios",
        app_version="0",
        is_active=False,
    )
    db = FakeDB(existing=existing)
    client = build_client(db)

    res = client.post(
        "/devices/register",
        json={"platform": "android", "fcm_token": "abc", "app_version": "2"},
    )

    assert res.status_code == 200
    assert existing.user_id == "u1"
    assert existing.platform == "android"
    assert existing.app_version == "2"
    assert existing.is_active is True