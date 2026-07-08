"""create book_recaps table (student-owned, book-scoped)

Revision ID: 028
Revises: 027
Create Date: 2026-07-08

Each student may keep their own personal recap notes for a book,
separate from the tutor-authored per-topic notes (topic_notes).
One row per (book_id, student_id); the student has full read/write
access to their own row only.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "028"
down_revision: Union[str, None] = "027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "book_recaps",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("book_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("content", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.Column("created_by_name", sa.String(), nullable=True),
        sa.Column("updated_by_name", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("book_id", "student_id", name="uq_book_recap_book_student"),
    )
    op.create_index("ix_book_recaps_book_id", "book_recaps", ["book_id"])
    op.create_index("ix_book_recaps_student_id", "book_recaps", ["student_id"])


def downgrade() -> None:
    op.drop_index("ix_book_recaps_student_id", table_name="book_recaps")
    op.drop_index("ix_book_recaps_book_id", table_name="book_recaps")
    op.drop_table("book_recaps")
