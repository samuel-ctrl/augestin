import { Component, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import EyeBreakOverlay from "../components/EyeBreakOverlay";
import BreakNudgeBanner from "../components/BreakNudgeBanner";
import { useEngagement } from "./EngagementContext";
import { useStreak } from "./StreakContext";

/**
 * The wellbeing layer: a forced eye rest after a long unbroken sitting, and a
 * soft nudge once the day gets heavy.
 *
 * Everything here is a nudge, not a cage. It is wrapped in an error boundary
 * because a crash in a full-screen blocking overlay is the one bug in this
 * feature that could lock a student out of their own lessons — and the app
 * working without wellbeing prompts is strictly better than the app not
 * working.
 */

/** Unbroken engaged minutes before the first eye rest, then each next one. */
const EYE_BREAK_LADDER_SECONDS = [30 * 60, 45 * 60, 60 * 60];
/** Re-offer the daily break nudge every 30 min once dismissed. */
const NUDGE_REARM_MS = 30 * 60 * 1000;

function Guard({ children }: { children: ReactNode }) {
  const { breakDue, setBreakThresholdSeconds, resetContinuous, setPaused, suppressed } =
    useEngagement();
  const { streak } = useStreak();

  const [breakOpen, setBreakOpen] = useState(false);
  // State, not a ref: the threshold is derived from it, and a ref bump would
  // not re-run the effect that pushes the new threshold down to the clock.
  const [breaksTaken, setBreaksTaken] = useState(0);

  const [nudgeVisible, setNudgeVisible] = useState(false);
  const nudgeArmedAt = useRef(0);

  // Escalating ladder: 30 min, then 45, then 60. A fixed 30 would interrupt a
  // long revision session four times in two hours, which stops reading as
  // care and starts reading as nagging.
  useEffect(() => {
    setBreakThresholdSeconds(
      EYE_BREAK_LADDER_SECONDS[Math.min(breaksTaken, EYE_BREAK_LADDER_SECONDS.length - 1)]
    );
  }, [breaksTaken, setBreakThresholdSeconds]);

  // --- Eye break ---
  // `breakDue` latches on in the clock and is cleared only by resetContinuous,
  // so a break that comes due during a timed test simply waits here until the
  // suppression lifts. No separate queue state is needed.
  useEffect(() => {
    if (!breakDue || suppressed || breakOpen) return;
    setBreakOpen(true);
    // Stop the clock: the break is not study time, and crediting it would let
    // the interruption feed the very streak it exists to interrupt.
    setPaused(true);
  }, [breakDue, suppressed, breakOpen, setPaused]);

  // If this component ever unmounts mid-break (logout, a crash upstream), the
  // clock must not be left paused for the rest of the session. The provider
  // has its own timeout fail-safe too; belt and braces, because a stuck pause
  // silently stops all usage tracking.
  useEffect(() => () => setPaused(false), [setPaused]);

  const finishBreak = useCallback(() => {
    setBreaksTaken((n) => n + 1);
    setBreakOpen(false);
    setPaused(false);
    resetContinuous();
  }, [resetContinuous, setPaused]);

  // --- Daily heavy-usage nudge ---
  const heavy =
    streak != null && streak.active_seconds_today >= streak.heavy_day_seconds;

  useEffect(() => {
    if (!heavy || suppressed || breakOpen) return;
    if (nudgeVisible) return;
    if (nudgeArmedAt.current && Date.now() - nudgeArmedAt.current < NUDGE_REARM_MS) return;
    setNudgeVisible(true);
  }, [heavy, suppressed, breakOpen, nudgeVisible, streak?.active_seconds_today]);

  const dismissNudge = useCallback(() => {
    nudgeArmedAt.current = Date.now();
    setNudgeVisible(false);
  }, []);

  return (
    <>
      {children}
      {nudgeVisible && !breakOpen && (
        <BreakNudgeBanner
          minutesToday={Math.floor((streak?.active_seconds_today ?? 0) / 60)}
          onDismiss={dismissNudge}
        />
      )}
      {breakOpen && <EyeBreakOverlay onDone={finishBreak} />}
    </>
  );
}

interface BoundaryState {
  failed: boolean;
}

class GuardBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Deliberately console-only: there is no error-reporting channel in this
    // app, and the student must never see a wellbeing bug as an app failure.
    console.error("Engagement guard failed; wellbeing prompts disabled:", error);
  }

  render() {
    // On failure the app renders WITHOUT the guard. Losing the eye break is a
    // degraded experience; losing the app is a broken one.
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function EngagementGuardProvider({ children }: { children: ReactNode }) {
  return (
    <GuardBoundary fallback={<>{children}</>}>
      <Guard>{children}</Guard>
    </GuardBoundary>
  );
}
