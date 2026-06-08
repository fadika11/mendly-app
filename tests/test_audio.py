# tests/test_audio.py
from datetime import date, datetime, timezone
from pathlib import Path
from types import ModuleType, SimpleNamespace
import os
import sys

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.routers import audio_analysis as ar
from server.services import audio_emotion as ae


# =========================
# Fake DB helpers
# =========================

class FakeFetchOne:
    def __init__(self, a=None):
        self.a = a


class FakeResult:
    def __init__(self, rows=None, one=None):
        self._rows = rows or []
        self._one = one

    def fetchone(self):
        if self._one is not None:
            return self._one
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return self._rows


class FakeDB:
    def __init__(self, avg=None, streak_rows=None):
        self.calls = []
        self.commits = 0
        self.avg = avg
        self.streak_rows = streak_rows or []

    def execute(self, stmt, params=None):
        text_stmt = str(stmt)
        self.calls.append((text_stmt, params))

        if "SELECT AVG(CAST(score AS float)) AS a" in text_stmt:
            return FakeResult(one=FakeFetchOne(self.avg))

        if "SELECT CAST(captured_at AS date) AS d" in text_stmt:
            return FakeResult(rows=self.streak_rows)

        return FakeResult()

    def commit(self):
        self.commits += 1


def make_client(monkeypatch, analyze_result=None, analyze_func=None, db=None):
    app = FastAPI()
    app.include_router(ar.router)

    fake_db = db or FakeDB()

    app.dependency_overrides[ar.get_db] = lambda: fake_db
    app.dependency_overrides[ar._user_id_from_authorization] = lambda: "user-1"

    if analyze_func is not None:
        monkeypatch.setattr(ar, "analyze_audio_file", analyze_func)
    else:
        monkeypatch.setattr(ar, "analyze_audio_file", lambda _path: analyze_result)

    return TestClient(app), fake_db


# =========================
# audio_analysis.py helper tests
# =========================

def test_emotion_to_score_label_all_branches():
    assert ar.emotion_to_score_label("sad") == (2, "sad")
    assert ar.emotion_to_score_label("angry") == (3, "stressed")
    assert ar.emotion_to_score_label("happy") == (9, "happy")
    assert ar.emotion_to_score_label("neutral") == (6, "calm")
    assert ar.emotion_to_score_label("other") == (5, "calm")
    assert ar.emotion_to_score_label(None) == (5, "calm")


def test_compute_streak_returns_0_when_no_days():
    db = FakeDB(streak_rows=[])

    assert ar._compute_streak(db, "u1") == 0


def test_compute_streak_counts_consecutive_days():
    today = datetime.now(timezone.utc).date()
    rows = [
        SimpleNamespace(d=today),
        SimpleNamespace(d=date.fromordinal(today.toordinal() - 1)),
        SimpleNamespace(d=date.fromordinal(today.toordinal() - 2)),
    ]

    db = FakeDB(streak_rows=rows)

    assert ar._compute_streak(db, "u1") == 3


def test_compute_streak_ignores_future_dates_and_stops_on_gap():
    today = datetime.now(timezone.utc).date()
    rows = [
        SimpleNamespace(d=date.fromordinal(today.toordinal() + 1)),
        SimpleNamespace(d=today),
        SimpleNamespace(d=date.fromordinal(today.toordinal() - 2)),
    ]

    db = FakeDB(streak_rows=rows)

    assert ar._compute_streak(db, "u1") == 1


def test_rolling_avg_returns_none_when_no_average():
    db = FakeDB(avg=None)

    assert ar._rolling_avg(db, "u1", 7) is None


def test_rolling_avg_returns_float():
    db = FakeDB(avg=6.25)

    assert ar._rolling_avg(db, "u1", 7) == 6.25


# =========================
# audio_analysis.py route tests
# =========================

def test_audio_route_rejects_empty_upload(monkeypatch):
    client, _db = make_client(
        monkeypatch,
        {
            "ok": True,
            "emotion": "happy",
            "confidence": 0.9,
            "mendly_state": "positive_candidate",
            "message": "ok",
        },
    )

    res = client.post(
        "/audio/analyze-mood",
        files={"file": ("x.wav", b"", "audio/wav")},
    )

    assert res.status_code == 400
    assert "empty" in res.text.lower()


def test_audio_route_rejects_too_large_upload(monkeypatch):
    monkeypatch.setattr(ar, "MAX_UPLOAD_BYTES", 3)

    client, _db = make_client(
        monkeypatch,
        {
            "ok": True,
            "emotion": "happy",
            "confidence": 0.9,
            "mendly_state": "positive_candidate",
            "message": "ok",
        },
    )

    res = client.post(
        "/audio/analyze-mood",
        files={"file": ("x.wav", b"12345", "audio/wav")},
    )

    assert res.status_code == 400
    assert "too large" in res.text.lower()


def test_audio_route_accepts_unknown_extension_as_m4a(monkeypatch):
    captured = {}

    def fake_analyze(path):
        captured["path"] = path
        return {
            "ok": True,
            "emotion": "happy",
            "confidence": 0.9,
            "mendly_state": "positive_candidate",
            "message": "ok",
        }

    client, _db = make_client(monkeypatch, analyze_func=fake_analyze)

    res = client.post(
        "/audio/analyze-mood",
        files={"file": ("recording.badext", b"12345", "application/octet-stream")},
    )

    assert res.status_code == 200
    assert captured["path"].endswith(".m4a")


def test_audio_route_success_happy(monkeypatch):
    client, db = make_client(
        monkeypatch,
        {
            "ok": True,
            "emotion": "happy",
            "confidence": 0.9,
            "mendly_state": "positive_candidate",
            "message": "ok",
        },
    )

    res = client.post(
        "/audio/analyze-mood",
        files={"file": ("x.wav", b"12345", "audio/wav")},
    )

    assert res.status_code == 200
    body = res.json()

    assert body["ok"] is True
    assert body["saved"] is True
    assert body["score_saved"] == 9
    assert body["label_saved"] == "happy"
    assert body["mood_source"] == "audio_ai"
    assert any("INSERT INTO dbo.MoodEntries" in call[0] for call in db.calls)
    assert any("MERGE dbo.AdherenceStats" in call[0] for call in db.calls)
    assert db.commits == 2


def test_audio_route_success_neutral(monkeypatch):
    client, _db = make_client(
        monkeypatch,
        {
            "ok": True,
            "emotion": "neutral",
            "confidence": 0.5,
            "mendly_state": "calm_or_neutral",
            "message": "neutral",
        },
    )

    res = client.post(
        "/audio/analyze-mood",
        files={"file": ("x.wav", b"12345", "audio/wav")},
    )

    assert res.status_code == 200
    assert res.json()["score_saved"] == 6
    assert res.json()["label_saved"] == "calm"


def test_audio_route_success_unknown_emotion(monkeypatch):
    client, _db = make_client(
        monkeypatch,
        {
            "ok": True,
            "emotion": "surprised",
            "confidence": 0.4,
            "mendly_state": "calm_or_neutral",
            "message": "unknown",
        },
    )

    res = client.post(
        "/audio/analyze-mood",
        files={"file": ("x.wav", b"12345", "audio/wav")},
    )

    assert res.status_code == 200
    assert res.json()["score_saved"] == 5
    assert res.json()["label_saved"] == "calm"


def test_audio_route_returns_503_when_analyzer_unavailable(monkeypatch):
    client, _db = make_client(
        monkeypatch,
        {
            "ok": False,
            "error": "Audio emotion model is unavailable",
            "detail": "x",
        },
    )

    res = client.post(
        "/audio/analyze-mood",
        files={"file": ("x.wav", b"123", "audio/wav")},
    )

    assert res.status_code == 503


def test_audio_route_returns_500_when_analyze_raises(monkeypatch):
    def boom(_path):
        raise RuntimeError("analysis crashed")

    client, _db = make_client(monkeypatch, analyze_func=boom)

    res = client.post(
        "/audio/analyze-mood",
        files={"file": ("x.wav", b"123", "audio/wav")},
    )

    assert res.status_code == 500
    assert "Audio analysis failed" in res.text


def test_audio_route_removes_temp_file_on_success(monkeypatch):
    seen = {}

    def fake_analyze(path):
        seen["path"] = path
        assert os.path.exists(path) is True
        return {
            "ok": True,
            "emotion": "happy",
            "confidence": 0.9,
            "mendly_state": "positive_candidate",
            "message": "ok",
        }

    client, _db = make_client(monkeypatch, analyze_func=fake_analyze)

    res = client.post(
        "/audio/analyze-mood",
        files={"file": ("x.wav", b"123", "audio/wav")},
    )

    assert res.status_code == 200
    assert os.path.exists(seen["path"]) is False


def test_audio_route_removes_temp_file_on_error(monkeypatch):
    seen = {}

    def fake_analyze(path):
        seen["path"] = path
        assert os.path.exists(path) is True
        raise RuntimeError("analysis crashed")

    client, _db = make_client(monkeypatch, analyze_func=fake_analyze)

    res = client.post(
        "/audio/analyze-mood",
        files={"file": ("x.wav", b"123", "audio/wav")},
    )

    assert res.status_code == 500
    assert os.path.exists(seen["path"]) is False


# =========================
# audio_emotion.py helpers
# =========================

def test_safe_audio_path_returns_normalized_absolute_path(tmp_path):
    p = tmp_path / "a.wav"
    p.write_bytes(b"123")

    out = ae._safe_audio_path(str(p))

    assert ":/" in out or out.startswith("/")
    assert out.endswith("a.wav")


def test_map_emotion_to_mendly_state():
    assert ae.map_emotion_to_mendly_state("sad") == "low_mood_candidate"
    assert ae.map_emotion_to_mendly_state("angry") == "stress_candidate"
    assert ae.map_emotion_to_mendly_state("happy") == "positive_candidate"
    assert ae.map_emotion_to_mendly_state("neutral") == "calm_or_neutral"
    assert ae.map_emotion_to_mendly_state(None) == "calm_or_neutral"


def test_preload_classifier_true_when_loaded(monkeypatch):
    monkeypatch.setattr(ae, "_classifier", object())

    assert ae.preload_classifier() is True


def test_preload_classifier_false_when_missing(monkeypatch):
    monkeypatch.setattr(ae, "_classifier", None)
    monkeypatch.setattr(ae, "_classifier_attempted", True)

    assert ae.preload_classifier() is False


def test_get_classifier_returns_existing_classifier(monkeypatch):
    fake = object()

    monkeypatch.setattr(ae, "_classifier", fake)
    monkeypatch.setattr(ae, "_classifier_attempted", True)

    assert ae._get_classifier() is fake


def test_get_classifier_returns_none_after_previous_failed_attempt(monkeypatch):
    monkeypatch.setattr(ae, "_classifier", None)
    monkeypatch.setattr(ae, "_classifier_attempted", True)

    assert ae._get_classifier() is None


def test_get_classifier_loads_fake_speechbrain(monkeypatch):
    fake_classifier = object()

    interfaces_mod = ModuleType("speechbrain.inference.interfaces")

    def fake_foreign_class(**kwargs):
        assert kwargs["source"] == "speechbrain/emotion-recognition-wav2vec2-IEMOCAP"
        assert kwargs["classname"] == "CustomEncoderWav2vec2Classifier"
        return fake_classifier

    interfaces_mod.foreign_class = fake_foreign_class

    fetching_mod = ModuleType("speechbrain.utils.fetching")

    class FakeLocalStrategy:
        COPY = "copy"

    fetching_mod.LocalStrategy = FakeLocalStrategy

    monkeypatch.setitem(sys.modules, "speechbrain", ModuleType("speechbrain"))
    monkeypatch.setitem(sys.modules, "speechbrain.inference", ModuleType("speechbrain.inference"))
    monkeypatch.setitem(sys.modules, "speechbrain.inference.interfaces", interfaces_mod)
    monkeypatch.setitem(sys.modules, "speechbrain.utils", ModuleType("speechbrain.utils"))
    monkeypatch.setitem(sys.modules, "speechbrain.utils.fetching", fetching_mod)

    monkeypatch.setattr(ae, "_classifier", None)
    monkeypatch.setattr(ae, "_classifier_error", None)
    monkeypatch.setattr(ae, "_classifier_attempted", False)

    assert ae._get_classifier() is fake_classifier
    assert ae._classifier is fake_classifier
    assert ae._classifier_attempted is True


def test_get_classifier_sets_error_when_import_or_load_fails(monkeypatch):
    interfaces_mod = ModuleType("speechbrain.inference.interfaces")

    def fake_foreign_class(**kwargs):
        raise RuntimeError("load failed")

    interfaces_mod.foreign_class = fake_foreign_class

    fetching_mod = ModuleType("speechbrain.utils.fetching")

    class FakeLocalStrategy:
        COPY = "copy"

    fetching_mod.LocalStrategy = FakeLocalStrategy

    monkeypatch.setitem(sys.modules, "speechbrain", ModuleType("speechbrain"))
    monkeypatch.setitem(sys.modules, "speechbrain.inference", ModuleType("speechbrain.inference"))
    monkeypatch.setitem(sys.modules, "speechbrain.inference.interfaces", interfaces_mod)
    monkeypatch.setitem(sys.modules, "speechbrain.utils", ModuleType("speechbrain.utils"))
    monkeypatch.setitem(sys.modules, "speechbrain.utils.fetching", fetching_mod)

    monkeypatch.setattr(ae, "_classifier", None)
    monkeypatch.setattr(ae, "_classifier_error", None)
    monkeypatch.setattr(ae, "_classifier_attempted", False)

    assert ae._get_classifier() is None
    assert "load failed" in ae._classifier_error


def test_normalize_audio_to_wav16k_calls_librosa_and_soundfile(monkeypatch, tmp_path):
    input_path = tmp_path / "input.wav"
    input_path.write_bytes(b"123")

    calls = {"librosa": False, "sf": False}

    def fake_load(path, sr, mono, duration):
        calls["librosa"] = True
        assert sr == 16000
        assert mono is True
        assert duration == ae.MAX_AUDIO_SECONDS
        return [0.1, 0.2, 0.3], 44100

    def fake_write(path, audio, sr):
        calls["sf"] = True
        assert audio == [0.1, 0.2, 0.3]
        assert sr == 16000
        Path(path).write_bytes(b"normalized")

    monkeypatch.setattr(ae.librosa, "load", fake_load)
    monkeypatch.setattr(ae.sf, "write", fake_write)

    out = ae.normalize_audio_to_wav16k(str(input_path))

    assert calls["librosa"] is True
    assert calls["sf"] is True
    assert out.endswith(".wav")
    assert Path(out).exists() is True

    Path(out).unlink()


# =========================
# audio_emotion.py analyze_audio_file tests
# =========================

def test_analyze_audio_file_returns_unavailable_when_classifier_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(ae, "_get_classifier", lambda: None)
    monkeypatch.setattr(ae, "_classifier_error", "boom")

    p = tmp_path / "x.wav"
    p.write_bytes(b"1")

    result = ae.analyze_audio_file(str(p))

    assert result["ok"] is False
    assert "unavailable" in result["error"].lower()
    assert result["detail"] == "boom"


def test_analyze_audio_file_success_happy(monkeypatch, tmp_path):
    class FakeClassifier:
        def classify_file(self, _path):
            return None, [0.91], None, ["happy"]

    normalized = tmp_path / "norm.wav"
    normalized.write_bytes(b"123")

    monkeypatch.setattr(ae, "_get_classifier", lambda: FakeClassifier())
    monkeypatch.setattr(ae, "normalize_audio_to_wav16k", lambda _p: str(normalized))

    result = ae.analyze_audio_file("ignored.wav")

    assert result["ok"] is True
    assert result["emotion"] == "happy"
    assert result["confidence"] == 0.91
    assert result["mendly_state"] == "positive_candidate"
    assert "brighter" in result["message"].lower()
    assert Path(str(normalized)).exists() is False


def test_analyze_audio_file_success_sad(monkeypatch, tmp_path):
    class FakeClassifier:
        def classify_file(self, _path):
            return None, [0.8], None, ["sad"]

    normalized = tmp_path / "norm.wav"
    normalized.write_bytes(b"123")

    monkeypatch.setattr(ae, "_get_classifier", lambda: FakeClassifier())
    monkeypatch.setattr(ae, "normalize_audio_to_wav16k", lambda _p: str(normalized))

    result = ae.analyze_audio_file("ignored.wav")

    assert result["ok"] is True
    assert result["emotion"] == "sad"
    assert result["mendly_state"] == "low_mood_candidate"
    assert "heavy moment" in result["message"].lower()


def test_analyze_audio_file_success_angry(monkeypatch, tmp_path):
    class FakeClassifier:
        def classify_file(self, _path):
            return None, [0.7], None, ["angry"]

    normalized = tmp_path / "norm.wav"
    normalized.write_bytes(b"123")

    monkeypatch.setattr(ae, "_get_classifier", lambda: FakeClassifier())
    monkeypatch.setattr(ae, "normalize_audio_to_wav16k", lambda _p: str(normalized))

    result = ae.analyze_audio_file("ignored.wav")

    assert result["ok"] is True
    assert result["emotion"] == "angry"
    assert result["mendly_state"] == "stress_candidate"
    assert "stressed" in result["message"].lower()


def test_analyze_audio_file_success_neutral_with_scalar_score_and_string_label(monkeypatch, tmp_path):
    class FakeClassifier:
        def classify_file(self, _path):
            return None, 0.55, None, "neutral"

    normalized = tmp_path / "norm.wav"
    normalized.write_bytes(b"123")

    monkeypatch.setattr(ae, "_get_classifier", lambda: FakeClassifier())
    monkeypatch.setattr(ae, "normalize_audio_to_wav16k", lambda _p: str(normalized))

    result = ae.analyze_audio_file("ignored.wav")

    assert result["ok"] is True
    assert result["emotion"] == "neutral"
    assert result["confidence"] == 0.55
    assert result["mendly_state"] == "calm_or_neutral"
    assert "neutral" in result["message"].lower()


def test_analyze_audio_file_classifier_exception_returns_error(monkeypatch, tmp_path):
    class FakeClassifier:
        def classify_file(self, _path):
            raise RuntimeError("classify failed")

    normalized = tmp_path / "norm.wav"
    normalized.write_bytes(b"123")

    monkeypatch.setattr(ae, "_get_classifier", lambda: FakeClassifier())
    monkeypatch.setattr(ae, "normalize_audio_to_wav16k", lambda _p: str(normalized))

    result = ae.analyze_audio_file("ignored.wav")

    assert result["ok"] is False
    assert result["error"] == "Audio analysis failed"
    assert "classify failed" in result["detail"]
    assert Path(str(normalized)).exists() is False