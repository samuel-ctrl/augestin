"""IST day/week math — the single place this may live.

IST is a fixed UTC+05:30 offset with no DST (unchanged since 1945), so it is
expressed as a plain `timezone(timedelta(...))` constant rather than a
`zoneinfo.ZoneInfo`. That is deliberate, not a shortcut: the production image
is `python:3.11-slim`, which ships no `/usr/share/zoneinfo`, so building
`ZoneInfo("Asia/Kolkata")` at import time would kill boot on Render.
"""

from datetime import date, datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30), "IST")


def ist_now() -> datetime:
    """Current instant, expressed in IST."""
    return datetime.now(IST)


def ist_today() -> date:
    """Today's IST calendar date."""
    return ist_now().date()


def ist_date_of(dt: datetime) -> date:
    """IST calendar date of an instant.

    A naive `dt` is treated as UTC. Left to itself, `astimezone()` assumes a
    naive input is in the *local system clock's* timezone, which silently
    differs between a developer laptop, CI, and the production container.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST).date()


def week_start(d: date) -> date:
    """Monday of the week containing `d`."""
    return d - timedelta(days=d.weekday())


def week_end(d: date) -> date:
    """Sunday of the week containing `d`."""
    return week_start(d) + timedelta(days=6)
