from typing import List, Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from sqlalchemy.orm import Session
from sqlalchemy import text

from ..deps import get_db
from ..auth import get_current_user
from ..models import User
from ..services.local_ai_chat import ask_local_ai

router = APIRouter(prefix="/ai", tags=["ai-chat"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str


def normalize(s: str) -> str:
    return (s or "").strip().lower()


def estimate_mood_score(text: str) -> int:
    lower = normalize(text)
    score = 5

    if any(w in lower for w in ["very happy", "amazing", "fantastic", "wonderful", "ecstatic"]):
        score = 9
    elif any(w in lower for w in ["happy", "good", "great", "excited", "grateful", "proud"]):
        score = 7
    elif any(w in lower for w in ["depressed", "terrible", "awful", "hopeless", "miserable"]):
        score = 1
    elif any(w in lower for w in ["angry", "furious", "mad", "rage", "frustrated"]):
        score = 2
    elif any(w in lower for w in ["anxious", "anxiety", "worried", "panic", "stressed", "overwhelmed"]):
        score = 4
    elif any(w in lower for w in ["sad", "down", "unhappy", "low", "lonely"]):
        score = 3
    elif any(w in lower for w in ["tired", "exhausted", "burnt out", "burned out", "fatigued"]):
        score = 4
    elif any(w in lower for w in ["bored", "meh", "nothing to do"]):
        score = 5
    elif any(w in lower for w in ["confused", "lost", "don’t know", "don't know"]):
        score = 4

    return max(0, min(10, score))


def mood_label_from_score(score: int) -> str:
    if score >= 8:
        return "Very positive"
    if score >= 6:
        return "Positive"
    if score >= 4:
        return "Neutral / mixed"
    if score >= 2:
        return "Low / sad"
    return "Very low"


@router.get("/chat/history")
def get_chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.execute(
        text(
            """
            SELECT role, content, created_at
            FROM dbo.AiChatMessages
            WHERE user_id = :uid
            ORDER BY created_at ASC
            """
        ),
        {"uid": current_user.user_id},
    ).fetchall()

    return [
        {
            "role": r.role,
            "content": r.content,
            "created_at": r.created_at.isoformat() if getattr(r, "created_at", None) else None,
        }
        for r in rows
    ]


@router.delete("/chat/history")
def clear_chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.execute(
        text(
            """
            DELETE FROM dbo.AiChatMessages
            WHERE user_id = :uid
            """
        ),
        {"uid": current_user.user_id},
    )
    db.commit()
    return {"ok": True}


@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatResponse:
    bounded_history = req.history[-20:] if req.history else []

    try:
        reply = ask_local_ai(
            req.message,
            [{"role": m.role, "content": m.content} for m in bounded_history],
        )
    except Exception as e:
        print("[AI] local model error:", e)
        raise HTTPException(
            status_code=500,
            detail="Local AI is unavailable right now. Make sure Ollama is running.",
        )

    try:
        db.execute(
            text(
                """
                INSERT INTO dbo.AiChatMessages (user_id, role, content)
                VALUES (:uid, :role, :content)
                """
            ),
            {
                "uid": current_user.user_id,
                "role": "user",
                "content": req.message,
            },
        )

        db.execute(
            text(
                """
                INSERT INTO dbo.AiChatMessages (user_id, role, content)
                VALUES (:uid, :role, :content)
                """
            ),
            {
                "uid": current_user.user_id,
                "role": "assistant",
                "content": reply,
            },
        )

        user_texts = [m.content for m in bounded_history if m.role == "user"]
        user_texts.append(req.message)
        recent_user_note = "\n".join(user_texts[-10:]).strip()

        if recent_user_note:
            mood_score = estimate_mood_score(recent_user_note)
            label = mood_label_from_score(mood_score)

            db.execute(
                text(
                    """
                    INSERT INTO dbo.MoodEntries
                        (user_id, checkin_slot, score, label,
                         text_note_encrypted, emojis_json,
                         captured_at, created_at)
                    VALUES
                        (
                            :uid,
                            :slot,
                            :score,
                            :label,
                            CONVERT(VARBINARY(MAX), :note),
                            :emojis,
                            SYSDATETIMEOFFSET(),
                            SYSDATETIMEOFFSET()
                        )
                    """
                ),
                {
                    "uid": current_user.user_id,
                    "slot": None,
                    "score": mood_score,
                    "label": label,
                    "note": recent_user_note,
                    "emojis": None,
                },
            )

        db.commit()

    except Exception as e:
        print("[AI] Failed to save AI chat or mood entry:", e)
        db.rollback()

    return ChatResponse(reply=reply)