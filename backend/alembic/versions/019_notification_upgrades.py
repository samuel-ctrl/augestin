"""notification upgrades: rename student_id to recipient_id, add type and reference_id

Revision ID: 019
Revises: 018
Create Date: 2026-04-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rename student_id -> recipient_id
    op.alter_column("notifications", "student_id", new_column_name="recipient_id")
    op.drop_index("ix_notifications_student_id", table_name="notifications")
    op.create_index("ix_notifications_recipient_id", "notifications", ["recipient_id"])

    # Add notification_type and reference_id columns
    op.add_column("notifications", sa.Column("notification_type", sa.String(50), nullable=True))
    op.add_column("notifications", sa.Column("reference_id", postgresql.UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    op.drop_column("notifications", "reference_id")
    op.drop_column("notifications", "notification_type")

    op.drop_index("ix_notifications_recipient_id", table_name="notifications")
    op.alter_column("notifications", "recipient_id", new_column_name="student_id")
    op.create_index("ix_notifications_student_id", "notifications", ["student_id"])
