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
    #
    # Everything here is a *cache* of a pure walk over student_daily_activity
    # (services/streak.py). It can always be rebuilt from those raw rows with
    # `python -m app.commands.recompute_streaks`, which is the sanctioned
    # repair whenever activity is corrected or the rules change.

    # The day tracking begins for this student: max(STREAK_TRACKING_EPOCH,
    # signup date). Days before it are neither scored nor rendered as missed —
    # they predate the account or the feature. This replaces the weekly
    # model's "not_tracked" sentinel week.
    streak_tracking_since: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Last day the evaluator has finalized. Never today — today is in progress.
    last_activity_finalized_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    current_streak_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    longest_streak_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    last_qualifying_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # The one free bridged gap since the last qualifying day (§3.3 grace day).
    streak_grace_used_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Banked freezes, 0..MAX_FREEZES. Earned every FREEZE_EVERY_N_QUALIFYING
    # qualifying days; auto-consumed to bridge a gap grace can't cover.
    streak_freezes: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    streak_freezes_progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    # Repair window: a streak that broke within REPAIR_WINDOW_DAYS is restored
    # to streak_pre_break_days + 1 by the next qualifying day.
    streak_break_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    streak_pre_break_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    # Highest tier longest_streak_days has ever reached. Never revoked.
    streak_tier: Mapped[str | None] = mapped_column(String(20), nullable=True)
    last_streak_warning_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Relationships
    assignments = relationship("BookAssignment", foreign_keys="BookAssignment.student_id", back_populates="student", cascade="all, delete-orphan")
    assigned_by_me = relationship("BookAssignment", foreign_keys="BookAssignment.assigned_by", back_populates="assigner", cascade="all, delete-orphan")
    watch_progress = relationship("WatchProgress", back_populates="student", cascade="all, delete-orphan")
