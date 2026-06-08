# server/routers/control_circle_routes.py
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
import random
from ..deps import get_db
from .auth_routes import _user_id_from_authorization

router = APIRouter(prefix="/control-circle", tags=["control-circle"])


class ControlCirclePromptPublic(BaseModel):
    prompt_id: str
    label: str
    category_hint: Optional[str] = None
    can_control_message: str
    cannot_control_message: str


class ControlCircleEntryCreate(BaseModel):
    prompt_id: Optional[str] = None
    prompt_text: str
    selected_zone: str  # can_control / cannot_control


class ControlCircleEntryPublic(BaseModel):
    entry_id: str
    user_id: str
    prompt_id: Optional[str] = None
    prompt_text: str
    selected_zone: str
    feedback_message: str
    created_at: str


def _default_message(prompt_text: str, selected_zone: str) -> str:
    can_control_templates = [
        (
            "For “{text}”, start with one small step you can do today. "
            "Even a simple action can help your mind feel more organized."
        ),
        (
            "You moved “{text}” into what you can handle. Try choosing one practical action: "
            "write it down, make a short plan, or talk to someone you trust."
        ),
        (
            "“{text}” may feel heavy, but you do not need to solve it all at once. "
            "Focus on one small thing you can do in the next few minutes."
        ),
        (
            "For “{text}”, try to turn the worry into a small action. "
            "A tiny step is still progress."
        ),
        (
            "You have some control over how you respond to “{text}”. "
            "Pause, breathe, and choose one helpful action for right now."
        ),
        (
            "“{text}” is now in your control circle. "
            "Try to focus on what is possible today, not everything at once."
        ),
        (
            "For “{text}”, pick one grounding action: drink water, organize one thing, "
            "take a short walk, or send a message to someone supportive."
        ),
        (
            "You are not ignoring “{text}”; you are choosing to handle it step by step. "
            "Start with the smallest step that feels possible."
        ),
    ]

    cannot_control_templates = [
        (
            "“{text}” may not be fully in your control right now. "
            "Try to release what you cannot solve today and return to one safe step in the present."
        ),
        (
            "It is okay if “{text}” feels too big right now. "
            "You do not have to carry everything at once."
        ),
        (
            "Some parts of “{text}” may be outside your control. "
            "Focus on caring for yourself while the situation is uncertain."
        ),
        (
            "You may not be able to control “{text}”, but you can control how gently you treat yourself right now."
        ),
    ]

    templates = (
        can_control_templates
        if selected_zone == "can_control"
        else cannot_control_templates
    )

    template = random.choice(templates)
    return template.format(text=prompt_text)


@router.get("/prompts", response_model=List[ControlCirclePromptPublic])
def list_control_circle_prompts(
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text("""
            SELECT TOP 8
                prompt_id,
                label,
                category_hint,
                can_control_message,
                cannot_control_message
            FROM dbo.ControlCirclePrompts
            WHERE is_active = 1
            ORDER BY NEWID()
        """)
    ).fetchall()

    return [
        ControlCirclePromptPublic(
            prompt_id=str(r.prompt_id),
            label=r.label,
            category_hint=r.category_hint,
            can_control_message=r.can_control_message,
            cannot_control_message=r.cannot_control_message,
        )
        for r in rows
    ]


@router.post("/entries", response_model=ControlCircleEntryPublic)
def create_control_circle_entry(
    payload: ControlCircleEntryCreate,
    user_id: str = Depends(_user_id_from_authorization),
    db: Session = Depends(get_db),
):
    selected_zone = payload.selected_zone.strip()

    if selected_zone not in {"can_control", "cannot_control"}:
        raise HTTPException(
            status_code=400,
            detail="selected_zone must be can_control or cannot_control",
        )

    prompt_text = payload.prompt_text.strip()

    if not prompt_text:
        raise HTTPException(status_code=400, detail="prompt_text is required")

    prompt_id = payload.prompt_id
    feedback_message = None

    if prompt_id:
        prompt = db.execute(
            text("""
                SELECT TOP 1
                    prompt_id,
                    label,
                    can_control_message,
                    cannot_control_message
                FROM dbo.ControlCirclePrompts
                WHERE prompt_id = :pid AND is_active = 1
            """),
            {"pid": prompt_id},
        ).fetchone()

        if not prompt:
            raise HTTPException(status_code=404, detail="Prompt not found")

        prompt_text = prompt.label

        if selected_zone == "can_control":
            feedback_message = prompt.can_control_message
        else:
            feedback_message = prompt.cannot_control_message

    if feedback_message is None:
        feedback_message = _default_message(prompt_text, selected_zone)

    row = db.execute(
        text("""
            INSERT INTO dbo.UserControlCircleEntries
                (user_id, prompt_id, prompt_text, selected_zone, feedback_message)
            OUTPUT
                inserted.entry_id,
                inserted.user_id,
                inserted.prompt_id,
                inserted.prompt_text,
                inserted.selected_zone,
                inserted.feedback_message,
                inserted.created_at
            VALUES
                (:user_id, :prompt_id, :prompt_text, :selected_zone, :feedback_message)
        """),
        {
            "user_id": user_id,
            "prompt_id": prompt_id,
            "prompt_text": prompt_text,
            "selected_zone": selected_zone,
            "feedback_message": feedback_message,
        },
    ).fetchone()

    db.commit()

    return ControlCircleEntryPublic(
        entry_id=str(row.entry_id),
        user_id=str(row.user_id),
        prompt_id=str(row.prompt_id) if row.prompt_id else None,
        prompt_text=row.prompt_text,
        selected_zone=row.selected_zone,
        feedback_message=row.feedback_message,
        created_at=str(row.created_at),
    )


@router.get("/history", response_model=List[ControlCircleEntryPublic])
def list_control_circle_history(
    user_id: str = Depends(_user_id_from_authorization),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text("""
            SELECT TOP 30
                entry_id,
                user_id,
                prompt_id,
                prompt_text,
                selected_zone,
                feedback_message,
                created_at
            FROM dbo.UserControlCircleEntries
            WHERE user_id = :uid
            ORDER BY created_at DESC
        """),
        {"uid": user_id},
    ).fetchall()

    return [
        ControlCircleEntryPublic(
            entry_id=str(r.entry_id),
            user_id=str(r.user_id),
            prompt_id=str(r.prompt_id) if r.prompt_id else None,
            prompt_text=r.prompt_text,
            selected_zone=r.selected_zone,
            feedback_message=r.feedback_message,
            created_at=str(r.created_at),
        )
        for r in rows
    ]