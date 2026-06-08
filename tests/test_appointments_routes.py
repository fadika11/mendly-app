# tests/test_appointments_routes.py
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.routers import appointments_routes as ap


# Fake query result for tests.
class FakeResult:
    def __init__(self, rows=None):
        self._rows = rows or []

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return self._rows


# Fake database for appointment tests.
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


# Builds a fake app client for appointment tests.
def build_client(db, user_id="u1"):
    app = FastAPI()
    app.include_router(ap.router)

    def override_db():
        yield db

    app.dependency_overrides[ap.get_db] = override_db
    app.dependency_overrides[ap._user_id_from_authorization] = lambda: user_id
    return TestClient(app)


def appointment_row(**overrides):
    data = {
        "appointment_id": "a1",
        "client_user_id": "u1",
        "client_username": "fadi",
        "client_email": "a@b.com",
        "psychologist_user_id": "p1",
        "intake_id": None,
        "availability_slot_id": "slot1",
        "start_at": "2026-04-10T10:00:00+00:00",
        "status": "requested",
        "notes": None,
        "created_at": "2026-04-01T10:00:00+00:00",
        "updated_at": None,
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def slot_row(**overrides):
    data = {
        "slot_id": "slot1",
        "psychologist_user_id": "u1",
        "start_at": "2026-04-10T10:00:00+00:00",
        "end_at": None,
        "is_booked": False,
        "appointment_id": None,
        "created_at": "2026-04-01T10:00:00+00:00",
    }
    data.update(overrides)
    return SimpleNamespace(**data)


# =====================
# Helpers
# =====================

def test_get_role_returns_role():
    db = FakeDB(responses=[FakeResult([SimpleNamespace(Role="regular")])])
    assert ap._get_role(db, "u1") == "regular"


def test_get_role_user_not_found():
    db = FakeDB(responses=[FakeResult([])])

    try:
        ap._get_role(db, "missing")
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 404
    else:
        raise AssertionError("Expected 404")


def test_appointment_public_from_row_formats_optional_fields():
    row = appointment_row(
        intake_id=None,
        availability_slot_id=None,
        updated_at=None,
    )

    result = ap._appointment_public_from_row(row)

    assert result.appointment_id == "a1"
    assert result.intake_id is None
    assert result.availability_slot_id is None
    assert result.updated_at is None


def test_slot_public_from_row_formats_optional_fields():
    row = slot_row(
        end_at=None,
        appointment_id=None,
        created_at=None,
    )

    result = ap._slot_public_from_row(row)

    assert result.slot_id == "slot1"
    assert result.end_at is None
    assert result.appointment_id is None
    assert result.created_at is None
    assert result.is_booked is False


# =====================
# Availability slots
# =====================

def test_create_availability_slot_success():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="psychologist")]),
            FakeResult([slot_row()]),
        ]
    )
    client = build_client(db)

    res = client.post(
        "/appointments/availability",
        json={
            "start_at": "2026-04-10T10:00:00+00:00",
            "end_at": "2026-04-10T11:00:00+00:00",
        },
    )

    assert res.status_code == 200
    assert res.json()["slot_id"] == "slot1"
    assert db.committed == 1


def test_create_availability_slot_rejects_regular_user():
    db = FakeDB(responses=[FakeResult([SimpleNamespace(Role="regular")])])
    client = build_client(db)

    res = client.post(
        "/appointments/availability",
        json={"start_at": "2026-04-10T10:00:00+00:00"},
    )

    assert res.status_code == 403
    assert db.committed == 0


def test_create_availability_slot_duplicate_returns_400():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="psychologist")]),
            Exception("UNIQUE constraint UQ_PsychologistAvailabilitySlots_PsyStart"),
        ]
    )
    client = build_client(db)

    res = client.post(
        "/appointments/availability",
        json={"start_at": "2026-04-10T10:00:00+00:00"},
    )

    assert res.status_code == 400
    assert "already exists" in res.text
    assert db.rolled_back == 1


def test_list_my_availability_slots_success():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="psychologist")]),
            FakeResult([slot_row(), slot_row(slot_id="slot2")]),
        ]
    )
    client = build_client(db)

    res = client.get("/appointments/availability/my")

    assert res.status_code == 200
    assert len(res.json()) == 2


def test_list_my_availability_slots_rejects_regular_user():
    db = FakeDB(responses=[FakeResult([SimpleNamespace(Role="regular")])])
    client = build_client(db)

    res = client.get("/appointments/availability/my")

    assert res.status_code == 403


def test_list_available_slots_for_user_booking_success():
    db = FakeDB(responses=[FakeResult([slot_row(psychologist_user_id="p1")])])
    client = build_client(db)

    res = client.get(
        "/appointments/availability",
        params={
            "psychologist_user_id": "p1",
            "date": "2026-04-10",
        },
    )

    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["psychologist_user_id"] == "p1"


def test_delete_availability_slot_success():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="psychologist")]),
            FakeResult([SimpleNamespace(slot_id="slot1", is_booked=False)]),
            FakeResult(),
        ]
    )
    client = build_client(db)

    res = client.delete("/appointments/availability/slot1")

    assert res.status_code == 200
    assert res.json()["ok"] is True
    assert db.committed == 1


def test_delete_availability_slot_rejects_regular_user():
    db = FakeDB(responses=[FakeResult([SimpleNamespace(Role="regular")])])
    client = build_client(db)

    res = client.delete("/appointments/availability/slot1")

    assert res.status_code == 403


def test_delete_availability_slot_not_found():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="psychologist")]),
            FakeResult([]),
        ]
    )
    client = build_client(db)

    res = client.delete("/appointments/availability/missing")

    assert res.status_code == 404


def test_delete_availability_slot_rejects_booked_slot():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="psychologist")]),
            FakeResult([SimpleNamespace(slot_id="slot1", is_booked=True)]),
        ]
    )
    client = build_client(db)

    res = client.delete("/appointments/availability/slot1")

    assert res.status_code == 400
    assert "already booked" in res.text


# =====================
# Intake
# =====================

def test_create_intake_success():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="regular")]),
            FakeResult(),
            FakeResult(
                [
                    SimpleNamespace(
                        intake_id="i1",
                        client_user_id="u1",
                        psychologist_user_id="p1",
                        answers_json='{"q":1}',
                        created_at="2026-04-01",
                    )
                ]
            ),
        ]
    )
    client = build_client(db)

    res = client.post(
        "/appointments/intake",
        json={"psychologist_user_id": "p1", "answers": {"q": 1}},
    )

    assert res.status_code == 200
    assert res.json()["psychologist_user_id"] == "p1"
    assert db.committed == 1


def test_create_intake_rejects_non_regular_user():
    db = FakeDB(responses=[FakeResult([SimpleNamespace(Role="psychologist")])])
    client = build_client(db)

    res = client.post(
        "/appointments/intake",
        json={"psychologist_user_id": "p1", "answers": {"q": 1}},
    )

    assert res.status_code == 403


def test_create_intake_created_but_not_found_returns_500():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="regular")]),
            FakeResult(),
            FakeResult([]),
        ]
    )
    client = build_client(db)

    res = client.post(
        "/appointments/intake",
        json={"psychologist_user_id": "p1", "answers": {"q": 1}},
    )

    assert res.status_code == 500


# =====================
# Create appointment
# =====================

def test_create_appointment_invalid_intake():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="regular")]),
            FakeResult([]),
        ]
    )
    client = build_client(db)

    res = client.post(
        "/appointments",
        json={
            "psychologist_user_id": "p1",
            "intake_id": "bad",
            "availability_slot_id": "slot1",
        },
    )

    assert res.status_code == 400


def test_create_appointment_success_from_available_slot():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="regular")]),
            FakeResult(
                [
                    SimpleNamespace(
                        slot_id="slot1",
                        psychologist_user_id="p1",
                        start_at="2026-04-10T10:00:00+00:00",
                        end_at=None,
                        is_booked=False,
                    )
                ]
            ),
            FakeResult([SimpleNamespace(appointment_id="a1")]),
            FakeResult(),
            FakeResult([appointment_row(status="requested")]),
        ]
    )
    client = build_client(db)

    res = client.post(
        "/appointments",
        json={
            "psychologist_user_id": "p1",
            "availability_slot_id": "slot1",
        },
    )

    assert res.status_code == 200
    assert res.json()["appointment_id"] == "a1"
    assert res.json()["availability_slot_id"] == "slot1"
    assert db.committed == 1


def test_create_appointment_rejects_non_regular_user():
    db = FakeDB(responses=[FakeResult([SimpleNamespace(Role="psychologist")])])
    client = build_client(db)

    res = client.post(
        "/appointments",
        json={
            "psychologist_user_id": "p1",
            "availability_slot_id": "slot1",
        },
    )

    assert res.status_code == 403


def test_create_appointment_slot_not_found():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="regular")]),
            FakeResult([]),
        ]
    )
    client = build_client(db)

    res = client.post(
        "/appointments",
        json={
            "psychologist_user_id": "p1",
            "availability_slot_id": "missing",
        },
    )

    assert res.status_code == 404
    assert db.rolled_back == 1


def test_create_appointment_slot_already_booked():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="regular")]),
            FakeResult(
                [
                    SimpleNamespace(
                        slot_id="slot1",
                        psychologist_user_id="p1",
                        start_at="2026-04-10T10:00:00+00:00",
                        end_at=None,
                        is_booked=True,
                    )
                ]
            ),
        ]
    )
    client = build_client(db)

    res = client.post(
        "/appointments",
        json={
            "psychologist_user_id": "p1",
            "availability_slot_id": "slot1",
        },
    )

    assert res.status_code == 400
    assert "already booked" in res.text
    assert db.rolled_back == 1


def test_create_appointment_created_but_not_found_returns_500():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="regular")]),
            FakeResult(
                [
                    SimpleNamespace(
                        slot_id="slot1",
                        psychologist_user_id="p1",
                        start_at="2026-04-10T10:00:00+00:00",
                        end_at=None,
                        is_booked=False,
                    )
                ]
            ),
            FakeResult([SimpleNamespace(appointment_id="a1")]),
            FakeResult(),
            FakeResult([]),
        ]
    )
    client = build_client(db)

    res = client.post(
        "/appointments",
        json={
            "psychologist_user_id": "p1",
            "availability_slot_id": "slot1",
        },
    )

    assert res.status_code == 500


def test_create_appointment_unexpected_db_error_rolls_back():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="regular")]),
            Exception("database exploded"),
        ]
    )
    client = build_client(db)

    try:
        client.post(
            "/appointments",
            json={
                "psychologist_user_id": "p1",
                "availability_slot_id": "slot1",
            },
        )
    except Exception:
        pass

    assert db.rolled_back == 1


# =====================
# Psychologist appointment list
# =====================

def test_list_psy_appointments_success():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="psychologist")]),
            FakeResult([appointment_row()]),
        ]
    )
    client = build_client(db, user_id="p1")

    res = client.get("/appointments/psy")

    assert res.status_code == 200
    assert len(res.json()) == 1


def test_list_psy_appointments_rejects_regular_user():
    db = FakeDB(responses=[FakeResult([SimpleNamespace(Role="regular")])])
    client = build_client(db)

    res = client.get("/appointments/psy")

    assert res.status_code == 403


def test_list_psy_appointments_with_status_filter():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="psychologist")]),
            FakeResult([appointment_row(status="approved")]),
        ]
    )
    client = build_client(db, user_id="p1")

    res = client.get("/appointments/psy", params={"status_filter": "approved"})

    assert res.status_code == 200
    assert res.json()[0]["status"] == "approved"

    assert any(
        params and params.get("st") == "approved"
        for _query, params in db.executed
    )


# =====================
# Intake view
# =====================

def test_get_intake_success():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="psychologist")]),
            FakeResult(
                [
                    SimpleNamespace(
                        intake_id="i1",
                        client_user_id="u1",
                        psychologist_user_id="p1",
                        answers_json='{"q":1}',
                        created_at="2026-04-01",
                    )
                ]
            ),
        ]
    )
    client = build_client(db, user_id="p1")

    res = client.get("/appointments/intake/i1")

    assert res.status_code == 200
    assert res.json()["intake_id"] == "i1"


def test_get_intake_rejects_regular_user():
    db = FakeDB(responses=[FakeResult([SimpleNamespace(Role="regular")])])
    client = build_client(db)

    res = client.get("/appointments/intake/i1")

    assert res.status_code == 403


def test_get_intake_not_found():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="psychologist")]),
            FakeResult([]),
        ]
    )
    client = build_client(db, user_id="p1")

    res = client.get("/appointments/intake/missing")

    assert res.status_code == 404


# =====================
# Status update
# =====================

def test_update_appointment_status_sends_email(monkeypatch):
    sent = {}

    def fake_send_email(to_email, subject, body):
        sent["to"] = to_email
        sent["subject"] = subject
        sent["body"] = body

    monkeypatch.setattr(ap, "send_email", fake_send_email)

    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="psychologist")]),
            FakeResult(),
            FakeResult([appointment_row(status="approved", notes="ok")]),
        ]
    )
    client = build_client(db, user_id="p1")

    res = client.put(
        "/appointments/a1/status",
        json={"status": "approved", "notes": "ok"},
    )

    assert res.status_code == 200
    assert sent["to"] == "a@b.com"
    assert "approved" in sent["subject"].lower()
    assert db.committed == 1


def test_update_appointment_status_rejects_regular_user():
    db = FakeDB(responses=[FakeResult([SimpleNamespace(Role="regular")])])
    client = build_client(db)

    res = client.put(
        "/appointments/a1/status",
        json={"status": "approved", "notes": "ok"},
    )

    assert res.status_code == 403


def test_update_appointment_status_rejects_invalid_status():
    db = FakeDB(responses=[FakeResult([SimpleNamespace(Role="psychologist")])])
    client = build_client(db, user_id="p1")

    res = client.put(
        "/appointments/a1/status",
        json={"status": "bad", "notes": "ok"},
    )

    assert res.status_code == 400
    assert "Invalid status" in res.text


def test_update_appointment_status_rejected_sends_email_and_releases_slot(monkeypatch):
    sent = {}

    def fake_send_email(to_email, subject, body):
        sent["to"] = to_email
        sent["subject"] = subject
        sent["body"] = body

    monkeypatch.setattr(ap, "send_email", fake_send_email)

    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="psychologist")]),
            FakeResult(),
            FakeResult(),
            FakeResult([appointment_row(status="rejected")]),
        ]
    )
    client = build_client(db, user_id="p1")

    res = client.put(
        "/appointments/a1/status",
        json={"status": "rejected", "notes": "not available"},
    )

    assert res.status_code == 200
    assert sent["to"] == "a@b.com"
    assert "declined" in sent["subject"].lower()
    assert any("SET s.is_booked = 0" in q for q, _ in db.executed)


def test_update_appointment_status_canceled_releases_slot_without_email(monkeypatch):
    sent = {"called": False}

    def fake_send_email(to_email, subject, body):
        sent["called"] = True

    monkeypatch.setattr(ap, "send_email", fake_send_email)

    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="psychologist")]),
            FakeResult(),
            FakeResult(),
            FakeResult([appointment_row(status="canceled")]),
        ]
    )
    client = build_client(db, user_id="p1")

    res = client.put(
        "/appointments/a1/status",
        json={"status": "canceled", "notes": "canceled"},
    )

    assert res.status_code == 200
    assert sent["called"] is False
    assert any("SET s.is_booked = 0" in q for q, _ in db.executed)


def test_update_appointment_status_completed_no_email(monkeypatch):
    sent = {"called": False}

    def fake_send_email(to_email, subject, body):
        sent["called"] = True

    monkeypatch.setattr(ap, "send_email", fake_send_email)

    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="psychologist")]),
            FakeResult(),
            FakeResult([appointment_row(status="completed")]),
        ]
    )
    client = build_client(db, user_id="p1")

    res = client.put(
        "/appointments/a1/status",
        json={"status": "completed", "notes": "done"},
    )

    assert res.status_code == 200
    assert sent["called"] is False


def test_update_appointment_status_appointment_not_found():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="psychologist")]),
            FakeResult(),
            FakeResult([]),
        ]
    )
    client = build_client(db, user_id="p1")

    res = client.put(
        "/appointments/a1/status",
        json={"status": "approved", "notes": "ok"},
    )

    assert res.status_code == 404
    assert db.committed == 1


def test_update_appointment_status_without_client_email_does_not_send_email(monkeypatch):
    sent = {"called": False}

    def fake_send_email(to_email, subject, body):
        sent["called"] = True

    monkeypatch.setattr(ap, "send_email", fake_send_email)

    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(Role="psychologist")]),
            FakeResult(),
            FakeResult([appointment_row(status="approved", client_email=None)]),
        ]
    )
    client = build_client(db, user_id="p1")

    res = client.put(
        "/appointments/a1/status",
        json={"status": "approved", "notes": "ok"},
    )

    assert res.status_code == 200
    assert sent["called"] is False