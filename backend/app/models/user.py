import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserType(str, enum.Enum):
    student = "student"
    tutor = "tutor"


VALID_STANDARDS = [str(i) for i in range(1, 13)]


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    login_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    user_type: Mapped[UserType] = mapped_column(Enum(UserType), nullable=False)
    standard: Mapped[str | None] = mapped_column(String(10), nullable=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    created_subjects = relationship("Subject", back_populates="creator", cascade="all, delete-orphan")
    created_books = relationship("Book", back_populates="creator", cascade="all, delete-orphan")
    assignments = relationship("BookAssignment", foreign_keys="BookAssignment.student_id", back_populates="student", cascade="all, delete-orphan")
    assigned_by_me = relationship("BookAssignment", foreign_keys="BookAssignment.assigned_by", back_populates="assigner", cascade="all, delete-orphan")
    watch_progress = relationship("WatchProgress", back_populates="student", cascade="all, delete-orphan")
