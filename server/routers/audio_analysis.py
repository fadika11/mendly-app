import os
import json
import tempfile
import logging
from datetime import datetime, timedelta, timezone, date
from typing import Optional, List

from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from server.services.audio_emotion import analyze_audio_file
from server.deps import get_db
from .auth_routes import _user_id_from_authorization

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audio", tags=["audio"])

MAX_UPLOAD_BYTES = 700_000  # keep requests small/light


def _compute_streak(db: Session, uid: str) -> int:
    rows = db.execute(
        text("""
            SELECT CAST(captured_at AS date) AS d
            FROM dbo.MoodEntries
            WHERE user_id = :uid
            GROUP BY CAST(captured_at AS date)
            ORDER BY d DESC
        """),
        {"uid": uid},
    ).fetchall()

    days: List[date] = [r.d if isinstance(r.d, date) else r.d.date() for r in rows]
    if not days:
        return 0

    streak = 0
    cursor = datetime.now(timezone.utc).date()
    for d in days:
        if d == cursor:
            streak += 1
            cursor = date.fromordinal(cursor.toordinal() - 1)
        elif d > cursor:
            continue
        else:
            break
    return streak


def _rolling_avg(db: Session, uid: str, days: int) -> Optional[float]:
    cut = datetime.now(timezone.utc) - timedelta(days=days)
    r = db.execute(
        text("""
            SELECT AVG(CAST(score AS float)) AS a
            FROM dbo.MoodEntries
            WHERE user_id = :uid AND captured_at >= :cut
        """),
        {"uid": uid, "cut": cut},
    ).fetchone()
    return float(r.a) if r and r.a is not None else None


def emotion_to_score_label(emotion):
    e = str(emotion or "").strip().lower()

    if e in ("happy", "hap", "joy", "positive"):
        return 9, "happy"

    if e in ("sad", "sadness", "low"):
        return 2, "sad"

    if e in ("angry", "anger", "ang", "frustrated"):
        return 3, "stressed"

    if e in ("fear", "fea", "fearful", "anxious", "stress", "stressed"):
        return 3, "stressed"

    if e in ("neutral", "neu", "calm"):
        return 6, "calm"

    return 5, "calm"


@router.post("/analyze-mood")
async def analyze_mood(
    file: UploadFile = File(...),
    user_id: str = Depends(_user_id_from_authorization),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    filename = file.filename or "audio.m4a"
    suffix = os.path.splitext(filename)[1].lower()

    if suffix not in {".m4a", ".mp4", ".wav", ".webm", ".ogg"}:
        suffix = ".m4a"
    fd, temp_path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)

    try:
        content = await file.read()

        if not content:
            raise HTTPException(status_code=400, detail="Uploaded audio file is empty")

        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=400,
                detail="Audio file is too large. Please record a shorter clip.",
            )

        with open(temp_path, "wb") as f:
            f.write(content)

        result = analyze_audio_file(temp_path)
        print("AUDIO ROUTE RESULT:", result)

        if not result.get("ok", False):
            raise HTTPException(status_code=503, detail=result)

        emotion = result.get("emotion", "neutral")
        confidence = result.get("confidence", 0.0)
        score_to_save, label_to_save = emotion_to_score_label(emotion)

        note_text = (
            f"audio_analysis|emotion={emotion}|confidence={confidence}|"
            f"state={result.get('mendly_state')}"
        )

        emoji_map = {
            1: "😞",
            2: "☹️",
            3: "😟",
            5: "😐",
            6: "🙂",
            7: "🙂",
            9: "😊",
            10: "😁",
        }
        emoji_selected = emoji_map.get(score_to_save)
        emoji_json = json.dumps({
            "selected": emoji_selected,
            "score": score_to_save,
            "source": "audio_ai",
            "emotion": emotion,
            "confidence": confidence,
        })

        now = datetime.now(timezone.utc)

        db.execute(
            text("""
                INSERT INTO dbo.MoodEntries
                    (user_id, score, label, text_note_encrypted, emojis_json, captured_at)
                VALUES
                    (:uid, :score, :label, CONVERT(varbinary(max), :note), :emoji_json, :ts)
            """),
            {
                "uid": user_id,
                "score": score_to_save,
                "label": label_to_save,
                "note": note_text,
                "emoji_json": emoji_json,
                "ts": now,
            },
        )
        db.commit()

        streak = _compute_streak(db, user_id)
        avg7 = _rolling_avg(db, user_id, 7)
        avg14 = _rolling_avg(db, user_id, 14)
        avg30 = _rolling_avg(db, user_id, 30)

        db.execute(
            text("""
                MERGE dbo.AdherenceStats AS tgt
                USING (SELECT :uid AS user_id) AS s
                ON tgt.user_id = s.user_id
                WHEN MATCHED THEN
                  UPDATE SET
                    streak_days     = :streak,
                    last_checkin_at = :now,
                    avg_7d          = :avg7,
                    avg_14d         = :avg14,
                    avg_30d         = :avg30
                WHEN NOT MATCHED THEN
                  INSERT (user_id, streak_days, last_checkin_at, avg_7d, avg_14d, avg_30d)
                  VALUES (:uid, :streak, :now, :avg7, :avg14, :avg30);
            """),
            {
                "uid": user_id,
                "streak": streak,
                "now": now,
                "avg7": avg7,
                "avg14": avg14,
                "avg30": avg30,
            },
        )
        db.commit()

        return {
            "ok": True,
            "emotion": emotion,
            "confidence": confidence,
            "mendly_state": result.get("mendly_state"),
            "message": result.get("message"),
            "saved": True,
            "score_saved": score_to_save,
            "label_saved": label_to_save,
            "mood_source": "audio_ai",
            "streak_days": streak,
            "avg_7d": avg7,
            "avg_14d": avg14,
            "avg_30d": avg30,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("[audio route] unexpected error: %s", e)
        raise HTTPException(status_code=500, detail=f"Audio analysis failed: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)