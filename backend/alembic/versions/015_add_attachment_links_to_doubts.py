"""add attachment_links to doubts

Revision ID: 015
Revises: 014
Create Date: 2026-04-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "doubts",
        sa.Column("attachment_links", postgresql.JSON(), nullable=True, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("doubts", "attachment_links")
