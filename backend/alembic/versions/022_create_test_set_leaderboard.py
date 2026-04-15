"""create test_set_leaderboard_entries table

Revision ID: 022
Revises: 021
Create Date: 2026-04-15 00:10:00.000000

"""
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "test_set_leaderboard_entries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("test_set_id", UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", UUID(as_uuid=True), nullable=False),
        sa.Column("rank", sa.Integer, nullable=False),
        sa.Column("score", sa.String(50), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("created_by", sa.String, nullable=True),
        sa.Column("updated_by", sa.String, nullable=True),
        sa.Column("created_by_name", sa.String, nullable=True),
        sa.Column("updated_by_name", sa.String, nullable=True),
        sa.ForeignKeyConstraint(["test_set_id"], ["test_sets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("test_set_id", "student_id", name="uq_test_set_leaderboard_student"),
    )
    op.create_index(
        "ix_test_set_leaderboard_test_set",
        "test_set_leaderboard_entries",
        ["test_set_id", "rank"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_test_set_leaderboard_test_set", table_name="test_set_leaderboard_entries"
    )
    op.drop_table("test_set_leaderboard_entries")
