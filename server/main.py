import os
import asyncio
import logging
import threading
from typing import AsyncIterator
from pathlib import Path

from fastapi import FastAPI  # type: ignore
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles  # type: ignore
from sqlalchemy import text  # type: ignore
from starlette.requests import Request
from starlette.responses import Response

from .db import engine, SessionLocal
from .init_db import ensure_database_and_schema
from .routers import (
    journey_routes,
    auth_routes,
    ai_routes,
    checkin_routes,
    positive_notifications_routes,
    device_routes,
    support_routes,
    screenings_routes,
    photo_memory_routes,
    appointments_routes,
    psychologists_routes,
    psychologist_routes,
    audio_analysis,
    control_circle_routes,
)
from .notification_worker import start_worker
from server.services.audio_emotion import preload_classifier

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
log = logging.getLogger("mendly.startup")

INIT_DB_ON_STARTUP = os.getenv("INIT_DB_ON_STARTUP", "1") == "1"
DB_WARMUP_ON_STARTUP = os.getenv("DB_WARMUP_ON_STARTUP", "0") == "1"
DB_PING_TIMEOUT_SEC = float(os.getenv("DB_PING_TIMEOUT_SEC", "1.5"))

NOTIF_WORKER_ENABLED = os.getenv("NOTIF_WORKER_ENABLED", "1") == "1"
NOTIF_WORKER_INTERVAL_SEC = int(os.getenv("NOTIF_WORKER_INTERVAL_SEC", "60"))

CORS_ALLOW_ALL = os.getenv("CORS_ALLOW_ALL", "1") == "1"

STRICT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost",
    "http://127.0.0.1",
    "http://10.0.2.2",
    "http://10.0.2.2:5173",
    "http://10.0.2.2:8000",
    "capacitor://localhost",
    "http://localhost:8080",
]


async def _ping_db_quick() -> None:
    if DB_PING_TIMEOUT_SEC <= 0:
        log.info("[startup] quick DB ping disabled.")
        return

    def _do_ping():
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))

    try:
        await asyncio.wait_for(asyncio.to_thread(_do_ping), timeout=DB_PING_TIMEOUT_SEC)
        log.info("[startup] quick DB ping OK.")
    except asyncio.TimeoutError:
        log.info("[startup] quick DB ping skipped (timeout %.1fs).", DB_PING_TIMEOUT_SEC)
    except Exception as e:
        log.warning("[startup] quick DB ping failed: %r", e)


def _safe_db_warmup() -> None:
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        log.info("[startup] DB warmup OK.")
    except Exception as e:
        log.info("[startup] DB warmup skipped/failed: %r", e)


async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    if INIT_DB_ON_STARTUP:
        await asyncio.to_thread(ensure_database_and_schema)
        log.info("[startup] ensure_database_and_schema finished.")

    await _ping_db_quick()

    if DB_WARMUP_ON_STARTUP:
        await asyncio.to_thread(_safe_db_warmup)

    # Preload audio emotion model so first audio analysis is faster
    AUDIO_PRELOAD_ON_STARTUP = os.getenv("AUDIO_PRELOAD_ON_STARTUP", "0") == "1"
    if AUDIO_PRELOAD_ON_STARTUP:
        await asyncio.to_thread(preload_classifier)
        log.info("[startup] audio emotion classifier preload finished.")
    else:
        log.info("[startup] audio emotion classifier preload skipped.")

    if NOTIF_WORKER_ENABLED:
        def _run_worker():
            start_worker(interval_seconds=NOTIF_WORKER_INTERVAL_SEC)

        t = threading.Thread(target=_run_worker, daemon=True)
        t.start()
        log.info(
            "[startup] notification worker thread started (interval=%ss)",
            NOTIF_WORKER_INTERVAL_SEC,
        )

    yield


app = FastAPI(lifespan=lifespan)


@app.middleware("http")
async def log_origin(request: Request, call_next):
    if request.method == "OPTIONS":
        print("OPTIONS Origin:", request.headers.get("origin"))
        print("Req-Method:", request.headers.get("access-control-request-method"))
        print("Req-Headers:", request.headers.get("access-control-request-headers"))
    return await call_next(request)


@app.options("/{path:path}")
async def options_any(path: str):
    return Response(status_code=204)


@app.post("/debug/log")
async def debug_log(req: Request):
    data = await req.json()
    print("DEBUG LOG:", data)
    return {"ok": True}


if CORS_ALLOW_ALL:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        max_age=86400,
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=STRICT_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        max_age=86400,
    )

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MEDIA_ROOT = PROJECT_ROOT / "media"
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(MEDIA_ROOT)), name="media")

app.include_router(auth_routes.router)
app.include_router(journey_routes.router)
app.include_router(ai_routes.router)
app.include_router(checkin_routes.router)
app.include_router(positive_notifications_routes.router)
app.include_router(device_routes.router)
app.include_router(support_routes.router)
app.include_router(screenings_routes.router)
app.include_router(photo_memory_routes.router)
app.include_router(appointments_routes.router)
app.include_router(psychologists_routes.router)
app.include_router(psychologist_routes.router)
app.include_router(audio_analysis.router)
app.include_router(control_circle_routes.router)


@app.get("/health/db")
def health_db():
    with engine.connect() as conn:
        return {"ok": True, "db": conn.execute(text("SELECT DB_NAME()")).scalar_one()}
