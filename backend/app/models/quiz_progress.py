import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.audit import AuditBase


class QuizProgress(AuditBase):
    __tablename__ = "quiz_progress"
    __table_args__ = (
        UniqueConstraint("student_id", "book_id", name="uq_student_book_quiz"),
        Index("ix_quiz_progress_student_book", "student_id", "book_id"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), nullable=False
    )
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    total_attempted: Mapped[int] = mapped_column(Integer, default=0)
    current_question_index: Mapped[int] = mapped_column(Integer, default=0)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    score_percentage: Mapped[float] = mapped_column(Float, default=0.0)
    total_time_seconds: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    student = relationship("User")
    book = relationship("Book", back_populates="quiz_progress")
