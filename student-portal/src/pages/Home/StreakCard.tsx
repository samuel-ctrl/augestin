import { Flame } from "lucide-react";
import { AlertCard } from "@shared";
import { useStreak } from "../../context/StreakContext";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

type PipState = "hit" | "miss" | "today" | "future";

const PIP_CLASS: Record<PipState, string> = {
  hit: "bg-orange-500 text-white border-orange-500",
  miss: "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600",
  today: "bg-white dark:bg-gray-800 text-orange-600 dark:text-orange-400 border-orange-400 border-dashed",
  future: "bg-transparent text-gray-300 dark:text-gray-600 border-gray-200 dark:border-gray-700",
};

export default function StreakCard() {
  const { streak, loading } = useStreak();

  if (loading || !streak) return null;

  const { total_streaks_earned, active_seconds_today, target_seconds, days, days_elapsed, week_status } = streak;

  const minutesToday = Math.floor(active_seconds_today / 60);
  const targetMinutes = Math.round(target_seconds / 60);
  const pct = Math.min(100, Math.round((active_seconds_today / target_seconds) * 100));
  const goalMet = active_seconds_today >= target_seconds;

  const pipState = (i: number): PipState => {
    if (days[i] >= target_seconds) return "hit";
    if (i === days_elapsed) return "today";
    // In a not_tracked week a past day with no time isn't a miss — the
    // account (or the feature) didn't exist yet — so it stays neutral
    // rather than being marked against the student.
    if (i < days_elapsed) return week_status === "not_tracked" ? "future" : "miss";
    return "future";
  };

  // "not_tracked" is this student's first tracked week — a new signup, or
  // any student in the week the feature launched. Its leading days are zero
  // because nothing was tracked yet, not because anything was missed, so it
  // gets neutral encouragement and never a warning or danger state.
  const alert =
    week_status === "at_risk"
      ? { variant: "warning" as const, message: "You missed a day — reach 1 hour today to keep this week's streak alive." }
      : week_status === "broken"
      ? { variant: "danger" as const, message: "This week's streak is gone. A fresh week starts Monday — you've got this." }
      : null;

  const caption =
    week_status === "not_tracked"
      ? "Study 1 hour a day to start your first streak."
      : goalMet
      ? "Today's hour is done. Nice work."
      : `${targetMinutes - minutesToday} min to go today.`;

  return (
    <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="shrink-0 w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
            <Flame className="w-5 h-5 text-orange-500" />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">Day Streak</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{caption}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 leading-none">
            {total_streaks_earned}
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
            week{total_streaks_earned === 1 ? "" : "s"} earned
          </p>
        </div>
      </div>

      {/* Today's hour */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>Today</span>
          <span>
            {minutesToday} / {targetMinutes} min
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${goalMet ? "bg-green-500" : "bg-orange-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Mon..Sun pips */}
      <div className="mt-4 flex items-center gap-2">
        {DAY_LABELS.map((label, i) => (
          <span
            key={i}
            title={`${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}: ${Math.floor(days[i] / 60)} min`}
            className={`flex-1 h-7 rounded-md border text-[11px] font-medium flex items-center justify-center ${PIP_CLASS[pipState(i)]}`}
          >
            {label}
          </span>
        ))}
      </div>

      {alert && <AlertCard variant={alert.variant} message={alert.message} className="mt-4" />}
    </div>
  );
}
