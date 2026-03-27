"""refactor quiz_progress to support multiple quiz sources

Revision ID: 008
Revises: 007
Create Date: 2026-03-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to quiz_progress
    op.add_column("quiz_progress", sa.Column("quiz_source", sa.String(20), nullable=False, server_default="book"))
    op.add_column("quiz_progress", sa.Column("quiz_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("quiz_progress", sa.Column("is_started", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("quiz_progress", sa.Column("skipped_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("quiz_progress", sa.Column("total_questions", sa.Integer(), nullable=False, server_default="0"))

    # Rename score_percentage to score_percentage (already done)
    # Add any other fields if needed

    # Create new unique constraint for quiz_source
    op.create_unique_constraint(
        "uq_student_quiz_source",
        "quiz_progress",
        ["student_id", "quiz_source", "quiz_id"],
    )

    # Add indexes
    op.create_index("ix_quiz_progress_source", "quiz_progress", ["quiz_source", "quiz_id", "student_id"])

    # Keep existing unique constraint for backward compatibility
    # Note: uq_student_book_quiz should remain as is


def downgrade() -> None:
    op.drop_index("ix_quiz_progress_source", table_name="quiz_progress")
    op.drop_constraint("uq_student_quiz_source", "quiz_progress", type_="unique")

    # Drop new columns
    op.drop_column("quiz_progress", "total_questions")
    op.drop_column("quiz_progress", "skipped_count")
    op.drop_column("quiz_progress", "is_started")
    op.drop_column("quiz_progress", "quiz_id")
    op.drop_column("quiz_progress", "quiz_source")
