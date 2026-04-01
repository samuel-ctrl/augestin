"""create test_sets, test_set_files, test_set_assignments, test_set_submissions tables

Revision ID: 013
Revises: 012
Create Date: 2026-04-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # test_sets
    op.create_table(
        "test_sets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tutor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.Column("created_by_name", sa.String(), nullable=True),
        sa.Column("updated_by_name", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["tutor_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_test_sets_tutor_id", "test_sets", ["tutor_id"])

    # test_set_files
    op.create_table(
        "test_set_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("test_set_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("drive_link", sa.Text(), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.Column("created_by_name", sa.String(), nullable=True),
        sa.Column("updated_by_name", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["test_set_id"], ["test_sets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_test_set_files_test_set_id", "test_set_files", ["test_set_id"])

    # test_set_assignments
    op.create_table(
        "test_set_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("test_set_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.Column("created_by_name", sa.String(), nullable=True),
        sa.Column("updated_by_name", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["test_set_id"], ["test_sets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("test_set_id", "student_id", name="uq_test_set_student"),
    )
    op.create_index("ix_test_set_assignment_test_set", "test_set_assignments", ["test_set_id"])
    op.create_index("ix_test_set_assignment_student", "test_set_assignments", ["student_id"])

    # test_set_submissions
    op.create_table(
        "test_set_submissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("test_set_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.Column("created_by_name", sa.String(), nullable=True),
        sa.Column("updated_by_name", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["test_set_id"], ["test_sets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("test_set_id", "student_id", name="uq_test_set_submission_student"),
    )
    op.create_index("ix_test_set_submission_test_set", "test_set_submissions", ["test_set_id"])
    op.create_index("ix_test_set_submission_student", "test_set_submissions", ["student_id"])


def downgrade() -> None:
    op.drop_index("ix_test_set_submission_student", "test_set_submissions")
    op.drop_index("ix_test_set_submission_test_set", "test_set_submissions")
    op.drop_table("test_set_submissions")
    op.drop_index("ix_test_set_assignment_student", "test_set_assignments")
    op.drop_index("ix_test_set_assignment_test_set", "test_set_assignments")
    op.drop_table("test_set_assignments")
    op.drop_index("ix_test_set_files_test_set_id", "test_set_files")
    op.drop_table("test_set_files")
    op.drop_index("ix_test_sets_tutor_id", "test_sets")
    op.drop_table("test_sets")
