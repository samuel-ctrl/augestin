import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.audit import AuditBase


class Question(AuditBase):
    __tablename__ = "questions"
    __table_args__ = (
        CheckConstraint("correct_option IN ('A','B','C','D')", name="ck_question_correct_option"),
        CheckConstraint(
            "NOT (book_id IS NULL AND quiz_set_id IS NULL) AND "
            "NOT (book_id IS NOT NULL AND quiz_set_id IS NOT NULL)",
            name="ck_question_source_check"
        ),
        Index("ix_questions_book_id", "book_id"),
        Index("ix_questions_quiz_set_id", "quiz_set_id"),
    )

    book_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), nullable=True
    )
    quiz_set_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quiz_sets.id", ondelete="CASCADE"), nullable=True
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    option_a: Mapped[str] = mapped_column(Text, nullable=False)
    option_a_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    option_b: Mapped[str] = mapped_column(Text, nullable=False)
    option_b_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    option_c: Mapped[str] = mapped_column(Text, nullable=False)
    option_c_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    option_d: Mapped[str] = mapped_column(Text, nullable=False)
    option_d_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    correct_option: Mapped[str] = mapped_column(String(1), nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    time_limit_seconds: Mapped[int] = mapped_column(Integer, default=60)

    # Relationships
    book = relationship("Book", back_populates="questions")
    quiz_set = relationship("QuizSet", back_populates="questions")
