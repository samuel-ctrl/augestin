"""update quiz_progress: add completion fields, remove level

Revision ID: 004
Revises: 003
Create Date: 2026-03-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns
    op.add_column("quiz_progress", sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("quiz_progress", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("quiz_progress", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("quiz_progress", sa.Column("score_percentage", sa.Float(), nullable=False, server_default="0.0"))
    op.add_column("quiz_progress", sa.Column("total_time_seconds", sa.Integer(), nullable=False, server_default="0"))

    # Drop obsolete columns
    op.drop_column("quiz_progress", "current_level")
    op.drop_column("quiz_progress", "last_practiced_at")


def downgrade() -> None:
    op.add_column("quiz_progress", sa.Column("current_level", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("quiz_progress", sa.Column("last_practiced_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.drop_column("quiz_progress", "total_time_seconds")
    op.drop_column("quiz_progress", "score_percentage")
    op.drop_column("quiz_progress", "completed_at")
    op.drop_column("quiz_progress", "started_at")
    op.drop_column("quiz_progress", "is_completed")
