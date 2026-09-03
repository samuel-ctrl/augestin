import enum
from datetime import date

from sqlalchemy import Boolean, Date, Enum, Integer, String
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

    # --- Day Streak (students only) ---
    # On users rather than a 1:1 table because AuthMiddleware already loads
    # the whole User row per request, so reading these costs nothing extra.
    total_streaks_earned: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    # Monday of the last week evaluated for this student. Doubles as the
    # "tracking started here" marker: the marker's own week reports
    # week_status "not_tracked" rather than a computed status, so a signup
    # week (or, via migration 029's backfill, the feature's launch week)
    # is never scored against days that predate the account or the feature.
    last_finalized_week_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_streak_warning_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Relationships
    assignments = relationship("BookAssignment", foreign_keys="BookAssignment.student_id", back_populates="student", cascade="all, delete-orphan")
    assigned_by_me = relationship("BookAssignment", foreign_keys="BookAssignment.assigned_by", back_populates="assigner", cascade="all, delete-orphan")
    watch_progress = relationship("WatchProgress", back_populates="student", cascade="all, delete-orphan")
