"""add submission_link to test_set_submissions

Revision ID: 017
Revises: 016
Create Date: 2026-04-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "test_set_submissions",
        sa.Column("submission_link", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("test_set_submissions", "submission_link")
