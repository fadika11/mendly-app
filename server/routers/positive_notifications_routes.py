from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import text
import json

from ..deps import get_db
from .auth_routes import _user_id_from_authorization

router = APIRouter(
    prefix="/positive-notifications",
    tags=["positive_notifications"],
)


class PositiveNotificationSettings(BaseModel):
    enabled: bool = Field(
        ...,
        description="Whether positive notifications are on or off",
    )
    frequency_minutes: int = Field(
        ...,
        ge=1,
        le=1440 * 7,
        description="Interval between notifications in minutes",
    )


class TestPositiveNotification(BaseModel):
    body: str | None = None


def _row_to_settings(row) -> PositiveNotificationSettings:
    if row is None:
        return PositiveNotificationSettings(enabled=True, frequency_minutes=60)

    enabled = (
        bool(row.positive_notif_enabled)
        if row.positive_notif_enabled is not None
        else True
    )
    freq = (
        int(row.positive_notif_interval_minutes)
        if row.positive_notif_interval_minutes is not None
        else 60
    )

    return PositiveNotificationSettings(enabled=enabled, frequency_minutes=freq)


@router.get("/settings", response_model=PositiveNotificationSettings)
def get_positive_notifications_settings(
    user_id: str = Depends(_user_id_from_authorization),
    db: Session = Depends(get_db),
):
    row = db.execute(
        text(
            """
            SELECT TOP 1
                positive_notif_enabled,
                positive_notif_interval_minutes
            FROM dbo.UserSettings
            WHERE user_id = :uid
            """
        ),
        {"uid": user_id},
    ).fetchone()

    return _row_to_settings(row)


@router.post("/settings", response_model=PositiveNotificationSettings)
def update_positive_notifications_settings(
    payload: PositiveNotificationSettings,
    user_id: str = Depends(_user_id_from_authorization),
    db: Session = Depends(get_db),
):
    result = db.execute(
        text(
            """
            UPDATE dbo.UserSettings
            SET
                positive_notif_enabled = :enabled,
                positive_notif_interval_minutes = :freq,
                updated_at = SYSDATETIMEOFFSET()
            WHERE user_id = :uid
            """
        ),
        {
            "uid": user_id,
            "enabled": 1 if payload.enabled else 0,
            "freq": payload.frequency_minutes,
        },
    )

    if result.rowcount == 0:
        db.execute(
            text(
                """
                INSERT INTO dbo.UserSettings
                    (user_id,
                     checkin_frequency,
                     motivation_enabled,
                     positive_notif_enabled,
                     positive_notif_interval_minutes)
                VALUES
                    (:uid, :checkin_freq, :motivation_on, :enabled, :freq)
                """
            ),
            {
                "uid": user_id,
                "checkin_freq": 1,
                "motivation_on": 1,
                "enabled": 1 if payload.enabled else 0,
                "freq": payload.frequency_minutes,
            },
        )

    if not payload.enabled:
        db.execute(
            text(
                """
                DELETE FROM dbo.NotificationQueue
                WHERE user_id = :uid
                  AND purpose = N'tip'
                  AND status = N'pending'
                """
            ),
            {"uid": user_id},
        )

    db.commit()
    return payload


@router.post("/send-test", status_code=204)
def send_test_positive_notification(
    payload: TestPositiveNotification,
    user_id: str = Depends(_user_id_from_authorization),
    db: Session = Depends(get_db),
):
    message_body = (
        payload.body
        or "This is a test positive notification from Mendly."
    )

    token_row = db.execute(
        text(
            """
            SELECT TOP 1 token_id
            FROM dbo.UserDeviceTokens
            WHERE user_id = :uid AND is_active = 1
            ORDER BY last_seen DESC
            """
        ),
        {"uid": user_id},
    ).fetchone()

    token_id = token_row.token_id if token_row is not None else None

    payload_json = json.dumps(
        {
            "title": "Mendly",
            "body": message_body,
            "kind": "test_positive",
        }
    )

    db.execute(
        text(
            """
            INSERT INTO dbo.NotificationQueue
                (user_id, token_id, purpose, payload_json, scheduled_at, status)
            VALUES
                (:uid, :token_id, N'tip', :payload_json,
                 SYSDATETIMEOFFSET(), N'pending')
            """
        ),
        {
            "uid": user_id,
            "token_id": token_id,
            "payload_json": payload_json,
        },
    )

    db.commit()
    return