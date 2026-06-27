import uuid

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.audit import AuditBase


class QuizAttempt(AuditBase):
    __tablename__ = "quiz_attempts"
    __table_args__ = (
        Index("ix_quiz_attempt_student_topic", "student_id", "topic_id"),
        Index("ix_quiz_attempt_source", "quiz_source", "quiz_id", "student_id"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    quiz_source: Mapped[str] = mapped_column(String(20), nullable=False)  # "topic" | "quiz_set"
    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    topic_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("topics.id", ondelete="CASCADE"), nullable=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    selected_option: Mapped[str | None] = mapped_column(String(1), nullable=True)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    is_skipped: Mapped[bool] = mapped_column(Boolean, default=False)
    time_taken_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    level_at_attempt: Mapped[int] = mapped_column(Integer, default=1)

    # Relationships
    student = relationship("User")
    topic = relationship("Topic")
    question = relationship("Question")
