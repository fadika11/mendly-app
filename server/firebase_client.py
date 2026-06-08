import os
import logging
from typing import Optional, Dict

import firebase_admin  # type: ignore
from firebase_admin import credentials, messaging  # type: ignore

log = logging.getLogger("mendly.firebase")

FCM_CREDENTIALS = os.getenv("FCM_CREDENTIALS", "server/firebase-key.json")

FCM_ENABLED = False

try:
    if not os.path.isfile(FCM_CREDENTIALS):
        raise FileNotFoundError(f"Service account file not found: {FCM_CREDENTIALS}")

    if not firebase_admin._apps:
        cred = credentials.Certificate(FCM_CREDENTIALS)
        firebase_admin.initialize_app(cred)

    FCM_ENABLED = True
    log.info("[firebase] FCM initialized with credentials: %s", FCM_CREDENTIALS)
except Exception as e:
    log.warning(
        "[firebase] FCM disabled (no valid credentials). "
        "Reason: %r. Notifications will be skipped.", e
    )
    FCM_ENABLED = False


def send_push_to_token(
    token: str,
    title: str,
    body: str,
    data: Optional[Dict[str, str]] = None,
):
    if not FCM_ENABLED:
        log.info(
            "[firebase] Skipping push to %s because FCM is disabled (no credentials).",
            token[:12] + "..." if token else "<no-token>",
        )
        return False, "fcm_disabled"

    msg = messaging.Message(
        notification=messaging.Notification(title=title, body=body),
        token=token,
        data={k: str(v) for k, v in (data or {}).items()},
    )

    resp = messaging.send(msg)
    log.info("[firebase] Sent push to token %s... -> %s", token[:12], resp)
    return True, None, resp