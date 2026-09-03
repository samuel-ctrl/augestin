"""add streak tracking

Revision ID: 029
Revises: 028
Create Date: 2026-09-03

Adds the storage behind the student Day Streak:

- `student_daily_activity` — one row per (student, IST calendar date)
  accumulating credited active seconds. Raw per-day rows are kept
  deliberately; they are the substrate for later engagement analytics.
- Three streak columns on `users`, rather than a 1:1 table, because
  `AuthMiddleware` already loads the whole User row per request — the
  tutor tile and the student sync both cost zero extra queries.
- `notifications.sender_id` becomes nullable: streak notifications are
  system-generated and have no human sender.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.utils.ist import ist_today, week_start

revision: str = "029"
down_revision: Union[str, None] = "028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "student_daily_activity",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        # IST calendar date, not UTC — see app/utils/ist.py.
        sa.Column("activity_date", sa.Date(), nullable=False),
        sa.Column("active_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_beat_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.Column("created_by_name", sa.String(), nullable=True),
        sa.Column("updated_by_name", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "activity_date", name="uq_student_daily_activity_date"),
    )
    op.create_index(
        "ix_student_daily_activity_student_date",
        "student_daily_activity",
        ["student_id", "activity_date"],
    )

    # server_default is required so existing rows get 0, and stays permanently
    # (same rationale as `version` in 028).
    op.add_column(
        "users",
        sa.Column("total_streaks_earned", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("users", sa.Column("last_finalized_week_start", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("last_streak_warning_date", sa.Date(), nullable=True))

    op.alter_column("notifications", "sender_id", existing_type=postgresql.UUID(), nullable=True)

    # Backfill: every EXISTING student gets last_finalized_week_start = THIS
    # week's Monday, computed once here rather than left NULL. A NULL marker
    # lazy-inits from the student's real (months-old) created_at, which makes
    # their first sync walk months of pre-feature history — harmless, since an
    # empty week can never be congratulated — but, far worse, it makes the
    # LIVE status for the current week count days that elapsed before this
    # code even shipped as misses. Ship mid-week with NULL markers and the
    # entire existing student base sees "broken" the moment they open the app.
    # With this backfill the launch week is everyone's "first tracked week"
    # (week_status "not_tracked"), exactly as a brand-new signup's first week
    # already is. New signups AFTER this migration are unaffected — they still
    # get NULL and lazy-init from their own created_at.
    op.execute(
        sa.text(
            "UPDATE users SET last_finalized_week_start = :this_monday "
            "WHERE user_type = 'student'"
        ).bindparams(this_monday=week_start(ist_today()))
    )


def downgrade() -> None:
    # WARNING: this PERMANENTLY DELETES real notification history. Every
    # system-generated (null-sender) notification — streak warnings and
    # congratulations that students may not have read yet — is destroyed,
    # because sender_id cannot be restored to NOT NULL while such rows exist
    # and there is no human sender to attribute them to. This is irreversible.
    op.execute("DELETE FROM notifications WHERE sender_id IS NULL")
    op.alter_column("notifications", "sender_id", existing_type=postgresql.UUID(), nullable=False)

    op.drop_column("users", "last_streak_warning_date")
    op.drop_column("users", "last_finalized_week_start")
    op.drop_column("users", "total_streaks_earned")

    op.drop_index("ix_student_daily_activity_student_date", table_name="student_daily_activity")
    op.drop_table("student_daily_activity")
