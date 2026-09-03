from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user_db, get_db, require_student
from app.schemas.streak import HeartbeatOut, StreakStateOut
from app.services.streak import DAILY_TARGET_SECONDS, record_heartbeat, sync_streak

router = APIRouter(prefix="/api/streak", tags=["streak"])


@router.post("/heartbeat", response_model=HeartbeatOut)
async def heartbeat(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Credit ~5 minutes of active time towards today's total.

    Empty body by design — the client sends no timestamp and no duration, so
    all time is server-side and client clock skew is irrelevant.

    The plain (session-detached) `require_student` is correct here: this
    endpoint never touches the User row, only StudentDailyActivity.

    The path is static, not parameterised, so it can be matched exactly by
    the activity-log middleware's SKIP_PATHS — a beat every 5 minutes per
    student must not be logged.
    """
    student = require_student(request)
    active_seconds, counted = await record_heartbeat(db, student.id)
    return HeartbeatOut(
        active_seconds_today=active_seconds,
        target_seconds=DAILY_TARGET_SECONDS,
        counted=counted,
    )


@router.post("/sync", response_model=StreakStateOut)
async def sync(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Catch up unfinalized weeks and return the current week's state.

    POST because it has side effects (counter, marker, notifications), and
    deliberately NOT in the activity log's SKIP_PATHS — it runs about once
    per app load and logging the catch-up is useful.

    `get_current_user_db`, not `require_student`: this mutates the User row,
    and the middleware's detached copy would swallow those writes silently.
    The role check is redundant for a student-only portal but kept explicit.
    """
    require_student(request)
    user = await get_current_user_db(request, db)
    return await sync_streak(db, user)
