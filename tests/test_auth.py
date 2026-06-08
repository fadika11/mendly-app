# tests/test_auth.py
import types
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from server import auth
from server.routers import auth_routes as ar


# Fake query result for auth tests.
class FakeResult:
    def __init__(self, rows=None, rowcount=1):
        self._rows = rows or []
        self.rowcount = rowcount

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return self._rows


# Fake database for auth tests.
class FakeDB:
    def __init__(self, responses=None, rows=None):
        if responses is not None:
            self.responses = list(responses)
        elif rows is not None:
            self.responses = list(rows)
        else:
            self.responses = []

        self.executed = []
        self.committed = 0
        self.rolled_back = 0

    def execute(self, query, params=None):
        self.executed.append((str(query), params))

        if self.responses:
            item = self.responses.pop(0)

            if isinstance(item, Exception):
                raise item

            if isinstance(item, FakeResult):
                return item

            return FakeResult([item] if item is not None else [])

        return FakeResult()

    def commit(self):
        self.committed += 1

    def rollback(self):
        self.rolled_back += 1


# Builds a fake app client for auth routes.
def build_client(db):
    app = FastAPI()
    app.include_router(ar.router)

    def override_db():
        yield db

    app.dependency_overrides[ar.get_db] = override_db
    return TestClient(app)


# Builds a fake app client with token dependency overridden.
def build_authed_client(db, user_id="u1", current_user=None):
    app = FastAPI()
    app.include_router(ar.router)

    def override_db():
        yield db

    app.dependency_overrides[ar.get_db] = override_db
    app.dependency_overrides[ar._user_id_from_authorization] = lambda: user_id

    if current_user is not None:
        app.dependency_overrides[ar.get_current_user] = lambda: current_user

    return TestClient(app)


def make_integrity_error():
    return IntegrityError("stmt", "params", Exception("integrity"))


# =========================
# server/auth.py helpers
# =========================

def test_hash_password_and_verify_password_roundtrip():
    hashed = auth.hash_password("abc12345")
    assert hashed != "abc12345"
    assert auth.verify_password("abc12345", hashed) is True
    assert auth.verify_password("wrongpass", hashed) is False


def test_create_access_token_contains_sub_claim():
    token = auth.create_access_token({"sub": "user-123", "username": "fadi"})
    assert isinstance(token, str)
    assert len(token) > 20


def test_create_access_token_for_user_builds_standard_claims():
    row = types.SimpleNamespace(user_id="u1", Username="bashar", is_admin=True)
    token = auth.create_access_token_for_user(row)
    assert isinstance(token, str)
    assert len(token) > 20


@pytest.mark.asyncio
async def test_get_current_admin_allows_admin():
    user = types.SimpleNamespace(is_admin=True)
    result = await auth.get_current_admin(current_user=user)
    assert result is user


@pytest.mark.asyncio
async def test_get_current_admin_rejects_non_admin():
    user = types.SimpleNamespace(is_admin=False)
    with pytest.raises(HTTPException) as exc:
        await auth.get_current_admin(current_user=user)

    assert exc.value.status_code == 403
    assert exc.value.detail == "Admin only"


def test_get_user_by_username_returns_row():
    row = SimpleNamespace(user_id="u1", Username="fadi")
    db = FakeDB(rows=[row])

    result = auth.get_user_by_username(db, "fadi")

    assert result is row


def test_get_user_by_id_returns_row():
    row = SimpleNamespace(user_id="u1", Username="fadi")
    db = FakeDB(rows=[row])

    result = auth.get_user_by_id(db, "u1")

    assert result is row


def test_authenticate_user_returns_none_when_user_missing():
    db = FakeDB(rows=[None])

    result = auth.authenticate_user(db, "fadi", "secret")

    assert result is None


def test_authenticate_user_returns_none_when_password_missing():
    row = SimpleNamespace(user_id="u1", Username="fadi", Password=None)
    db = FakeDB(rows=[row])

    result = auth.authenticate_user(db, "fadi", "secret")

    assert result is None


def test_authenticate_user_returns_none_when_password_wrong(monkeypatch):
    row = SimpleNamespace(user_id="u1", Username="fadi", Password="HASH")
    db = FakeDB(rows=[row])

    monkeypatch.setattr(auth, "verify_password", lambda plain, hashed: False)

    result = auth.authenticate_user(db, "fadi", "wrong")

    assert result is None


def test_authenticate_user_returns_user_when_password_ok(monkeypatch):
    row = SimpleNamespace(user_id="u1", Username="fadi", Password="HASH")
    db = FakeDB(rows=[row])

    monkeypatch.setattr(auth, "verify_password", lambda plain, hashed: True)

    result = auth.authenticate_user(db, "fadi", "secret")

    assert result is row


@pytest.mark.asyncio
async def test_get_current_user_success():
    token = auth.create_access_token({"sub": "u1", "username": "fadi"})
    row = SimpleNamespace(user_id="u1", Username="fadi")
    db = FakeDB(rows=[row])

    user = await auth.get_current_user(token=token, db=db)

    assert user is row


@pytest.mark.asyncio
async def test_get_current_user_rejects_invalid_token():
    db = FakeDB(rows=[])

    with pytest.raises(HTTPException) as exc:
        await auth.get_current_user(token="bad-token", db=db)

    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_rejects_missing_sub():
    token = auth.jwt.encode({"username": "fadi"}, auth.SECRET_KEY, algorithm=auth.ALGORITHM)
    db = FakeDB(rows=[])

    with pytest.raises(HTTPException) as exc:
        await auth.get_current_user(token=token, db=db)

    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_rejects_when_user_not_found():
    token = auth.create_access_token({"sub": "u1", "username": "fadi"})
    db = FakeDB(rows=[None])

    with pytest.raises(HTTPException) as exc:
        await auth.get_current_user(token=token, db=db)

    assert exc.value.status_code == 401


# =========================
# License helpers
# =========================

def test_normalize_psychologist_license_success():
    assert ar.normalize_psychologist_license("27-147619") == "27-147619"


def test_normalize_psychologist_license_removes_spaces():
    assert ar.normalize_psychologist_license("27- 147619") == "27-147619"


def test_normalize_psychologist_license_rejects_empty():
    with pytest.raises(HTTPException) as exc:
        ar.normalize_psychologist_license("   ")

    assert exc.value.status_code == 400


def test_normalize_psychologist_license_rejects_bad_format():
    with pytest.raises(HTTPException) as exc:
        ar.normalize_psychologist_license("LIC123")

    assert exc.value.status_code == 400


def test_verify_psychologist_license_with_moh_returns_true(monkeypatch):
    class FakeResponse:
        status_code = 200
        text = "Psychologists 27-147619 פסיכולוגים בעלי רשיון"

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def get(self, url):
            assert "27-147619" in url
            return FakeResponse()

    monkeypatch.setattr(ar.httpx, "Client", FakeClient)

    assert ar.verify_psychologist_license_with_moh("27-147619") is True


def test_verify_psychologist_license_with_moh_returns_false_on_non_200(monkeypatch):
    class FakeResponse:
        status_code = 500
        text = ""

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def get(self, url):
            return FakeResponse()

    monkeypatch.setattr(ar.httpx, "Client", FakeClient)

    assert ar.verify_psychologist_license_with_moh("27-147619") is False


def test_verify_psychologist_license_with_moh_returns_false_on_no_results(monkeypatch):
    class FakeResponse:
        status_code = 200
        text = "Psychologists 27-147619 groupTitleFound 0"

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def get(self, url):
            return FakeResponse()

    monkeypatch.setattr(ar.httpx, "Client", FakeClient)

    assert ar.verify_psychologist_license_with_moh("27-147619") is False


def test_verify_psychologist_license_with_moh_returns_false_on_exception(monkeypatch):
    class FakeClient:
        def __init__(self, *args, **kwargs):
            raise RuntimeError("network down")

    monkeypatch.setattr(ar.httpx, "Client", FakeClient)

    assert ar.verify_psychologist_license_with_moh("27-147619") is False


# =========================
# Regular signup/login
# =========================

def test_signup_success(monkeypatch):
    db = FakeDB(
        responses=[
            FakeResult([]),
            FakeResult(),
            FakeResult(
                [
                    SimpleNamespace(
                        user_id="u1",
                        Username="fadi",
                        Email="a@b.com",
                        Age=20,
                        Gender=2,
                        Role="regular",
                    )
                ]
            ),
        ]
    )

    monkeypatch.setattr(ar, "hash_password", lambda p: "HASHED")
    client = build_client(db)

    res = client.post(
        "/auth/signup",
        json={
            "username": "fadi",
            "email": "a@b.com",
            "password": "secret123",
            "age": 20,
            "gender": 2,
        },
    )

    assert res.status_code == 200
    assert res.json()["role"] == "regular"
    assert db.committed == 1


def test_signup_duplicate_returns_400():
    db = FakeDB(responses=[FakeResult([SimpleNamespace(user_id="u1")])])
    client = build_client(db)

    res = client.post(
        "/auth/signup",
        json={
            "username": "fadi",
            "email": "a@b.com",
            "password": "secret123",
            "age": 20,
            "gender": 2,
        },
    )

    assert res.status_code == 400


def test_signup_integrity_error_returns_400(monkeypatch):
    db = FakeDB(
        responses=[
            FakeResult([]),
            make_integrity_error(),
        ]
    )

    monkeypatch.setattr(ar, "hash_password", lambda p: "HASHED")
    client = build_client(db)

    res = client.post(
        "/auth/signup",
        json={
            "username": "fadi",
            "email": "a@b.com",
            "password": "secret123",
            "age": 20,
            "gender": 2,
        },
    )

    assert res.status_code == 400
    assert db.rolled_back == 1


def test_signup_created_but_not_found_returns_500(monkeypatch):
    db = FakeDB(
        responses=[
            FakeResult([]),
            FakeResult(),
            FakeResult([]),
        ]
    )

    monkeypatch.setattr(ar, "hash_password", lambda p: "HASHED")
    client = build_client(db)

    res = client.post(
        "/auth/signup",
        json={
            "username": "fadi",
            "email": "a@b.com",
            "password": "secret123",
            "age": 20,
            "gender": 2,
        },
    )

    assert res.status_code == 500


def test_login_success(monkeypatch):
    db = FakeDB(
        responses=[
            FakeResult(
                [
                    SimpleNamespace(
                        user_id="u1",
                        Username="fadi",
                        Email="a@b.com",
                        Password="HASH",
                        Role="regular",
                    )
                ]
            )
        ]
    )

    monkeypatch.setattr(ar, "verify_password", lambda plain, hashed: True)
    monkeypatch.setattr(ar, "create_access_token", lambda data: "TOKEN123")
    client = build_client(db)

    res = client.post("/auth/login", json={"username": "fadi", "password": "secret123"})

    assert res.status_code == 200
    data = res.json()
    assert data["access_token"] == "TOKEN123"
    assert data["role"] == "regular"


def test_login_user_not_found():
    db = FakeDB(responses=[FakeResult([])])
    client = build_client(db)

    res = client.post("/auth/login", json={"username": "missing", "password": "secret123"})

    assert res.status_code == 401


def test_login_invalid_password(monkeypatch):
    db = FakeDB(
        responses=[
            FakeResult(
                [
                    SimpleNamespace(
                        user_id="u1",
                        Username="fadi",
                        Email="a@b.com",
                        Password="HASH",
                        Role="regular",
                    )
                ]
            )
        ]
    )

    monkeypatch.setattr(ar, "verify_password", lambda plain, hashed: False)
    client = build_client(db)

    res = client.post("/auth/login", json={"username": "fadi", "password": "wrongpass"})

    assert res.status_code == 401


# =========================
# Psychologist signup
# =========================

def test_signup_psychologist_success(monkeypatch):
    db = FakeDB(
        responses=[
            FakeResult([]),
            FakeResult([]),
            FakeResult(),
            FakeResult(
                [
                    SimpleNamespace(
                        user_id="p1",
                        Username="psy",
                        Email="p@b.com",
                        Age=33,
                        Gender=1,
                        Role="psychologist",
                    )
                ]
            ),
            FakeResult(),
        ]
    )

    monkeypatch.setattr(ar, "hash_password", lambda p: "HASHED")
    monkeypatch.setattr(ar, "verify_psychologist_license_with_moh", lambda lic: True)

    client = build_client(db)

    res = client.post(
        "/auth/signup-psychologist",
        json={
            "username": "psy",
            "email": "p@b.com",
            "password": "secret123",
            "age": 33,
            "gender": 1,
            "license_number": "27-147619",
        },
    )

    assert res.status_code == 200
    assert res.json()["role"] == "psychologist"


def test_signup_psychologist_rejects_invalid_license(monkeypatch):
    monkeypatch.setattr(ar, "verify_psychologist_license_with_moh", lambda lic: False)

    db = FakeDB()
    client = build_client(db)

    res = client.post(
        "/auth/signup-psychologist",
        json={
            "username": "psy",
            "email": "p@b.com",
            "password": "secret123",
            "age": 33,
            "gender": 1,
            "license_number": "27-147619",
        },
    )

    assert res.status_code == 400


def test_signup_psychologist_rejects_duplicate_username_or_email(monkeypatch):
    monkeypatch.setattr(ar, "verify_psychologist_license_with_moh", lambda lic: True)

    db = FakeDB(responses=[FakeResult([SimpleNamespace(user_id="existing")])])
    client = build_client(db)

    res = client.post(
        "/auth/signup-psychologist",
        json={
            "username": "psy",
            "email": "p@b.com",
            "password": "secret123",
            "age": 33,
            "gender": 1,
            "license_number": "27-147619",
        },
    )

    assert res.status_code == 400
    assert "already in use" in res.text


def test_signup_psychologist_rejects_duplicate_license(monkeypatch):
    monkeypatch.setattr(ar, "verify_psychologist_license_with_moh", lambda lic: True)

    db = FakeDB(
        responses=[
            FakeResult([]),
            FakeResult([SimpleNamespace(user_id="p2")]),
        ]
    )
    client = build_client(db)

    res = client.post(
        "/auth/signup-psychologist",
        json={
            "username": "psy",
            "email": "p@b.com",
            "password": "secret123",
            "age": 33,
            "gender": 1,
            "license_number": "27-147619",
        },
    )

    assert res.status_code == 400
    assert "License number already in use" in res.text


def test_signup_psychologist_user_insert_integrity_error(monkeypatch):
    monkeypatch.setattr(ar, "verify_psychologist_license_with_moh", lambda lic: True)
    monkeypatch.setattr(ar, "hash_password", lambda p: "HASHED")

    db = FakeDB(
        responses=[
            FakeResult([]),
            FakeResult([]),
            make_integrity_error(),
        ]
    )
    client = build_client(db)

    res = client.post(
        "/auth/signup-psychologist",
        json={
            "username": "psy",
            "email": "p@b.com",
            "password": "secret123",
            "age": 33,
            "gender": 1,
            "license_number": "27-147619",
        },
    )

    assert res.status_code == 400
    assert db.rolled_back == 1


def test_signup_psychologist_user_created_but_not_found(monkeypatch):
    monkeypatch.setattr(ar, "verify_psychologist_license_with_moh", lambda lic: True)
    monkeypatch.setattr(ar, "hash_password", lambda p: "HASHED")

    db = FakeDB(
        responses=[
            FakeResult([]),
            FakeResult([]),
            FakeResult(),
            FakeResult([]),
        ]
    )
    client = build_client(db)

    res = client.post(
        "/auth/signup-psychologist",
        json={
            "username": "psy",
            "email": "p@b.com",
            "password": "secret123",
            "age": 33,
            "gender": 1,
            "license_number": "27-147619",
        },
    )

    assert res.status_code == 500
    assert db.rolled_back == 1


def test_signup_psychologist_profile_insert_integrity_error_deletes_user(monkeypatch):
    monkeypatch.setattr(ar, "verify_psychologist_license_with_moh", lambda lic: True)
    monkeypatch.setattr(ar, "hash_password", lambda p: "HASHED")

    db = FakeDB(
        responses=[
            FakeResult([]),
            FakeResult([]),
            FakeResult(),
            FakeResult(
                [
                    SimpleNamespace(
                        user_id="p1",
                        Username="psy",
                        Email="p@b.com",
                        Age=33,
                        Gender=1,
                        Role="psychologist",
                    )
                ]
            ),
            make_integrity_error(),
            FakeResult(),
        ]
    )
    client = build_client(db)

    res = client.post(
        "/auth/signup-psychologist",
        json={
            "username": "psy",
            "email": "p@b.com",
            "password": "secret123",
            "age": 33,
            "gender": 1,
            "license_number": "27-147619",
        },
    )

    assert res.status_code == 400
    assert db.rolled_back == 1
    assert any("DELETE FROM dbo.Users" in q for q, _ in db.executed)


def test_signup_psychologist_profile_insert_unexpected_error_deletes_user(monkeypatch):
    monkeypatch.setattr(ar, "verify_psychologist_license_with_moh", lambda lic: True)
    monkeypatch.setattr(ar, "hash_password", lambda p: "HASHED")

    db = FakeDB(
        responses=[
            FakeResult([]),
            FakeResult([]),
            FakeResult(),
            FakeResult(
                [
                    SimpleNamespace(
                        user_id="p1",
                        Username="psy",
                        Email="p@b.com",
                        Age=33,
                        Gender=1,
                        Role="psychologist",
                    )
                ]
            ),
            RuntimeError("profile insert failed"),
            FakeResult(),
        ]
    )

    client = build_client(db)

    with pytest.raises(RuntimeError):
        client.post(
            "/auth/signup-psychologist",
            json={
                "username": "psy",
                "email": "p@b.com",
                "password": "secret123",
                "age": 33,
                "gender": 1,
                "license_number": "27-147619",
            },
        )

    assert db.rolled_back == 1
    assert any("DELETE FROM dbo.Users" in q for q, _ in db.executed)


# =========================
# Forgot password
# =========================

def test_generate_reset_code_shape():
    code = ar.generate_reset_code()
    assert len(code) == 6
    assert code.isdigit()


def test_send_reset_email_no_credentials(monkeypatch):
    monkeypatch.setenv("EMAIL", "")
    monkeypatch.setenv("EMAILPASSWORD", "")
    ar.send_reset_email("a@b.com", "123456")


def test_send_reset_email_success(monkeypatch):
    monkeypatch.setenv("EMAIL", "sender@example.com")
    monkeypatch.setenv("EMAILPASSWORD", "app-pass")

    events = {"started": False, "logged_in": False, "sent": False}

    class FakeSMTP:
        def __init__(self, host, port):
            assert host == "smtp.gmail.com"
            assert port == 587

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def starttls(self):
            events["started"] = True

        def login(self, user, password):
            assert user == "sender@example.com"
            assert password == "app-pass"
            events["logged_in"] = True

        def send_message(self, msg):
            assert msg["To"] == "to@example.com"
            events["sent"] = True

    monkeypatch.setattr(ar.smtplib, "SMTP", FakeSMTP)

    ar.send_reset_email("to@example.com", "123456")

    assert events["started"] is True
    assert events["logged_in"] is True
    assert events["sent"] is True


def test_send_reset_email_smtp_exception_is_caught(monkeypatch):
    monkeypatch.setenv("EMAIL", "sender@example.com")
    monkeypatch.setenv("EMAILPASSWORD", "app-pass")

    class FakeSMTP:
        def __init__(self, host, port):
            pass

        def __enter__(self):
            raise RuntimeError("smtp down")

        def __exit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr(ar.smtplib, "SMTP", FakeSMTP)

    ar.send_reset_email("to@example.com", "123456")


def test_forgot_password_start_known_email_sends_code(monkeypatch):
    ar.RESET_CODES.clear()
    sent = {}

    def fake_send(email, code):
        sent["email"] = email
        sent["code"] = code

    monkeypatch.setattr(ar, "send_reset_email", fake_send)

    db = FakeDB(responses=[FakeResult([SimpleNamespace(user_id="u1")])])
    client = build_client(db)

    res = client.post("/auth/forgot-password/start", json={"email": "a@b.com"})

    assert res.status_code == 200
    assert sent["email"] == "a@b.com"
    assert len(sent["code"]) == 6
    assert "a@b.com" in ar.RESET_CODES


def test_forgot_password_start_unknown_email_still_returns_ok(monkeypatch):
    ar.RESET_CODES.clear()
    sent = {"called": False}

    def fake_send(email, code):
        sent["called"] = True

    monkeypatch.setattr(ar, "send_reset_email", fake_send)

    db = FakeDB(responses=[FakeResult([])])
    client = build_client(db)

    res = client.post("/auth/forgot-password/start", json={"email": "missing@b.com"})

    assert res.status_code == 200
    assert sent["called"] is False


def test_forgot_password_verify_success(monkeypatch):
    ar.RESET_CODES.clear()
    monkeypatch.setattr(ar, "hash_password", lambda p: "NEW_HASH")

    ar.RESET_CODES["a@b.com"] = {
        "code": "123456",
        "expires_at": ar.datetime.now(ar.timezone.utc) + ar.timedelta(minutes=10),
    }

    db = FakeDB()
    client = build_client(db)

    res = client.post(
        "/auth/forgot-password/verify",
        json={
            "email": "a@b.com",
            "code": "123456",
            "new_password": "newsecret123",
        },
    )

    assert res.status_code == 200
    assert db.committed == 1
    assert "a@b.com" not in ar.RESET_CODES


def test_forgot_password_verify_missing_code():
    ar.RESET_CODES.clear()
    db = FakeDB()
    client = build_client(db)

    res = client.post(
        "/auth/forgot-password/verify",
        json={
            "email": "a@b.com",
            "code": "999999",
            "new_password": "newsecret123",
        },
    )

    assert res.status_code == 400


def test_forgot_password_verify_invalid_entry_shape():
    ar.RESET_CODES.clear()
    ar.RESET_CODES["a@b.com"] = {
        "code": 123456,
        "expires_at": "bad-date",
    }

    db = FakeDB()
    client = build_client(db)

    res = client.post(
        "/auth/forgot-password/verify",
        json={
            "email": "a@b.com",
            "code": "123456",
            "new_password": "newsecret123",
        },
    )

    assert res.status_code == 400


def test_forgot_password_verify_wrong_code():
    ar.RESET_CODES.clear()
    ar.RESET_CODES["a@b.com"] = {
        "code": "111111",
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
    }

    db = FakeDB()
    client = build_client(db)

    res = client.post(
        "/auth/forgot-password/verify",
        json={
            "email": "a@b.com",
            "code": "999999",
            "new_password": "newsecret123",
        },
    )

    assert res.status_code == 400


def test_forgot_password_verify_expired_code():
    ar.RESET_CODES.clear()
    ar.RESET_CODES["a@b.com"] = {
        "code": "111111",
        "expires_at": datetime.now(timezone.utc) - timedelta(minutes=1),
    }

    db = FakeDB()
    client = build_client(db)

    res = client.post(
        "/auth/forgot-password/verify",
        json={
            "email": "a@b.com",
            "code": "111111",
            "new_password": "newsecret123",
        },
    )

    assert res.status_code == 400
    assert "a@b.com" not in ar.RESET_CODES


# =========================
# Authorization helper
# =========================

def test_user_id_from_authorization_success():
    token = ar.jwt.encode({"sub": "u1"}, ar.JWT_SECRET, algorithm=ar.JWT_ALG)

    assert ar._user_id_from_authorization(f"Bearer {token}") == "u1"


def test_user_id_from_authorization_rejects_bad_header():
    try:
        ar._user_id_from_authorization("Bad token")
    except HTTPException as exc:
        assert exc.status_code == 401
    else:
        raise AssertionError("Expected HTTPException")


def test_user_id_from_authorization_rejects_invalid_jwt():
    with pytest.raises(HTTPException) as exc:
        ar._user_id_from_authorization("Bearer bad-token")

    assert exc.value.status_code == 401


def test_user_id_from_authorization_rejects_missing_sub():
    token = ar.jwt.encode({"username": "fadi"}, ar.JWT_SECRET, algorithm=ar.JWT_ALG)

    with pytest.raises(HTTPException) as exc:
        ar._user_id_from_authorization(f"Bearer {token}")

    assert exc.value.status_code == 401


# =========================
# /auth/me
# =========================

def test_get_me_user_not_found():
    db = FakeDB(responses=[FakeResult([])])
    client = build_authed_client(db)

    res = client.get("/auth/me")

    assert res.status_code == 404


def test_get_me_returns_regular_user_without_psychologist_profile():
    db = FakeDB(
        responses=[
            FakeResult(
                [
                    SimpleNamespace(
                        user_id="u1",
                        Username="fadi",
                        Email="a@b.com",
                        Age=20,
                        Gender=2,
                        Role="regular",
                    )
                ]
            )
        ]
    )

    client = build_authed_client(db)

    res = client.get("/auth/me")

    assert res.status_code == 200
    assert res.json()["role"] == "regular"
    assert res.json()["psychologist_profile"] is None


def test_get_me_psychologist_without_profile_returns_none():
    db = FakeDB(
        responses=[
            FakeResult(
                [
                    SimpleNamespace(
                        user_id="u1",
                        Username="psy",
                        Email="p@b.com",
                        Age=33,
                        Gender=1,
                        Role="psychologist",
                    )
                ]
            ),
            FakeResult([]),
        ]
    )

    client = build_authed_client(db)

    res = client.get("/auth/me")

    assert res.status_code == 200
    assert res.json()["psychologist_profile"] is None


def test_get_me_returns_psychologist_profile():
    db = FakeDB(
        responses=[
            FakeResult(
                [
                    SimpleNamespace(
                        user_id="u1",
                        Username="psy",
                        Email="p@b.com",
                        Age=33,
                        Gender=1,
                        Role="psychologist",
                    )
                ]
            ),
            FakeResult(
                [
                    SimpleNamespace(
                        specialty="stress",
                        workplace="clinic",
                        city="Haifa",
                        bio="bio",
                        years_experience=5,
                        license_number="LIC",
                    )
                ]
            ),
        ]
    )

    client = build_authed_client(db)

    res = client.get("/auth/me")

    assert res.status_code == 200
    assert res.json()["psychologist_profile"]["license_number"] == "LIC"


# =========================
# Update /auth/me
# =========================

def test_update_me_success():
    db = FakeDB(
        responses=[
            FakeResult(),
            FakeResult(
                [
                    SimpleNamespace(
                        user_id="u1",
                        Username="fadi2",
                        Email="new@b.com",
                        Age=21,
                        Gender=2,
                        Role="regular",
                    )
                ]
            ),
        ]
    )

    client = build_authed_client(db)

    res = client.put(
        "/auth/me",
        json={
            "username": "fadi2",
            "email": "new@b.com",
            "age": 21,
            "gender": 2,
        },
    )

    assert res.status_code == 200
    assert res.json()["username"] == "fadi2"


def test_update_me_user_not_found_after_update():
    db = FakeDB(
        responses=[
            FakeResult(),
            FakeResult([]),
        ]
    )

    client = build_authed_client(db)

    res = client.put(
        "/auth/me",
        json={
            "username": "fadi2",
            "email": "new@b.com",
            "age": 21,
            "gender": 2,
        },
    )

    assert res.status_code == 404


# =========================
# Change password
# =========================

def test_change_password_success(monkeypatch):
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(user_id="u1", Password="OLDHASH")]),
            FakeResult(),
        ]
    )

    monkeypatch.setattr(ar, "verify_password", lambda plain, hashed: True)
    monkeypatch.setattr(ar, "hash_password", lambda plain: "NEWHASH")

    client = build_authed_client(db, current_user=SimpleNamespace(user_id="u1"))

    res = client.post(
        "/auth/change-password",
        json={"current_password": "oldpass123", "new_password": "newsecret123"},
    )

    assert res.status_code == 200
    assert db.committed == 1


def test_change_password_user_missing(monkeypatch):
    db = FakeDB(responses=[FakeResult([])])
    monkeypatch.setattr(ar, "verify_password", lambda plain, hashed: True)

    client = build_authed_client(db, current_user=SimpleNamespace(user_id="u1"))

    res = client.post(
        "/auth/change-password",
        json={"current_password": "oldpass123", "new_password": "newsecret123"},
    )

    assert res.status_code == 400


def test_change_password_wrong_current_password(monkeypatch):
    db = FakeDB(responses=[FakeResult([SimpleNamespace(user_id="u1", Password="OLDHASH")])])
    monkeypatch.setattr(ar, "verify_password", lambda plain, hashed: False)

    client = build_authed_client(db, current_user=SimpleNamespace(user_id="u1"))

    res = client.post(
        "/auth/change-password",
        json={"current_password": "oldpass123", "new_password": "newsecret123"},
    )

    assert res.status_code == 400


# =========================
# Psychologist profile upsert
# =========================

def test_upsert_psychologist_profile_insert_path():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(user_id="u1", Role="psychologist")]),
            FakeResult([]),
            FakeResult(),
        ]
    )

    client = build_authed_client(db)

    res = client.put(
        "/auth/psychologist-profile",
        json={
            "specialty": "stress",
            "workplace": "clinic",
            "city": "Haifa",
            "bio": "bio",
            "years_experience": 4,
            "license_number": "27-147619",
        },
    )

    assert res.status_code == 200
    assert res.json()["ok"] is True


def test_upsert_psychologist_profile_update_path():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(user_id="u1", Role="psychologist")]),
            FakeResult([SimpleNamespace(user_id="u1", license_number="27-147619")]),
            FakeResult(),
        ]
    )

    client = build_authed_client(db)

    res = client.put(
        "/auth/psychologist-profile",
        json={
            "specialty": "stress",
            "workplace": "clinic",
            "city": "Haifa",
            "bio": "bio",
            "years_experience": 4,
            "license_number": "27-999999",
        },
    )

    assert res.status_code == 200
    assert res.json()["ok"] is True

    profile_update_params = [
        params
        for q, params in db.executed
        if "UPDATE dbo.PsychologistProfiles" in q
    ][0]

    assert profile_update_params["license_number"] == "27-147619"


def test_upsert_psychologist_profile_user_not_found():
    db = FakeDB(responses=[FakeResult([])])
    client = build_authed_client(db)

    res = client.put(
        "/auth/psychologist-profile",
        json={
            "specialty": "stress",
            "workplace": "clinic",
            "city": "Haifa",
            "bio": "bio",
            "years_experience": 4,
            "license_number": "27-147619",
        },
    )

    assert res.status_code == 404


def test_upsert_psychologist_profile_rejects_regular_user():
    db = FakeDB(responses=[FakeResult([SimpleNamespace(user_id="u1", Role="regular")])])
    client = build_authed_client(db)

    res = client.put(
        "/auth/psychologist-profile",
        json={
            "specialty": "stress",
            "workplace": "clinic",
            "city": "Haifa",
            "bio": "bio",
            "years_experience": 4,
            "license_number": "27-147619",
        },
    )

    assert res.status_code == 403


def test_upsert_psychologist_profile_missing_verified_license():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(user_id="u1", Role="psychologist")]),
            FakeResult([]),
        ]
    )

    client = build_authed_client(db)

    res = client.put(
        "/auth/psychologist-profile",
        json={
            "specialty": "stress",
            "workplace": "clinic",
            "city": "Haifa",
            "bio": "bio",
            "years_experience": 4,
            "license_number": None,
        },
    )

    assert res.status_code == 400


def test_upsert_psychologist_profile_payload_license_normalized_when_no_existing_license():
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(user_id="u1", Role="psychologist")]),
            FakeResult([SimpleNamespace(user_id="u1", license_number=None)]),
            FakeResult(),
        ]
    )

    client = build_authed_client(db)

    res = client.put(
        "/auth/psychologist-profile",
        json={
            "specialty": "stress",
            "workplace": "clinic",
            "city": "Haifa",
            "bio": "bio",
            "years_experience": 4,
            "license_number": "27- 147619",
        },
    )

    assert res.status_code == 200

    profile_update_params = [
        params
        for q, params in db.executed
        if "UPDATE dbo.PsychologistProfiles" in q
    ][0]

    assert profile_update_params["license_number"] == "27-147619"