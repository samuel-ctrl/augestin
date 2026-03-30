import uuid

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.audit import AuditBase


class QuizSet(AuditBase):
    __tablename__ = "quiz_sets"
    __table_args__ = (
        Index("ix_quiz_sets_subject_id", "subject_id"),
        Index("ix_quiz_sets_tutor_id", "tutor_id"),
    )

    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False
    )
    tutor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    subject = relationship("Subject")
    created_by_user = relationship("User", foreign_keys=[tutor_id])
    questions = relationship("Question", back_populates="quiz_set", cascade="all, delete-orphan")
    assignments = relationship("QuizSetAssignment", back_populates="quiz_set", cascade="all, delete-orphan")
