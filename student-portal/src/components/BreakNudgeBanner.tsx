import { Coffee, X } from "lucide-react";

/**
 * The two-hour nudge. Soft by design — dismissible, never blocking.
 *
 * A student may have a genuine reason to keep going (an exam tomorrow, a
 * deadline), and locking them out would be the app overriding a judgement it
 * is not in a position to make. It re-offers itself every 30 minutes instead.
 *
 * The copy congratulates and then suggests. It never implies the student has
 * done something wrong by studying.
 */
export default function BreakNudgeBanner({
  minutesToday,
  onDismiss,
}: {
  minutesToday: number;
  onDismiss: () => void;
}) {
  const hours = Math.floor(minutesToday / 60);
  const mins = minutesToday % 60;
  const spent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm sm:p-0"
    >
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-lg dark:border-amber-800 dark:bg-amber-900/40">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-800/60">
          <Coffee className="h-4 w-4 text-amber-600 dark:text-amber-300" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            That's {spent} of studying today
          </p>
          <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-200/90">
            Great effort. Your eyes and your focus will thank you for a proper break — go outside,
            move around, come back later.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss break reminder"
          className="-mr-1 -mt-1 shrink-0 rounded p-1 text-amber-500 hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-800/60 dark:hover:text-amber-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
