import uuid

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.audit import AuditBase


class Topic(AuditBase):
    __tablename__ = "topics"
    __table_args__ = (
        Index("ix_topics_book_id", "book_id"),
        Index("ix_topics_book_position", "book_id", "position"),
    )

    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    video_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    book = relationship("Book", back_populates="topics")
    notes = relationship("TopicNotes", back_populates="topic", cascade="all, delete-orphan", uselist=False)
    questions = relationship("Question", back_populates="topic", cascade="all, delete-orphan")
    watch_progress = relationship("WatchProgress", back_populates="topic", cascade="all, delete-orphan")
    quiz_progress = relationship("QuizProgress", back_populates="topic", cascade="all, delete-orphan")
