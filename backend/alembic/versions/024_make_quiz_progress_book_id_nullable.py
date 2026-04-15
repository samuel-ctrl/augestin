"""make quiz_progress.book_id nullable

Migration 008 introduced quiz_source/quiz_id on quiz_progress but forgot
to drop the NOT NULL constraint on book_id (migration 007 did this for
quiz_attempts). Starting a quiz for a quiz_set inserts book_id=NULL and
fails with NotNullViolationError.

Revision ID: 024
Revises: 023
Create Date: 2026-04-15

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "024"
down_revision: Union[str, None] = "023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "quiz_progress",
        "book_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )


def downgrade() -> None:
    # Will fail if any rows have NULL book_id (i.e. quiz_set progress rows).
    op.alter_column(
        "quiz_progress",
        "book_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )
