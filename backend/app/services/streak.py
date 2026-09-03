"""Student Day Streak — evaluation rules and the DB layer around them.

Rules (locked with the client):
  * A day "counts" when the student accumulates >= 1 hour of active platform
    time on that IST calendar date. Non-contiguous — sessions sum.
  * A week runs Monday..Sunday in IST and is a binary achievement.
  * One *isolated* missed day is forgiven; two *consecutive* misses break the
    week. Grace never carries across a week boundary.

Nothing here runs on a schedule. Weeks are evaluated lazily whenever the
student's app calls in, anchored on a persisted "last finalized week" marker
rather than on "yesterday" or "Monday", so a student who skips days — or
weeks — is caught up correctly whenever they next appear.

Concurrency note, and it matters: this codebase has NO optimistic locking.
`version` (app/audit.py) is a plain counter incremented in a before_flush
hook, not SQLAlchemy's `version_id_col`, so two concurrent writes to a row
raise nothing at all — it is a silent last-writer-wins. Both entry points
below therefore avoid read-then-write by construction:
  * `record_heartbeat` is a single atomic conditional UPDATE.
  * `sync_streak` serializes per student on a Postgres advisory lock and
    re-reads the marker after acquiring it.
Note that the test suite runs on one shared aiosqlite connection via
StaticPool, which serializes at the driver level — a green test run is
evidence the *logic* is right, never that the *concurrency* fix works.
"""

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import case, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.student_daily_activity import StudentDailyActivity
from app.models.user import User
from app.schemas.streak import StreakStateOut
from app.services.notification_service import build_notification, push_notification
from app.utils.ist import ist_date_of, ist_today, week_end, week_start

DAILY_TARGET_SECONDS = 3600
HEARTBEAT_CREDIT_SECONDS = 300
MIN_BEAT_GAP_SECONDS = 240
MAX_DAILY_SECONDS = 86400

# Arbitrary but stable namespace for pg_advisory_xact_lock, so streak locks
# can never collide with run_migrations()'s lock key 1.
_LOCK_NAMESPACE = 29


# --------------------------------------------------------------------------
# Pure layer — no DB, unit-testable standalone.
# --------------------------------------------------------------------------


def week_status(day_seconds: list[int], days_elapsed: int) -> str:
    """Classify a week from 7 Mon..Sun second-totals (0 for days not yet reached).

    `days_elapsed` is how many *complete* days the week has so far — i.e.
    `today.weekday()` mid-week, or 7 to finalize a finished week.
    Returns 'broken' | 'at_risk' | 'on_track'.

    A week is broken iff its pattern of misses contains two in a row. Note
    this is deliberately not a *count* of misses: the pattern ✗✓✗ is two
    misses with no adjacent pair and is still salvageable.

    At days_elapsed=7 this can still return 'at_risk' (a lone trailing Sunday
    miss). That is harmless — week_achieved() only tests != 'broken' — but a
    caller finalizing a complete week must treat anything other than 'broken'
    as achieved rather than branching on the exact label.
    """
    misses = 0
    for s in day_seconds[:days_elapsed]:
        misses = 0 if s >= DAILY_TARGET_SECONDS else misses + 1
        if misses >= 2:
            return "broken"
    if days_elapsed >= 1 and day_seconds[days_elapsed - 1] < DAILY_TARGET_SECONDS:
        return "at_risk"
    return "on_track"


def week_achieved(day_seconds: list[int]) -> bool:
    """Did a *complete* week earn its streak?"""
    return week_status(day_seconds, 7) != "broken"


# --------------------------------------------------------------------------
# DB layer
# --------------------------------------------------------------------------


def _fmt_day(d: date) -> str:
    """'Tue, Sep 2' — platform-independent (%-d / %#d are not portable)."""
    return f"{d:%a, %b} {d.day}"


async def record_heartbeat(db: AsyncSession, student_id: uuid.UUID) -> tuple[int, bool]:
    """Credit one heartbeat towards today's active time.

    Returns (active_seconds_today, counted).

    Credit is a fixed +300s per accepted beat rather than the elapsed time
    since the last beat, which is what lets the whole accept/credit decision
    be one atomic conditional UPDATE with no read first. Two tabs beating at
    once therefore cannot both pass the gap check and double-credit: the
    second UPDATE's WHERE clause simply matches no rows.
    """
    today = ist_today()
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=MIN_BEAT_GAP_SECONDS)

    credited = StudentDailyActivity.active_seconds + HEARTBEAT_CREDIT_SECONDS
    clamped = case((credited > MAX_DAILY_SECONDS, MAX_DAILY_SECONDS), else_=credited)

    async def _try_update() -> int | None:
        stmt = (
            update(StudentDailyActivity)
            .where(
                StudentDailyActivity.student_id == student_id,
                StudentDailyActivity.activity_date == today,
                (StudentDailyActivity.last_beat_at.is_(None))
                | (StudentDailyActivity.last_beat_at <= cutoff),
            )
            .values(active_seconds=clamped, last_beat_at=now)
            .returning(StudentDailyActivity.active_seconds)
            .execution_options(synchronize_session=False)
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    seconds = await _try_update()
    if seconds is not None:
        await db.commit()
        return seconds, True

    # Zero rows matched: either there is no row for today yet, or the beat
    # arrived inside the dedup gap. One SELECT tells them apart.
    existing = (
        await db.execute(
            select(StudentDailyActivity.active_seconds).where(
                StudentDailyActivity.student_id == student_id,
                StudentDailyActivity.activity_date == today,
            )
        )
    ).scalar_one_or_none()

    if existing is not None:
        # Rejected beat — release the write transaction the no-op UPDATE
        # opened rather than leaving it for session teardown.
        await db.rollback()
        return existing, False

    row = StudentDailyActivity(
        student_id=student_id,
        activity_date=today,
        active_seconds=HEARTBEAT_CREDIT_SECONDS,
        last_beat_at=now,
    )
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        # A simultaneous first-beat-of-the-day won the race and created the
        # row. Retry as the conditional UPDATE so its gap check applies.
        await db.rollback()
        seconds = await _try_update()
        if seconds is not None:
            await db.commit()
            return seconds, True
        await db.rollback()
        current = (
            await db.execute(
                select(StudentDailyActivity.active_seconds).where(
                    StudentDailyActivity.student_id == student_id,
                    StudentDailyActivity.activity_date == today,
                )
            )
        ).scalar_one_or_none()
        await db.rollback()
        return current or 0, False

    return HEARTBEAT_CREDIT_SECONDS, True


async def _lock_student(db: AsyncSession, student_id: uuid.UUID) -> None:
    """Serialize streak evaluation per student.

    Mirrors main.py's run_migrations(), which takes a Postgres advisory lock
    with a documented fallback for SQLite. Transaction-scoped, so it is
    released by the single commit (or by a rollback on error) at the end of
    sync_streak — a session-scoped lock would leak, because SQLAlchemy
    returns the connection to the pool on commit and a later checkout could
    be a different backend entirely.
    """
    try:
        dialect = db.get_bind().dialect.name
    except Exception:  # pragma: no cover — defensive
        return
    if dialect != "postgresql":
        # SQLite (tests) has no advisory locks and serializes writes at the
        # driver level anyway.
        return
    await db.execute(
        text("SELECT pg_advisory_xact_lock(:ns, :key)"),
        {"ns": _LOCK_NAMESPACE, "key": student_id.int % 2147483647},
    )


async def sync_streak(db: AsyncSession, user: User) -> StreakStateOut:
    """Catch up every unfinalized week, then report the current week.

    `user` MUST come from `get_current_user_db`, not `require_student` —
    the latter hands back the middleware's session-detached copy, so these
    mutations would attach to no session and `commit()` would flush nothing
    while the notifications still fired. The failure is entirely silent.
    """
    await _lock_student(db, user.id)
    # Re-read under the lock: a concurrent sync that just committed advanced
    # the marker, and this session's copy — loaded by get_current_user_db
    # before the lock was taken — predates that commit. Postgres' default
    # READ COMMITTED gives each statement its own snapshot, so this SELECT
    # sees the winner's marker.
    await db.refresh(user)

    today = ist_today()
    current_ws = week_start(today)

    if user.last_finalized_week_start is None:
        # Lazy init for a new signup. The catch-up loop walks weeks strictly
        # after the marker, so the partial signup week needs no special case.
        user.last_finalized_week_start = week_start(ist_date_of(user.created_at))

    marker: date = user.last_finalized_week_start
    first_open_ws = marker + timedelta(days=7)

    # One query covers every week we might evaluate plus the current one.
    fetch_start = min(first_open_ws, current_ws)
    rows = await db.execute(
        select(StudentDailyActivity.activity_date, StudentDailyActivity.active_seconds).where(
            StudentDailyActivity.student_id == user.id,
            StudentDailyActivity.activity_date >= fetch_start,
            StudentDailyActivity.activity_date <= today,
        )
    )
    day_seconds: dict[date, int] = {d: s for d, s in rows.all()}

    def days_of(ws: date) -> list[int]:
        return [day_seconds.get(ws + timedelta(days=i), 0) for i in range(7)]

    # --- Finalize every complete week strictly after the marker ---
    # No iteration cap: a week with no activity is all-zeros, so it contains
    # ✗✗, so it is broken and cannot be congratulated. Non-spam falls out of
    # the rules themselves. Walking even a few hundred empty weeks in pure
    # Python is microseconds, and a cap would only create a way for the
    # marker to get stuck short of the current week.
    pending: list = []
    weeks_finalized = 0
    ws = first_open_ws
    while ws < current_ws:
        if week_achieved(days_of(ws)):
            user.total_streaks_earned = (user.total_streaks_earned or 0) + 1
            pending.append(
                await build_notification(
                    db,
                    recipient_id=user.id,
                    sender_id=None,
                    message=(
                        f"Day Streak earned! You hit your 1-hour goal for the week of "
                        f"{_fmt_day(ws)} – {_fmt_day(week_end(ws))}. Keep it going this week!"
                    ),
                    notification_type="streak_earned",
                )
            )
        weeks_finalized += 1
        ws += timedelta(days=7)

    if weeks_finalized:
        user.last_finalized_week_start = current_ws - timedelta(days=7)

    # --- Current week ---
    days = days_of(current_ws)
    days_elapsed = today.weekday()

    if current_ws <= user.last_finalized_week_start:
        # This IS the marker's own week — a new signup's first partial week,
        # or (via migration 029's backfill) a pre-existing student's launch
        # week. Its leading days are zero because the account or the feature
        # did not exist yet, not because anything was missed, so scoring it
        # would show "broken" to most signups within days of joining. Report
        # a neutral sentinel instead and skip the warning entirely.
        status = "not_tracked"
    else:
        status = week_status(days, days_elapsed)
        if status == "at_risk" and user.last_streak_warning_date != today:
            user.last_streak_warning_date = today
            missed = today - timedelta(days=1)
            pending.append(
                await build_notification(
                    db,
                    recipient_id=user.id,
                    sender_id=None,
                    message=(
                        f"You missed {_fmt_day(missed)} — reach 1 hour today "
                        f"({_fmt_day(today)}) to keep this week's streak!"
                    ),
                    notification_type="streak_at_risk",
                )
            )

    # Single commit: the counter bump, the marker advance and the
    # notification rows all land together, or none of them do. If this
    # raises, the marker never advanced and the next sync re-evaluates
    # cleanly. WebSocket pushes deliberately follow the commit, so a
    # rolled-back transaction can never produce a phantom toast.
    await db.commit()
    for out in pending:
        await push_notification(out)

    return StreakStateOut(
        total_streaks_earned=user.total_streaks_earned or 0,
        active_seconds_today=day_seconds.get(today, 0),
        target_seconds=DAILY_TARGET_SECONDS,
        week_start=current_ws,
        week_status=status,
        days=days,
        days_elapsed=days_elapsed,
        weeks_finalized=weeks_finalized,
    )
