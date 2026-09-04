from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class UsageIn(BaseModel):
    """Measured engaged time since the client's last successful poll.

    Bounded at the schema so a malformed or hostile client cannot hand the
    clamp arithmetic a negative, a float, or 10^9. The server clamps again
    against real elapsed wall-clock — this is only the outer guard rail.
    """

    engaged_seconds: int = Field(ge=0, le=120)


class UsageOut(BaseModel):
    active_seconds_today: int
    goal_seconds: int
    goal_met: bool
    typical_seconds: int | None
    band: Literal["light", "on_track", "heavy"]
    heavy_day_seconds: int
    # False when the poll landed inside the dedup gap, lost a compare-and-swap
    # to another tab, or claimed more than wall-clock allows — no credit given.
    counted: bool


class TierOut(BaseModel):
    name: str
    at_days: int


class RepairOut(BaseModel):
    """A recently broken streak that one qualifying day would restore."""

    restores_to: int
    expires_on: date
    lost_streak: int
    # True once today's goal is met: the repair is earned and will apply at
    # tonight's finalize. The card must switch from "do this" to "done" —
    # never keep asking for work the student has already completed.
    secured: bool = False


class RecentDay(BaseModel):
    date: date
    active_seconds: int
    # "untracked" predates the student's tracking start (the account or the
    # feature did not exist) and must render neutral, never as a missed day.
    status: Literal["qualifying", "grace", "freeze", "break", "missed", "today", "untracked"]


class StreakStateOut(BaseModel):
    current_streak_days: int
    longest_streak_days: int

    active_seconds_today: int
    goal_seconds: int
    goal_met: bool
    # None until the student has at least one day of >= 5 minutes in the
    # trailing window. Render "not enough data yet", never 0.
    typical_seconds: int | None
    band: Literal["light", "on_track", "heavy"]
    heavy_day_seconds: int

    freezes: int
    # Qualifying days still needed to bank the next freeze; 0 when capped.
    freezes_to_next: int

    streak_tier: str | None
    next_tier: TierOut | None

    at_risk: bool
    repair: RepairOut | None

    # Oldest..today, 14 entries.
    recent: list[RecentDay]
    tracking_since: date
