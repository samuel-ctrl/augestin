import uuid

from sqlalchemy import ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.audit import AuditBase


class QuizSetAssignment(AuditBase):
    __tablename__ = "quiz_set_assignments"
    __table_args__ = (
        UniqueConstraint("quiz_set_id", "student_id", name="uq_quiz_set_student"),
        Index("ix_quiz_set_assignment_quiz", "quiz_set_id"),
        Index("ix_quiz_set_assignment_student", "student_id"),
    )

    quiz_set_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quiz_sets.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Relationships
    quiz_set = relationship("QuizSet", back_populates="assignments")
    student = relationship("User")
