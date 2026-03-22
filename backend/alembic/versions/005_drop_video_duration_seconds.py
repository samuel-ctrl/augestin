"""drop video_duration_seconds from books

Revision ID: 005
Revises: 004
Create Date: 2026-03-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("books", "video_duration_seconds")


def downgrade() -> None:
    op.add_column(
        "books",
        sa.Column("video_duration_seconds", sa.Float(), nullable=True),
    )
