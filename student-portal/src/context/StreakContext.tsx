import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import api from "../api/client";
import { useEngagement } from "./EngagementContext";

export type DayStatus =
  | "qualifying"
  | "grace"
  | "freeze"
  | "break"
  | "missed"
  | "today"
  | "untracked";

export type UsageBand = "light" | "on_track" | "heavy";

export interface RecentDay {
  date: string;
  active_seconds: number;
  status: DayStatus;
}

export interface StreakState {
  current_streak_days: number;
  longest_streak_days: number;

  active_seconds_today: number;
  goal_seconds: number;
  goal_met: boolean;
  /** null until there is enough history — render "—", never "0 min". */
  typical_seconds: number | null;
  band: UsageBand;
  heavy_day_seconds: number;

  freezes: number;
  freezes_to_next: number;

  streak_tier: string | null;
  next_tier: { name: string; at_days: number } | null;

  at_risk: boolean;
  repair: {
    restores_to: number;
    expires_on: string;
    lost_streak: number;
    /** True once today's goal is met — the repair is earned, pending finalize. */
    secured: boolean;
  } | null;

  recent: RecentDay[];
  tracking_since: string;
}

interface StreakContextType {
  streak: StreakState | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const StreakContext = createContext<StreakContextType | null>(null);

/** Matches POLL_CADENCE_SECONDS on the server. */
const POLL_MS = 60 * 1000;
/** Don't re-sync on every tab-switch — only if it's been a while. */
const RESYNC_THROTTLE_MS = 5 * 60 * 1000;

export function StreakProvider({ children }: { children: ReactNode }) {
  const [streak, setStreak] = useState<StreakState | null>(null);
  const [loading, setLoading] = useState(true);
  const lastSyncRef = useRef(0);
  const inFlightRef = useRef(false);
  const { drainPendingSeconds } = useEngagement();

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
  // anywhere else, and the sibling unread-count fetch in App.tsx is
  // mount-only. A student who leaves a tab open across an IST midnight (a
  // shared school machine, a laptop that's never closed) would get no
  // warning and no congratulations at all. Re-sync when the tab regains
  // focus instead.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastSyncRef.current < RESYNC_THROTTLE_MS) return;
      refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [refresh]);

  // Usage poll. Reports MEASURED engaged seconds drained from the engagement
  // clock — never a fixed credit, and never a timestamp, so client clock skew
  // is irrelevant and the server can clamp the claim against its own
  // wall-clock.
  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      if (stopped) return;
      const engaged_seconds = drainPendingSeconds();
      if (engaged_seconds <= 0) return; // nothing to report; don't wake the API
      try {
        const { data } = await api.post<{
          active_seconds_today: number;
          goal_seconds: number;
          goal_met: boolean;
          typical_seconds: number | null;
          band: UsageBand;
          counted: boolean;
        }>("/streak/usage", { engaged_seconds });
        if (!data.counted) return;
        setStreak((prev) =>
          prev
            ? {
                ...prev,
                active_seconds_today: data.active_seconds_today,
                goal_met: data.goal_met,
                typical_seconds: data.typical_seconds,
                band: data.band,
              }
            : prev
        );
      } catch {
        // Stop on the FIRST non-2xx and don't restart until the next app
        // load. A 401 hard-navigates to /session-expired, which would tear
        // the interval down anyway, but this cleanup must be correct on its
        // own merits rather than relying on that reload as a safety net.
        stopped = true;
      }
    };

    const timer = setInterval(poll, POLL_MS);

    // Flush on the way out so the last partial minute is not lost.
    //
    // `fetch(..., { keepalive: true })`, deliberately NOT `sendBeacon`:
    // sendBeacon cannot set headers, and this API authenticates with a bearer
    // token from localStorage, so every beacon would be a guaranteed 401 —
    // silently, since nothing reads a beacon's response. keepalive gives the
    // same survives-page-teardown behaviour with headers intact.
    const flush = () => {
      if (stopped || document.visibilityState === "visible") return;
      const engaged_seconds = drainPendingSeconds();
      if (engaged_seconds <= 0) return;
      const token = localStorage.getItem("token");
      if (!token) return;
      fetch(`${api.defaults.baseURL ?? ""}/streak/usage`, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ engaged_seconds }),
      }).catch(() => {
        // Teardown-time failure; the seconds are simply lost. Never surface.
      });
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [drainPendingSeconds]);

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
