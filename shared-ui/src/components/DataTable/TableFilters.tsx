import React from "react";
import type { FilterDef } from "../../types";

interface TableFiltersProps {
  filters: FilterDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function TableFilters({ filters, values, onChange }: TableFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <select
          key={filter.key}
          value={values[filter.key] || ""}
          onChange={(e) => onChange(filter.key, e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">{filter.label}</option>
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}
