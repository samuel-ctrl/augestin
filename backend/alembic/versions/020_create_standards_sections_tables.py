"""create standards and sections lookup tables

Revision ID: 020
Revises: 019
Create Date: 2026-04-11 00:00:00.000000

"""
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    standards = op.create_table(
        "standards",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("name", sa.String(10), unique=True, nullable=False),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("created_by", sa.String, nullable=True),
        sa.Column("updated_by", sa.String, nullable=True),
        sa.Column("created_by_name", sa.String, nullable=True),
        sa.Column("updated_by_name", sa.String, nullable=True),
    )

    sections = op.create_table(
        "sections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("name", sa.String(10), unique=True, nullable=False),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("created_by", sa.String, nullable=True),
        sa.Column("updated_by", sa.String, nullable=True),
        sa.Column("created_by_name", sa.String, nullable=True),
        sa.Column("updated_by_name", sa.String, nullable=True),
    )

    # Seed standards 1-12
    op.bulk_insert(
        standards,
        [
            {"id": uuid.uuid4(), "name": str(i), "display_order": i}
            for i in range(1, 13)
        ],
    )

    # Seed sections A-E
    op.bulk_insert(
        sections,
        [
            {"id": uuid.uuid4(), "name": letter, "display_order": idx}
            for idx, letter in enumerate(["A", "B", "C", "D", "E"], start=1)
        ],
    )


def downgrade() -> None:
    op.drop_table("sections")
    op.drop_table("standards")
