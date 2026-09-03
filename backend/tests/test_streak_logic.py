"""Pure streak rules + IST day math — no DB, no app."""

from datetime import date, datetime, timedelta, timezone

from app.services.streak import DAILY_TARGET_SECONDS, week_achieved, week_status
from app.utils.ist import IST, ist_date_of, week_end, week_start

HIT = DAILY_TARGET_SECONDS
MISS = 0


def pattern(spec: str) -> list[int]:
    """'YYNYYYY' -> seconds per day, Y = hit, N = miss. Padded to 7."""
    days = [HIT if c == "Y" else MISS for c in spec]
    return days + [MISS] * (7 - len(days))


class TestWeekAchieved:
    def test_all_days_hit(self):
        assert week_achieved(pattern("YYYYYYY")) is True

    def test_all_days_missed(self):
        assert week_achieved(pattern("NNNNNNN")) is False

    def test_single_isolated_miss_is_forgiven(self):
        # The client's own walkthrough case.
        assert week_achieved(pattern("YYNYYYY")) is True

    def test_two_consecutive_misses_break_the_week(self):
        # The client's second walkthrough case.
        assert week_achieved(pattern("YYNYNNY")) is False

    def test_four_isolated_misses_still_achieved(self):
        # Proves the rule is "consecutive", not "count". A count-based rule
        # would wrongly break this week.
        assert week_achieved(pattern("NYNYNYN")) is True

    def test_monday_only_miss(self):
        assert week_achieved(pattern("NYYYYYY")) is True

    def test_sunday_only_miss(self):
        assert week_achieved(pattern("YYYYYYN")) is True

    def test_exactly_target_counts(self):
        days = [DAILY_TARGET_SECONDS] * 7
        assert week_achieved(days) is True

    def test_one_second_short_does_not_count(self):
        days = [DAILY_TARGET_SECONDS] * 7
        days[2] = DAILY_TARGET_SECONDS - 1
        days[3] = DAILY_TARGET_SECONDS - 1
        assert week_achieved(days) is False

    def test_single_day_one_second_short_is_an_isolated_miss(self):
        days = [DAILY_TARGET_SECONDS] * 7
        days[2] = 3599
        assert week_achieved(days) is True


class TestWeekStatus:
    def test_monday_is_never_at_risk(self):
        assert week_status(pattern(""), 0) == "on_track"

    def test_yesterday_missed_is_at_risk(self):
        # ✗✓✗ on Thursday: 3 complete days, the last one a miss, no pair.
        assert week_status(pattern("NYN"), 3) == "at_risk"

    def test_consecutive_misses_is_broken(self):
        assert week_status(pattern("YNN"), 3) == "broken"

    def test_yesterday_hit_is_on_track(self):
        assert week_status(pattern("NYY"), 3) == "on_track"

    def test_future_days_are_ignored(self):
        # Wednesday: only Mon+Tue count, so the empty Wed..Sun tail must not
        # register as a run of misses.
        assert week_status(pattern("YY"), 2) == "on_track"

    def test_broken_wins_over_at_risk(self):
        assert week_status(pattern("YNNN"), 4) == "broken"

    def test_finalize_tolerates_trailing_lone_miss(self):
        # At days_elapsed=7 a lone Sunday miss reports at_risk, which is
        # harmless because week_achieved only tests != "broken".
        assert week_status(pattern("YYYYYYN"), 7) == "at_risk"
        assert week_achieved(pattern("YYYYYYN")) is True


class TestIst:
    def test_offset_is_fixed_five_thirty(self):
        assert IST.utcoffset(None) == timedelta(hours=5, minutes=30)

    def test_just_before_ist_midnight(self):
        # 18:29Z on Sep 2 is 23:59 IST, still Sep 2.
        dt = datetime(2026, 9, 2, 18, 29, tzinfo=timezone.utc)
        assert ist_date_of(dt) == date(2026, 9, 2)

    def test_just_after_ist_midnight(self):
        # 18:30Z on Sep 2 is 00:00 IST on Sep 3.
        dt = datetime(2026, 9, 2, 18, 30, tzinfo=timezone.utc)
        assert ist_date_of(dt) == date(2026, 9, 3)

    def test_naive_datetime_is_treated_as_utc(self):
        # Not as the local system clock, which astimezone() would assume —
        # the repo already has a naive datetime.utcnow() fixture.
        naive = datetime(2026, 9, 2, 18, 30)
        aware = datetime(2026, 9, 2, 18, 30, tzinfo=timezone.utc)
        assert ist_date_of(naive) == ist_date_of(aware) == date(2026, 9, 3)

    def test_week_start_is_monday(self):
        # 2026-09-03 is a Thursday.
        assert week_start(date(2026, 9, 3)) == date(2026, 8, 31)

    def test_week_start_of_a_monday_is_itself(self):
        assert week_start(date(2026, 8, 31)) == date(2026, 8, 31)

    def test_week_start_of_a_sunday(self):
        assert week_start(date(2026, 9, 6)) == date(2026, 8, 31)

    def test_week_end_is_sunday(self):
        assert week_end(date(2026, 9, 3)) == date(2026, 9, 6)
