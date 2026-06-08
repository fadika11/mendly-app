import asyncio
import json
import logging

from sqlalchemy import text
from .db import SessionLocal
from .firebase_client import send_push_to_token

log = logging.getLogger("mendly.notifications")

POLL_INTERVAL_SECONDS = 15


def _enqueue_due_positive_notifications(db) -> None:
    db.execute(
        text(
            """
            ;WITH LastTip AS (
                SELECT
                    q.user_id,
                    MAX(COALESCE(q.sent_at, q.scheduled_at)) AS last_tip_at
                FROM dbo.NotificationQueue q
                WHERE q.purpose = N'tip'
                GROUP BY q.user_id
            )
            INSERT INTO dbo.NotificationQueue (
                user_id,
                token_id,
                purpose,
                payload_json,
                scheduled_at,
                status
            )
            SELECT
                s.user_id,
                NULL,
                N'tip',
                N'{
                    "title": "Mendly",
                    "body": "Take one small positive pause with Mendly today."
                }',
                SYSDATETIMEOFFSET(),
                N'pending'
            FROM dbo.UserSettings s
            LEFT JOIN LastTip lt
                ON lt.user_id = s.user_id
            WHERE s.positive_notif_enabled = 1
              AND NOT EXISTS (
                    SELECT 1
                    FROM dbo.NotificationQueue qp
                    WHERE qp.user_id = s.user_id
                      AND qp.purpose = N'tip'
                      AND qp.status = N'pending'
              )
              AND (
                    lt.last_tip_at IS NULL
                    OR DATEADD(MINUTE, s.positive_notif_interval_minutes, lt.last_tip_at) <= SYSDATETIMEOFFSET()
              )
            """
        )
    )


async def _send_one_job(db, job_row) -> None:
    job_id = job_row.job_id
    user_id = job_row.user_id
    purpose = job_row.purpose
    payload_json = job_row.payload_json

    token_row = db.execute(
        text(
            """
            SELECT TOP 1 fcm_token
            FROM dbo.UserDeviceTokens
            WHERE user_id = :uid AND is_active = 1
            ORDER BY last_seen DESC
            """
        ),
        {"uid": user_id},
    ).fetchone()

    if not token_row:
        db.execute(
            text(
                """
                UPDATE dbo.NotificationQueue
                SET status = N'failed',
                    error = N'no_active_device_token',
                    sent_at = SYSDATETIMEOFFSET()
                WHERE job_id = :jid
                """
            ),
            {"jid": job_id},
        )
        log.warning("Notification job %s failed: no active device token", job_id)
        return

    fcm_token = token_row.fcm_token

    try:
        payload = json.loads(payload_json)
    except Exception:
        payload = {}

    title = payload.get("title", "Mendly")
    body = payload.get("body", "You have a new notification")

    try:
        send_result = send_push_to_token(
            token=fcm_token,
            title=title,
            body=body,
            data={"purpose": purpose},
        )

        ok = False
        err = None

        if isinstance(send_result, tuple):
            ok = bool(send_result[0])
            err = send_result[1] if len(send_result) > 1 else None
        else:
            ok = bool(send_result)
            err = None

    except Exception as e:
        ok = False
        err = str(e)
        log.warning("FCM send raised exception for job %s: %r", job_id, e)

    if ok:
        db.execute(
            text(
                """
                UPDATE dbo.NotificationQueue
                SET status = N'sent',
                    sent_at = SYSDATETIMEOFFSET(),
                    error = NULL
                WHERE job_id = :jid
                """
            ),
            {"jid": job_id},
        )
        log.info(
            "Sent notification job %s (purpose=%s) to user %s",
            job_id,
            purpose,
            user_id,
        )
    else:
        db.execute(
            text(
                """
                UPDATE dbo.NotificationQueue
                SET status = N'failed',
                    error = :err,
                    sent_at = SYSDATETIMEOFFSET()
                WHERE job_id = :jid
                """
            ),
            {"jid": job_id, "err": err or "unknown error"},
        )
        log.warning("Failed to send notification job %s: %s", job_id, err)


async def notification_loop(poll_interval: int = POLL_INTERVAL_SECONDS) -> None:
    while True:
        try:
            with SessionLocal() as db:
                _enqueue_due_positive_notifications(db)

                jobs = db.execute(
                    text(
                        """
                        SELECT TOP 50 job_id, user_id, purpose, payload_json
                        FROM dbo.NotificationQueue
                        WHERE status = N'pending'
                          AND scheduled_at <= SYSDATETIMEOFFSET()
                          AND purpose IN (N'checkin_reminder', N'weekly_summary', N'tip')
                        ORDER BY scheduled_at
                        """
                    )
                ).fetchall()

                for job in jobs:
                    await _send_one_job(db, job)

                db.commit()

        except Exception as e:
            log.exception("Error in notification_loop: %r", e)

        await asyncio.sleep(poll_interval)


def start_worker(interval_seconds: int = POLL_INTERVAL_SECONDS) -> None:
    log.info(
        "[notifications] background worker starting (interval=%s)",
        interval_seconds,
    )
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(notification_loop(interval_seconds))