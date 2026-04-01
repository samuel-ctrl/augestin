import uuid

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.audit import AuditBase


class Doubt(AuditBase):
    __tablename__ = "doubts"
    __table_args__ = (
        Index("ix_doubts_student_id", "student_id"),
        Index("ix_doubts_book_id", "book_id"),
        Index("ix_doubts_status", "status"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    book_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")

    # Relationships
    student = relationship("User")
    book = relationship("Book", back_populates="doubts")
    comments = relationship("DoubtComment", back_populates="doubt", cascade="all, delete-orphan", lazy="selectin")


class DoubtComment(AuditBase):
    __tablename__ = "doubt_comments"
    __table_args__ = (
        Index("ix_doubt_comments_doubt_id", "doubt_id"),
        Index("ix_doubt_comments_user_id", "user_id"),
    )

    doubt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("doubts.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationships
    doubt = relationship("Doubt", back_populates="comments")
    user = relationship("User")
