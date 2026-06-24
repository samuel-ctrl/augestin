import type { LiveQuizLeaderboardEntry } from "../types";

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

interface LiveLeaderboardProps {
  entries: LiveQuizLeaderboardEntry[];
  currentUserId?: string;
  revealScores?: boolean;
  title?: string;
  emptyMessage?: string;
}

export function LiveLeaderboard({
  entries,
  currentUserId,
  revealScores = false,
  title = "Leaderboard",
  emptyMessage = "No players yet",
}: LiveLeaderboardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">{emptyMessage}</p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((e) => {
            const isMe = currentUserId && e.user_id === currentUserId;
            return (
              <li
                key={e.user_id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm ${
                  isMe ? "bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800" : "bg-gray-50 dark:bg-gray-700/50"
                }`}
              >
                <span className="w-6 text-xs font-semibold text-gray-600 dark:text-gray-300 text-center">
                  #{e.rank}
                </span>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    e.connected ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                  title={e.connected ? "Online" : "Disconnected"}
                />
                <span className="flex-1 truncate text-gray-800 dark:text-gray-200">
                  {e.name}
                  {isMe && <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">(you)</span>}
                </span>
                {revealScores && e.correct_count !== undefined && (
                  <span className="flex flex-col items-end">
                    <span className="text-xs font-mono text-gray-700 dark:text-gray-300">
                      {e.correct_count}/{e.total_questions ?? "?"}
                    </span>
                    {e.time_taken_seconds !== undefined && (
                      <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                        {formatDuration(e.time_taken_seconds)}
                      </span>
                    )}
                  </span>
                )}
                {!revealScores && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {e.answered_count} answered
                  </span>
                )}
                {e.finished && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-full">
                    done
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
