from datetime import date
from typing import Literal

from pydantic import BaseModel


class HeartbeatOut(BaseModel):
    active_seconds_today: int
    target_seconds: int
    # False when the beat landed inside the dedup gap (a second tab, or a
    # client beating faster than it should) — no credit was given.
    counted: bool


class StreakStateOut(BaseModel):
    total_streaks_earned: int
    active_seconds_today: int
    target_seconds: int
    week_start: date
    # "not_tracked" is the marker's own week — a new signup's first partial
    # week, or a pre-existing student's launch week. Neutral by design: its
    # leading days are zero because nothing was tracked yet, not missed.
    week_status: Literal["not_tracked", "on_track", "at_risk", "broken"]
    # Seconds per day, Mon..Sun. Entries past today are 0.
    days: list[int]
    # Complete days so far this week — today.weekday(). On Friday this is 4
    # (Mon-Thu are complete); today itself is still in progress.
    days_elapsed: int
    # Weeks caught up by this call. 0 on a repeat call the same day.
    weeks_finalized: int
