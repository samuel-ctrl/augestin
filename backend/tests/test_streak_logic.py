"""Pure streak rules + IST day math — no DB, no app."""

from datetime import date, datetime, timedelta, timezone

from app.services.streak import (
    DAILY_GOAL_SECONDS,
    FREEZE_EVERY_N_QUALIFYING,
    HEAVY_DAY_SECONDS,
    MAX_FREEZES,
    MIN_PRESENT_SECONDS,
    REPAIR_WINDOW_DAYS,
    StreakState,
    advance_day,
    expire_repair,
    next_tier,
    tier_for,
    typical_seconds,
    usage_band,
    walk_days,
)
from app.utils.ist import IST, ist_date_of

D0 = date(2026, 9, 7)  # a Monday
HIT = DAILY_GOAL_SECONDS
SHORT = DAILY_GOAL_SECONDS - 1
ZERO = 0


def day(n: int) -> date:
    return D0 + timedelta(days=n)


def run(spec: str, state: StreakState | None = None) -> tuple[StreakState, list]:
    """Walk a pattern from D0. 'Q' = qualifying, 's' = short, '.' = absent."""
    seconds = {"Q": HIT, "s": SHORT, ".": ZERO}
    st = state or StreakState()
    outcomes = [advance_day(st, day(i), seconds[c]) for i, c in enumerate(spec)]
    return st, outcomes


def statuses(spec: str, state: StreakState | None = None) -> list[str]:
    _, outcomes = run(spec, state)
    return [o.status for o in outcomes]


class TestQualifying:
    def test_exactly_the_goal_qualifies(self):
        st, _ = run("Q")
        assert st.current == 1

    def test_one_second_short_does_not(self):
        st, out = run("s")
        assert st.current == 0
        # Nothing to protect yet, so it is not a break — just a missed day.
        assert out[0].status == "missed"

    def test_time_beyond_the_goal_earns_nothing_extra(self):
        modest = StreakState()
        advance_day(modest, day(0), DAILY_GOAL_SECONDS)
        grinder = StreakState()
        advance_day(grinder, day(0), DAILY_GOAL_SECONDS * 8)
        assert modest.current == grinder.current == 1

    def test_consecutive_days_accumulate(self):
        st, _ = run("QQQQQ")
        assert st.current == 5
        assert st.longest == 5


class TestGraceDay:
    def test_the_client_walkthrough(self):
        # Day 1 hit, day 2 hit, day 3 below goal (held at 2), day 4 hit -> 3.
        st, out = run("QQsQ")
        assert [o.status for o in out] == ["qualifying", "qualifying", "grace", "qualifying"]
        assert st.current == 3

    def test_an_absent_day_is_bridged_the_same_as_a_short_one(self):
        assert statuses("QQ.Q") == statuses("QQsQ")

    def test_grace_holds_the_streak_rather_than_advancing_it(self):
        st, _ = run("QQs")
        assert st.current == 2

    def test_grace_regenerates_after_a_qualifying_day(self):
        # Two isolated slips, each preceded by a qualifying day, is fine.
        st, out = run("QsQsQ")
        assert [o.status for o in out] == ["qualifying", "grace", "qualifying", "grace", "qualifying"]
        assert st.current == 3

    def test_grace_needs_yesterday_to_have_qualified(self):
        # Without a freeze banked, a second consecutive slip breaks.
        st, out = run("Qss")
        assert out[2].status == "break"
        assert st.current == 0

    def test_no_grace_burned_when_there_is_no_streak(self):
        st, out = run("s")
        assert out[0].status == "missed"
        assert st.grace_used_on is None


class TestFreezes:
    def test_earned_on_the_seventh_qualifying_day(self):
        st, _ = run("Q" * (FREEZE_EVERY_N_QUALIFYING - 1))
        assert st.freezes == 0
        st, _ = run("Q" * FREEZE_EVERY_N_QUALIFYING)
        assert st.freezes == 1

    def test_capped(self):
        st, _ = run("Q" * (FREEZE_EVERY_N_QUALIFYING * (MAX_FREEZES + 2)))
        assert st.freezes == MAX_FREEZES

    def test_grace_is_spent_before_a_freeze(self):
        # A one-day wobble must not cost a hard-earned freeze.
        st, out = run("Q" * 7 + "s")
        assert out[-1].status == "grace"
        assert st.freezes == 1

    def test_a_weekend_costs_one_freeze_and_the_grace_day(self):
        # Mon..Fri qualifying (with a freeze already banked), Sat+Sun off.
        st = StreakState(current=10, longest=10, freezes=1, last_qualifying_date=day(-1))
        _, out = run("..", st)
        assert [o.status for o in out] == ["grace", "freeze"]
        assert st.current == 10
        assert st.freezes == 0

    def test_freeze_earned_mid_walk_is_available_to_a_later_gap(self):
        # The freeze banked on day 7 must be spendable on day 9 — which only
        # holds if the walk applies days in strict date order.
        st, out = run("Q" * 7 + "..")
        assert [o.status for o in out[-2:]] == ["grace", "freeze"]
        assert st.current == 7

    def test_break_once_grace_and_freezes_are_gone(self):
        st, out = run("Q" * 7 + "...")
        assert [o.status for o in out[-3:]] == ["grace", "freeze", "break"]
        assert st.current == 0


class TestBreakAndRepair:
    def test_break_records_what_was_lost(self):
        st, _ = run("QQQss")
        assert st.current == 0
        assert st.pre_break_days == 3
        assert st.break_at == day(4)

    def test_repair_restores_the_streak_plus_the_new_day(self):
        st, out = run("QQQssQ")
        assert out[-1].repaired is True
        assert st.current == 4  # 3 restored + today
        assert st.longest == 4

    def test_repair_expires_after_the_window(self):
        spec = "QQQss" + "." * (REPAIR_WINDOW_DAYS + 1) + "Q"
        st, out = run(spec)
        assert out[-1].repaired is False
        assert st.current == 1

    def test_repair_is_consumed_once(self):
        st, _ = run("QQQssQ")
        assert st.break_at is None
        assert st.pre_break_days == 0

    def test_expire_repair_clears_a_stale_offer(self):
        st, _ = run("QQQss")
        expire_repair(st, day(4) + timedelta(days=REPAIR_WINDOW_DAYS + 1))
        assert st.break_at is None

    def test_expire_repair_keeps_a_live_offer(self):
        st, _ = run("QQQss")
        expire_repair(st, day(4) + timedelta(days=REPAIR_WINDOW_DAYS))
        assert st.break_at == day(4)

    def test_longest_never_decreases_on_a_break(self):
        st, _ = run("Q" * 10 + "...")
        assert st.current == 0
        assert st.longest == 10

    def test_current_never_goes_negative(self):
        st, _ = run("." * 30)
        assert st.current == 0


class TestTiers:
    def test_thresholds(self):
        assert tier_for(6) is None
        assert tier_for(7) == "Bronze"
        assert tier_for(13) == "Bronze"
        assert tier_for(14) == "Silver"
        assert tier_for(30) == "Elite"
        assert tier_for(1000) == "Legend"

    def test_next_tier(self):
        assert next_tier(0) == (7, "Bronze")
        assert next_tier(7) == (14, "Silver")
        assert next_tier(400) is None

    def test_awarded_once_when_crossed(self):
        _, out = run("Q" * 8)
        reached = [o.tier_reached for o in out if o.tier_reached]
        assert reached == ["Bronze"]

    def test_not_re_awarded_after_a_break_and_re_climb(self):
        # Reach Silver, break hard, climb back past Bronze. The badge is held
        # off longest_streak_days, so nothing is revoked and nothing refires.
        st, _ = run("Q" * 14 + "." * 5)
        assert st.tier == "Silver"
        _, out = run("Q" * 8, st)
        assert [o.tier_reached for o in out if o.tier_reached] == []
        assert st.tier == "Silver"

    def test_one_walk_can_cross_several_tiers(self):
        _, out = run("Q" * 31)
        assert [o.tier_reached for o in out if o.tier_reached] == ["Bronze", "Silver", "Elite"]


class TestWalkDays:
    def test_walks_inclusive_and_in_order(self):
        st = StreakState()
        result = walk_days(st, {day(0): HIT, day(1): HIT, day(2): HIT}, day(0), day(2))
        assert [o.day for o in result.outcomes] == [day(0), day(1), day(2)]
        assert st.current == 3

    def test_missing_days_are_treated_as_zero(self):
        st = StreakState()
        walk_days(st, {day(0): HIT}, day(0), day(3))
        assert st.current == 0


class TestTypicalUsage:
    def test_none_without_data(self):
        assert typical_seconds({}, day(10)) is None

    def test_ignores_accidental_opens(self):
        seconds = {day(1): MIN_PRESENT_SECONDS - 1, day(2): 3600}
        assert typical_seconds(seconds, day(3)) == 3600

    def test_excludes_today(self):
        seconds = {day(1): 1800, day(2): 86400}
        assert typical_seconds(seconds, day(2)) == 1800

    def test_ignores_absent_days_rather_than_averaging_them_in(self):
        # Two study days of 1h each is "about an hour a day", not "17 minutes
        # a day" — absent days are not part of a typical *study* session.
        seconds = {day(1): 3600, day(5): 3600}
        assert typical_seconds(seconds, day(8)) == 3600

    def test_only_the_trailing_calendar_window(self):
        # A student returning from a long gap is described by recent
        # behaviour, not by stale behaviour from weeks ago.
        seconds = {day(0): 7200, day(29): 1800}
        assert typical_seconds(seconds, day(30)) == 1800


class TestUsageBand:
    def test_heavy_at_two_hours(self):
        assert usage_band(HEAVY_DAY_SECONDS, 1800) == "heavy"

    def test_heavy_regardless_of_a_high_typical(self):
        assert usage_band(HEAVY_DAY_SECONDS, HEAVY_DAY_SECONDS) == "heavy"

    def test_light_under_fifteen_minutes(self):
        assert usage_band(600, None) == "light"

    def test_light_relative_to_typical(self):
        assert usage_band(1200, 6000) == "light"

    def test_on_track(self):
        assert usage_band(1800, 1800) == "on_track"

    def test_no_typical_yet_still_classifies(self):
        assert usage_band(1800, None) == "on_track"


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
