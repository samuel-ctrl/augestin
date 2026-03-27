"""refactor quiz_attempt to support multiple quiz sources

Revision ID: 007
Revises: 006
Create Date: 2026-03-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to quiz_attempts
    op.add_column("quiz_attempts", sa.Column("quiz_source", sa.String(20), nullable=False, server_default="book"))
    op.add_column("quiz_attempts", sa.Column("quiz_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("book_id")))
    op.add_column("quiz_attempts", sa.Column("is_skipped", sa.Boolean(), nullable=False, server_default="false"))

    # Make book_id nullable
    op.alter_column("quiz_attempts", "book_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)

    # Add indexes
    op.create_index("ix_quiz_attempt_source", "quiz_attempts", ["quiz_source", "quiz_id", "student_id"])

    # Note: Existing index ix_quiz_attempt_student_book will be kept for backward compatibility


def downgrade() -> None:
    op.drop_index("ix_quiz_attempt_source", table_name="quiz_attempts")

    # Make book_id not null again (this will fail if there are null values)
    op.alter_column("quiz_attempts", "book_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)

    # Drop new columns
    op.drop_column("quiz_attempts", "is_skipped")
    op.drop_column("quiz_attempts", "quiz_id")
    op.drop_column("quiz_attempts", "quiz_source")
