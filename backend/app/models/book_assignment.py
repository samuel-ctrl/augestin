import uuid

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.audit import AuditBase


class BookAssignment(AuditBase):
    __tablename__ = "book_assignments"
    __table_args__ = (UniqueConstraint("book_id", "student_id", name="uq_book_student"),)

    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    assigned_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Relationships
    book = relationship("Book", back_populates="assignments")
    student = relationship("User", foreign_keys=[student_id], back_populates="assignments")
    assigner = relationship("User", foreign_keys=[assigned_by], back_populates="assigned_by_me")
