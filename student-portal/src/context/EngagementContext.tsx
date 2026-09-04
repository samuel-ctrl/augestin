import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * The single source of truth for "is this student actually using the app, and
 * for how long".
 *
 * Both the usage poll (StreakContext) and the wellbeing timers
 * (EngagementGuardProvider) read from here. It must not be implemented twice —
 * two clocks would drift apart and the eye break would fire at a different
 * moment than the streak thinks the student has been studying.
 *
 * All time is measured as `Date.now()` deltas rather than by counting interval
 * ticks: background tabs throttle `setInterval` to once a minute or less, so a
 * tick count would silently undercount, and a laptop resuming from sleep would
 * deliver one enormous tick.
 */

/** No input for this long and the student is idle — unless media is playing. */
const IDLE_AFTER_MS = 3 * 60_000;
/** Idle or hidden this long counts as a real break: the sitting timer resets. */
const BREAK_AFTER_MS = 5 * 60_000;
/**
 * A gap larger than this is a laptop sleeping, a frozen tab, or a paused
 * debugger — never real study. Discard it and treat it as a break, or a
 * student who closed the lid at lunch returns to a phantom three hours.
 */
const MAX_TICK_DELTA_MS = 120_000;
/**
 * Media playing with zero user input for this long stops earning credit. A
 * left-running playlist must not farm a perfect streak overnight, but a
 * student genuinely watching a 40-minute lecture must not be cut off either.
 */
const MEDIA_ONLY_GRACE_MS = 15 * 60_000;

const TICK_MS = 1_000;
/**
 * Fail-safe: if something pauses the clock and never resumes it — an eye-break
 * overlay that throws after `setPaused(true)`, say — usage tracking would die
 * silently for the rest of the session. Nothing should ever legitimately pause
 * for this long, so force it back on.
 */
const MAX_PAUSE_MS = 3 * 60_000;

const INPUT_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;

interface EngagementContextType {
  /**
   * True once the current sitting has run past the break threshold.
   *
   * A BOOLEAN, not a seconds counter, and that is the whole point: exposing
   * live seconds meant a setState on every tick, which re-rendered the entire
   * authenticated app sixty times a minute — brutal on the cheap Android
   * tablets most of these students are on. This flips at most once per break.
   */
  breakDue: boolean;
  /** Seconds of unbroken engagement before `breakDue` flips. */
  setBreakThresholdSeconds: (seconds: number) => void;
  /** Engaged seconds accumulated since the last drain, for the usage poll. */
  drainPendingSeconds: () => number;
  /** Called when a break is taken (eye break completed) or forced. */
  resetContinuous: () => void;
  /**
   * Stop the clock entirely. Used while the eye-break overlay is up — that
   * time is a break, not engagement, or the break would feed the streak it
   * exists to interrupt.
   */
  setPaused: (paused: boolean) => void;
  /**
   * Suppress wellbeing interruptions (not tracking) for a named reason.
   * A timed test or a live quiz must never be frozen by an overlay.
   */
  setSuppressed: (key: string, active: boolean) => void;
  suppressed: boolean;
}

const EngagementContext = createContext<EngagementContextType | null>(null);

function isMediaPlaying(): boolean {
  const els = document.querySelectorAll<HTMLMediaElement>("video, audio");
  for (const el of els) {
    if (!el.paused && !el.ended && el.readyState > 2) return true;
  }
  // Drive and YouTube lessons are cross-origin iframes, so their playback
  // state is invisible to us. A focused iframe is the best proxy available:
  // the student clicked into the player, which is exactly what watching a
  // lesson looks like from out here. Without this, passive video-watching —
  // this platform's core use case — would be scored as idle after 3 minutes.
  return document.activeElement?.tagName === "IFRAME";
}

export function EngagementProvider({ children }: { children: ReactNode }) {
  const [breakDue, setBreakDue] = useState(false);
  const [suppressedKeys, setSuppressedKeys] = useState<string[]>([]);

  const lastInputAt = useRef(Date.now());
  const lastTickAt = useRef(Date.now());
  const pendingMs = useRef(0);
  const continuousMs = useRef(0);
  const notEngagedMs = useRef(0);
  const mediaOnlyMs = useRef(0);
  const paused = useRef(false);
  const pausedMs = useRef(0);
  const breakThresholdMs = useRef(Number.POSITIVE_INFINITY);

  const breakDueRef = useRef(false);

  const resetContinuous = useCallback(() => {
    continuousMs.current = 0;
    breakDueRef.current = false;
    setBreakDue(false);
  }, []);

  const setBreakThresholdSeconds = useCallback((seconds: number) => {
    breakThresholdMs.current = seconds * 1000;
  }, []);

  const drainPendingSeconds = useCallback(() => {
    const seconds = Math.floor(pendingMs.current / 1000);
    pendingMs.current -= seconds * 1000;
    return seconds;
  }, []);

  const setPaused = useCallback((value: boolean) => {
    paused.current = value;
    pausedMs.current = 0;
    // Re-anchor so the paused span is never credited as one huge delta.
    lastTickAt.current = Date.now();
  }, []);

  const setSuppressed = useCallback((key: string, active: boolean) => {
    setSuppressedKeys((keys) => {
      const has = keys.includes(key);
      if (active === has) return keys;
      return active ? [...keys, key] : keys.filter((k) => k !== key);
    });
  }, []);

  // Input listeners. Passive and on the capture phase so a child calling
  // stopPropagation (menus, modals) cannot make a genuinely active student
  // look idle.
  useEffect(() => {
    const mark = () => {
      lastInputAt.current = Date.now();
    };
    for (const evt of INPUT_EVENTS) {
      window.addEventListener(evt, mark, { passive: true, capture: true });
    }
    return () => {
      for (const evt of INPUT_EVENTS) {
        window.removeEventListener(evt, mark, { capture: true } as EventListenerOptions);
      }
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const delta = now - lastTickAt.current;
      lastTickAt.current = now;

      if (delta > MAX_TICK_DELTA_MS) {
        // Sleep, freeze, or a suspended tab. Credit nothing and treat the
        // whole gap as a break.
        notEngagedMs.current = 0;
        mediaOnlyMs.current = 0;
        resetContinuous();
        return;
      }
      if (delta <= 0) return; // clock stepped backwards; ignore

      if (paused.current) {
        pausedMs.current += delta;
        if (pausedMs.current >= MAX_PAUSE_MS) {
          // Nothing legitimately pauses this long. Something failed to
          // resume us; fail open rather than stop tracking for the session.
          paused.current = false;
          pausedMs.current = 0;
        }
        return;
      }

      const visible = document.visibilityState === "visible";
      const recentInput = now - lastInputAt.current < IDLE_AFTER_MS;
      // Only pay for the DOM scan when input alone cannot explain engagement.
      const media = visible && !recentInput && isMediaPlaying();
      const engaged = visible && (recentInput || media);

      if (!engaged) {
        notEngagedMs.current += delta;
        mediaOnlyMs.current = 0;
        if (notEngagedMs.current >= BREAK_AFTER_MS && continuousMs.current > 0) {
          resetContinuous();
        }
        return;
      }

      notEngagedMs.current = 0;

      if (!recentInput) {
        // Engaged only because something is playing.
        mediaOnlyMs.current += delta;
        if (mediaOnlyMs.current >= MEDIA_ONLY_GRACE_MS) return; // stop crediting
      } else {
        mediaOnlyMs.current = 0;
      }

      pendingMs.current += delta;
      continuousMs.current += delta;

      // The ONLY setState on this path, and the ref guard means it fires
      // exactly once per sitting rather than every second thereafter.
      // Everything else lives in refs precisely so a per-second clock cannot
      // re-render the app.
      if (!breakDueRef.current && continuousMs.current >= breakThresholdMs.current) {
        breakDueRef.current = true;
        setBreakDue(true);
      }
    };

    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [resetContinuous]);

  const value = useMemo(
    () => ({
      breakDue,
      setBreakThresholdSeconds,
      drainPendingSeconds,
      resetContinuous,
      setPaused,
      setSuppressed,
      suppressed: suppressedKeys.length > 0,
    }),
    [
      breakDue,
      setBreakThresholdSeconds,
      drainPendingSeconds,
      resetContinuous,
      setPaused,
      setSuppressed,
      suppressedKeys,
    ]
  );

  return <EngagementContext.Provider value={value}>{children}</EngagementContext.Provider>;
}

export function useEngagement() {
  const ctx = useContext(EngagementContext);
  if (!ctx) throw new Error("useEngagement must be used within EngagementProvider");
  return ctx;
}

/**
 * Declare that this screen must not be interrupted by a wellbeing overlay.
 * Mount it in any timed assessment: freezing a student for 20 seconds while a
 * server-driven timer runs would corrupt their result.
 *
 * Tracking continues — only the interruption is held back, and it fires as
 * soon as the screen unmounts.
 */
export function useNoInterruptions(key: string, active = true) {
  const { setSuppressed } = useEngagement();
  useEffect(() => {
    setSuppressed(key, active);
    return () => setSuppressed(key, false);
  }, [key, active, setSuppressed]);
}
