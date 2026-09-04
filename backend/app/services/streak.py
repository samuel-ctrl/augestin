"""Student Day Streak — consecutive-day rules and the DB layer around them.

Replaces the weekly Mon..Sun model (see docs/STREAK_REDESIGN_PLAN.md).

Rules:
  * A day QUALIFIES when the student accumulates >= DAILY_GOAL_SECONDS of
    credited engaged time on that IST calendar date. The goal is FIXED and
    identical for every student — deliberately not "beat your own average",
    which would make a good study day raise tomorrow's bar and would pit the
    streak directly against the wellbeing features.
  * Time beyond the goal earns nothing. The streak rewards showing up, not
    grinding, so it never competes with "go do something else".
  * A non-qualifying day is bridged, in order, by:
      1. the free GRACE day (one isolated slip right after a qualifying day),
      2. a banked FREEZE (earned every FREEZE_EVERY_N_QUALIFYING qualifying
         days, capped at MAX_FREEZES) — this is what stops an ordinary
         two-day weekend from killing every streak in the school,
      3. otherwise the streak BREAKS.
    Grace is tried before freezes because grace is free and regenerates after
    every qualifying day, while freezes are earned and capped.
  * A broken streak is REPAIRED by the next qualifying day within
    REPAIR_WINDOW_DAYS, restoring it to pre_break + 1. Losing a long streak to
    one bad week is the single most demotivating thing this feature can do to
    a child, and the repair costs a real study session to claim.
  * TIERS are awarded off longest_streak_days and are never revoked.

Today is never scored — it is still in progress.

Nothing here runs on a schedule. Days are evaluated lazily whenever the
student's app calls in, anchored on a persisted "last finalized day" marker,
so a student who skips days — or months — is caught up correctly whenever they
next appear.

Concurrency note, and it matters: this codebase has NO optimistic locking.
`version` (app/audit.py) is a plain counter incremented in a before_flush
hook, not SQLAlchemy's `version_id_col`, so two concurrent writes to a row
raise nothing at all — it is a silent last-writer-wins. Both entry points
below therefore avoid a plain read-then-write:
  * `record_usage` does a compare-and-swap UPDATE guarded on the exact
    `last_beat_at` it read, so a racing poll writes nothing.
  * `sync_streak` serializes per student on a Postgres advisory lock and
    re-reads the user row after acquiring it.
Note that the test suite runs on one shared aiosqlite connection via
StaticPool, which serializes at the driver level — a green test run is
evidence the *logic* is right, never that the *concurrency* fix works.
"""

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from sqlalchemy import select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.student_daily_activity import StudentDailyActivity
from app.models.user import User
from app.schemas.streak import RecentDay, RepairOut, StreakStateOut, TierOut
from app.services.notification_service import build_notification, push_notification
from app.utils.ist import ist_date_of, ist_today

# --- The rules, as constants. Tune here, never inline. ---------------------

# A day qualifies at 30 minutes. Modest on purpose: the streak must be
# reachable on a school night, and nothing above it counts for more.
DAILY_GOAL_SECONDS = 1800
# Hard per-day cap. NOT 86400 — beyond six hours is certainly idle media or a
# shared login, and letting one runaway day through would poison the
# "typical usage" stat and the heavy-day detector for a fortnight.
MAX_DAILY_SECONDS = 21600
# Two hours in a day trips the (soft, dismissible) break nudge.
HEAVY_DAY_SECONDS = 7200
# Below five minutes a day is an accidental open, not a study session — it is
# excluded from the typical-usage mean so it cannot drag the stat down.
MIN_PRESENT_SECONDS = 300
# Typical usage is a mean over present days in a CALENDAR window, so a student
# returning from a long gap is described by recent behaviour, not stale
# behaviour from weeks ago.
TYPICAL_WINDOW_DAYS = 14

MAX_FREEZES = 2
FREEZE_EVERY_N_QUALIFYING = 7
REPAIR_WINDOW_DAYS = 2

# Usage polling. The client posts measured engaged seconds every ~60s; the
# server clamps the claim to real elapsed wall-clock so a client cannot
# inflate it by polling faster or lying bigger.
POLL_CADENCE_SECONDS = 60
MAX_POLL_CREDIT_SECONDS = 120
CLOCK_SLACK_SECONDS = 15
MIN_BEAT_GAP_SECONDS = 50

# Earliest date any student_daily_activity row can exist — the day streak
# tracking first shipped. A student who signed up long before it starts
# tracking here, not at their (months-old) created_at, so their card never
# renders a wall of red days that predate the feature.
STREAK_TRACKING_EPOCH = date(2026, 9, 3)

# (days, label). Ascending. Awarded off longest_streak_days, never revoked.
TIERS: tuple[tuple[int, str], ...] = (
    (7, "Bronze"),
    (14, "Silver"),
    (30, "Elite"),
    (60, "Platinum"),
    (100, "Diamond"),
    (200, "Master"),
    (365, "Legend"),
)

TIER_EMOJI = {
    "Bronze": "\U0001f949",
    "Silver": "\U0001f948",
    "Elite": "\U0001f947",
    "Platinum": "\U0001f3c5",
    "Diamond": "\U0001f48e",
    "Master": "\U0001f31f",
    "Legend": "\U0001f451",
}

DayStatus = Literal["qualifying", "grace", "freeze", "break", "missed"]

# Arbitrary but stable namespace for pg_advisory_xact_lock, so streak locks
# can never collide with run_migrations()'s lock key 1.
_LOCK_NAMESPACE = 29


# --------------------------------------------------------------------------
# Pure layer — no DB, unit-testable standalone.
# --------------------------------------------------------------------------


def tier_for(days: int) -> str | None:
    """Highest tier label reached by a streak of `days`, or None."""
    label = None
    for threshold, name in TIERS:
        if days >= threshold:
            label = name
        else:
            break
    return label


def next_tier(days: int) -> tuple[int, str] | None:
    """The next (threshold, label) above `days`, or None past the top."""
    for threshold, name in TIERS:
        if days < threshold:
            return threshold, name
    return None


def typical_seconds(day_seconds: dict[date, int], upto: date) -> int | None:
    """Mean active seconds over *present* days in the TYPICAL_WINDOW_DAYS
    calendar days before `upto` (exclusive of `upto` itself).

    Present means >= MIN_PRESENT_SECONDS, so an accidental two-minute open is
    not mistaken for a study day. Returns None when there is nothing to
    average — the caller must render "not enough data yet", never 0.

    This drives the DASHBOARD only. It is deliberately not the streak goal:
    a self-referential bar punishes a good day by raising tomorrow's hurdle.
    """
    start = upto - timedelta(days=TYPICAL_WINDOW_DAYS)
    vals = [s for d, s in day_seconds.items() if start <= d < upto and s >= MIN_PRESENT_SECONDS]
    if not vals:
        return None
    return round(sum(vals) / len(vals))


def usage_band(active_today: int, typical: int | None) -> Literal["light", "on_track", "heavy"]:
    """Classify today's usage for the dashboard. Never affects the streak.

    A heavy day still counts toward the streak — it cleared the goal. The band
    is a wellbeing signal, and its copy is health-first: "heavy" is a nudge to
    stop, never a score to beat.
    """
    if active_today >= HEAVY_DAY_SECONDS:
        return "heavy"
    if active_today < MIN_PRESENT_SECONDS * 3:  # < 15 min
        return "light"
    if typical is not None and active_today < typical * 0.5:
        return "light"
    return "on_track"


@dataclass
class StreakState:
    """The full evaluator state. Mirrors the streak columns on `users`."""

    current: int = 0
    longest: int = 0
    last_qualifying_date: date | None = None
    grace_used_on: date | None = None
    freezes: int = 0
    freezes_progress: int = 0
    break_at: date | None = None
    pre_break_days: int = 0
    tier: str | None = None


@dataclass
class DayOutcome:
    day: date
    status: DayStatus
    # Tier label newly crossed on this day, if any.
    tier_reached: str | None = None
    # True when this qualifying day restored a recently broken streak.
    repaired: bool = False


@dataclass
class WalkResult:
    outcomes: list[DayOutcome] = field(default_factory=list)

    def by_day(self) -> dict[date, DayOutcome]:
        return {o.day: o for o in self.outcomes}


def advance_day(state: StreakState, day: date, active_seconds: int) -> DayOutcome:
    """Apply one finalized day to `state` (mutating it) and report the outcome.

    `day` must be strictly in the past — today is never scored.
    """
    if active_seconds >= DAILY_GOAL_SECONDS:
        repaired = False
        if (
            state.break_at is not None
            and (day - state.break_at).days <= REPAIR_WINDOW_DAYS
            and state.pre_break_days > 0
        ):
            # Repair: the streak broke within the window and this is the
            # qualifying day that earns it back.
            state.current = state.pre_break_days
            repaired = True
        state.break_at = None
        state.pre_break_days = 0

        state.current += 1
        state.last_qualifying_date = day
        state.grace_used_on = None
        state.freezes_progress += 1
        if state.freezes_progress >= FREEZE_EVERY_N_QUALIFYING:
            state.freezes_progress = 0
            state.freezes = min(MAX_FREEZES, state.freezes + 1)

        newly = None
        if state.current > state.longest:
            state.longest = state.current
            reached = tier_for(state.longest)
            if reached is not None and reached != state.tier:
                state.tier = reached
                newly = reached
        return DayOutcome(day, "qualifying", tier_reached=newly, repaired=repaired)

    # --- non-qualifying ---

    if state.current == 0:
        # Nothing to protect. Don't burn a freeze, don't record a break.
        return DayOutcome(day, "missed")

    # 1. The free grace day — one isolated slip immediately after a
    #    qualifying day. Tried FIRST so a one-day wobble never spends a
    #    freeze that a real two-day gap will need.
    if state.grace_used_on is None and state.last_qualifying_date == day - timedelta(days=1):
        state.grace_used_on = day
        return DayOutcome(day, "grace")

    # 2. A banked freeze.
    if state.freezes > 0:
        state.freezes -= 1
        return DayOutcome(day, "freeze")

    # 3. Break. Remember what was lost so the repair window can give it back.
    state.pre_break_days = state.current
    state.break_at = day
    state.current = 0
    state.grace_used_on = None
    state.freezes_progress = 0
    return DayOutcome(day, "break")


def walk_days(
    state: StreakState,
    day_seconds: dict[date, int],
    start: date,
    end: date,
) -> WalkResult:
    """Advance `state` over every day in [start, end] inclusive.

    Days are applied in strict date order, which the freeze accounting
    depends on: a freeze earned on the 7th qualifying day must be bankable
    before a gap two days later tries to spend it.
    """
    result = WalkResult()
    day = start
    while day <= end:
        result.outcomes.append(advance_day(state, day, day_seconds.get(day, 0)))
        day += timedelta(days=1)
    return result


def expire_repair(state: StreakState, today: date) -> None:
    """Drop a repair offer the student did not claim in time."""
    if state.break_at is not None and (today - state.break_at).days > REPAIR_WINDOW_DAYS:
        state.break_at = None
        state.pre_break_days = 0


# --------------------------------------------------------------------------
# DB layer
# --------------------------------------------------------------------------


def _fmt_day(d: date) -> str:
    """'Tue, Sep 2' — platform-independent (%-d / %#d are not portable)."""
    return f"{d:%a, %b} {d.day}"


def _as_utc(dt: datetime | None) -> datetime | None:
    """SQLite hands back naive datetimes even for DateTime(timezone=True)."""
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


async def record_usage(
    db: AsyncSession, student_id: uuid.UUID, engaged_seconds: int
) -> tuple[int, bool]:
    """Credit measured engaged time towards today's total.

    Returns (active_seconds_today, counted).

    The client reports how many seconds it actually observed the student
    engaged since its last successful poll. That claim is clamped to the real
    wall-clock elapsed since `last_beat_at` (plus a small slack for clock
    jitter), so polling faster or claiming bigger buys nothing — a much
    tighter bound than the old fixed "+300 per call" heartbeat.

    The write is a compare-and-swap on the exact `last_beat_at` that was read,
    so two tabs polling at once cannot both credit: the loser's UPDATE matches
    no rows and returns counted=False. Computing the clamp in Python rather
    than in SQL is deliberate — the epoch arithmetic needed to do it inside
    the UPDATE has no portable spelling across Postgres and SQLite.
    """
    today = ist_today()
    now = datetime.now(timezone.utc)
    engaged_seconds = max(0, min(engaged_seconds, MAX_POLL_CREDIT_SECONDS))

    row = (
        await db.execute(
            select(
                StudentDailyActivity.active_seconds,
                StudentDailyActivity.last_beat_at,
            ).where(
                StudentDailyActivity.student_id == student_id,
                StudentDailyActivity.activity_date == today,
            )
        )
    ).one_or_none()

    if row is None:
        # First engaged time of the day. No elapsed reference exists, so the
        # claim is capped at a single poll interval.
        credit = min(engaged_seconds, POLL_CADENCE_SECONDS + CLOCK_SLACK_SECONDS)
        db.add(
            StudentDailyActivity(
                student_id=student_id,
                activity_date=today,
                active_seconds=credit,
                last_beat_at=now,
            )
        )
        try:
            await db.commit()
            return credit, True
        except IntegrityError:
            # A simultaneous first poll won the race and created the row.
            # Fall through and retry as the normal CAS path.
            await db.rollback()
            row = (
                await db.execute(
                    select(
                        StudentDailyActivity.active_seconds,
                        StudentDailyActivity.last_beat_at,
                    ).where(
                        StudentDailyActivity.student_id == student_id,
                        StudentDailyActivity.activity_date == today,
                    )
                )
            ).one_or_none()
            if row is None:  # pragma: no cover — defensive
                return 0, False

    active, last_beat = row
    last_beat = _as_utc(last_beat)

    if last_beat is None:
        allowed = POLL_CADENCE_SECONDS + CLOCK_SLACK_SECONDS
    else:
        elapsed = (now - last_beat).total_seconds()
        if elapsed < MIN_BEAT_GAP_SECONDS:
            # Inside the dedup gap — a second tab, or a client polling faster
            # than it should. Release the read transaction and credit nothing.
            await db.rollback()
            return active, False
        allowed = int(elapsed) + CLOCK_SLACK_SECONDS

    credit = min(engaged_seconds, allowed)
    if credit <= 0:
        await db.rollback()
        return active, False

    new_total = min(active + credit, MAX_DAILY_SECONDS)

    cas = (
        StudentDailyActivity.last_beat_at.is_(None)
        if last_beat is None
        else StudentDailyActivity.last_beat_at == last_beat
    )
    updated = (
        await db.execute(
            update(StudentDailyActivity)
            .where(
                StudentDailyActivity.student_id == student_id,
                StudentDailyActivity.activity_date == today,
                cas,
            )
            .values(active_seconds=new_total, last_beat_at=now)
            .returning(StudentDailyActivity.active_seconds)
            .execution_options(synchronize_session=False)
        )
    ).scalar_one_or_none()

    if updated is None:
        # Lost the CAS: another poll credited between our read and write.
        await db.rollback()
        return active, False

    await db.commit()
    return updated, True


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


def state_from_user(user: User) -> StreakState:
    return StreakState(
        current=user.current_streak_days or 0,
        longest=user.longest_streak_days or 0,
        last_qualifying_date=user.last_qualifying_date,
        grace_used_on=user.streak_grace_used_on,
        freezes=user.streak_freezes or 0,
        freezes_progress=user.streak_freezes_progress or 0,
        break_at=user.streak_break_at,
        pre_break_days=user.streak_pre_break_days or 0,
        tier=user.streak_tier,
    )


def state_to_user(state: StreakState, user: User) -> None:
    user.current_streak_days = state.current
    user.longest_streak_days = state.longest
    user.last_qualifying_date = state.last_qualifying_date
    user.streak_grace_used_on = state.grace_used_on
    user.streak_freezes = state.freezes
    user.streak_freezes_progress = state.freezes_progress
    user.streak_break_at = state.break_at
    user.streak_pre_break_days = state.pre_break_days
    user.streak_tier = state.tier


def tracking_start_for(user: User) -> date:
    """First day this student is scored on.

    A student who signed up months before the feature existed starts at the
    epoch, not at their created_at, so the walk never scores days that
    predate the tracking table and the card never shows them as missed.
    """
    return max(STREAK_TRACKING_EPOCH, ist_date_of(user.created_at))


async def _persist_day_statuses(
    db: AsyncSession,
    student_id: uuid.UUID,
    outcomes: list[DayOutcome],
    have_row: set[date],
) -> None:
    """Write each finalized day's status onto its activity row.

    Days with an existing row get an UPDATE. Days with NO row are only
    materialised when the outcome is interesting — grace, freeze or break —
    so the card can explain why a zero-activity day did not end the streak.
    A plain 'missed' day is left rowless; creating a row for every empty day
    forever would grow the table without telling anyone anything the absence
    of a row does not already say.
    """
    by_status: dict[str, list[date]] = {}
    for o in outcomes:
        if o.day in have_row:
            by_status.setdefault(o.status, []).append(o.day)
        elif o.status in ("grace", "freeze", "break"):
            db.add(
                StudentDailyActivity(
                    student_id=student_id,
                    activity_date=o.day,
                    active_seconds=0,
                    day_status=o.status,
                )
            )

    for status, days in by_status.items():
        await db.execute(
            update(StudentDailyActivity)
            .where(
                StudentDailyActivity.student_id == student_id,
                StudentDailyActivity.activity_date.in_(days),
            )
            .values(day_status=status)
            .execution_options(synchronize_session=False)
        )


async def sync_streak(db: AsyncSession, user: User) -> StreakStateOut:
    """Catch up every unfinalized day, then report the current state.

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
    yesterday = today - timedelta(days=1)

    if user.streak_tracking_since is None:
        user.streak_tracking_since = tracking_start_for(user)
    tracking_since: date = user.streak_tracking_since
    if user.last_activity_finalized_date is None:
        user.last_activity_finalized_date = tracking_since - timedelta(days=1)

    marker: date = user.last_activity_finalized_date
    walk_start = max(marker + timedelta(days=1), tracking_since)

    # One query covers the walk plus the typical-usage window plus the
    # 14-day strip the card renders.
    fetch_start = min(walk_start, today - timedelta(days=TYPICAL_WINDOW_DAYS + 1))
    rows = (
        await db.execute(
            select(
                StudentDailyActivity.activity_date,
                StudentDailyActivity.active_seconds,
                StudentDailyActivity.day_status,
            ).where(
                StudentDailyActivity.student_id == user.id,
                StudentDailyActivity.activity_date >= fetch_start,
                StudentDailyActivity.activity_date <= today,
            )
        )
    ).all()
    day_seconds: dict[date, int] = {d: s for d, s, _ in rows}
    stored_status: dict[date, str | None] = {d: st for d, _, st in rows}
    have_row = set(day_seconds)

    # --- Walk every finalized day strictly after the marker ---
    # No iteration cap. The walk is bounded below by STREAK_TRACKING_EPOCH, so
    # even a student returning after years costs a few hundred in-memory
    # iterations. A cap would only create a way for the marker to get stuck
    # short of today.
    state = state_from_user(user)
    walked = walk_days(state, day_seconds, walk_start, yesterday) if walk_start <= yesterday else WalkResult()
    expire_repair(state, today)
    state_to_user(state, user)

    pending = []

    if walked.outcomes:
        await _persist_day_statuses(db, user.id, walked.outcomes, have_row)
        for o in walked.outcomes:
            stored_status[o.day] = o.status
        user.last_activity_finalized_date = yesterday

        # Tier congratulations. A single sync can cross several thresholds at
        # once (a student whose time was credited while the app sat open for
        # days); send only the HIGHEST reached, not one toast per tier.
        crossed = [o.tier_reached for o in walked.outcomes if o.tier_reached]
        if crossed:
            top = crossed[-1]
            pending.append(
                await build_notification(
                    db,
                    recipient_id=user.id,
                    sender_id=None,
                    message=(
                        f"{TIER_EMOJI.get(top, '')} {top} unlocked — you're on a "
                        f"{state.longest}-day streak. Keep it going!"
                    ).strip(),
                    notification_type="streak_milestone",
                )
            )

        # At-risk: yesterday was bridged rather than earned, and there is a
        # live streak to save. An already-broken streak produces no warning —
        # a demotivating message with no available action. The card carries
        # the repair offer instead.
        last = walked.outcomes[-1]
        if (
            last.day == yesterday
            and last.status in ("grace", "freeze")
            and state.current > 0
            and user.last_streak_warning_date != today
        ):
            user.last_streak_warning_date = today
            goal_min = DAILY_GOAL_SECONDS // 60
            pending.append(
                await build_notification(
                    db,
                    recipient_id=user.id,
                    sender_id=None,
                    message=(
                        f"You slipped on {_fmt_day(yesterday)}. A {goal_min}-minute "
                        f"session today keeps your {state.current}-day streak alive!"
                    ),
                    notification_type="streak_at_risk",
                )
            )

    # Single commit: the streak columns, the day statuses and the
    # notification rows all land together, or none of them do. If this
    # raises, the marker never advanced and the next sync re-evaluates
    # cleanly. WebSocket pushes deliberately follow the commit, so a
    # rolled-back transaction can never produce a phantom toast.
    await db.commit()
    for out in pending:
        await push_notification(out)

    return _build_state_out(user, state, day_seconds, stored_status, tracking_since, today)


def _build_state_out(
    user: User,
    state: StreakState,
    day_seconds: dict[date, int],
    stored_status: dict[date, str | None],
    tracking_since: date,
    today: date,
) -> StreakStateOut:
    active_today = day_seconds.get(today, 0)
    goal_met = active_today >= DAILY_GOAL_SECONDS
    typical = typical_seconds(day_seconds, today)

    nxt = next_tier(state.longest)
    nxt_out = TierOut(name=nxt[1], at_days=nxt[0]) if nxt else None

    repair = None
    if state.break_at is not None and state.pre_break_days > 0:
        repair = RepairOut(
            restores_to=state.pre_break_days + 1,
            expires_on=state.break_at + timedelta(days=REPAIR_WINDOW_DAYS),
            lost_streak=state.pre_break_days,
            # Today already cleared the goal, so the repair is earned — it
            # just cannot be applied until tonight's finalize. Without this
            # the card would keep telling a student to do the 30 minutes they
            # have already done, which is precisely the demoralising message
            # this whole design exists to avoid.
            secured=goal_met,
        )

    recent: list[RecentDay] = []
    for i in range(TYPICAL_WINDOW_DAYS - 1, -1, -1):
        d = today - timedelta(days=i)
        if d < tracking_since:
            status = "untracked"
        elif d == today:
            status = "today"
        else:
            # A NULL status on a past day means "not walked yet", which after
            # the walk above can only be a day with no row at all — i.e. no
            # activity. Render it as missed.
            status = stored_status.get(d) or "missed"
        recent.append(RecentDay(date=d, active_seconds=day_seconds.get(d, 0), status=status))

    return StreakStateOut(
        current_streak_days=state.current,
        longest_streak_days=state.longest,
        active_seconds_today=active_today,
        goal_seconds=DAILY_GOAL_SECONDS,
        goal_met=goal_met,
        typical_seconds=typical,
        band=usage_band(active_today, typical),
        heavy_day_seconds=HEAVY_DAY_SECONDS,
        freezes=state.freezes,
        freezes_to_next=max(0, FREEZE_EVERY_N_QUALIFYING - state.freezes_progress)
        if state.freezes < MAX_FREEZES
        else 0,
        streak_tier=state.tier,
        next_tier=nxt_out,
        # "At risk" means action is still NEEDED, not merely that a warning
        # was issued: once today's goal is met the streak is safe, and the
        # card must stop nagging immediately rather than at the next sync.
        at_risk=user.last_streak_warning_date == today and state.current > 0 and not goal_met,
        repair=repair,
        recent=recent,
        tracking_since=tracking_since,
    )
