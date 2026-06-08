from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from server.utils.email import send_email
import json

from ..deps import get_db
from .auth_routes import _user_id_from_authorization

router = APIRouter(prefix="/appointments", tags=["appointments"])


# ===================== Models =====================

class IntakeCreate(BaseModel):
    psychologist_user_id: str
    answers: Dict[str, Any]


class IntakePublic(BaseModel):
    intake_id: str
    client_user_id: str
    psychologist_user_id: str
    answers_json: str
    created_at: str


class AvailabilitySlotCreate(BaseModel):
    start_at: str
    end_at: Optional[str] = None


class AvailabilitySlotPublic(BaseModel):
    slot_id: str
    psychologist_user_id: str
    start_at: str
    end_at: Optional[str] = None
    is_booked: bool
    appointment_id: Optional[str] = None
    created_at: Optional[str] = None


class AppointmentCreate(BaseModel):
    psychologist_user_id: str
    intake_id: Optional[str] = None
    availability_slot_id: str


class AppointmentPublic(BaseModel):
    appointment_id: str
    client_user_id: str
    client_username: Optional[str] = None
    client_email: Optional[str] = None
    psychologist_user_id: str
    intake_id: Optional[str]
    availability_slot_id: Optional[str] = None
    start_at: str
    status: str
    notes: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None


class AppointmentStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None


# ===================== Helpers =====================

def _get_role(db: Session, user_id: str) -> str:
    row = db.execute(
        text("SELECT TOP 1 Role FROM dbo.Users WHERE user_id = :uid"),
        {"uid": user_id},
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    return row.Role


def _appointment_public_from_row(row) -> AppointmentPublic:
    return AppointmentPublic(
        appointment_id=str(row.appointment_id),
        client_user_id=str(row.client_user_id),
        client_username=getattr(row, "client_username", None),
        client_email=getattr(row, "client_email", None),
        psychologist_user_id=str(row.psychologist_user_id),
        intake_id=str(row.intake_id) if row.intake_id else None,
        availability_slot_id=str(row.availability_slot_id) if getattr(row, "availability_slot_id", None) else None,
        start_at=str(row.start_at),
        status=row.status,
        notes=row.notes,
        created_at=str(row.created_at),
        updated_at=str(row.updated_at) if row.updated_at else None,
    )


def _slot_public_from_row(row) -> AvailabilitySlotPublic:
    return AvailabilitySlotPublic(
        slot_id=str(row.slot_id),
        psychologist_user_id=str(row.psychologist_user_id),
        start_at=str(row.start_at),
        end_at=str(row.end_at) if row.end_at else None,
        is_booked=bool(row.is_booked),
        appointment_id=str(row.appointment_id) if row.appointment_id else None,
        created_at=str(row.created_at) if row.created_at else None,
    )


# ===================== Availability Slots =====================

@router.post("/availability", response_model=AvailabilitySlotPublic)
def create_availability_slot(
    payload: AvailabilitySlotCreate,
    user_id: str = Depends(_user_id_from_authorization),
    db: Session = Depends(get_db),
):
    role = _get_role(db, user_id)

    if role != "psychologist":
        raise HTTPException(status_code=403, detail="Only psychologists can create available slots")

    try:
        inserted = db.execute(
            text("""
                INSERT INTO dbo.PsychologistAvailabilitySlots
                    (psychologist_user_id, start_at, end_at, is_booked)
                OUTPUT
                    inserted.slot_id,
                    inserted.psychologist_user_id,
                    inserted.start_at,
                    inserted.end_at,
                    inserted.is_booked,
                    inserted.appointment_id,
                    inserted.created_at
                VALUES
                    (:psy_id, :start_at, :end_at, 0)
            """),
            {
                "psy_id": user_id,
                "start_at": payload.start_at,
                "end_at": payload.end_at,
            },
        ).fetchone()

        db.commit()

    except Exception as e:
        db.rollback()
        msg = str(e)

        if "UQ_PsychologistAvailabilitySlots_PsyStart" in msg or "UNIQUE" in msg.upper():
            raise HTTPException(status_code=400, detail="This available time already exists")

        raise

    return _slot_public_from_row(inserted)


@router.get("/availability/my", response_model=List[AvailabilitySlotPublic])
def list_my_availability_slots(
    user_id: str = Depends(_user_id_from_authorization),
    db: Session = Depends(get_db),
):
    role = _get_role(db, user_id)

    if role != "psychologist":
        raise HTTPException(status_code=403, detail="Only psychologists can view their available slots")

    rows = db.execute(
        text("""
            SELECT
                slot_id,
                psychologist_user_id,
                start_at,
                end_at,
                is_booked,
                appointment_id,
                created_at
            FROM dbo.PsychologistAvailabilitySlots
            WHERE psychologist_user_id = :psy_id
              AND start_at >= DATEADD(day, -1, SYSDATETIMEOFFSET())
            ORDER BY start_at ASC
        """),
        {"psy_id": user_id},
    ).fetchall()

    return [_slot_public_from_row(r) for r in rows]


@router.get("/availability", response_model=List[AvailabilitySlotPublic])
def list_available_slots_for_user_booking(
    psychologist_user_id: str,
    date: str,
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text("""
            SELECT
                slot_id,
                psychologist_user_id,
                start_at,
                end_at,
                is_booked,
                appointment_id,
                created_at
            FROM dbo.PsychologistAvailabilitySlots
            WHERE psychologist_user_id = :psy_id
              AND CONVERT(date, start_at) = CONVERT(date, :day)
              AND is_booked = 0
            ORDER BY start_at ASC
        """),
        {"psy_id": psychologist_user_id, "day": date},
    ).fetchall()

    return [_slot_public_from_row(r) for r in rows]


@router.delete("/availability/{slot_id}")
def delete_availability_slot(
    slot_id: str,
    user_id: str = Depends(_user_id_from_authorization),
    db: Session = Depends(get_db),
):
    role = _get_role(db, user_id)

    if role != "psychologist":
        raise HTTPException(status_code=403, detail="Only psychologists can delete available slots")

    slot = db.execute(
        text("""
            SELECT TOP 1 slot_id, is_booked
            FROM dbo.PsychologistAvailabilitySlots
            WHERE slot_id = :slot_id AND psychologist_user_id = :psy_id
        """),
        {"slot_id": slot_id, "psy_id": user_id},
    ).fetchone()

    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    if slot.is_booked:
        raise HTTPException(status_code=400, detail="Cannot delete a slot that is already booked")

    db.execute(
        text("""
            DELETE FROM dbo.PsychologistAvailabilitySlots
            WHERE slot_id = :slot_id AND psychologist_user_id = :psy_id
        """),
        {"slot_id": slot_id, "psy_id": user_id},
    )

    db.commit()

    return {"ok": True}


# ===================== Create Intake =====================

@router.post("/intake", response_model=IntakePublic)
def create_intake(
    payload: IntakeCreate,
    user_id: str = Depends(_user_id_from_authorization),
    db: Session = Depends(get_db),
):
    role = _get_role(db, user_id)

    if role != "regular":
        raise HTTPException(status_code=403, detail="Only regular users can create intake")

    db.execute(
        text("""
            INSERT INTO dbo.AppointmentIntakes (client_user_id, psychologist_user_id, answers_json)
            VALUES (:client_id, :psy_id, :answers_json)
        """),
        {
            "client_id": user_id,
            "psy_id": payload.psychologist_user_id,
            "answers_json": json.dumps(payload.answers, ensure_ascii=False),
        },
    )

    db.commit()

    row = db.execute(
        text("""
            SELECT TOP 1 intake_id, client_user_id, psychologist_user_id, answers_json, created_at
            FROM dbo.AppointmentIntakes
            WHERE client_user_id = :client_id AND psychologist_user_id = :psy_id
            ORDER BY created_at DESC
        """),
        {"client_id": user_id, "psy_id": payload.psychologist_user_id},
    ).fetchone()

    if not row:
        raise HTTPException(status_code=500, detail="Intake created but not found")

    return IntakePublic(
        intake_id=str(row.intake_id),
        client_user_id=str(row.client_user_id),
        psychologist_user_id=str(row.psychologist_user_id),
        answers_json=row.answers_json,
        created_at=str(row.created_at),
    )


# ===================== Create Appointment from saved slot =====================

@router.post("", response_model=AppointmentPublic)
def create_appointment(
    payload: AppointmentCreate,
    user_id: str = Depends(_user_id_from_authorization),
    db: Session = Depends(get_db),
):
    role = _get_role(db, user_id)

    if role != "regular":
        raise HTTPException(status_code=403, detail="Only regular users can request appointments")

    if payload.intake_id:
        chk = db.execute(
            text("""
                SELECT TOP 1 intake_id
                FROM dbo.AppointmentIntakes
                WHERE intake_id = :iid
                  AND client_user_id = :cid
                  AND psychologist_user_id = :pid
            """),
            {
                "iid": payload.intake_id,
                "cid": user_id,
                "pid": payload.psychologist_user_id,
            },
        ).fetchone()

        if not chk:
            raise HTTPException(status_code=400, detail="Invalid intake_id for this user/psychologist")

    try:
        slot = db.execute(
            text("""
                SELECT TOP 1 slot_id, psychologist_user_id, start_at, end_at, is_booked
                FROM dbo.PsychologistAvailabilitySlots WITH (UPDLOCK, HOLDLOCK)
                WHERE slot_id = :slot_id
                  AND psychologist_user_id = :psy_id
            """),
            {
                "slot_id": payload.availability_slot_id,
                "psy_id": payload.psychologist_user_id,
            },
        ).fetchone()

        if not slot:
            raise HTTPException(status_code=404, detail="Available slot not found")

        if slot.is_booked:
            raise HTTPException(status_code=400, detail="This appointment time is already booked")

        inserted = db.execute(
            text("""
                INSERT INTO dbo.Appointments
                    (client_user_id, psychologist_user_id, intake_id, availability_slot_id, start_at, status)
                OUTPUT inserted.appointment_id
                VALUES
                    (:client_id, :psy_id, :intake_id, :slot_id, :start_at, 'requested')
            """),
            {
                "client_id": user_id,
                "psy_id": payload.psychologist_user_id,
                "intake_id": payload.intake_id,
                "slot_id": payload.availability_slot_id,
                "start_at": slot.start_at,
            },
        ).fetchone()

        appointment_id = inserted.appointment_id

        db.execute(
            text("""
                UPDATE dbo.PsychologistAvailabilitySlots
                SET is_booked = 1,
                    appointment_id = :appointment_id
                WHERE slot_id = :slot_id
            """),
            {
                "appointment_id": appointment_id,
                "slot_id": payload.availability_slot_id,
            },
        )

        db.commit()

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise

    row = db.execute(
        text("""
            SELECT TOP 1
                a.appointment_id,
                a.client_user_id,
                a.psychologist_user_id,
                a.intake_id,
                a.availability_slot_id,
                a.start_at,
                a.status,
                a.notes,
                a.created_at,
                a.updated_at,
                u.Username AS client_username,
                u.Email AS client_email
            FROM dbo.Appointments a
            JOIN dbo.Users u ON u.user_id = a.client_user_id
            WHERE a.appointment_id = :appointment_id
        """),
        {"appointment_id": appointment_id},
    ).fetchone()

    if not row:
        raise HTTPException(status_code=500, detail="Appointment created but not found")

    return _appointment_public_from_row(row)


# ===================== Psychologist: list requests =====================

@router.get("/psy", response_model=List[AppointmentPublic])
def list_psy_appointments(
    status_filter: Optional[str] = None,
    user_id: str = Depends(_user_id_from_authorization),
    db: Session = Depends(get_db),
):
    role = _get_role(db, user_id)

    if role != "psychologist":
        raise HTTPException(status_code=403, detail="Only psychologists can view this")

    q = """
        SELECT
            a.appointment_id,
            a.client_user_id,
            a.psychologist_user_id,
            a.intake_id,
            a.availability_slot_id,
            a.start_at,
            a.status,
            a.notes,
            a.created_at,
            a.updated_at,
            u.Username AS client_username,
            u.Email AS client_email
        FROM dbo.Appointments a
        JOIN dbo.Users u
            ON u.user_id = a.client_user_id
        WHERE a.psychologist_user_id = :pid
    """

    params = {"pid": user_id}

    if status_filter:
        q += " AND a.status = :st"
        params["st"] = status_filter

    q += " ORDER BY a.created_at DESC"

    rows = db.execute(text(q), params).fetchall()

    return [_appointment_public_from_row(r) for r in rows]


# ===================== Psychologist: view intake answers =====================

@router.get("/intake/{intake_id}", response_model=IntakePublic)
def get_intake(
    intake_id: str,
    user_id: str = Depends(_user_id_from_authorization),
    db: Session = Depends(get_db),
):
    role = _get_role(db, user_id)

    if role != "psychologist":
        raise HTTPException(status_code=403, detail="Only psychologists can view intakes")

    row = db.execute(
        text("""
            SELECT TOP 1 intake_id, client_user_id, psychologist_user_id, answers_json, created_at
            FROM dbo.AppointmentIntakes
            WHERE intake_id = :iid AND psychologist_user_id = :pid
        """),
        {"iid": intake_id, "pid": user_id},
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Intake not found")

    return IntakePublic(
        intake_id=str(row.intake_id),
        client_user_id=str(row.client_user_id),
        psychologist_user_id=str(row.psychologist_user_id),
        answers_json=row.answers_json,
        created_at=str(row.created_at),
    )


# ===================== Psychologist: approve/reject =====================

@router.put("/{appointment_id}/status", response_model=AppointmentPublic)
def update_appointment_status(
    appointment_id: str,
    payload: AppointmentStatusUpdate,
    user_id: str = Depends(_user_id_from_authorization),
    db: Session = Depends(get_db),
):
    role = _get_role(db, user_id)

    if role != "psychologist":
        raise HTTPException(status_code=403, detail="Only psychologists can update status")

    allowed = {"approved", "rejected", "canceled", "completed"}

    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {sorted(allowed)}")

    db.execute(
        text("""
            UPDATE dbo.Appointments
            SET status = :st,
                notes = :notes,
                updated_at = SYSDATETIMEOFFSET()
            WHERE appointment_id = :aid AND psychologist_user_id = :pid
        """),
        {
            "st": payload.status,
            "notes": payload.notes,
            "aid": appointment_id,
            "pid": user_id,
        },
    )

    if payload.status in {"rejected", "canceled"}:
        db.execute(
            text("""
                UPDATE s
                SET s.is_booked = 0,
                    s.appointment_id = NULL
                FROM dbo.PsychologistAvailabilitySlots s
                JOIN dbo.Appointments a
                  ON a.availability_slot_id = s.slot_id
                WHERE a.appointment_id = :aid
                  AND a.psychologist_user_id = :pid
            """),
            {
                "aid": appointment_id,
                "pid": user_id,
            },
        )

    db.commit()

    row = db.execute(
        text("""
            SELECT TOP 1
                a.appointment_id,
                a.client_user_id,
                a.psychologist_user_id,
                a.intake_id,
                a.availability_slot_id,
                a.start_at,
                a.status,
                a.notes,
                a.created_at,
                a.updated_at,
                u.Username AS client_username,
                u.Email AS client_email
            FROM dbo.Appointments a
            JOIN dbo.Users u ON u.user_id = a.client_user_id
            WHERE a.appointment_id = :aid
        """),
        {"aid": appointment_id},
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if payload.status in {"approved", "rejected"} and row.client_email:
        if payload.status == "approved":
            subject = "Your appointment has been approved"
            body = f"""Hello {row.client_username},

Your appointment request has been APPROVED.

Scheduled time:
{row.start_at}

Best regards,
Mendly Team
"""
        else:
            subject = "Your appointment request was declined"
            body = f"""Hello {row.client_username},

Unfortunately, your appointment request was DECLINED.

You may request another appointment.

Best regards,
Mendly Team
"""

        send_email(row.client_email, subject, body)

    return _appointment_public_from_row(row)