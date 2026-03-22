import React from "react";
import type {
  PaginatedResponse,
  TableQueryParams,
  ColumnDef,
  FilterDef,
} from "../../types";
import { useServerTable } from "../../hooks/useServerTable";
import { TableSearch } from "./TableSearch";
import { TableFilters } from "./TableFilters";
import { TableSortHeader } from "./TableSortHeader";
import { TablePagination } from "./TablePagination";
import { LoadingSpinner } from "../LoadingSpinner";

interface DataTableProps<T> {
  fetchFn: (params: TableQueryParams) => Promise<PaginatedResponse<T>>;
  columns: ColumnDef<T>[];
  searchPlaceholder?: string;
  filters?: FilterDef[];
  defaultSortBy?: string;
  defaultSortOrder?: "asc" | "desc";
  defaultPageSize?: number;
  onRowClick?: (row: T) => void;
  actions?: (row: T) => React.ReactNode;
  rowKey?: (row: T) => string;
}

export function DataTable<T>({
  fetchFn,
  columns,
  searchPlaceholder,
  filters: filterDefs,
  defaultSortBy,
  defaultSortOrder,
  defaultPageSize,
  onRowClick,
  actions,
  rowKey,
}: DataTableProps<T>) {
  const {
    data,
    loading,
    error,
    pagination,
    search,
    sortBy,
    sortOrder,
    filters,
    handlers,
  } = useServerTable<T>({
    fetchFn,
    defaultSortBy,
    defaultSortOrder,
    defaultPageSize,
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200">
        <div className="flex-1 max-w-sm">
          <TableSearch
            value={search}
            onChange={handlers.setSearch}
            placeholder={searchPlaceholder}
          />
        </div>
        {filterDefs && filterDefs.length > 0 && (
          <TableFilters
            filters={filterDefs}
            values={filters}
            onChange={handlers.setFilter}
          />
        )}
      </div>

      {/* Table */}
      <div className="overflow-visible">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <TableSortHeader
                  key={col.key}
                  label={col.label}
                  column={col.key}
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  sortable={col.sortable !== false}
                  onToggleSort={handlers.toggleSort}
                  width={col.width}
                />
              ))}
              {actions && (
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-4 py-12 text-center"
                >
                  <LoadingSpinner />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-4 py-12 text-center text-red-500"
                >
                  {error}
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-4 py-12 text-center text-gray-400"
                >
                  No results found
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={rowKey ? rowKey(row) : idx}
                  className={`${
                    onRowClick
                      ? "cursor-pointer hover:bg-gray-50"
                      : ""
                  }`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => {
                    const value = (row as Record<string, unknown>)[col.key];
                    return (
                      <td
                        key={col.key}
                        className="px-4 py-3 text-sm text-gray-700"
                        style={col.width ? { width: col.width } : undefined}
                      >
                        {col.render ? col.render(value, row) : String(value ?? "—")}
                      </td>
                    );
                  })}
                  {actions && (
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <TablePagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pagination.total}
        totalPages={pagination.totalPages}
        onPageChange={handlers.setPage}
        onPageSizeChange={handlers.setPageSize}
      />
    </div>
  );
}
