import uuid
from datetime import datetime

from sqlalchemy import JSON, CheckConstraint, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# Use JSONB in Postgres (indexable, binary-packed), fall back to plain JSON
# in SQLite so the test suite can create the table against an in-memory DB.
_JSON_COL = JSONB().with_variant(JSON(), "sqlite")


class ActivityLog(Base):
    """Immutable event log. Intentionally does NOT inherit from AuditBase —
    logs are never updated, and we own the actor snapshot fields directly."""

    __tablename__ = "activity_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    ended_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    actor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    actor_type: Mapped[str | None] = mapped_column(String(20), nullable=True)

    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False)

    target_type: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    target_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    target_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    meta: Mapped[dict | None] = mapped_column(_JSON_COL, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "actor_type IS NULL OR actor_type IN ('tutor', 'student')",
            name="ck_activity_logs_actor_type",
        ),
        CheckConstraint(
            "outcome IS NULL OR outcome IN ('success', 'client_error', 'server_error', 'exception')",
            name="ck_activity_logs_outcome",
        ),
    )
