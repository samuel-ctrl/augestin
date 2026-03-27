"""refactor questions to support both book and quiz_set sources

Revision ID: 006
Revises: 005
Create Date: 2026-03-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Add new columns to questions table
    op.add_column("questions", sa.Column("quiz_set_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("questions", sa.Column("question_image_url", sa.Text(), nullable=True))
    op.add_column("questions", sa.Column("option_a_image_url", sa.Text(), nullable=True))
    op.add_column("questions", sa.Column("option_b_image_url", sa.Text(), nullable=True))
    op.add_column("questions", sa.Column("option_c_image_url", sa.Text(), nullable=True))
    op.add_column("questions", sa.Column("option_d_image_url", sa.Text(), nullable=True))

    # Step 2: Make book_id nullable
    op.alter_column("questions", "book_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)

    # Step 3: Add foreign key constraint for quiz_set_id
    # (This will be added via FK after quiz_sets table is created in next migration)

    # Step 4: Add check constraint to ensure exactly one source
    op.create_check_constraint(
        "ck_question_source_check",
        "questions",
        "NOT (book_id IS NULL AND quiz_set_id IS NULL) AND NOT (book_id IS NOT NULL AND quiz_set_id IS NOT NULL)",
    )

    # Step 5: Add indexes
    op.create_index("ix_questions_quiz_set_id", "questions", ["quiz_set_id"])


def downgrade() -> None:
    # Drop index created in upgrade
    op.drop_index("ix_questions_quiz_set_id", table_name="questions")

    # Drop check constraint created in upgrade
    op.drop_constraint("ck_question_source_check", "questions", type_="check")

    # Make book_id not null again
    op.alter_column("questions", "book_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)

    # Drop new columns added in upgrade
    op.drop_column("questions", "option_d_image_url")
    op.drop_column("questions", "option_c_image_url")
    op.drop_column("questions", "option_b_image_url")
    op.drop_column("questions", "option_a_image_url")
    op.drop_column("questions", "question_image_url")
    op.drop_column("questions", "quiz_set_id")
