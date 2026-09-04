"""Streak API — usage crediting, lazy day catch-up, notifications.

"Today" is pinned by monkeypatching app.services.streak.ist_today so these
tests behave identically whatever real date they run on. The anchor sits well
after STREAK_TRACKING_EPOCH so the walk has room to see seeded history.
"""

import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import ActivityLog  # noqa: F401 — mapper registration
from app.models.notification import Notification
from app.models.student_daily_activity import StudentDailyActivity
from app.models.user import User
from app.services.streak import (
    DAILY_GOAL_SECONDS,
    MAX_DAILY_SECONDS,
    POLL_CADENCE_SECONDS,
    STREAK_TRACKING_EPOCH,
)
from tests.conftest import student_headers, tutor_headers

TODAY = STREAK_TRACKING_EPOCH + timedelta(days=60)


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch):
    """Pin IST 'today' for both record_usage and sync_streak."""
    # Every module that resolves "today" independently must be pinned, or a
    # test passes only on the days the real clock happens to agree.
    monkeypatch.setattr("app.services.streak.ist_today", lambda: TODAY)
    monkeypatch.setattr("app.routers.streak.ist_today", lambda: TODAY)
    monkeypatch.setattr("app.routers.students.ist_today", lambda: TODAY)
    monkeypatch.setattr("app.commands.recompute_streaks.ist_today", lambda: TODAY)
    return TODAY


async def seed_days(db: AsyncSession, student_id: uuid.UUID, start: date, spec: str):
    """spec runs forward from `start`. 'Q' = goal met, 's' = short, '.' = no row."""
    for i, ch in enumerate(spec):
        if ch == ".":
            continue
        db.add(
            StudentDailyActivity(
                id=uuid.uuid4(),
                student_id=student_id,
                activity_date=start + timedelta(days=i),
                active_seconds=DAILY_GOAL_SECONDS if ch == "Q" else DAILY_GOAL_SECONDS - 1,
            )
        )
    await db.commit()


async def anchor_tracking(db: AsyncSession, student: User, since: date):
    """Pin where the walk starts, as migration 030's backfill would."""
    await db.execute(
        update(User)
        .where(User.id == student.id)
        .values(streak_tracking_since=since, last_activity_finalized_date=since - timedelta(days=1))
    )
    await db.commit()


async def notifications_of(db: AsyncSession, student: User, ntype: str | None = None):
    q = select(Notification).where(Notification.recipient_id == student.id)
    if ntype:
        q = q.where(Notification.notification_type == ntype)
    return list((await db.execute(q)).scalars())


@pytest.mark.asyncio
class TestUsage:
    async def test_first_poll_creates_the_row_and_credits_the_claim(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        resp = await client.post(
            "/api/streak/usage", json={"engaged_seconds": 60}, headers=student_headers(student)
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["counted"] is True
        assert body["active_seconds_today"] == 60
        assert body["goal_seconds"] == DAILY_GOAL_SECONDS
        assert body["goal_met"] is False

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
        assert rows[0].activity_date == TODAY
        # A finalized status must never be written for today.
        assert rows[0].day_status is None

    async def test_first_poll_is_capped_at_one_interval(
        self, client: AsyncClient, student: User
    ):
        # No last_beat_at exists yet, so there is no elapsed time to clamp
        # against. The claim must not be taken at face value.
        resp = await client.post(
            "/api/streak/usage", json={"engaged_seconds": 120}, headers=student_headers(student)
        )
        assert resp.json()["active_seconds_today"] == POLL_CADENCE_SECONDS + 15

    async def test_claim_is_clamped_to_real_elapsed_time(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        # A row whose last beat was 10 seconds ago cannot legitimately have
        # accrued 120 seconds of engagement since.
        db.add(
            StudentDailyActivity(
                id=uuid.uuid4(),
                student_id=student.id,
                activity_date=TODAY,
                active_seconds=0,
                last_beat_at=datetime.now(timezone.utc) - timedelta(seconds=60),
            )
        )
        await db.commit()

        resp = await client.post(
            "/api/streak/usage", json={"engaged_seconds": 120}, headers=student_headers(student)
        )
        assert resp.json()["active_seconds_today"] <= 60 + 15

    async def test_absurd_claim_is_rejected_by_the_schema(
        self, client: AsyncClient, student: User
    ):
        resp = await client.post(
            "/api/streak/usage", json={"engaged_seconds": 100000}, headers=student_headers(student)
        )
        assert resp.status_code == 422

    async def test_negative_claim_is_rejected_by_the_schema(
        self, client: AsyncClient, student: User
    ):
        resp = await client.post(
            "/api/streak/usage", json={"engaged_seconds": -5}, headers=student_headers(student)
        )
        assert resp.status_code == 422

    async def test_second_poll_inside_the_gap_credits_nothing(
        self, client: AsyncClient, student: User
    ):
        headers = student_headers(student)
        first = await client.post("/api/streak/usage", json={"engaged_seconds": 60}, headers=headers)
        before = first.json()["active_seconds_today"]

        second = await client.post("/api/streak/usage", json={"engaged_seconds": 60}, headers=headers)
        body = second.json()
        assert body["counted"] is False
        assert body["active_seconds_today"] == before

    async def test_daily_cap_is_six_hours_not_twenty_four(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        db.add(
            StudentDailyActivity(
                id=uuid.uuid4(),
                student_id=student.id,
                activity_date=TODAY,
                active_seconds=MAX_DAILY_SECONDS - 10,
                last_beat_at=datetime.now(timezone.utc) - timedelta(seconds=120),
            )
        )
        await db.commit()

        resp = await client.post(
            "/api/streak/usage", json={"engaged_seconds": 120}, headers=student_headers(student)
        )
        assert resp.json()["active_seconds_today"] == MAX_DAILY_SECONDS

    async def test_tutor_is_forbidden(self, client: AsyncClient, tutor: User):
        resp = await client.post(
            "/api/streak/usage", json={"engaged_seconds": 60}, headers=tutor_headers(tutor)
        )
        assert resp.status_code == 403

    async def test_writes_no_activity_log_row(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        await client.post(
            "/api/streak/usage", json={"engaged_seconds": 60}, headers=student_headers(student)
        )
        logs = list((await db.execute(select(ActivityLog))).scalars())
        assert logs == []

    async def test_deprecated_heartbeat_alias_still_credits(
        self, client: AsyncClient, student: User
    ):
        # Student bundles already loaded in a browser keep POSTing this after
        # deploy; a 404 would stop their tracker for the whole session.
        resp = await client.post("/api/streak/heartbeat", headers=student_headers(student))
        assert resp.status_code == 200
        assert resp.json()["counted"] is True
        assert resp.json()["active_seconds_today"] == POLL_CADENCE_SECONDS


@pytest.mark.asyncio
class TestSync:
    async def test_new_student_starts_clean_with_no_notifications(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        resp = await client.post("/api/streak/sync", headers=student_headers(student))
        assert resp.status_code == 200
        body = resp.json()
        assert body["current_streak_days"] == 0
        assert body["longest_streak_days"] == 0
        assert body["typical_seconds"] is None
        assert await notifications_of(db, student) == []

    async def test_pre_tracking_days_render_untracked_not_missed(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        # A student whose tracking starts today must not see a fortnight of
        # red. Those days predate the feature; they were not missed.
        await anchor_tracking(db, student, TODAY)
        resp = await client.post("/api/streak/sync", headers=student_headers(student))
        recent = resp.json()["recent"]
        assert recent[-1]["status"] == "today"
        assert {d["status"] for d in recent[:-1]} == {"untracked"}

    async def test_months_of_pre_feature_zeroes_produce_nothing(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        # The replacement for the weekly model's "not_tracked" sentinel: an
        # all-empty walk simply keeps the streak at 0 and says nothing.
        await anchor_tracking(db, student, STREAK_TRACKING_EPOCH)
        resp = await client.post("/api/streak/sync", headers=student_headers(student))
        assert resp.json()["current_streak_days"] == 0
        assert await notifications_of(db, student) == []

    async def test_qualifying_run_builds_the_streak(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        start = TODAY - timedelta(days=5)
        await anchor_tracking(db, student, start)
        await seed_days(db, student.id, start, "QQQQQ")  # the 5 days before today

        resp = await client.post("/api/streak/sync", headers=student_headers(student))
        body = resp.json()
        assert body["current_streak_days"] == 5
        assert body["longest_streak_days"] == 5

    async def test_seven_days_unlocks_bronze_once(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        start = TODAY - timedelta(days=7)
        await anchor_tracking(db, student, start)
        await seed_days(db, student.id, start, "QQQQQQQ")

        await client.post("/api/streak/sync", headers=student_headers(student))
        notes = await notifications_of(db, student, "streak_milestone")
        assert len(notes) == 1
        assert "Bronze" in notes[0].message
        assert notes[0].sender_id is None

        # A second sync the same day must not re-congratulate.
        await client.post("/api/streak/sync", headers=student_headers(student))
        assert len(await notifications_of(db, student, "streak_milestone")) == 1

    async def test_one_sync_crossing_several_tiers_sends_only_the_highest(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        start = TODAY - timedelta(days=31)
        await anchor_tracking(db, student, start)
        await seed_days(db, student.id, start, "Q" * 31)

        await client.post("/api/streak/sync", headers=student_headers(student))
        notes = await notifications_of(db, student, "streak_milestone")
        assert len(notes) == 1
        assert "Elite" in notes[0].message

    async def test_isolated_slip_warns_once_and_keeps_the_streak(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        start = TODAY - timedelta(days=5)
        await anchor_tracking(db, student, start)
        await seed_days(db, student.id, start, "QQQQs")  # yesterday fell short

        resp = await client.post("/api/streak/sync", headers=student_headers(student))
        body = resp.json()
        assert body["current_streak_days"] == 4
        assert body["at_risk"] is True

        notes = await notifications_of(db, student, "streak_at_risk")
        assert len(notes) == 1

        await client.post("/api/streak/sync", headers=student_headers(student))
        assert len(await notifications_of(db, student, "streak_at_risk")) == 1

    async def test_a_weekend_is_bridged_by_grace_plus_a_freeze(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        # Seven qualifying days bank a freeze; the next two empty days must
        # not end the streak, or every streak in the school dies on Sunday.
        start = TODAY - timedelta(days=9)
        await anchor_tracking(db, student, start)
        await seed_days(db, student.id, start, "QQQQQQQ..")

        resp = await client.post("/api/streak/sync", headers=student_headers(student))
        body = resp.json()
        assert body["current_streak_days"] == 7
        assert body["freezes"] == 0
        statuses = {d["date"]: d["status"] for d in body["recent"]}
        assert statuses[str(TODAY - timedelta(days=2))] == "grace"
        assert statuses[str(TODAY - timedelta(days=1))] == "freeze"

    async def test_break_offers_a_repair(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        start = TODAY - timedelta(days=6)
        await anchor_tracking(db, student, start)
        # Four qualifying days (no freeze banked yet), then three empty ones.
        await seed_days(db, student.id, start, "QQQQ...")

        resp = await client.post("/api/streak/sync", headers=student_headers(student))
        body = resp.json()
        assert body["current_streak_days"] == 0
        assert body["repair"] is not None
        assert body["repair"]["lost_streak"] == 4
        assert body["repair"]["restores_to"] == 5
        # A broken streak gets no notification — a demotivating message with
        # no available action. The card carries the repair offer instead.
        assert await notifications_of(db, student, "streak_at_risk") == []

    async def test_at_risk_clears_once_todays_goal_is_met(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        # The card must stop asking for work the student has already done.
        start = TODAY - timedelta(days=5)
        await anchor_tracking(db, student, start)
        await seed_days(db, student.id, start, "QQQQs")

        first = (await client.post("/api/streak/sync", headers=student_headers(student))).json()
        assert first["at_risk"] is True

        # Now today clears the goal.
        db.add(
            StudentDailyActivity(
                id=uuid.uuid4(),
                student_id=student.id,
                activity_date=TODAY,
                active_seconds=DAILY_GOAL_SECONDS,
            )
        )
        await db.commit()

        second = (await client.post("/api/streak/sync", headers=student_headers(student))).json()
        assert second["goal_met"] is True
        assert second["at_risk"] is False

    async def test_repair_reports_secured_once_todays_goal_is_met(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        start = TODAY - timedelta(days=6)
        await anchor_tracking(db, student, start)
        await seed_days(db, student.id, start, "QQQQ...")

        before = (await client.post("/api/streak/sync", headers=student_headers(student))).json()
        assert before["repair"]["secured"] is False

        db.add(
            StudentDailyActivity(
                id=uuid.uuid4(),
                student_id=student.id,
                activity_date=TODAY,
                active_seconds=DAILY_GOAL_SECONDS,
            )
        )
        await db.commit()

        after = (await client.post("/api/streak/sync", headers=student_headers(student))).json()
        assert after["repair"]["secured"] is True

    async def test_repeat_sync_same_day_is_idempotent(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        start = TODAY - timedelta(days=5)
        await anchor_tracking(db, student, start)
        await seed_days(db, student.id, start, "QQQQQ")

        first = (await client.post("/api/streak/sync", headers=student_headers(student))).json()
        second = (await client.post("/api/streak/sync", headers=student_headers(student))).json()
        assert first["current_streak_days"] == second["current_streak_days"]
        assert len(await notifications_of(db, student)) <= 1

    async def test_today_is_never_finalized(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        await anchor_tracking(db, student, TODAY - timedelta(days=3))
        await seed_days(db, student.id, TODAY, "Q")  # a row for today

        await client.post("/api/streak/sync", headers=student_headers(student))
        row = (
            await db.execute(
                select(StudentDailyActivity).where(
                    StudentDailyActivity.student_id == student.id,
                    StudentDailyActivity.activity_date == TODAY,
                )
            )
        ).scalar_one()
        assert row.day_status is None

    async def test_tutor_is_forbidden(self, client: AsyncClient, tutor: User):
        resp = await client.post("/api/streak/sync", headers=tutor_headers(tutor))
        assert resp.status_code == 403


@pytest.mark.asyncio
class TestNotificationsListing:
    async def test_null_sender_rows_are_listed_and_counted_consistently(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        # Regression for 029: /notifications INNER JOINed the sender, silently
        # dropping system rows while /unread-count still counted them.
        start = TODAY - timedelta(days=7)
        await anchor_tracking(db, student, start)
        await seed_days(db, student.id, start, "QQQQQQQ")
        await client.post("/api/streak/sync", headers=student_headers(student))

        headers = student_headers(student)
        listed = (await client.get("/api/notifications", headers=headers)).json()
        rows = listed["items"] if isinstance(listed, dict) and "items" in listed else listed
        assert any(r["notification_type"] == "streak_milestone" for r in rows)
        assert all(r["sender_id"] is None for r in rows if r["notification_type"] == "streak_milestone")

        count = (await client.get("/api/notifications/unread-count", headers=headers)).json()
        assert count["count"] == len([r for r in rows if not r["is_read"]])


@pytest.mark.asyncio
class TestStudentListQueryCount:
    async def test_list_does_not_scale_queries_with_page_size(
        self, client: AsyncClient, tutor: User, student: User, db: AsyncSession
    ):
        # Regression: _student_to_out used to run two queries per student, so
        # a 100-row page cost 200 round trips on the tutor's main screen.
        from app.models.user import UserType
        from app.utils.password import hash_password

        for i in range(6):
            db.add(
                User(
                    id=uuid.uuid4(),
                    login_id=f"bulk{i}@test.com",
                    name=f"Bulk {i}",
                    password_hash=hash_password("Student@123"),
                    user_type=UserType.student,
                    must_change_password=False,
                )
            )
        await db.commit()

        counts: list[str] = []
        from sqlalchemy import event

        engine = db.get_bind()

        def before_cursor_execute(conn, cursor, statement, *args):
            counts.append(statement)

        event.listen(engine, "before_cursor_execute", before_cursor_execute)
        try:
            resp = await client.get(
                "/api/students?page_size=100", headers=tutor_headers(tutor)
            )
        finally:
            event.remove(engine, "before_cursor_execute", before_cursor_execute)

        assert resp.status_code == 200
        assert len(resp.json()["items"]) >= 7
        activity_queries = [s for s in counts if "student_daily_activity" in s]
        assignment_queries = [s for s in counts if "book_assignments" in s]
        # One batched query each, regardless of how many students came back.
        assert len(activity_queries) == 1, activity_queries
        assert len(assignment_queries) == 1, assignment_queries


@pytest.mark.asyncio
class TestRecompute:
    async def test_matches_an_incremental_sync(
        self, client: AsyncClient, student: User, db: AsyncSession
    ):
        from app.commands.recompute_streaks import recompute_student

        start = TODAY - timedelta(days=10)
        await anchor_tracking(db, student, start)
        await seed_days(db, student.id, start, "QQQQQQQ.QQ")

        synced = (await client.post("/api/streak/sync", headers=student_headers(student))).json()

        fresh = (await db.execute(select(User).where(User.id == student.id))).scalar_one()
        summary = await recompute_student(db, fresh)
        await db.commit()

        assert summary["current"] == synced["current_streak_days"]
        assert summary["longest"] == synced["longest_streak_days"]
        assert summary["tier"] == synced["streak_tier"]

    async def test_is_idempotent(self, student: User, db: AsyncSession):
        from app.commands.recompute_streaks import recompute_student

        start = TODAY - timedelta(days=10)
        await anchor_tracking(db, student, start)
        await seed_days(db, student.id, start, "QQQQQQQ.QQ")

        fresh = (await db.execute(select(User).where(User.id == student.id))).scalar_one()
        first = await recompute_student(db, fresh)
        await db.commit()
        second = await recompute_student(db, fresh)
        await db.commit()
        assert first == second
