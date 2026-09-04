"""Rebuild every student's streak columns from raw activity rows.

    python -m app.commands.recompute_streaks
    python -m app.commands.recompute_streaks --student <uuid>
    python -m app.commands.recompute_streaks --dry-run

Two jobs:

1. **Backfill** after migration 030, which adds the columns but deliberately
   does not populate them (a migration that imported the evaluator would break
   on replay the first time the rules changed).
2. **Repair.** Every streak column on `users`, and every `day_status` on
   `student_daily_activity`, is a CACHE of a pure walk over `active_seconds`.
   Correcting a past day's activity, or changing the rules in
   services/streak.py, silently invalidates every value after it. This command
   is the sanctioned way to make them true again.

Idempotent: running it twice in a row produces identical output, and running
it on a student who is already up to date changes nothing.

It does NOT emit notifications. A backfill that congratulated everyone for
tiers they earned before the feature existed would be spam; students see their
correct tier on their next app open instead.
"""

import argparse
import asyncio
import uuid
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.student_daily_activity import StudentDailyActivity
from app.models.user import User, UserType
from app.services.streak import (
    StreakState,
    expire_repair,
    state_to_user,
    tracking_start_for,
    walk_days,
)
from app.utils.ist import ist_today

COMMIT_BATCH = 200


async def recompute_student(db: AsyncSession, user: User, *, dry_run: bool = False) -> dict:
    """Replay one student's whole history. Returns a summary dict."""
    today = ist_today()
    yesterday = today - timedelta(days=1)
    # Honour an ALREADY-PERSISTED tracking start over re-deriving one. This
    # command's whole job is to reproduce what sync_streak would have
    # computed, and sync lazy-inits this once and then treats it as fixed —
    # re-deriving here would silently disagree with sync for any student
    # whose start was pinned by migration 030's backfill or adjusted by hand.
    tracking_since = user.streak_tracking_since or tracking_start_for(user)

    rows = (
        await db.execute(
            select(
                StudentDailyActivity.activity_date, StudentDailyActivity.active_seconds
            ).where(StudentDailyActivity.student_id == user.id)
        )
    ).all()
    day_seconds = {d: s for d, s in rows}
    have_row = set(day_seconds)

    # Start from a clean state — this is a full rebuild, not an increment.
    state = StreakState()
    walked = (
        walk_days(state, day_seconds, tracking_since, yesterday)
        if tracking_since <= yesterday
        else None
    )
    expire_repair(state, today)

    if dry_run:
        return {
            "login_id": user.login_id,
            "current": state.current,
            "longest": state.longest,
            "tier": state.tier,
            "freezes": state.freezes,
            "days": len(walked.outcomes) if walked else 0,
        }

    state_to_user(state, user)
    user.streak_tracking_since = tracking_since
    user.last_activity_finalized_date = yesterday if tracking_since <= yesterday else tracking_since - timedelta(days=1)

    if walked:
        # Clear first: a rerun after the rules changed must not leave a stale
        # status on a day whose classification moved.
        await db.execute(
            update(StudentDailyActivity)
            .where(StudentDailyActivity.student_id == user.id)
            .values(day_status=None)
            .execution_options(synchronize_session=False)
        )
        by_status: dict[str, list] = {}
        for o in walked.outcomes:
            if o.day in have_row:
                by_status.setdefault(o.status, []).append(o.day)
            elif o.status in ("grace", "freeze", "break"):
                db.add(
                    StudentDailyActivity(
                        student_id=user.id,
                        activity_date=o.day,
                        active_seconds=0,
                        day_status=o.status,
                    )
                )
        for status, days in by_status.items():
            await db.execute(
                update(StudentDailyActivity)
                .where(
                    StudentDailyActivity.student_id == user.id,
                    StudentDailyActivity.activity_date.in_(days),
                )
                .values(day_status=status)
                .execution_options(synchronize_session=False)
            )

    return {
        "login_id": user.login_id,
        "current": state.current,
        "longest": state.longest,
        "tier": state.tier,
        "freezes": state.freezes,
        "days": len(walked.outcomes) if walked else 0,
    }


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--student", help="Recompute one student by UUID")
    parser.add_argument("--dry-run", action="store_true", help="Report without writing")
    parser.add_argument("--quiet", action="store_true", help="Summary line only")
    args = parser.parse_args()

    async with async_session() as db:
        stmt = select(User).where(User.user_type == UserType.student)
        if args.student:
            stmt = stmt.where(User.id == uuid.UUID(args.student))
        students = (await db.execute(stmt)).scalars().all()

        changed = 0
        for i, student in enumerate(students, start=1):
            before = (student.current_streak_days, student.longest_streak_days, student.streak_tier)
            summary = await recompute_student(db, student, dry_run=args.dry_run)
            after = (summary["current"], summary["longest"], summary["tier"])
            if before != after:
                changed += 1
            if not args.quiet:
                print(
                    f"{summary['login_id']:<20} current={summary['current']:<4} "
                    f"longest={summary['longest']:<4} tier={summary['tier'] or '-':<10} "
                    f"freezes={summary['freezes']} days={summary['days']}"
                )
            # Commit in batches rather than holding one transaction open over
            # the whole school: a backfill across thousands of students would
            # otherwise take row locks on `users` for its entire runtime,
            # blocking every login that touches those rows.
            if not args.dry_run and i % COMMIT_BATCH == 0:
                await db.commit()

        if args.dry_run:
            await db.rollback()
        else:
            await db.commit()

        verb = "would change" if args.dry_run else "changed"
        print(f"\n{len(students)} student(s) processed, {changed} {verb}.")


if __name__ == "__main__":
    asyncio.run(main())
