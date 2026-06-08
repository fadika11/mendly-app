# tests/test_photo_memory.py
from datetime import date, datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.routers import photo_memory_routes as pm


# Fake query result for photo memory tests.
class FakeResult:
    def __init__(self, rows=None):
        self._rows = rows or []

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return self._rows


# Fake database for photo memory tests.
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


# Builds a fake app client for photo memory tests.
def build_client(db):
    app = FastAPI()
    app.include_router(pm.router)

    def override_db():
        yield db

    app.dependency_overrides[pm.get_db] = override_db
    app.dependency_overrides[pm._user_id_from_authorization] = lambda: "u1"
    return TestClient(app)


def memory_row(**overrides):
    data = {
        "memory_id": "m1",
        "image_url": "/media/user_u1/x.jpg",
        "caption": "happy",
        "memory_date": date(2026, 4, 1),
        "created_at": datetime(2026, 4, 1, 10, 0, 0),
    }
    data.update(overrides)
    return type("R", (), data)()


# =====================
# Upload
# =====================

def test_upload_photo_memory_rejects_non_image():
    db = FakeDB(responses=[FakeResult([type("R", (), {"cnt": 0})()])])
    client = build_client(db)

    res = client.post(
        "/photo-memories/upload",
        files={"file": ("note.txt", b"hello", "text/plain")},
    )

    assert res.status_code == 400
    assert "File must be an image" in res.text


def test_upload_photo_memory_rejects_limit():
    db = FakeDB(responses=[FakeResult([type("R", (), {"cnt": 10})()])])
    client = build_client(db)

    res = client.post(
        "/photo-memories/upload",
        files={"file": ("pic.jpg", b"123", "image/jpeg")},
    )

    assert res.status_code == 400
    assert "up to 10" in res.text


def test_upload_photo_memory_rejects_bad_memory_date(tmp_path, monkeypatch):
    monkeypatch.setattr(pm, "MEDIA_ROOT", tmp_path)

    db = FakeDB(responses=[FakeResult([type("R", (), {"cnt": 0})()])])
    client = build_client(db)

    res = client.post(
        "/photo-memories/upload",
        data={"caption": "nice", "memory_date": "bad-date"},
        files={"file": ("pic.jpg", b"fakejpgbytes", "image/jpeg")},
    )

    assert res.status_code == 400
    assert "Invalid memory_date format" in res.text
    assert db.committed == 0


def test_upload_photo_memory_success(tmp_path, monkeypatch):
    monkeypatch.setattr(pm, "MEDIA_ROOT", tmp_path)

    db = FakeDB(
        responses=[
            FakeResult([type("R", (), {"cnt": 0})()]),
            FakeResult(),
        ]
    )
    client = build_client(db)

    res = client.post(
        "/photo-memories/upload",
        data={"caption": "nice", "memory_date": "2026-04-01"},
        files={"file": ("pic.jpg", b"fakejpgbytes", "image/jpeg")},
    )

    assert res.status_code == 200
    body = res.json()

    assert "image_url" in body
    assert body["image_url"].startswith("/media/user_u1/")
    assert body["image_url"].endswith(".jpg")
    assert db.committed == 1

    saved_files = list((tmp_path / "user_u1").glob("*.jpg"))
    assert len(saved_files) == 1
    assert saved_files[0].read_bytes() == b"fakejpgbytes"


def test_upload_photo_memory_uses_default_jpg_extension_when_filename_has_no_extension(
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(pm, "MEDIA_ROOT", tmp_path)

    db = FakeDB(
        responses=[
            FakeResult([type("R", (), {"cnt": 0})()]),
            FakeResult(),
        ]
    )
    client = build_client(db)

    res = client.post(
        "/photo-memories/upload",
        files={"file": ("picture", b"abc", "image/jpeg")},
    )

    assert res.status_code == 200
    assert res.json()["image_url"].endswith(".jpg")


def test_upload_photo_memory_keeps_original_extension_lowercase(tmp_path, monkeypatch):
    monkeypatch.setattr(pm, "MEDIA_ROOT", tmp_path)

    db = FakeDB(
        responses=[
            FakeResult([type("R", (), {"cnt": 0})()]),
            FakeResult(),
        ]
    )
    client = build_client(db)

    res = client.post(
        "/photo-memories/upload",
        files={"file": ("picture.PNG", b"abc", "image/png")},
    )

    assert res.status_code == 200
    assert res.json()["image_url"].endswith(".png")


def test_upload_photo_memory_allows_missing_memory_date(tmp_path, monkeypatch):
    monkeypatch.setattr(pm, "MEDIA_ROOT", tmp_path)

    db = FakeDB(
        responses=[
            FakeResult([type("R", (), {"cnt": 0})()]),
            FakeResult(),
        ]
    )
    client = build_client(db)

    res = client.post(
        "/photo-memories/upload",
        data={"caption": "without date"},
        files={"file": ("pic.jpg", b"fakejpgbytes", "image/jpeg")},
    )

    assert res.status_code == 200

    insert_params = [
        params
        for q, params in db.executed
        if "INSERT INTO dbo.HappyMemories" in q
    ][0]

    assert insert_params["caption"] == "without date"
    assert insert_params["mem_date"] is None


# =====================
# List
# =====================

def test_list_photo_memories_success():
    db = FakeDB(
        responses=[
            FakeResult(
                [
                    memory_row(
                        memory_id="m1",
                        image_url="/media/user_u1/x.jpg",
                        caption="happy",
                        memory_date=date(2026, 4, 1),
                        created_at=datetime(2026, 4, 1, 10, 0, 0),
                    )
                ]
            )
        ]
    )
    client = build_client(db)

    res = client.get("/photo-memories")

    assert res.status_code == 200
    assert res.json()[0]["memory_id"] == "m1"
    assert res.json()[0]["caption"] == "happy"
    assert res.json()[0]["memory_date"] == "2026-04-01"
    assert res.json()[0]["created_at"] == "2026-04-01T10:00:00"


def test_list_photo_memories_formats_null_memory_date():
    db = FakeDB(
        responses=[
            FakeResult(
                [
                    memory_row(
                        memory_date=None,
                        created_at=datetime(2026, 4, 1, 10, 0, 0),
                    )
                ]
            )
        ]
    )
    client = build_client(db)

    res = client.get("/photo-memories")

    assert res.status_code == 200
    assert res.json()[0]["memory_date"] is None


def test_list_photo_memories_empty():
    db = FakeDB(responses=[FakeResult([])])
    client = build_client(db)

    res = client.get("/photo-memories")

    assert res.status_code == 200
    assert res.json() == []


# =====================
# Delete
# =====================

def test_delete_photo_memory_not_found():
    db = FakeDB(responses=[FakeResult([])])
    client = build_client(db)

    res = client.delete("/photo-memories/missing")

    assert res.status_code == 404


def test_delete_photo_memory_success_deletes_db_and_file(tmp_path, monkeypatch):
    monkeypatch.setattr(pm, "MEDIA_ROOT", tmp_path)

    user_dir = tmp_path / "user_u1"
    user_dir.mkdir(parents=True)
    file_path = user_dir / "x.jpg"
    file_path.write_bytes(b"image")

    db = FakeDB(
        responses=[
            FakeResult([type("R", (), {"image_url": "/media/user_u1/x.jpg"})()]),
            FakeResult(),
        ]
    )
    client = build_client(db)

    res = client.delete("/photo-memories/m1")

    assert res.status_code == 200
    assert res.json()["ok"] is True
    assert file_path.exists() is False
    assert db.committed == 1
    assert any("DELETE FROM dbo.HappyMemories" in q for q, _ in db.executed)


def test_delete_photo_memory_success_when_file_missing(tmp_path, monkeypatch):
    monkeypatch.setattr(pm, "MEDIA_ROOT", tmp_path)

    db = FakeDB(
        responses=[
            FakeResult([type("R", (), {"image_url": "/media/user_u1/missing.jpg"})()]),
            FakeResult(),
        ]
    )
    client = build_client(db)

    res = client.delete("/photo-memories/m1")

    assert res.status_code == 200
    assert res.json()["ok"] is True
    assert db.committed == 1


def test_delete_photo_memory_ignores_non_media_url(tmp_path, monkeypatch):
    monkeypatch.setattr(pm, "MEDIA_ROOT", tmp_path)

    db = FakeDB(
        responses=[
            FakeResult([type("R", (), {"image_url": "https://example.com/x.jpg"})()]),
            FakeResult(),
        ]
    )
    client = build_client(db)

    res = client.delete("/photo-memories/m1")

    assert res.status_code == 200
    assert res.json()["ok"] is True
    assert db.committed == 1


def test_delete_photo_memory_ignores_file_delete_error(tmp_path, monkeypatch):
    monkeypatch.setattr(pm, "MEDIA_ROOT", tmp_path)

    class BadPath:
        def exists(self):
            return True

        def unlink(self):
            raise RuntimeError("cannot delete")

    class FakeMediaRoot:
        def __truediv__(self, rel_path):
            return BadPath()

    monkeypatch.setattr(pm, "MEDIA_ROOT", FakeMediaRoot())

    db = FakeDB(
        responses=[
            FakeResult([type("R", (), {"image_url": "/media/user_u1/x.jpg"})()]),
            FakeResult(),
        ]
    )
    client = build_client(db)

    res = client.delete("/photo-memories/m1")

    assert res.status_code == 200
    assert res.json()["ok"] is True
    assert db.committed == 1


# =====================
# Update
# =====================

def test_update_photo_memory_rejects_bad_date():
    db = FakeDB()
    client = build_client(db)

    res = client.put(
        "/photo-memories/m1",
        json={"caption": "new", "memory_date": "bad-date"},
    )

    assert res.status_code == 400


def test_update_photo_memory_not_found():
    db = FakeDB(responses=[FakeResult([])])
    client = build_client(db)

    res = client.put(
        "/photo-memories/missing",
        json={"caption": "new caption", "memory_date": "2026-04-01"},
    )

    assert res.status_code == 404


def test_update_photo_memory_success():
    db = FakeDB(
        responses=[
            FakeResult([object()]),
            FakeResult(),
        ]
    )
    client = build_client(db)

    res = client.put(
        "/photo-memories/m1",
        json={"caption": "new caption", "memory_date": "2026-04-01"},
    )

    assert res.status_code == 200
    assert res.json()["ok"] is True
    assert db.committed == 1

    update_params = [
        params
        for q, params in db.executed
        if "UPDATE dbo.HappyMemories" in q
    ][0]

    assert update_params["caption"] == "new caption"
    assert update_params["mem_date"] == date(2026, 4, 1)


def test_update_photo_memory_allows_null_memory_date():
    db = FakeDB(
        responses=[
            FakeResult([object()]),
            FakeResult(),
        ]
    )
    client = build_client(db)

    res = client.put(
        "/photo-memories/m1",
        json={"caption": "new caption", "memory_date": None},
    )

    assert res.status_code == 200

    update_params = [
        params
        for q, params in db.executed
        if "UPDATE dbo.HappyMemories" in q
    ][0]

    assert update_params["caption"] == "new caption"
    assert update_params["mem_date"] is None


def test_update_photo_memory_missing_caption_sets_none():
    db = FakeDB(
        responses=[
            FakeResult([object()]),
            FakeResult(),
        ]
    )
    client = build_client(db)

    res = client.put(
        "/photo-memories/m1",
        json={"memory_date": "2026-04-01"},
    )

    assert res.status_code == 200

    update_params = [
        params
        for q, params in db.executed
        if "UPDATE dbo.HappyMemories" in q
    ][0]

    assert update_params["caption"] is None


# =====================
# Weekly candidate
# =====================

def test_weekly_photo_candidate_empty():
    db = FakeDB(responses=[FakeResult([])])
    client = build_client(db)

    res = client.get("/photo-memories/weekly-candidate")

    assert res.status_code == 200
    assert res.json()["show"] is False
    assert res.json()["message"] is None
    assert res.json()["memory"] is None


def test_weekly_photo_candidate_success():
    db = FakeDB(
        responses=[
            FakeResult(
                [
                    memory_row(
                        memory_id="m1",
                        image_url="/media/user_u1/x.jpg",
                        caption="happy",
                        memory_date=date(2026, 4, 1),
                        created_at=datetime(2026, 4, 1, 10, 0, 0),
                    )
                ]
            )
        ]
    )
    client = build_client(db)

    res = client.get("/photo-memories/weekly-candidate")

    assert res.status_code == 200
    body = res.json()

    assert body["show"] is True
    assert "beautiful moments" in body["message"]
    assert body["memory"]["memory_id"] == "m1"
    assert body["memory"]["memory_date"] == "2026-04-01"
    assert body["memory"]["created_at"] == "2026-04-01T10:00:00"


def test_weekly_photo_candidate_formats_null_memory_date():
    db = FakeDB(
        responses=[
            FakeResult(
                [
                    memory_row(
                        memory_date=None,
                        created_at=datetime(2026, 4, 1, 10, 0, 0),
                    )
                ]
            )
        ]
    )
    client = build_client(db)

    res = client.get("/photo-memories/weekly-candidate")

    assert res.status_code == 200
    assert res.json()["memory"]["memory_date"] is None