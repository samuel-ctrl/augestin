import type { ActivityOutcome } from "./types";

export function OutcomeBadge({ outcome }: { outcome: ActivityOutcome | null }) {
  if (!outcome) return <span className="text-gray-400">—</span>;

  const styles: Record<ActivityOutcome, string> = {
    success: "bg-green-50 text-green-700 border-green-200",
    client_error: "bg-amber-50 text-amber-700 border-amber-200",
    server_error: "bg-red-50 text-red-700 border-red-200",
    exception: "bg-red-100 text-red-800 border-red-300",
  };

  const labels: Record<ActivityOutcome, string> = {
    success: "Success",
    client_error: "Client error",
    server_error: "Server error",
    exception: "Exception",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${styles[outcome]}`}
    >
      {labels[outcome]}
    </span>
  );
}

export function ActorTypeBadge({ type }: { type: "tutor" | "student" | null }) {
  if (!type) return <span className="text-gray-400 text-xs">—</span>;
  const cls =
    type === "tutor"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-purple-50 text-purple-700 border-purple-200";
  const label = type === "tutor" ? "Tutor" : "Student";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${cls}`}>
      {label}
    </span>
  );
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
