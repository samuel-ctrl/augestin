import enum

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.audit import AuditBase


class UserType(str, enum.Enum):
    student = "student"
    tutor = "tutor"


class User(AuditBase):
    __tablename__ = "users"

    login_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    user_type: Mapped[UserType] = mapped_column(Enum(UserType), nullable=False)
    standard: Mapped[str | None] = mapped_column(String(10), nullable=True)
    section: Mapped[str | None] = mapped_column(String(5), nullable=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    assignments = relationship("BookAssignment", foreign_keys="BookAssignment.student_id", back_populates="student", cascade="all, delete-orphan")
    assigned_by_me = relationship("BookAssignment", foreign_keys="BookAssignment.assigned_by", back_populates="assigner", cascade="all, delete-orphan")
    watch_progress = relationship("WatchProgress", back_populates="student", cascade="all, delete-orphan")
