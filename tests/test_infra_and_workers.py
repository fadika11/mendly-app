from types import SimpleNamespace
from unittest.mock import MagicMock

from server import deps
from server import notification_worker as nw
from server import firebase_client as fc
from server.utils import email as em


# Fake DB session for dependency tests.
class FakeDBSession:
    def __init__(self):
        self.closed = False

    def close(self):
        self.closed = True


# Checks that database session is yielded and closed.
def test_get_db_yields_and_closes(monkeypatch):
    fake = FakeDBSession()
    monkeypatch.setattr(deps, 'SessionLocal', lambda: fake)
    gen = deps.get_db()
    db = next(gen)
    assert db is fake
    try:
        next(gen)
    except StopIteration:
        pass
    assert fake.closed is True


# Checks email is skipped without credentials.
def test_send_email_skips_when_credentials_missing(monkeypatch):
    monkeypatch.setattr(em, 'SMTP_USER', '')
    monkeypatch.setattr(em, 'SMTP_PASS', '')
    em.send_email('a@b.com', 'subj', 'body')


# Checks push send is skipped when FCM is off.
def test_send_push_to_token_returns_disabled_when_fcm_off(monkeypatch):
    monkeypatch.setattr(fc, 'FCM_ENABLED', False)
    assert fc.send_push_to_token("tok", "title", "body") == (False, "fcm_disabled")


# Checks failed notification job is marked failed.
def test_send_one_job_marks_failed_when_send_raises(monkeypatch):
    class FakeDB:
        def __init__(self):
            self.updated = []

        def execute(self, query, params=None):
            text = str(query)
            if 'SELECT TOP 1 fcm_token' in text:
                return SimpleNamespace(fetchone=lambda: SimpleNamespace(fcm_token='tok'))
            self.updated.append((text, params))
            return SimpleNamespace(fetchone=lambda: None)

    monkeypatch.setattr(nw, 'send_push_to_token', lambda **kwargs: (_ for _ in ()).throw(RuntimeError('boom')))
    db = FakeDB()
    row = SimpleNamespace(job_id='j1', user_id='u1', purpose='checkin_reminder', payload_json='{}')
    import asyncio
    asyncio.run(nw._send_one_job(db, row))
    assert any("failed" in q.lower() for q, _ in db.updated)



# Checks email sends successfully.
def test_send_email_success(monkeypatch):
    monkeypatch.setattr(em, "SMTP_USER", "test@example.com")
    monkeypatch.setattr(em, "SMTP_PASS", "app-pass")
    monkeypatch.setattr(em, "SMTP_HOST", "smtp.test.com")
    monkeypatch.setattr(em, "SMTP_PORT", 587)

    events = {"started": False, "logged_in": False, "sent": False}

    class FakeSMTP:
        def __init__(self, host, port):
            assert host == "smtp.test.com"
            assert port == 587

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def starttls(self):
            events["started"] = True

        def login(self, user, pwd):
            assert user == "test@example.com"
            assert pwd == "app-pass"
            events["logged_in"] = True

        def send_message(self, msg):
            assert msg["To"] == "to@example.com"
            events["sent"] = True

    monkeypatch.setattr(em.smtplib, "SMTP", FakeSMTP)

    em.send_email("to@example.com", "Subject", "Body")

    assert events["started"] is True
    assert events["logged_in"] is True
    assert events["sent"] is True



# Fake query result for worker tests.
class FakeResult:
    def __init__(self, rows=None):
        self._rows = rows or []

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return self._rows


# Fake database for worker tests.
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


# Checks successful notification job is marked sent.
def test_send_one_job_marks_sent_when_push_ok(monkeypatch):
    db = FakeDB(
        responses=[
            FakeResult([SimpleNamespace(fcm_token="TOKEN123")]),
        ]
    )

    job = SimpleNamespace(
        job_id="j1",
        user_id="u1",
        purpose="checkin_reminder",
        payload_json='{"title":"Hello","body":"World"}',
    )

    monkeypatch.setattr(nw, "send_push_to_token", lambda **kwargs: "msg-id")

    import asyncio
    asyncio.run(nw._send_one_job(db, job))

    assert any("SET status = N'sent'" in q for q, _ in db.executed)


# Checks notification loop processes jobs and commits.
def test_notification_loop_fetches_jobs_and_commits(monkeypatch):
    fake_db = FakeDB(
        responses=[
            FakeResult([
                SimpleNamespace(
                    job_id="j1",
                    user_id="u1",
                    purpose="checkin_reminder",
                    payload_json='{"title":"Hi","body":"B"}',
                )
            ]),
            FakeResult([SimpleNamespace(fcm_token="TOKEN123")]),
        ]
    )

    class FakeCtx:
        def __enter__(self):
            return fake_db
        def __exit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr(nw, "SessionLocal", lambda: FakeCtx())
    monkeypatch.setattr(nw, "send_push_to_token", lambda **kwargs: "msg-id")

    calls = {"n": 0}

    async def fake_sleep(_):
        calls["n"] += 1
        if calls["n"] >= 2:
            raise RuntimeError("stop loop")

    monkeypatch.setattr(nw.asyncio, "sleep", fake_sleep)

    import asyncio
    try:
        asyncio.run(nw.notification_loop(poll_interval=0))
    except RuntimeError as e:
        assert str(e) == "stop loop"

    assert fake_db.committed >= 1


# Checks worker starts event loop.
def test_start_worker_builds_event_loop(monkeypatch):
    class FakeLoop:
        def __init__(self):
            self.ran = False

        def run_until_complete(self, coro):
            self.ran = True
            try:
                coro.close()
            except Exception:
                pass

    loop = FakeLoop()

    monkeypatch.setattr(nw.asyncio, "new_event_loop", lambda: loop)
    monkeypatch.setattr(nw.asyncio, "set_event_loop", lambda l: None)

    nw.start_worker(interval_seconds=1)

    assert loop.ran is True


# Checks push notification sends successfully.
def test_send_push_to_token_success(monkeypatch):
    monkeypatch.setattr(fc, "FCM_ENABLED", True)

    class FakeMessaging:
        class Notification:
            def __init__(self, title, body):
                self.title = title
                self.body = body

        class Message:
            def __init__(self, notification, token, data):
                self.notification = notification
                self.token = token
                self.data = data

        @staticmethod
        def send(msg):
            return "firebase-msg-id"

    monkeypatch.setattr(fc, "messaging", FakeMessaging)

    result = fc.send_push_to_token(
        token="TOKEN123",
        title="Hello",
        body="World",
        data={"purpose": "checkin_reminder"},
    )

    assert result == (True, None, "firebase-msg-id")