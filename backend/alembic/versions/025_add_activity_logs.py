"""create activity_logs table

Immutable event log recording every state-changing action across both portals.
Inserted by ActivityLogMiddleware and the login endpoint; no write API exposed.

Revision ID: 025
Revises: 024
Create Date: 2026-04-19

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "025"
down_revision = "024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "activity_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),

        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=True),

        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_name", sa.String(length=255), nullable=True),
        sa.Column("actor_type", sa.String(length=20), nullable=True),

        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("method", sa.String(length=10), nullable=False),
        sa.Column("path", sa.String(length=500), nullable=False),

        sa.Column("target_type", sa.String(length=50), nullable=True),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("target_name", sa.String(length=255), nullable=True),

        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("outcome", sa.String(length=20), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),

        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("request_id", sa.String(length=64), nullable=True),

        sa.Column("meta", postgresql.JSONB(), nullable=True),

        sa.CheckConstraint(
            "actor_type IS NULL OR actor_type IN ('tutor', 'student')",
            name="ck_activity_logs_actor_type",
        ),
        sa.CheckConstraint(
            "outcome IS NULL OR outcome IN ('success', 'client_error', 'server_error', 'exception')",
            name="ck_activity_logs_outcome",
        ),
    )

    op.create_index("ix_activity_logs_started_at", "activity_logs", ["started_at"])
    op.create_index("ix_activity_logs_ended_at", "activity_logs", ["ended_at"])
    op.create_index("ix_activity_logs_actor_id", "activity_logs", ["actor_id"])
    op.create_index("ix_activity_logs_action", "activity_logs", ["action"])
    op.create_index("ix_activity_logs_target_type", "activity_logs", ["target_type"])
    op.create_index("ix_activity_logs_target_id", "activity_logs", ["target_id"])
    op.create_index("ix_activity_logs_outcome", "activity_logs", ["outcome"])

    # Composite indexes for the common query patterns
    op.create_index(
        "ix_activity_logs_actor_id_ended_at",
        "activity_logs",
        ["actor_id", sa.text("ended_at DESC")],
    )
    op.create_index(
        "ix_activity_logs_target_ended_at",
        "activity_logs",
        ["target_type", "target_id", sa.text("ended_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_activity_logs_target_ended_at", table_name="activity_logs")
    op.drop_index("ix_activity_logs_actor_id_ended_at", table_name="activity_logs")
    op.drop_index("ix_activity_logs_outcome", table_name="activity_logs")
    op.drop_index("ix_activity_logs_target_id", table_name="activity_logs")
    op.drop_index("ix_activity_logs_target_type", table_name="activity_logs")
    op.drop_index("ix_activity_logs_action", table_name="activity_logs")
    op.drop_index("ix_activity_logs_actor_id", table_name="activity_logs")
    op.drop_index("ix_activity_logs_ended_at", table_name="activity_logs")
    op.drop_index("ix_activity_logs_started_at", table_name="activity_logs")
    op.drop_table("activity_logs")
