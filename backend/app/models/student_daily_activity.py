import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.audit import AuditBase


class StudentDailyActivity(AuditBase):
    """Credited active time for one student on one IST calendar date.

    High-frequency write path (a heartbeat every 5 minutes per open tab), so
    it follows watch_progress's shape: one narrow row per natural key, with
    the uniqueness and lookup index declared together in __table_args__.

    Rows are written by an atomic conditional UPDATE in services/streak.py,
    not by ORM mutation — see the concurrency notes there.
    """

    __tablename__ = "student_daily_activity"
    __table_args__ = (
        UniqueConstraint("student_id", "activity_date", name="uq_student_daily_activity_date"),
        Index("ix_student_daily_activity_student_date", "student_id", "activity_date"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # IST calendar date — never UTC. See app/utils/ist.py.
    activity_date: Mapped[date] = mapped_column(Date, nullable=False)
    active_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_beat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    student = relationship("User", foreign_keys=[student_id])
