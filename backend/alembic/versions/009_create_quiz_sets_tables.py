"""create quiz_sets and quiz_set_assignments tables

Revision ID: 009
Revises: 008
Create Date: 2026-03-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create quiz_sets table
    op.create_table(
        "quiz_sets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tutor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.Column("created_by_name", sa.String(), nullable=True),
        sa.Column("updated_by_name", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["tutor_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_quiz_sets_subject_id", "quiz_sets", ["subject_id"])
    op.create_index("ix_quiz_sets_tutor_id", "quiz_sets", ["tutor_id"])

    # Create quiz_set_assignments table
    op.create_table(
        "quiz_set_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("quiz_set_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.Column("created_by_name", sa.String(), nullable=True),
        sa.Column("updated_by_name", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["quiz_set_id"], ["quiz_sets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("quiz_set_id", "student_id", name="uq_quiz_set_student"),
    )
    op.create_index("ix_quiz_set_assignment_quiz", "quiz_set_assignments", ["quiz_set_id"])
    op.create_index("ix_quiz_set_assignment_student", "quiz_set_assignments", ["student_id"])

    # Add foreign key constraint for quiz_set_id in questions
    op.create_foreign_key(
        "fk_questions_quiz_set_id",
        "questions",
        "quiz_sets",
        ["quiz_set_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    # Drop foreign key from questions
    op.drop_constraint("fk_questions_quiz_set_id", "questions", type_="foreignkey")

    # Drop tables
    op.drop_index("ix_quiz_set_assignment_student", table_name="quiz_set_assignments")
    op.drop_index("ix_quiz_set_assignment_quiz", table_name="quiz_set_assignments")
    op.drop_table("quiz_set_assignments")

    op.drop_index("ix_quiz_sets_tutor_id", table_name="quiz_sets")
    op.drop_index("ix_quiz_sets_subject_id", table_name="quiz_sets")
    op.drop_table("quiz_sets")
