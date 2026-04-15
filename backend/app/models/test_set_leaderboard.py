import uuid

from sqlalchemy import ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.audit import AuditBase


class TestSetLeaderboardEntry(AuditBase):
    __tablename__ = "test_set_leaderboard_entries"
    __table_args__ = (
        UniqueConstraint(
            "test_set_id", "student_id", name="uq_test_set_leaderboard_student"
        ),
        Index("ix_test_set_leaderboard_test_set", "test_set_id", "rank"),
    )

    test_set_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("test_sets.id", ondelete="CASCADE"),
        nullable=False,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    score: Mapped[str] = mapped_column(String(50), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    student = relationship("User")
