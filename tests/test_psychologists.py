from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.routers import psychologist_routes as psy_private
from server.routers import psychologists_routes as psy_public


# Fake query result for psychologist tests.
class FakeResult:
    def __init__(self, rows=None):
        self._rows = rows or []

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return self._rows


# Fake database for psychologist tests.
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


# Builds a fake app client for public psychologist routes.
def build_public_client(db):
    app = FastAPI()
    app.include_router(psy_public.router)

    def override_db():
        yield db

    app.dependency_overrides[psy_public.get_db] = override_db
    app.dependency_overrides[psy_public._user_id_from_authorization] = lambda: "psy1"
    return TestClient(app)


# Builds a fake app client for private psychologist routes.
def build_private_client(db):
    app = FastAPI()
    app.include_router(psy_private.router)

    def override_db():
        yield db

    app.dependency_overrides[psy_private.get_db] = override_db
    app.dependency_overrides[psy_private._user_id_from_authorization] = lambda: "psy1"
    return TestClient(app)


# Checks psychologist list is returned.
def test_list_psychologists_success():
    db = FakeDB(
        responses=[
            FakeResult(
                [
                    SimpleNamespace(
                        user_id="p1",
                        Username="psy",
                        Email="p@b.com",
                        specialty="stress",
                        workplace="clinic",
                        city="Haifa",
                        bio="bio",
                        years_experience=5,
                        license_number="LIC",
                    )
                ]
            )
        ]
    )
    client = build_public_client(db)
    res = client.get("/psychologists")
    assert res.status_code == 200
    assert res.json()[0]["license_number"] == "LIC"


# Checks non-psychologist cannot update profile.
def test_update_psychologist_profile_rejects_non_psychologist():
    db = FakeDB(responses=[FakeResult([SimpleNamespace(Role="regular")])])
    client = build_public_client(db)
    res = client.put(
        "/psychologist-profile",
        json={"specialty": "s", "workplace": "w", "city": "c", "bio": "b"},
    )
    assert res.status_code == 403


# Checks missing psychologist returns not found.
def test_get_psychologist_not_found():
    db = FakeDB(responses=[FakeResult([])])
    client = build_public_client(db)
    res = client.get("/psychologists/missing")
    assert res.status_code == 404


# Checks non-psychologist is rejected.
def test_require_psychologist_raises_for_non_psy():
    db = FakeDB(responses=[FakeResult([SimpleNamespace(user_id="u1", Role="regular")])])
    try:
        psy_private._require_psychologist("u1", db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 403
    else:
        raise AssertionError("Expected 403")


# Checks psychologist clients list is returned.
def test_list_my_clients_success():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(user_id="psy1", Role="psychologist")]),
            FakeResult(
                [
                    SimpleNamespace(
                        user_id="u1",
                        Username="fadi",
                        Email="a@b.com",
                        Age=20,
                        Gender=2,
                        appointments_count=1,
                        last_appointment_at=None,
                    )
                ]
            ),
        ]
    )
    client = build_private_client(db)
    res = client.get("/psy/clients")
    assert res.status_code == 200
    assert res.json()[0]["username"] == "fadi"


# Checks psychologist appointments list is returned.
def test_list_my_appointments_success():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(user_id="psy1", Role="psychologist")]),
            FakeResult(
                [
                    SimpleNamespace(
                        appointment_id="a1",
                        client_user_id="u1",
                        client_username="fadi",
                        client_email="a@b.com",
                        client_age=20,
                        client_gender=2,
                        intake_id=None,
                        answers_json=None,
                        start_at=None,
                        status="requested",
                        notes=None,
                        created_at=None,
                        updated_at=None,
                    )
                ]
            ),
        ]
    )
    client = build_private_client(db)
    res = client.get("/psy/appointments")
    assert res.status_code == 200
    assert len(res.json()) == 1