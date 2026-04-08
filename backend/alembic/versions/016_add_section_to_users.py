"""add section column to users

Revision ID: 016
Revises: 015
Create Date: 2026-04-07 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("section", sa.String(5), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "section")
