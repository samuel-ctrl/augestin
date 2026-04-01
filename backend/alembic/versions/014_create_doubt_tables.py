"""create doubts and doubt_comments tables

Revision ID: 014
Revises: 013
Create Date: 2026-04-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # doubts
    op.create_table(
        "doubts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("book_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.Column("created_by_name", sa.String(), nullable=True),
        sa.Column("updated_by_name", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_doubts_student_id", "doubts", ["student_id"])
    op.create_index("ix_doubts_book_id", "doubts", ["book_id"])
    op.create_index("ix_doubts_status", "doubts", ["status"])

    # doubt_comments
    op.create_table(
        "doubt_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("doubt_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.Column("created_by_name", sa.String(), nullable=True),
        sa.Column("updated_by_name", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["doubt_id"], ["doubts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_doubt_comments_doubt_id", "doubt_comments", ["doubt_id"])
    op.create_index("ix_doubt_comments_user_id", "doubt_comments", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_doubt_comments_user_id", "doubt_comments")
    op.drop_index("ix_doubt_comments_doubt_id", "doubt_comments")
    op.drop_table("doubt_comments")
    op.drop_index("ix_doubts_status", "doubts")
    op.drop_index("ix_doubts_book_id", "doubts")
    op.drop_index("ix_doubts_student_id", "doubts")
    op.drop_table("doubts")
