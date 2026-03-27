import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.audit import AuditBase


class BookTest(AuditBase):
    __tablename__ = "book_tests"
    __table_args__ = (
        Index("ix_book_tests_book_id", "book_id"),
    )

    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"),
        nullable=False, unique=True
    )
    drive_link: Mapped[str] = mapped_column(Text, nullable=False)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    book = relationship("Book", back_populates="test")
    submissions = relationship("TestSubmission", back_populates="test", cascade="all, delete-orphan")


class TestSubmission(AuditBase):
    __tablename__ = "test_submissions"
    __table_args__ = (
        UniqueConstraint("test_id", "student_id", name="uq_test_student"),
        Index("ix_test_submissions_test_id", "test_id"),
        Index("ix_test_submissions_student_id", "student_id"),
    )

    test_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("book_tests.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    test = relationship("BookTest", back_populates="submissions")
    student = relationship("User")
