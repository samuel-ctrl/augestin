"""add audit fields to all tables

Revision ID: 002
Revises: 001
Create Date: 2026-03-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# All tables that get audit fields
TABLES = ["users", "subjects", "books", "book_assignments", "watch_progress"]


def upgrade() -> None:
    # --- 1. Add new audit columns to all tables ---
    for table in TABLES:
        op.add_column(table, sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
        op.add_column(table, sa.Column("updated_by", sa.String(), nullable=True))
        op.add_column(table, sa.Column("created_by_name", sa.String(), nullable=True))
        op.add_column(table, sa.Column("updated_by_name", sa.String(), nullable=True))

    # --- 2. Convert created_by from UUID to String (drop FK first) ---

    # Users: drop self-referential FK on created_by, alter type
    op.drop_constraint("users_created_by_fkey", "users", type_="foreignkey")
    op.alter_column(
        "users", "created_by",
        type_=sa.String(),
        existing_type=sa.UUID(),
        existing_nullable=True,
        postgresql_using="created_by::text",
    )

    # Subjects: drop FK, alter type, make nullable
    op.drop_constraint("subjects_created_by_fkey", "subjects", type_="foreignkey")
    op.alter_column(
        "subjects", "created_by",
        type_=sa.String(),
        existing_type=sa.UUID(),
        nullable=True,
        postgresql_using="created_by::text",
    )

    # Books: drop FK, alter type, make nullable
    op.drop_constraint("books_created_by_fkey", "books", type_="foreignkey")
    op.alter_column(
        "books", "created_by",
        type_=sa.String(),
        existing_type=sa.UUID(),
        nullable=True,
        postgresql_using="created_by::text",
    )

    # --- 3. Book assignments: rename assigned_at -> add created_at, drop assigned_at ---
    op.add_column(
        "book_assignments",
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    # Copy assigned_at data into created_at
    op.execute("UPDATE book_assignments SET created_at = assigned_at")
    op.drop_column("book_assignments", "assigned_at")

    # Book assignments also needs created_by (from AuditBase)
    op.add_column(
        "book_assignments",
        sa.Column("created_by", sa.String(), nullable=True),
    )

    # --- 4. Tables missing created_at/updated_at: add them ---
    # book_assignments: created_at was added above, needs updated_at
    op.add_column(
        "book_assignments",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # watch_progress: needs both created_at and updated_at
    op.add_column(
        "watch_progress",
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.add_column(
        "watch_progress",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Backfill created_at from last_watched_at where available
    op.execute("UPDATE watch_progress SET created_at = last_watched_at WHERE last_watched_at IS NOT NULL")

    # watch_progress also needs created_by (from AuditBase)
    op.add_column(
        "watch_progress",
        sa.Column("created_by", sa.String(), nullable=True),
    )

    # --- 5. Make updated_at nullable and add timezone on existing tables ---
    TABLES_WITH_EXISTING_TIMESTAMPS = ["users", "subjects", "books"]
    for table in TABLES_WITH_EXISTING_TIMESTAMPS:
        op.alter_column(
            table, "updated_at",
            type_=sa.DateTime(timezone=True),
            existing_type=sa.DateTime(),
            nullable=True,
        )
        op.alter_column(
            table, "created_at",
            type_=sa.DateTime(timezone=True),
            existing_type=sa.DateTime(),
            existing_nullable=False,
        )


def downgrade() -> None:
    # --- Reverse: restore assigned_at on book_assignments ---
    op.add_column(
        "book_assignments",
        sa.Column("assigned_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.execute("UPDATE book_assignments SET assigned_at = created_at")
    op.drop_column("book_assignments", "created_at")
    op.drop_column("book_assignments", "created_by")

    # --- Restore created_by types and FKs ---
    op.alter_column(
        "books", "created_by",
        type_=sa.UUID(),
        existing_type=sa.String(),
        nullable=False,
        postgresql_using="created_by::uuid",
    )
    op.create_foreign_key("books_created_by_fkey", "books", "users", ["created_by"], ["id"], ondelete="CASCADE")

    op.alter_column(
        "subjects", "created_by",
        type_=sa.UUID(),
        existing_type=sa.String(),
        nullable=False,
        postgresql_using="created_by::uuid",
    )
    op.create_foreign_key("subjects_created_by_fkey", "subjects", "users", ["created_by"], ["id"], ondelete="CASCADE")

    op.alter_column(
        "users", "created_by",
        type_=sa.UUID(),
        existing_type=sa.String(),
        existing_nullable=True,
        postgresql_using="created_by::uuid",
    )
    op.create_foreign_key("users_created_by_fkey", "users", "users", ["created_by"], ["id"], ondelete="SET NULL")

    # --- Restore updated_at to non-nullable DateTime ---
    # book_assignments and watch_progress had no updated_at originally — just drop
    op.drop_column("book_assignments", "updated_at")
    op.drop_column("watch_progress", "updated_at")
    op.drop_column("watch_progress", "created_at")
    op.drop_column("watch_progress", "created_by")

    TABLES_WITH_EXISTING_TIMESTAMPS = ["users", "subjects", "books"]
    for table in TABLES_WITH_EXISTING_TIMESTAMPS:
        op.alter_column(
            table, "updated_at",
            type_=sa.DateTime(),
            existing_type=sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        )
        op.alter_column(
            table, "created_at",
            type_=sa.DateTime(),
            existing_type=sa.DateTime(timezone=True),
            existing_nullable=False,
        )

    # --- Drop audit columns ---
    for table in TABLES:
        op.drop_column(table, "version")
        op.drop_column(table, "updated_by")
        op.drop_column(table, "created_by_name")
        op.drop_column(table, "updated_by_name")
