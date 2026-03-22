import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.audit import AuditBase


class WatchProgress(AuditBase):
    __tablename__ = "watch_progress"
    __table_args__ = (
        UniqueConstraint("student_id", "book_id", name="uq_student_book_progress"),
        Index("ix_watch_progress_student_last_watched", "student_id", "last_watched_at"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), nullable=False
    )
    watch_percentage: Mapped[float] = mapped_column(Float, default=0.0)
    last_position_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    last_watched_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    student = relationship("User", back_populates="watch_progress")
    book = relationship("Book", back_populates="watch_progress")
