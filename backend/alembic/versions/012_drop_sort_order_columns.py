"""drop sort_order from books and questions

Revision ID: 012
Revises: 011
Create Date: 2026-03-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("books", "sort_order")
    op.drop_column("questions", "sort_order")


def downgrade() -> None:
    op.add_column("questions", sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("books", sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"))
