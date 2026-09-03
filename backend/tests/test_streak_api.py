"""Streak API — heartbeat crediting, lazy week catch-up, notifications.

"Today" is pinned by monkeypatching app.services.streak.ist_today so these
tests behave identically whatever real weekday they run on. The anchor is
Friday 2026-09-04 (days_elapsed = 4: Mon-Thu complete, Friday in progress).
"""

import asyncio
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import ActivityLog  # noqa: F401 — mapper registration
from app.models.notification import Notification
from app.models.student_daily_activity import StudentDailyActivity
from app.models.user import User
from app.services.streak import DAILY_TARGET_SECONDS, HEARTBEAT_CREDIT_SECONDS
from tests.conftest import student_headers, tutor_headers

MONDAY = date(2026, 8, 31)
FRIDAY = MONDAY + timedelta(days=4)


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch):
    """Pin IST 'today' for both record_heartbeat and sync_streak."""
    monkeypatch.setattr("app.services.streak.ist_today", lambda: FRIDAY)
    return FRIDAY


async def seed_days(db: AsyncSession, student_id: uuid.UUID, week_monday: date, spec: str):
    """spec is Mon..Sun, 'Y' = target reached, anything else = no row."""
    for i, ch in enumerate(spec):
        if ch == "Y":
            db.add(
                StudentDailyActivity(
                    id=uuid.uuid4(),
                    student_id=student_id,
                    activity_date=week_monday + timedelta(days=i),
                    active_seconds=DAILY_TARGET_SECONDS,
                )
            )
    await db.commit()


async def notifications_of(db: AsyncSession, student: User, ntype: str | None = None):
    q = select(Notification).where(Notification.recipient_id == student.id)
    if ntype:
        q = q.where(Notification.notification_type == ntype)
    return list((await db.execute(q)).scalars())


@pytest.mark.asyncio
class TestHeartbeat:
    async def test_creates_row_and_credits_exactly_300(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        resp = await client.post("/api/streak/heartbeat", headers=student_headers(student))
        assert resp.status_code == 200
        body = resp.json()
        assert body["counted"] is True
        assert body["active_seconds_today"] == HEARTBEAT_CREDIT_SECONDS
        assert body["target_seconds"] == DAILY_TARGET_SECONDS

        rows = list(
            (
                await db.execute(
                    select(StudentDailyActivity).where(
                        StudentDailyActivity.student_id == student.id
                    )
                )
            ).scalars()
        )
        assert len(rows) == 1
        assert rows[0].activity_date == FRIDAY
        assert rows[0].active_seconds == HEARTBEAT_CREDIT_SECONDS

    async def test_second_beat_inside_gap_is_not_counted(
        self, client: AsyncClient, student: User
    ):
        first = await client.post("/api/streak/heartbeat", headers=student_headers(student))
        assert first.json()["counted"] is True

        second = await client.post("/api/streak/heartbeat", headers=student_headers(student))
        assert second.status_code == 200
        assert second.json()["counted"] is False
        # Total unchanged — no lost and no duplicated credit.
        assert second.json()["active_seconds_today"] == HEARTBEAT_CREDIT_SECONDS

    async def test_beat_outside_gap_is_counted_again(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        await client.post("/api/streak/heartbeat", headers=student_headers(student))
        row = (
            await db.execute(
                select(StudentDailyActivity).where(StudentDailyActivity.student_id == student.id)
            )
        ).scalar_one()
        row.last_beat_at = datetime.now(timezone.utc) - timedelta(seconds=600)
        await db.commit()

        resp = await client.post("/api/streak/heartbeat", headers=student_headers(student))
        assert resp.json()["counted"] is True
        assert resp.json()["active_seconds_today"] == 2 * HEARTBEAT_CREDIT_SECONDS

    async def test_tutor_is_forbidden(self, client: AsyncClient, tutor: User):
        resp = await client.post("/api/streak/heartbeat", headers=tutor_headers(tutor))
        assert resp.status_code == 403

    async def test_heartbeat_writes_no_activity_log_row(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        resp = await client.post("/api/streak/heartbeat", headers=student_headers(student))
        assert resp.status_code == 200
        # Give any background log task a chance to land, then assert it did not.
        await asyncio.sleep(0.3)
        rows = list((await db.execute(select(ActivityLog))).scalars())
        assert all(r.path != "/api/streak/heartbeat" for r in rows)


@pytest.mark.asyncio
class TestFirstTrackedWeek:
    async def test_new_student_sync_is_not_tracked(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        resp = await client.post("/api/streak/sync", headers=student_headers(student))
        assert resp.status_code == 200
        body = resp.json()
        assert body["week_status"] == "not_tracked"
        assert body["total_streaks_earned"] == 0
        assert body["active_seconds_today"] == 0
        assert body["days"] == [0] * 7
        assert body["weeks_finalized"] == 0

        await db.refresh(student)
        assert student.last_finalized_week_start is not None
        assert await notifications_of(db, student) == []

    async def test_midweek_signup_is_not_tracked_not_broken(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        # Signed up on the Wednesday of the pinned week. Mon and Tue have no
        # rows because the account did not exist, not because they were
        # missed — without the marker gate, week_status would see ✗✗ on days
        # one and two and report "broken" before a single real day could be
        # lost. This hits most signups, not just an edge case.
        student.created_at = datetime(2026, 9, 2, 6, 0, tzinfo=timezone.utc)
        student.last_finalized_week_start = None
        await db.commit()

        resp = await client.post("/api/streak/sync", headers=student_headers(student))
        body = resp.json()
        assert body["week_status"] == "not_tracked"
        assert body["days_elapsed"] == 4
        assert await notifications_of(db, student) == []

    async def test_backfilled_launch_week_is_not_tracked(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        # A pre-existing student as migration 029 leaves them: months of real
        # history, marker fast-forwarded to the launch week's Monday.
        student.created_at = datetime(2026, 3, 1, 6, 0, tzinfo=timezone.utc)
        student.last_finalized_week_start = MONDAY
        await db.commit()
        # Pre-marker history must not be walked or congratulated.
        await seed_days(db, student.id, MONDAY - timedelta(days=21), "YYYYYYY")

        resp = await client.post("/api/streak/sync", headers=student_headers(student))
        body = resp.json()
        assert body["week_status"] == "not_tracked"
        assert body["total_streaks_earned"] == 0
        assert body["weeks_finalized"] == 0
        assert await notifications_of(db, student) == []


@pytest.mark.asyncio
class TestCatchUp:
    async def test_achieved_prior_week_congratulates_once(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        last_week = MONDAY - timedelta(days=7)
        student.last_finalized_week_start = last_week - timedelta(days=7)
        await db.commit()
        # One isolated miss — still achieved.
        await seed_days(db, student.id, last_week, "YYNYYYY")

        resp = await client.post("/api/streak/sync", headers=student_headers(student))
        body = resp.json()
        assert body["total_streaks_earned"] == 1
        assert body["weeks_finalized"] == 1

        earned = await notifications_of(db, student, "streak_earned")
        assert len(earned) == 1
        assert earned[0].sender_id is None
        # The actual week's dates, not "last week" — the text is stored once
        # and re-read later out of context.
        assert "Mon, Aug 24" in earned[0].message
        assert "Sun, Aug 30" in earned[0].message

        await db.refresh(student)
        assert student.total_streaks_earned == 1
        assert student.last_finalized_week_start == last_week

    async def test_sync_twice_is_a_no_op(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        last_week = MONDAY - timedelta(days=7)
        student.last_finalized_week_start = last_week - timedelta(days=7)
        await db.commit()
        await seed_days(db, student.id, last_week, "YYYYYYY")

        first = (await client.post("/api/streak/sync", headers=student_headers(student))).json()
        assert first["weeks_finalized"] == 1
        before = len(await notifications_of(db, student))

        second = (await client.post("/api/streak/sync", headers=student_headers(student))).json()
        assert second["weeks_finalized"] == 0
        assert second["total_streaks_earned"] == 1
        assert len(await notifications_of(db, student)) == before

    async def test_three_empty_weeks_fast_forward_silently(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        student.last_finalized_week_start = MONDAY - timedelta(days=28)
        await db.commit()

        body = (await client.post("/api/streak/sync", headers=student_headers(student))).json()
        assert body["weeks_finalized"] == 3
        assert body["total_streaks_earned"] == 0
        # An empty week is all-zeros, so it contains ✗✗ and is broken — it
        # can never be congratulated. Non-spam falls out of the rules.
        assert await notifications_of(db, student) == []

        await db.refresh(student)
        assert student.last_finalized_week_start == MONDAY - timedelta(days=7)


@pytest.mark.asyncio
class TestWarning:
    async def test_at_risk_warns_exactly_once_per_day(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        # Marker is last week, so the current week IS tracked.
        student.last_finalized_week_start = MONDAY - timedelta(days=7)
        await db.commit()
        # Mon/Tue/Wed hit, Thursday (yesterday) missed → salvageable.
        await seed_days(db, student.id, MONDAY, "YYY")

        body = (await client.post("/api/streak/sync", headers=student_headers(student))).json()
        assert body["week_status"] == "at_risk"

        warnings = await notifications_of(db, student, "streak_at_risk")
        assert len(warnings) == 1
        assert warnings[0].sender_id is None
        assert "Thu, Sep 3" in warnings[0].message
        assert "Fri, Sep 4" in warnings[0].message

        # Same day again — suppressed by last_streak_warning_date.
        again = (await client.post("/api/streak/sync", headers=student_headers(student))).json()
        assert again["week_status"] == "at_risk"
        assert len(await notifications_of(db, student, "streak_at_risk")) == 1

    async def test_already_broken_week_does_not_warn(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        student.last_finalized_week_start = MONDAY - timedelta(days=7)
        await db.commit()
        # Wed and Thu both missed — nothing left to save, so a warning would
        # be a demotivating message with no available action.
        await seed_days(db, student.id, MONDAY, "YY")

        body = (await client.post("/api/streak/sync", headers=student_headers(student))).json()
        assert body["week_status"] == "broken"
        assert await notifications_of(db, student) == []


@pytest.mark.asyncio
class TestNullSenderNotifications:
    async def test_list_returns_system_notification(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        # Regression test for the inner-join bug: a null-sender row used to be
        # dropped from this list while /unread-count still counted it, so the
        # bell showed a badge the page could never clear.
        db.add(
            Notification(
                id=uuid.uuid4(),
                recipient_id=student.id,
                sender_id=None,
                message="System generated",
                notification_type="streak_earned",
            )
        )
        await db.commit()

        resp = await client.get("/api/notifications", headers=student_headers(student))
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items) == 1
        assert items[0]["message"] == "System generated"
        assert items[0]["sender_id"] is None
        assert items[0]["sender_name"] is None

        count = await client.get(
            "/api/notifications/unread-count", headers=student_headers(student)
        )
        # List and badge must agree.
        assert count.json()["count"] == len(items)
