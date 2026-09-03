import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import api from "../api/client";

export type WeekStatus = "not_tracked" | "on_track" | "at_risk" | "broken";

export interface StreakState {
  total_streaks_earned: number;
  active_seconds_today: number;
  target_seconds: number;
  week_start: string;
  week_status: WeekStatus;
  /** Seconds per day, Mon..Sun. Entries past today are 0. */
  days: number[];
  /** Complete days so far this week — on Friday this is 4. */
  days_elapsed: number;
  weeks_finalized: number;
}

interface StreakContextType {
  streak: StreakState | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const StreakContext = createContext<StreakContextType | null>(null);

const HEARTBEAT_MS = 5 * 60 * 1000;
/** Don't re-sync on every tab-switch — only if it's been a while. */
const RESYNC_THROTTLE_MS = 5 * 60 * 1000;

export function StreakProvider({ children }: { children: ReactNode }) {
  const [streak, setStreak] = useState<StreakState | null>(null);
  const [loading, setLoading] = useState(true);
  const lastSyncRef = useRef(0);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const { data } = await api.post<StreakState>("/streak/sync");
      setStreak(data);
      lastSyncRef.current = Date.now();
    } catch {
      // Non-fatal — the card keeps its previous state. A 401 has already
      // been turned into a redirect by the axios interceptor.
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // A long-lived tab would otherwise never re-sync: this app has no polling
  // anywhere, and the sibling unread-count fetch in App.tsx is mount-only.
  // A student who leaves a tab open across an IST midnight (a shared school
  // machine, a laptop that's never closed) would get no warning and no
  // congratulations at all. Re-sync when the tab regains focus instead.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastSyncRef.current < RESYNC_THROTTLE_MS) return;
      refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [refresh]);

  // Heartbeat. Gated ONLY on tab visibility — deliberately not on mouse or
  // keyboard interaction, which would systematically undercount passive
  // video-watching, this platform's core use case and exactly the behaviour
  // the streak is meant to encourage.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const beat = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const { data } = await api.post<{
          active_seconds_today: number;
          target_seconds: number;
          counted: boolean;
        }>("/streak/heartbeat");
        if (!data.counted) return;
        setStreak((prev) => {
          if (!prev) return prev;
          const days = [...prev.days];
          days[prev.days_elapsed] = data.active_seconds_today;
          return { ...prev, active_seconds_today: data.active_seconds_today, days };
        });
      } catch {
        // Stop on the FIRST non-2xx and don't restart until the next app
        // load. A 401 hard-navigates to /session-expired, which would tear
        // the interval down anyway, but this cleanup must be correct on its
        // own merits rather than relying on that reload as a safety net.
        stop();
      }
    };

    timer = setInterval(beat, HEARTBEAT_MS);
    return stop;
  }, []);

  return (
    <StreakContext.Provider value={{ streak, loading, refresh }}>
      {children}
    </StreakContext.Provider>
  );
}

export function useStreak() {
  const ctx = useContext(StreakContext);
  if (!ctx) throw new Error("useStreak must be used within StreakProvider");
  return ctx;
}
