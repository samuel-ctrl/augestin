import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
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

    # How the streak evaluator scored this day, once finalized:
    # 'qualifying' | 'grace' | 'freeze' | 'break' | 'missed'.
    #
    # NULL means "not yet finalized" — which is ALWAYS the case for today, and
    # is the case for any past day sync has not walked yet. A NULL on a past
    # day must never be read as "did not qualify".
    #
    # This is a cache of a pure computation over *prior* days, so correcting
    # any past active_seconds invalidates every later value. The repair is
    # `python -m app.commands.recompute_streaks`; treat active_seconds as
    # append-only in normal operation.
    day_status: Mapped[str | None] = mapped_column(String(12), nullable=True)

    # Relationships
    student = relationship("User", foreign_keys=[student_id])
