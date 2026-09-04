import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user_db, get_db, require_student
from app.models.student_daily_activity import StudentDailyActivity
from app.schemas.streak import StreakStateOut, UsageIn, UsageOut
from app.services.streak import (
    DAILY_GOAL_SECONDS,
    HEAVY_DAY_SECONDS,
    POLL_CADENCE_SECONDS,
    TYPICAL_WINDOW_DAYS,
    record_usage,
    sync_streak,
    typical_seconds,
    usage_band,
)
from app.utils.ist import ist_today

router = APIRouter(prefix="/api/streak", tags=["streak"])


async def _usage_response(
    db: AsyncSession, student_id: uuid.UUID, active_seconds: int, counted: bool
) -> UsageOut:
    """Shared tail for both usage endpoints.

    The typical-usage mean needs a small history read, which is why this is
    not inlined: the deprecated alias must return the identical shape so an
    old client bundle keeps rendering while it is still in the wild.

    This is the hottest authenticated path in the app (once a minute per
    active student), so the read is one indexed range scan over at most
    fourteen narrow rows and nothing else.
    """
    today = ist_today()
    rows = (
        await db.execute(
            select(
                StudentDailyActivity.activity_date, StudentDailyActivity.active_seconds
            ).where(
                StudentDailyActivity.student_id == student_id,
                StudentDailyActivity.activity_date >= today - timedelta(days=TYPICAL_WINDOW_DAYS),
                StudentDailyActivity.activity_date < today,
            )
        )
    ).all()
    typical = typical_seconds({d: s for d, s in rows}, today)
    return UsageOut(
        active_seconds_today=active_seconds,
        goal_seconds=DAILY_GOAL_SECONDS,
        goal_met=active_seconds >= DAILY_GOAL_SECONDS,
        typical_seconds=typical,
        band=usage_band(active_seconds, typical),
        heavy_day_seconds=HEAVY_DAY_SECONDS,
        counted=counted,
    )


@router.post("/usage", response_model=UsageOut)
async def usage(
    request: Request,
    payload: UsageIn,
    db: AsyncSession = Depends(get_db),
):
    """Credit measured engaged time towards today's total.

    The client sends only a DURATION, never a timestamp, so client clock skew
    is irrelevant — the server dates the row with `ist_today()` at request
    time and clamps the claim against its own wall-clock.

    The plain (session-detached) `require_student` is correct here: this
    endpoint never touches the User row, only StudentDailyActivity.

    The path is static, not parameterised, so it can be matched exactly by
    the activity-log middleware's SKIP_PATHS — a poll every 60 seconds per
    student must not be logged.
    """
    student = require_student(request)
    active_seconds, counted = await record_usage(db, student.id, payload.engaged_seconds)
    return await _usage_response(db, student.id, active_seconds, counted)


@router.post("/heartbeat", response_model=UsageOut, deprecated=True)
async def heartbeat(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """DEPRECATED — the empty-body heartbeat from the weekly streak model.

    Kept for exactly one release. Student-portal bundles already loaded in a
    browser will keep POSTing this path after deploy, and a 404 stops their
    tracker for the rest of the session (StreakContext halts on the first
    non-2xx by design). It credits a flat poll interval, still clamped
    against wall-clock, and returns the new response shape.

    Remove this once the old bundle can no longer be in circulation.
    """
    student = require_student(request)
    active_seconds, counted = await record_usage(db, student.id, POLL_CADENCE_SECONDS)
    return await _usage_response(db, student.id, active_seconds, counted)


@router.post("/sync", response_model=StreakStateOut)
async def sync(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Catch up unfinalized days and return the current streak state.

    POST because it has side effects (streak columns, day statuses,
    notifications), and deliberately NOT in the activity log's SKIP_PATHS —
    it runs about once per app load and logging the catch-up is useful.

    `get_current_user_db`, not `require_student`: this mutates the User row,
    and the middleware's detached copy would swallow those writes silently.
    The role check is redundant for a student-only portal but kept explicit.
    """
    require_student(request)
    user = await get_current_user_db(request, db)
    return await sync_streak(db, user)
