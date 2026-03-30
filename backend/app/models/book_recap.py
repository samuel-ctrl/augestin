import uuid

from sqlalchemy import ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.audit import AuditBase


class BookRecap(AuditBase):
    __tablename__ = "book_recaps"
    __table_args__ = (
        Index("ix_book_recaps_book_id", "book_id"),
        Index("ix_book_recaps_author_id", "author_id"),
    )

    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Relationships
    book = relationship("Book")
    created_by_user = relationship("User", foreign_keys=[author_id])
