"""streak: weekly model -> consecutive-day model

Revision ID: 030
Revises: 029
Create Date: 2026-09-03

Replaces the weekly Mon..Sun binary streak (029) with a consecutive-day
streak. See docs/STREAK_REDESIGN_PLAN.md.

SCHEMA ONLY. The backfill is deliberately NOT here — it lives in
`python -m app.commands.recompute_streaks`, run as a deploy step. A migration
that imported the evaluator would break on replay the first time the streak
rules changed, and the same command doubles as the operational repair tool
whenever activity data is corrected.

029 shipped one day before this, so `student_daily_activity` holds at most a
day of real data and the weekly columns carry nothing worth preserving. They
are dropped outright rather than left to rot as dead columns.
"""
from datetime import date
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# Kept as a literal, NOT imported from app.services.streak: a migration must
# keep meaning the same thing after the app constant is retuned.
STREAK_TRACKING_EPOCH = date(2026, 9, 3)

revision: str = "030"
down_revision: Union[str, None] = "029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_NEW_USER_COLUMN_NAMES = (
    "streak_tracking_since",
    "last_activity_finalized_date",
    "current_streak_days",
    "longest_streak_days",
    "last_qualifying_date",
    "streak_grace_used_on",
    "streak_freezes",
    "streak_freezes_progress",
    "streak_break_at",
    "streak_pre_break_days",
    "streak_tier",
)


def _new_user_columns() -> list[sa.Column]:
    """Fresh Column objects on every call.

    A FUNCTION, not a module-level tuple: `op.add_column` binds the Column to
    a Table, so reusing the same instance raises "already assigned to Table"
    the second time. That happens for real whenever a single process runs
    upgrade -> downgrade -> upgrade, which is exactly what a migration test
    or a rollback-and-retry deploy does.

    server_default is required on every NOT NULL add so existing rows are
    valid at the moment the column appears, and stays permanently (same
    rationale as `version` in 028).
    """
    return [
        sa.Column("streak_tracking_since", sa.Date(), nullable=True),
        sa.Column("last_activity_finalized_date", sa.Date(), nullable=True),
        sa.Column("current_streak_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("longest_streak_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_qualifying_date", sa.Date(), nullable=True),
        sa.Column("streak_grace_used_on", sa.Date(), nullable=True),
        sa.Column("streak_freezes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("streak_freezes_progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("streak_break_at", sa.Date(), nullable=True),
        sa.Column("streak_pre_break_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("streak_tier", sa.String(length=20), nullable=True),
    ]


def upgrade() -> None:
    for column in _new_user_columns():
        op.add_column("users", column)

    # Weekly model, retired. `last_streak_warning_date` is NOT dropped — the
    # new at-risk rule reuses it for the same same-day suppression.
    op.drop_column("users", "total_streaks_earned")
    op.drop_column("users", "last_finalized_week_start")

    # How the evaluator scored a finalized day: qualifying | grace | freeze |
    # break | missed. NULL means "not finalized yet", which is ALWAYS true of
    # today. Nullable with no default, on purpose: a default would make every
    # unwalked day look scored.
    op.add_column(
        "student_daily_activity",
        sa.Column("day_status", sa.String(length=12), nullable=True),
    )

    # Streak tracking shipped in 029; nothing before that date can have real
    # activity. Anchoring every existing student here (rather than at their
    # months-old created_at) keeps the walk short and, more importantly, stops
    # the student's card rendering a fortnight of pre-feature days as misses.
    # New signups after this migration get NULL and lazy-init from their own
    # created_at in sync_streak().
    op.execute(
        sa.text(
            "UPDATE users SET streak_tracking_since = :epoch "
            "WHERE user_type = 'student'"
        ).bindparams(epoch=STREAK_TRACKING_EPOCH)
    )


def downgrade() -> None:
    op.drop_column("student_daily_activity", "day_status")

    # Restored with the same server_default 029 gave them. The weekly COUNTS
    # are gone for good — they were derived from week evaluations this
    # migration deleted the marker for, and nothing here can reconstruct them.
    op.add_column(
        "users",
        sa.Column("total_streaks_earned", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("users", sa.Column("last_finalized_week_start", sa.Date(), nullable=True))

    for name in reversed(_NEW_USER_COLUMN_NAMES):
        op.drop_column("users", name)
