import { Flame, Snowflake, ShieldCheck } from "lucide-react";
import { AlertCard } from "@shared";
import { useStreak } from "../../context/StreakContext";
import type { DayStatus } from "../../context/StreakContext";

/**
 * The Home streak card.
 *
 * Two rules drive every choice here:
 *   * Once the goal is met the card says the student is DONE. Nothing on it
 *     rewards a bigger number, because the streak deliberately does not.
 *   * Nothing is ever framed as a loss. A broken streak shows the repair
 *     offer; a past best stays on display; bridged days read as "covered",
 *     not "failed".
 */

const DOT_CLASS: Record<DayStatus, string> = {
  qualifying: "bg-orange-500 border-orange-500",
  // Bridged days are teal, NOT red: the streak survived, and colouring them
  // like a failure would teach the opposite of what happened.
  grace: "bg-teal-300 border-teal-400 dark:bg-teal-700 dark:border-teal-600",
  freeze: "bg-sky-300 border-sky-400 dark:bg-sky-700 dark:border-sky-600",
  break: "bg-gray-300 border-gray-400 dark:bg-gray-600 dark:border-gray-500",
  missed: "bg-gray-100 border-gray-200 dark:bg-gray-700 dark:border-gray-600",
  today: "bg-white border-orange-400 border-dashed dark:bg-gray-800",
  // Predates the account or the feature — neutral, never a mark against them.
  untracked: "bg-transparent border-gray-200 dark:border-gray-700",
};

const DOT_LABEL: Record<DayStatus, string> = {
  qualifying: "Goal met",
  grace: "Rest day — streak kept",
  freeze: "Freeze used — streak kept",
  break: "Streak ended",
  missed: "No study",
  today: "Today",
  untracked: "Before tracking started",
};

function minutes(seconds: number) {
  return Math.floor(seconds / 60);
}

export default function StreakCard() {
  const { streak, loading } = useStreak();

  if (loading || !streak) return null;

  const {
    current_streak_days,
    longest_streak_days,
    active_seconds_today,
    goal_seconds,
    goal_met,
    typical_seconds,
    band,
    freezes,
    streak_tier,
    next_tier,
    at_risk,
    repair,
    recent,
  } = streak;

  const todayMin = minutes(active_seconds_today);
  const goalMin = minutes(goal_seconds);
  const pct = Math.min(100, Math.round((active_seconds_today / goal_seconds) * 100));

  const caption = goal_met
    ? "Today's goal is done. Go do something else!"
    : current_streak_days > 0
    ? `${goalMin - todayMin} min to keep your streak.`
    : `Study ${goalMin} minutes to start a streak.`;

  // Priority order matters: a live repair offer is the most actionable thing
  // on the card and must outrank the at-risk warning.
  //
  // Both branches check goal_met FIRST. `goal_met` is refreshed by the
  // once-a-minute usage poll, while `at_risk` and `repair` only move on a
  // sync — so without this the card would go on telling a student to do the
  // thirty minutes they finished an hour ago, which is exactly the
  // demoralising message this design exists to avoid.
  const alert = repair
    ? repair.secured || goal_met
      ? {
          variant: "success" as const,
          message: `Nice — that brings your ${repair.lost_streak}-day streak back to ${repair.restores_to} tomorrow.`,
        }
      : {
          variant: "warning" as const,
          message: `Your ${repair.lost_streak}-day streak just ended — but a ${goalMin}-minute session today brings it back to ${repair.restores_to}.`,
        }
    : at_risk && !goal_met && current_streak_days > 0
    ? {
        variant: "warning" as const,
        message: `You slipped yesterday. ${goalMin} minutes today keeps your ${current_streak_days}-day streak alive.`,
      }
    : null;

  return (
    <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/40">
            <Flame className="h-5 w-5 text-orange-500" />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
              {current_streak_days} day{current_streak_days === 1 ? "" : "s"} in a row
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{caption}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {streak_tier && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <ShieldCheck className="h-3 w-3" />
              {streak_tier}
            </span>
          )}
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
            Best: {longest_streak_days} day{longest_streak_days === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* Today's goal. Bar stops at 100% — there is deliberately nothing to
          gain by pushing past it. */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Today</span>
          <span>
            {todayMin} / {goalMin} min
            {band === "heavy" && (
              <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                heavy day
              </span>
            )}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-2 rounded-full transition-all ${goal_met ? "bg-green-500" : "bg-orange-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Last 14 days. */}
      <div className="mt-4 flex items-center gap-1">
        {recent.map((d) => (
          <span
            key={d.date}
            title={`${d.date} — ${DOT_LABEL[d.status]} (${minutes(d.active_seconds)} min)`}
            className={`h-6 flex-1 rounded border ${DOT_CLASS[d.status]}`}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
        {typical_seconds != null && <span>Your usual: ~{minutes(typical_seconds)} min/day</span>}
        {freezes > 0 && (
          <span className="inline-flex items-center gap-1">
            <Snowflake className="h-3 w-3 text-sky-500" />
            {freezes} freeze{freezes === 1 ? "" : "s"} banked
          </span>
        )}
        {next_tier && (
          <span>
            {next_tier.at_days - longest_streak_days} day
            {next_tier.at_days - longest_streak_days === 1 ? "" : "s"} to {next_tier.name}
          </span>
        )}
      </div>

      {alert && <AlertCard variant={alert.variant} message={alert.message} className="mt-4" />}
    </div>
  );
}
