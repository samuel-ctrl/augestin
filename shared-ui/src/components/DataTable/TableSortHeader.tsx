import React from "react";

interface TableSortHeaderProps {
  label: string;
  column: string;
  currentSortBy: string;
  currentSortOrder: "asc" | "desc";
  sortable?: boolean;
  onToggleSort: (column: string) => void;
  width?: string;
}

export function TableSortHeader({
  label,
  column,
  currentSortBy,
  currentSortOrder,
  sortable = true,
  onToggleSort,
  width,
}: TableSortHeaderProps) {
  const isActive = currentSortBy === column;

  if (!sortable) {
    return (
      <th
        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
        style={width ? { width } : undefined}
      >
        {label}
      </th>
    );
  }

  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
      style={width ? { width } : undefined}
      onClick={() => onToggleSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className="inline-flex flex-col text-[10px] leading-none">
          <span className={isActive && currentSortOrder === "asc" ? "text-primary-600" : "text-gray-300"}>
            ▲
          </span>
          <span className={isActive && currentSortOrder === "desc" ? "text-primary-600" : "text-gray-300"}>
            ▼
          </span>
        </span>
      </div>
    </th>
  );
}
