import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.audit import AuditBase


class Book(AuditBase):
    __tablename__ = "books"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String, nullable=True)
    standard: Mapped[str] = mapped_column(String(10), nullable=False)
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False
    )

    # Relationships
    subject = relationship("Subject", back_populates="books")
    assignments = relationship("BookAssignment", back_populates="book", cascade="all, delete-orphan")
    topics = relationship("Topic", back_populates="book", cascade="all, delete-orphan", order_by="Topic.position")
    test = relationship("BookTest", back_populates="book", cascade="all, delete-orphan", uselist=False)
    doubts = relationship("Doubt", back_populates="book")
