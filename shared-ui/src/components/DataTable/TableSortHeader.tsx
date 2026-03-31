import React from "react";

interface TableSortHeaderProps {
  label: string;
  column: string;
  currentSortBy: string;
  currentSortOrder: "asc" | "desc";
  sortable?: boolean;
  onToggleSort: (column: string) => void;
  width?: string;
  dark?: boolean;
}

export function TableSortHeader({
  label,
  column,
  currentSortBy,
  currentSortOrder,
  sortable = true,
  onToggleSort,
  width,
  dark = false,
}: TableSortHeaderProps) {
  const isActive = currentSortBy === column;
  const textClass = dark
    ? "text-white"
    : "text-gray-600";
  const hoverClass = dark
    ? "hover:text-gray-200"
    : "hover:text-gray-700";
  const arrowActive = dark ? "text-yellow-300" : "text-primary-600";
  const arrowInactive = dark ? "text-gray-400" : "text-gray-300";

  if (!sortable) {
    return (
      <th
        className={`px-4 py-3 text-left text-xs font-semibold ${textClass} uppercase tracking-wider`}
        style={width ? { width } : undefined}
      >
        {label}
      </th>
    );
  }

  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold ${textClass} uppercase tracking-wider cursor-pointer ${hoverClass} select-none`}
      style={width ? { width } : undefined}
      onClick={() => onToggleSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className="inline-flex flex-col text-[10px] leading-none">
          <span className={isActive && currentSortOrder === "asc" ? arrowActive : arrowInactive}>
            ▲
          </span>
          <span className={isActive && currentSortOrder === "desc" ? arrowActive : arrowInactive}>
            ▼
          </span>
        </span>
      </div>
    </th>
  );
}
