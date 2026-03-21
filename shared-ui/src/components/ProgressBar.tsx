import React from "react";

interface ProgressBarProps {
  percentage: number;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function ProgressBar({ percentage, showLabel = true, size = "md" }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percentage));

  const barColor =
    clamped >= 90 ? "bg-green-500" : clamped > 0 ? "bg-primary-500" : "bg-gray-300";

  const heightClass = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 bg-gray-200 rounded-full ${heightClass} overflow-hidden`}>
        <div
          className={`${barColor} ${heightClass} rounded-full transition-all duration-300`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-500 w-10 text-right shrink-0">
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
}
