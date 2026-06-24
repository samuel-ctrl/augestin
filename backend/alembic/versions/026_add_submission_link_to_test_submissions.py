"""add submission_link to test_submissions

Revision ID: 026
Revises: 025
Create Date: 2026-06-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "026"
down_revision = "025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "test_submissions",
        sa.Column("submission_link", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("test_submissions", "submission_link")
