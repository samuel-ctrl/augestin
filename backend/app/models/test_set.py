import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.audit import AuditBase


class TestSet(AuditBase):
    __tablename__ = "test_sets"
    __table_args__ = (
        Index("ix_test_sets_tutor_id", "tutor_id"),
    )

    tutor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    created_by_user = relationship("User", foreign_keys=[tutor_id])
    files = relationship("TestSetFile", back_populates="test_set", cascade="all, delete-orphan", lazy="selectin")
    assignments = relationship("TestSetAssignment", back_populates="test_set", cascade="all, delete-orphan", lazy="selectin")
    submissions = relationship("TestSetSubmission", back_populates="test_set", cascade="all, delete-orphan")


class TestSetFile(AuditBase):
    __tablename__ = "test_set_files"
    __table_args__ = (
        Index("ix_test_set_files_test_set_id", "test_set_id"),
    )

    test_set_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("test_sets.id", ondelete="CASCADE"), nullable=False
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    drive_link: Mapped[str] = mapped_column(Text, nullable=False)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    test_set = relationship("TestSet", back_populates="files")


class TestSetAssignment(AuditBase):
    __tablename__ = "test_set_assignments"
    __table_args__ = (
        UniqueConstraint("test_set_id", "student_id", name="uq_test_set_student"),
        Index("ix_test_set_assignment_test_set", "test_set_id"),
        Index("ix_test_set_assignment_student", "student_id"),
    )

    test_set_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("test_sets.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Relationships
    test_set = relationship("TestSet", back_populates="assignments")
    student = relationship("User")


class TestSetSubmission(AuditBase):
    __tablename__ = "test_set_submissions"
    __table_args__ = (
        UniqueConstraint("test_set_id", "student_id", name="uq_test_set_submission_student"),
        Index("ix_test_set_submission_test_set", "test_set_id"),
        Index("ix_test_set_submission_student", "student_id"),
    )

    test_set_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("test_sets.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    submission_link: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    test_set = relationship("TestSet", back_populates="submissions")
    student = relationship("User")
