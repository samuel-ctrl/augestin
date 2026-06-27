import uuid

from sqlalchemy import ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.audit import AuditBase


class TopicNotes(AuditBase):
    __tablename__ = "topic_notes"
    __table_args__ = (
        Index("ix_topic_notes_topic_id", "topic_id"),
        Index("ix_topic_notes_author_id", "author_id"),
    )

    topic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Relationships
    topic = relationship("Topic", back_populates="notes")
    created_by_user = relationship("User", foreign_keys=[author_id])
