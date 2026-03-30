"""fix quiz_sets and book_recaps: rename created_by UUID to tutor_id/author_id,
add missing audit columns

Revision ID: 012
Revises: 011
Create Date: 2026-03-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- quiz_sets: rename created_by (UUID FK) -> tutor_id ---
    op.drop_index("ix_quiz_sets_created_by", table_name="quiz_sets")
    op.alter_column("quiz_sets", "created_by", new_column_name="tutor_id")
    op.create_index("ix_quiz_sets_tutor_id", "quiz_sets", ["tutor_id"])

    # quiz_sets: add missing audit columns
    op.add_column("quiz_sets", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("quiz_sets", sa.Column("created_by", sa.String(), nullable=True))
    op.add_column("quiz_sets", sa.Column("updated_by", sa.String(), nullable=True))
    op.add_column("quiz_sets", sa.Column("created_by_name", sa.String(), nullable=True))
    op.add_column("quiz_sets", sa.Column("updated_by_name", sa.String(), nullable=True))

    # --- quiz_set_assignments: add missing audit columns ---
    op.add_column("quiz_set_assignments", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("quiz_set_assignments", sa.Column("created_by", sa.String(), nullable=True))
    op.add_column("quiz_set_assignments", sa.Column("updated_by", sa.String(), nullable=True))
    op.add_column("quiz_set_assignments", sa.Column("created_by_name", sa.String(), nullable=True))
    op.add_column("quiz_set_assignments", sa.Column("updated_by_name", sa.String(), nullable=True))

    # --- book_recaps: rename created_by (UUID FK) -> author_id ---
    op.drop_index("ix_book_recaps_created_by", table_name="book_recaps")
    op.alter_column("book_recaps", "created_by", new_column_name="author_id")
    op.create_index("ix_book_recaps_author_id", "book_recaps", ["author_id"])

    # book_recaps: add missing audit columns
    op.add_column("book_recaps", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("book_recaps", sa.Column("created_by", sa.String(), nullable=True))
    op.add_column("book_recaps", sa.Column("updated_by", sa.String(), nullable=True))
    op.add_column("book_recaps", sa.Column("created_by_name", sa.String(), nullable=True))
    op.add_column("book_recaps", sa.Column("updated_by_name", sa.String(), nullable=True))


def downgrade() -> None:
    # --- book_recaps ---
    op.drop_column("book_recaps", "updated_by_name")
    op.drop_column("book_recaps", "created_by_name")
    op.drop_column("book_recaps", "updated_by")
    op.drop_column("book_recaps", "created_by")
    op.drop_column("book_recaps", "version")
    op.drop_index("ix_book_recaps_author_id", table_name="book_recaps")
    op.alter_column("book_recaps", "author_id", new_column_name="created_by")
    op.create_index("ix_book_recaps_created_by", "book_recaps", ["created_by"])

    # --- quiz_set_assignments ---
    op.drop_column("quiz_set_assignments", "updated_by_name")
    op.drop_column("quiz_set_assignments", "created_by_name")
    op.drop_column("quiz_set_assignments", "updated_by")
    op.drop_column("quiz_set_assignments", "created_by")
    op.drop_column("quiz_set_assignments", "version")

    # --- quiz_sets ---
    op.drop_column("quiz_sets", "updated_by_name")
    op.drop_column("quiz_sets", "created_by_name")
    op.drop_column("quiz_sets", "updated_by")
    op.drop_column("quiz_sets", "created_by")
    op.drop_column("quiz_sets", "version")
    op.drop_index("ix_quiz_sets_tutor_id", table_name="quiz_sets")
    op.alter_column("quiz_sets", "tutor_id", new_column_name="created_by")
    op.create_index("ix_quiz_sets_created_by", "quiz_sets", ["created_by"])
